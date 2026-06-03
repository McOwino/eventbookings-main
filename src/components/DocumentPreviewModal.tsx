import { useEffect } from "react";
import { createPortal } from "react-dom";
import QRCode from "react-qr-code";
import { SiteIdentityMark } from "@/components/SiteIdentityMark";
import { DocumentsDropdown } from "@/components/DocumentsDropdown";
import type { VMRDocument } from "@/components/DocumentsDropdown";
import { PUBLIC_HEADER_PADDING } from "@/lib/public-shell";

const VM_RED = "#C0272D";

interface DocumentPreviewModalProps {
  doc: VMRDocument;
  onClose: () => void;
}

const CloseIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18 6 6 18M6 6l12 12" />
  </svg>
);

const DownloadIcon = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

const SmartphoneIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="14" height="20" x="5" y="2" rx="2" ry="2" />
    <path d="M12 18h.01" />
  </svg>
);

export function DocumentPreviewModal({ doc, onClose }: DocumentPreviewModalProps) {
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="doc-preview-title"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 10000,
        display: "flex",
        flexDirection: "column",
        background: "#fff",
        fontFamily: "inherit",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          padding: PUBLIC_HEADER_PADDING,
          borderBottom: "none",
          flexShrink: 0,
          background: VM_RED,
          minHeight: 72,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            minWidth: 0,
            flex: "1 1 auto",
          }}
        >
          <SiteIdentityMark height={44} onBrandRed linkToHome />
          <div style={{ minWidth: 0 }}>
          <h2
            id="doc-preview-title"
            style={{
              margin: 0,
              fontSize: "clamp(16px, 2vw, 20px)",
              fontWeight: 800,
              color: "#fff",
              letterSpacing: "-0.02em",
            }}
          >
            {doc.label}
          </h2>
          <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.72)" }}>
            {doc.description}
          </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <DocumentsDropdown onBrandRed />
          <button
          type="button"
          onClick={onClose}
          aria-label="Close preview"
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 40,
            height: 40,
            border: "0.5px solid rgba(255,255,255,0.4)",
            borderRadius: 10,
            background: "transparent",
            color: "#fff",
            cursor: "pointer",
          }}
        >
          <CloseIcon />
          </button>
        </div>
      </div>

      {/* Body: document left, QR sidebar right */}
      <div
        className="doc-preview-body"
        style={{
          flex: 1,
          minHeight: 0,
          display: "flex",
          flexDirection: "row",
        }}
      >
        {/* Document embed */}
        <div
          style={{
            flex: 1,
            minWidth: 0,
            background: "#f0ece6",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {doc.fileType === "pdf" ? (
            <iframe
              title={doc.label}
              src={doc.url}
              style={{ flex: 1, width: "100%", border: "none", display: "block", minHeight: 0 }}
            />
          ) : (
            <img
              src={doc.url}
              alt={doc.label}
              style={{ flex: 1, width: "100%", objectFit: "contain", display: "block", minHeight: 0 }}
            />
          )}
        </div>

        {/* QR sidebar */}
        <aside
          style={{
            width: "clamp(260px, 28vw, 340px)",
            flexShrink: 0,
            borderLeft: "0.5px solid #e8e4de",
            background: "#faf7f5",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            padding: "clamp(20px, 3vw, 32px) clamp(16px, 2vw, 24px)",
            gap: 20,
            overflowY: "auto",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8, color: "#C0272D" }}>
            <SmartphoneIcon />
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase" }}>
              Open on your phone
            </span>
          </div>

          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: "#555",
              textAlign: "center",
              lineHeight: 1.55,
              maxWidth: 260,
            }}
          >
            Scan the QR code with your phone camera — the PDF opens directly in your browser.
          </p>

          <div
            style={{
              background: "#fff",
              padding: 16,
              borderRadius: 14,
              border: "0.5px solid #e8e4de",
              boxShadow: "0 2px 12px rgba(0,0,0,0.06)",
            }}
          >
            <QRCode
              value={doc.url}
              size={200}
              style={{ height: "auto", maxWidth: "100%", width: "100%" }}
              bgColor="#ffffff"
              fgColor="#1a1a1a"
              level="M"
            />
          </div>

          <a
            href={doc.url}
            download
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 20px",
              borderRadius: 10,
              border: "none",
              background: "#C0272D",
              color: "#fff",
              fontSize: 14,
              fontWeight: 600,
              textDecoration: "none",
              whiteSpace: "nowrap",
            }}
          >
            <DownloadIcon />
            Download PDF
          </a>

          <a
            href={doc.url}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: 12,
              color: "#888",
              textDecoration: "underline",
              textUnderlineOffset: 3,
              wordBreak: "break-all",
              textAlign: "center",
              maxWidth: "100%",
            }}
          >
            {doc.url}
          </a>
        </aside>
      </div>

      <style>{`
        @media (max-width: 720px) {
          .doc-preview-body {
            flex-direction: column !important;
          }
          .doc-preview-body aside {
            width: 100% !important;
            border-left: none !important;
            border-top: 0.5px solid #e8e4de;
            flex-direction: row !important;
            flex-wrap: wrap;
            justify-content: center !important;
            padding: 16px !important;
            gap: 14px !important;
          }
          .doc-preview-body aside p {
            flex: 1 1 100%;
          }
        }
      `}</style>
    </div>,
    document.body,
  );
}
