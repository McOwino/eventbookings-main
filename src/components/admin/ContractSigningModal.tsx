import { useRef, useEffect, useCallback, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import SignaturePad from "signature_pad";
import { toPng } from "html-to-image";
import { PDFDocument } from "pdf-lib";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildContractHTML, type ContractData } from "@/lib/contract-utils";
import styles from "@/styles/vmr-form.module.css";

interface Props {
  open: boolean;
  onClose: () => void;
  data?: ContractData | null;
}

// A4 dimensions in points (1pt = 1/72 inch)
const A4_WIDTH_PT = (210 * 72) / 25.4;
const A4_HEIGHT_PT = (297 * 72) / 25.4;
// Capture width in px — matches what buildContractHTML expects
const CAPTURE_WIDTH_PX = 794;

export function ContractSigningModal({ open, onClose, data }: Props) {
  if (!data) return null;
  const { user } = useAuth();
  const qc = useQueryClient();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const cloneRef = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState<"sign" | "uploading" | "done" | "error">("sign");
  const [publicUrl, setPublicUrl] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const lastPdfRef = useRef<{ blob: Blob; fname: string } | null>(null);

  useEffect(() => {
    if (!open) {
      setStep("sign");
      setPublicUrl(null);
      setErrorMsg(null);
      return;
    }
    if (!canvasRef.current) return;
    const canvas = canvasRef.current;
    const ratio = Math.max(window.devicePixelRatio ?? 1, 1);
    canvas.width = canvas.offsetWidth * ratio;
    canvas.height = canvas.offsetHeight * ratio;
    canvas.getContext("2d")?.scale(ratio, ratio);
    padRef.current = new SignaturePad(canvas, { penColor: "#0f0e0d", minWidth: 1.5, maxWidth: 3 });
    return () => {
      padRef.current?.off();
    };
  }, [open]);

  // ─── Build PDF from HTML ──────────────────────────────────────────────────
  // Renders the contract HTML into the hidden cloneRef div at exactly
  // CAPTURE_WIDTH_PX, captures it as a PNG via html-to-image (supports oklch),
  // then slices the tall image into A4 pages using pdf-lib.
  async function buildPdfBlob(signed: ContractData): Promise<Blob> {
    const el = cloneRef.current!;

      // 1. Stamp content inside the module's contractBox so the same CSS applies
      el.innerHTML = `<div class="${styles.contractBox}">${buildContractHTML(signed, true)}</div>`;

    // 2. Ensure the same Google fonts are available (DM Serif Display + DM Sans)
    const fontHref = "https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@300;400;500;600&display=swap";
    if (!document.querySelector(`link[href="${fontHref}"]`)) {
      const ln = document.createElement("link");
      ln.rel = "stylesheet";
      ln.href = fontHref;
      document.head.appendChild(ln);
    }
    // wait for fonts to load
    await document.fonts.ready;
    await Promise.all(
      Array.from(el.querySelectorAll<HTMLImageElement>("img")).map((img) =>
        img.complete
          ? Promise.resolve()
          : new Promise<void>((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            })
      )
    );

    // 3. Capture full-height PNG at 2× for sharpness
    const dataUrl = await toPng(el, {
      pixelRatio: 2,
      backgroundColor: "#ffffff",
      width: CAPTURE_WIDTH_PX,
    });

    // 4. Clear the clone's innerHTML to keep DOM clean
    el.innerHTML = "";

    // 5. Embed PNG into pdf-lib and slice into A4 pages
    const pngResp = await fetch(dataUrl);
    const pngBytes = await pngResp.arrayBuffer();
    const pdfDoc = await PDFDocument.create();
    const pngImage = await pdfDoc.embedPng(pngBytes);

    const imgWidthPx = pngImage.width;
    const imgHeightPx = pngImage.height;

    // Scale factor: map captured px width → A4 point width
    const scale = A4_WIDTH_PT / imgWidthPx;
    const totalHeightPt = imgHeightPx * scale;

    // How many full/partial A4 pages do we need?
    const pageCount = Math.ceil(totalHeightPt / A4_HEIGHT_PT);

    for (let i = 0; i < pageCount; i++) {
      const page = pdfDoc.addPage([A4_WIDTH_PT, A4_HEIGHT_PT]);
      const yOffsetPt = i * A4_HEIGHT_PT;
      page.drawImage(pngImage, {
        x: 0,
        y: A4_HEIGHT_PT - totalHeightPt + yOffsetPt,
        width: A4_WIDTH_PT,
        height: totalHeightPt,
      });
    }

    const pdfBytes = await pdfDoc.save();
    return new Blob([pdfBytes], { type: "application/pdf" });
  }

  // ─── Upload helper ────────────────────────────────────────────────────────
  async function uploadToSupabaseFetch(blob: Blob, fileName: string): Promise<string> {
    const SUPABASE_URL = (import.meta as any).env.VITE_SUPABASE_URL as string;
    const SUPABASE_KEY = (import.meta as any).env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
    const BUCKET = "contracts";
    if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error("Missing Supabase env vars");

    const uploadPath = `signed/${fileName}`;
    const endpoint = `${SUPABASE_URL}/storage/v1/object/${BUCKET}/${uploadPath}`;
    const headers: Record<string, string> = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
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
      try {
        text = await (res ? res.text() : Promise.resolve("no response"));
      } catch (_) {}
      try {
        const j = JSON.parse(text);
        text = j.message || j.error || text;
      } catch (_) {}
      throw new Error(`Upload failed (${res?.status ?? "no-res"}): ${text}`);
    }
    return `${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${uploadPath}`;
  }

  // ─── Upsert DB record ─────────────────────────────────────────────────────
  async function persistContract(signed: ContractData, url: string) {
    if (!data.eventId || !url) return;
    const { error } = await supabase.from("contracts").upsert(
      {
        event_id: data.eventId,
        content: buildContractHTML(signed, true),
        signature_url: url,
        generated_by: user?.id ?? null,
      },
      { onConflict: "event_id" }
    );
    if (error) console.error("Failed to upsert contract record:", error.message);
    else qc?.invalidateQueries?.({ queryKey: ["admin", "contracts"] });
  }

  // ─── Main submit handler ──────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error("Please sign before submitting");
      return;
    }
    if (!cloneRef.current) return;

    const sigDataURL = padRef.current.toDataURL("image/png");
    const signed: ContractData = { ...data, sigDataURL };

    try {
      // Build PDF
      const pdfBlob = await buildPdfBlob(signed);
      const fname = `VMR-Contract-${data.name.replace(/[^a-zA-Z0-9]/g, "-")}-${new Date().toISOString().split("T")[0]}.pdf`;
      lastPdfRef.current = { blob: pdfBlob, fname };

      // Upload
      setStep("uploading");
      let uploadedUrl: string;
      try {
        uploadedUrl = await uploadToSupabaseFetch(pdfBlob, fname);
      } catch (uploadErr: any) {
        const msg = uploadErr?.message ?? JSON.stringify(uploadErr);
        setErrorMsg(msg);
        setStep("error");
        toast.error("Upload failed: " + msg);
        return;
      }

      setPublicUrl(uploadedUrl);

      // Trigger browser download from the vault URL
      const a = document.createElement("a");
      a.href = uploadedUrl;
      a.download = fname;
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Persist DB record
      await persistContract(signed, uploadedUrl);

      setStep("done");
      toast.success("Contract signed, downloaded & uploaded");
    } catch (err) {
      console.error(err);
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setStep("error");
      toast.error("PDF generation failed");
    }
  }, [data]); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Retry upload (reuse cached blob) ────────────────────────────────────
  const retryUpload = async () => {
    if (!lastPdfRef.current) return;
    const { blob, fname } = lastPdfRef.current;
    setStep("uploading");
    let pub: string;
    try {
      pub = await uploadToSupabaseFetch(blob, fname);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMsg(msg);
      setStep("error");
      toast.error("Retry failed: " + msg);
      return;
    }
    setPublicUrl(pub);
    await persistContract({ ...data, sigDataURL: data.sigDataURL }, pub);
    setStep("done");
    toast.success("Uploaded contract successfully");
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Hidden off-screen div used as the render target for pdf capture */}
      <div ref={cloneRef} aria-hidden className={styles.pdfClone} style={{ pointerEvents: "none", zIndex: -1 }} />

      <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">

          {step === "sign" && (
            <>
              <DialogHeader>
                <DialogTitle className="font-serif text-lg">Client Signature</DialogTitle>
              </DialogHeader>

              <div
                className={styles.contractBox}
                dangerouslySetInnerHTML={{ __html: buildContractHTML(data, false) }}
              />

              <div className={styles.signPanel}>
                <div className={styles.signPanelTitle}>Your Signature</div>
                <div className={styles.signPanelSub}>
                  Sign below using your finger or stylus to confirm agreement with the terms above
                </div>
                <canvas ref={canvasRef} className={styles.sigCanvas} />
                <div className={styles.sigMeta}>
                  <span>Draw your signature in the box</span>
                  <Button variant="outline" size="sm" onClick={() => padRef.current?.clear()}>
                    Clear
                  </Button>
                </div>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={onClose}>Cancel</Button>
                  <Button
                    className="bg-[#C0272D] hover:bg-[#a82227] text-white px-6 py-3 text-sm font-semibold"
                    onClick={handleSubmit}
                  >
                    ✍ Sign &amp; Download Contract
                  </Button>
                </div>
              </div>
            </>
          )}

          {step === "uploading" && (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              <p className="text-sm text-muted-foreground">Uploading to secure storage…</p>
            </div>
          )}

          {step === "done" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="text-5xl">✅</div>
              <h2 className="font-serif text-xl font-bold">Contract Signed</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                The contract has been downloaded to your device and uploaded to secure storage.
              </p>
              {publicUrl && (
                <div className="w-full max-w-sm space-y-2 text-left">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Stored Contract URL
                  </p>
                  <div className="flex gap-2">
                    <input
                      readOnly
                      value={publicUrl}
                      onClick={(e) => (e.target as HTMLInputElement).select()}
                      className="flex-1 rounded border px-3 py-2 font-mono text-xs bg-muted overflow-hidden text-ellipsis"
                    />
                    <Button
                      size="sm"
                      className="bg-[#C0272D] hover:bg-[#a82227] text-white"
                      onClick={() => {
                        navigator.clipboard.writeText(publicUrl);
                        toast.success("Copied!");
                      }}
                    >
                      Copy
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This link gives direct access to the signed PDF.
                  </p>
                </div>
              )}
              <Button onClick={onClose} className="mt-2">Done</Button>
            </div>
          )}

          {step === "error" && (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
              <div className="text-5xl">⚠️</div>
              <h2 className="font-serif text-xl font-bold">Upload Failed</h2>
              <p className="text-sm text-muted-foreground max-w-sm">
                The PDF was downloaded to your device successfully, but the cloud upload failed.
              </p>
              {errorMsg && (
                <div className="w-full max-w-sm rounded border border-red-200 bg-red-50 p-3 text-left text-xs text-red-700">
                  {errorMsg}
                </div>
              )}
              <p className="text-xs text-muted-foreground max-w-sm">
                Check that the "contracts" bucket exists and is public in your Supabase project.
              </p>
              <div className="flex gap-2">
                <Button onClick={retryUpload} disabled={!lastPdfRef.current}>
                  Retry Upload
                </Button>
                <Button onClick={onClose}>Close</Button>
              </div>
            </div>
          )}

        </DialogContent>
      </Dialog>
    </>
  );
}
