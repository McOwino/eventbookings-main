import { Link, useRouterState } from "@tanstack/react-router";
import { useState } from "react";
import type { ReactElement } from "react";
import { DocumentsDropdown, usePublicDocuments } from "@/components/DocumentsDropdown";
import type { VMRDocument } from "@/components/DocumentsDropdown";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { SiteIdentityMark } from "@/components/SiteIdentityMark";
import {
  PUBLIC_HEADER_MIN_HEIGHT_PX,
  PUBLIC_HEADER_PADDING,
  publicShellInnerStyle,
} from "@/lib/public-shell";
import { SITE_NAME, SITE_TAGLINE } from "@/lib/site-branding";

const VM_RED = "#C0272D";

const MessageSquareIcon = (): ReactElement => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z" />
  </svg>
);

export function PublicSiteHeader({ title, tagline }: { title?: string; tagline?: string } = {}) {
  const [activeDoc, setActiveDoc] = useState<VMRDocument | null>(null);
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const hideFeedbackNav = pathname === "/feedback" || pathname.startsWith("/feedback/");

  const { data: docCategories } = usePublicDocuments();
  const allDocs = (docCategories ?? []).flatMap((c) => c.docs);
  const matchingDoc = title ? allDocs.find((d) => d.label === title) : undefined;

  return (
    <header
      style={{
        background: VM_RED,
        borderBottom: "none",
        position: "sticky",
        top: 0,
        zIndex: 50,
        margin: 0,
        padding: 0,
        width: "100%",
      }}
    >
      <div
        className="shell-max"
        style={{
          ...publicShellInnerStyle,
          padding: PUBLIC_HEADER_PADDING,
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 12,
          minHeight: PUBLIC_HEADER_MIN_HEIGHT_PX,
        }}
      >
        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            textDecoration: "none",
            color: "inherit",
            minWidth: 0,
            flex: "1 1 auto",
          }}
        >
          <SiteIdentityMark height={44} onBrandRed />
          <div style={{ minWidth: 0 }}>
            <h1
              style={{
                margin: 0,
                fontSize: "clamp(16px, 2.5vw, 20px)",
                fontWeight: 800,
                color: "#fff",
                letterSpacing: "-0.02em",
                lineHeight: 1.2,
              }}
            >
              {title ?? SITE_NAME}
            </h1>
            <p
              className="hide-mobile"
              style={{ margin: "2px 0 0", fontSize: 12, color: "rgba(255,255,255,0.72)" }}
            >
              {tagline ?? SITE_TAGLINE}
            </p>
          </div>
        </Link>
        <nav
          style={{
            display: "flex",
            gap: 8,
            alignItems: "center",
            flexShrink: 0,
          }}
          aria-label="Site"
        >
          {/* Sign Contract removed from header per request */}
          {matchingDoc && (
            <>
              <button
                type="button"
                onClick={() => setActiveDoc(matchingDoc)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 13,
                  fontWeight: 500,
                  color: "#fff",
                  border: "0.5px solid rgba(255,255,255,0.4)",
                  borderRadius: 8,
                  padding: "7px 12px",
                  background: "transparent",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                📄
                <span className="hide-mobile">Document</span>
              </button>
            </>
          )}
          <DocumentsDropdown onBrandRed />
          {!hideFeedbackNav && (
            <Link
              to="/feedback"
              style={{
                display: "flex",
                alignItems: "center",
                gap: 6,
                fontSize: 13,
                fontWeight: 500,
                color: "#fff",
                border: "0.5px solid rgba(255,255,255,0.4)",
                borderRadius: 8,
                padding: "7px 14px",
                textDecoration: "none",
                background: "transparent",
                whiteSpace: "nowrap",
              }}
            >
              <MessageSquareIcon />
              <span className="hide-mobile">Feedback</span>
            </Link>
          )}

        </nav>
        {activeDoc && (
          <DocumentPreviewModal doc={activeDoc} onClose={() => setActiveDoc(null)} />
        )}
      </div>
    </header>
  );
}