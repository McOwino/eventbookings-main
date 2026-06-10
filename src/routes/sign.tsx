import { useEffect, useRef, useState, useCallback } from "react";
import { createFileRoute } from "@tanstack/react-router";
import SignaturePad from "signature_pad";
import { toPng } from "html-to-image";
import { PDFDocument } from 'pdf-lib';
import { supabase } from "@/integrations/supabase/client";
import { buildContractHTML, fetchStampUrl, type ContractData } from "@/lib/contract-utils";
import { PublicSiteHeader } from "../components/public-site/PublicSiteHeader";
import { PublicSiteFooter } from "@/components/public-site/PublicSiteFooter";
import { PUBLIC_MAIN_PADDING, publicShellInnerStyle, PUBLIC_HEADER_MIN_HEIGHT_PX } from "@/lib/public-shell";
import type { CSSProperties } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import styles from "@/styles/vmr-form.module.css";

function decompressPayload(enc: string): string {
  // reverse the compressPayload transform
  let s = enc.replace(/-/g, "+").replace(/_/g, "/");
  // add padding
  while (s.length % 4) s += "=";
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch (e) {
    return "";
  }
}

function useQueryParam(name: string) {
  const [val, setVal] = useState<string | null>(null);
  useEffect(() => {
    const p = new URLSearchParams(window.location.search).get(name);
    setVal(p);
  }, [name]);
  return val;
}

function SignPage() {
  const c = useQueryParam("c");
  const id = useQueryParam("id");
  const [payload, setPayload] = useState<ContractData | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const cloneRef = useRef<HTMLDivElement | null>(null);
  const pdfCloneRef = useRef<HTMLDivElement | null>(null);
  const [step, setStep] = useState<"view" | "sign" | "uploading" | "done" | "error">("view");
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastPdfRef = useRef<{ blob: Blob; fname: string } | null>(null);
  const [sigPreview, setSigPreview] = useState<string | null>(null);
  const [stampUrl, setStampUrl] = useState<string | undefined>(undefined);

  useEffect(() => {
    fetchStampUrl().then(setStampUrl).catch(() => {});
  }, []);

  useEffect(() => {
    if (!c) return;
    try {
      const json = decompressPayload(decodeURIComponent(c));
      const obj = JSON.parse(json) as ContractData;
      setPayload(obj);
    } catch (e) {
      console.error(e);
    }
  }, [c]);

  useEffect(() => {
    if (step !== "sign") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    padRef.current = new SignaturePad(canvas, { penColor: "#0f0e0d", minWidth: 1.5, maxWidth: 3 });
    // update preview when user finishes a stroke
    (padRef.current as any).onEnd = () => setSigPreview(padRef.current?.toDataURL() ?? null);
    return () => {
      padRef.current?.off();
      setSigPreview(null);
    };
  }, [step]);

  // Using html-to-image (`toPng`) so no OKLCH workaround required here.

  const startSigning = () => setStep("sign");

  const submitSigned = useCallback(async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error("Please sign before submitting");
      return;
    }
    if (!payload) return;
    if (!cloneRef.current || !pdfCloneRef.current) return;
    const sigDataURL = padRef.current.toDataURL("image/png");
    const signed = { ...payload, sigDataURL } as ContractData;
    try {
      // Render signed HTML into the off-screen pdf clone wrapped with the
      // module's contractBox class so styles match the visible preview.
      const pdfClone = pdfCloneRef.current;
      if (!pdfClone) throw new Error("pdf render area missing");
      pdfClone.innerHTML = "";
      const wrapper = document.createElement("div");
      wrapper.className = styles.contractBox;
      wrapper.innerHTML = buildContractHTML(signed, true, stampUrl);
      pdfClone.appendChild(wrapper);
      await document.fonts.ready;
      // Use html-to-image to render the wrapper (which has the exact preview styles)
      const dataUrl = await toPng(wrapper as HTMLElement, {
        pixelRatio: 2,
        backgroundColor: "#ffffff",
        width: 794,
      });

      // Measure the generated image to compute PDF dimensions
      const imgEl = new Image();
      imgEl.src = dataUrl;
      await new Promise((res) => (imgEl.onload = res));

      // Create PDF embedding the PNG exactly using pdf-lib
      const pngResp = await fetch(dataUrl);
      const pngBytes = await pngResp.arrayBuffer();
      const pdfDoc = await PDFDocument.create();
      const pngImage = await pdfDoc.embedPng(pngBytes);
      const pngWidth = pngImage.width;
      const pngHeight = pngImage.height;

      // Create pages as needed to fit the full image at A4 width scaling
      const mmToPt = (mm: number) => (mm * 72) / 25.4;
      const a4WidthPt = mmToPt(210);
      const scale = a4WidthPt / pngWidth;
      const pageHeightPt = pngHeight * scale;
      const page = pdfDoc.addPage([a4WidthPt, pageHeightPt]);
      page.drawImage(pngImage, { x: 0, y: 0, width: a4WidthPt, height: pageHeightPt });

      const pdfBytes = await pdfDoc.save();
      const fname = `VMR-Contract-${payload.name.replace(/\s+/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
      const pdfBlob = new Blob([pdfBytes.buffer as ArrayBuffer], { type: 'application/pdf' });
      // create blob, upload, and trigger download from vault
      let uploadedPublicUrl: string | null = null;
      try {
        lastPdfRef.current = { blob: pdfBlob, fname };

        setStep("uploading");
        uploadedPublicUrl = await uploadToSupabaseFetch(pdfBlob, fname);
        setPublicUrl(uploadedPublicUrl);

        // trigger download from the vault URL so the client receives the same stored file
        if (uploadedPublicUrl) {
          const a = document.createElement("a");
          a.href = uploadedPublicUrl;
          a.download = fname;
          document.body.appendChild(a);
          a.click();
          a.remove();
        }
      } catch (e) {
        console.error(e);
        setStep("error");
        toast.error("Upload failed: " + (errorMsg ?? (e instanceof Error ? e.message : "unknown")));
        return;
      }
      // upsert contracts row linking to event if available
      if (payload.eventId) {
        await supabase.from("contracts").upsert({ event_id: payload.eventId, content: window.location.href, signature_url: uploadedPublicUrl ?? null }, { onConflict: "event_id" });
      }
      setStep("done");
      toast.success("Signed contract uploaded");
    } catch (e) {
      console.error(e);
      setStep("error");
      toast.error("Upload failed");
    }
  }, [payload]);

  const retryUpload = async () => {
    if (!lastPdfRef.current || !payload) return;
    setStep("uploading");
    try {
      const { blob, fname } = lastPdfRef.current;
      const filePath = `signed/${fname}`;
      try {
        const publicUrl = await uploadToSupabaseFetch(blob, fname);
        setPublicUrl(publicUrl);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMsg(msg);
        setStep("error");
        toast.error("Retry failed: " + msg);
        return;
      }
      if (payload.eventId) {
        await supabase.from("contracts").upsert({ event_id: payload.eventId, content: window.location.href, signature_url: publicUrl }, { onConflict: "event_id" });
      }
      setStep("done");
      toast.success("Signed contract uploaded");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStep("error");
      toast.error("Retry failed: " + msg);
    }
  };

  async function uploadToSupabaseFetch(blob: Blob, fileName: string): Promise<string> {
    const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
    const SUPABASE_KEY = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const BUCKET = "contracts";
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase env vars");

    // Use the live session JWT, not the anon key
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Not authenticated — please log in and try again");

    const uploadPath = `signed/${fileName}`;
    const endpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${uploadPath}`;
    const headers: Record<string, string> = {
      apikey: SUPABASE_KEY,                        // project identifier — anon key is correct here
      Authorization: `Bearer ${session.access_token}`, // user JWT for RLS
      "Content-Type": "application/pdf",
      "x-upsert": "true",
    };

    let res: Response | null = null;
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        res = await fetch(endpoint, { method: "POST", headers, body: blob });
        break;
      } catch (netErr: any) {
        if (attempt === 2) throw new Error(`Network error after 2 attempts: ${netErr?.message ?? netErr}`);
        await new Promise((r) => setTimeout(r, 1500));
      }
    }
    if (!res || !res.ok) {
      let text = "";
      try { text = await (res ? res.text() : Promise.resolve("no response")); } catch (_) {}
      try { const j = JSON.parse(text); text = j.message || j.error || text; } catch (_) {}
      throw new Error(`Upload failed (${res?.status ?? "no-res"}): ${text}`);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${uploadPath}`;
  }

  const pageShell: CSSProperties = {
    minHeight: "100vh",
    background: "#faf8f6",
    fontFamily: "'Georgia', 'Times New Roman', serif",
  };

  if (!c) return <div className="p-6">Invalid sign link (missing payload)</div>;

  return (
    <div className="flex min-h-screen flex-col" style={pageShell}>
      <PublicSiteHeader title="Sign Contract" tagline="One copy saved to you, one to our servers." hideAdmin />

      <main
        className="shell-max flex flex-1 flex-col"
        style={{ ...publicShellInnerStyle, padding: PUBLIC_MAIN_PADDING }}
      >
        <div className={`p-6 ${styles.signPage}`}>
          {!payload && <div>Loading contract…</div>}
      {payload && (
        <div className="space-y-4">
          <div className={styles.contractBox}>
            <div ref={cloneRef} dangerouslySetInnerHTML={{ __html: buildContractHTML(payload, false, stampUrl) }} />
          </div>
          <div ref={pdfCloneRef} className={styles.pdfClone} aria-hidden="true" />
          {step === "view" && (
            <div className={styles.contractActions}>
              <Button onClick={startSigning}>Sign Online</Button>
              <Button onClick={() => { const link = window.location.href; navigator.clipboard.writeText(link); toast.success("Link copied"); }}>Copy Link</Button>
            </div>
          )}
          {step !== "view" && (
            <div className={styles.signPanel}>
              <div className={styles.signPanelTitle}>Your Signature</div>
              <div className={styles.signPanelSub}>Sign below using your finger or stylus to confirm agreement with the terms above</div>
              {/* Inline preview of signed fields (answers in blue) */}
              <div style={{ marginBottom: 12 }}>
                <div><strong>Name:</strong> <span className="sig-answer">VICTOR OTIENO</span></div>
                <div><strong>Designation:</strong> <span className="sig-answer">GENERAL MANAGER</span></div>
                <div><strong>Date:</strong> <span className="sig-answer">{payload?.today}</span></div>
                <div style={{ marginTop: 8 }}><strong>Signed by Client</strong></div>
                <div><strong>Name:</strong> <span className="sig-answer">{payload?.name}</span></div>
                <div><strong>Facility:</strong> <span className="sig-answer">{payload ? payload.fac : ""}</span></div>
                <div style={{ marginTop: 8 }}><strong>Signature:</strong></div>
                <div style={{ marginTop: 6 }}>
                  {sigPreview ? (
                    <img src={sigPreview} alt="signature preview" style={{ maxHeight: 60 }} />
                  ) : (
                    <div style={{ borderBottom: "1px solid #0f0e0d", height: 36 }} />
                  )}
                </div>
                <div style={{ marginTop: 6 }}><strong>Date:</strong> <span className="sig-answer">{payload?.today}</span></div>
              </div>
              <canvas ref={canvasRef} className={styles.sigCanvas} />
              <div className={styles.sigMeta}>
                <span>Draw your signature in the box</span>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => { padRef.current?.clear(); setSigPreview(null); }}>Clear</Button>
                  <Button onClick={submitSigned}>Sign & Upload</Button>
                </div>
              </div>
            </div>
          )}
          {step === "uploading" && <div className={styles.contractStatus}>Uploading…</div>}
          {step === "done" && publicUrl && (
            <div className={styles.contractStatus}>
              Signed PDF available at: <a href={publicUrl} target="_blank" rel="noreferrer">Open signed PDF</a>
            </div>
          )}
          {step === "error" && (
            <div className={styles.contractStatus}>
              <div className="space-y-2">
                <div className="text-red-600">Error uploading signed PDF</div>
                {errorMsg && <div className="text-xs text-red-700">{errorMsg}</div>}
                {lastPdfRef.current && (
                  <div className="flex gap-2">
                    <Button onClick={retryUpload}>Retry Upload</Button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
        </div>
        {/* spacer so fixed footer doesn't cover content */}
        <div style={{ height: `${PUBLIC_HEADER_MIN_HEIGHT_PX}px`, flexShrink: 0 }} />
      </main>
      <PublicSiteFooter fixed />
    </div>
  );
}

export const Route = createFileRoute("/sign")({
  component: SignPage,
});
