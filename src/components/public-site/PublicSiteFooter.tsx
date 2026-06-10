import { Link } from "@tanstack/react-router";
import type { CSSProperties } from "react";
const villageRecreationLogo = "https://yjgylhjuqggnetfwqqgh.supabase.co/storage/v1/object/sign/assets/Village_Recreation-Logo.png?token=eyJraWQiOiJzdG9yYWdlLXVybC1zaWduaW5nLWtleV9jMTEwZjk4NS03MTUyLTQ0MjEtYjcwYy00NDNmMTNhNmQ3Y2QiLCJhbGciOiJIUzI1NiJ9.eyJ1cmwiOiJhc3NldHMvVmlsbGFnZV9SZWNyZWF0aW9uLUxvZ28ucG5nIiwiaWF0IjoxNzgwODE5OTkyLCJleHAiOjE4NzU0Mjc5OTJ9.cwzmVd0mFRcRIXOcL61_5MQLgmONg91axWpdEFgDJjg";
import { PUBLIC_HEADER_PADDING, publicShellInnerStyle, PUBLIC_HEADER_MIN_HEIGHT_PX } from "@/lib/public-shell";

const VM_RED = "#C0272D";

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "minmax(0, 1fr) minmax(0, 2fr) minmax(0, 1fr)",
  alignItems: "center",
  columnGap: 12,
  minHeight: PUBLIC_HEADER_MIN_HEIGHT_PX,
  padding: PUBLIC_HEADER_PADDING,
  boxSizing: "border-box",
};

export type PublicSiteFooterProps = {
  /** Full-width cream bar; inner grid still uses `.shell-max` to match header/main */
  fullWidth?: boolean;
  /** Make the footer fixed to the bottom of the viewport */
  fixed?: boolean;
};

export function PublicSiteFooter({ fullWidth = false, fixed = false }: PublicSiteFooterProps) {
  const baseFooterStyle: React.CSSProperties = fullWidth
    ? { width: "100%", background: "#ffffff", borderTop: "0.5px solid #e8e4de" }
    : { borderTop: "none" };

  const fixedStyle: React.CSSProperties = fixed
    ? { position: "fixed", left: 0, right: 0, bottom: 0, zIndex: 60 }
    : {};

  return (
    <footer style={{ ...baseFooterStyle, ...fixedStyle }}>
      <div
        className="shell-max"
        style={{
          ...publicShellInnerStyle,
          ...gridStyle,
          background: "#ffffff",
          ...(fullWidth ? {} : { borderTop: "0.5px solid #e8e4de" }),
        }}
      >
        <div style={{ justifySelf: "start", minWidth: 0 }}>
          <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>Powered by Sulwe Agency</p>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            minWidth: 0,
            padding: "6px 10px",
            background: "#ffffff",
            borderRadius: 8,
            boxSizing: "border-box",
          }}
        >
          <img
            src={villageRecreationLogo}
            alt="Village Market Recreation — The Yard, REV, Ballpoint, Glitch, Ozone, Under the Sea, Village Bowl, Village Market"
            style={{
              display: "block",
              width: "100%",
              maxWidth: "100%",
              height: "auto",
              maxHeight: 48,
              objectFit: "contain",
              objectPosition: "center",
            }}
          />
        </div>
        <div style={{ justifySelf: "end", minWidth: 0 }}>
          <Link
            to="/login"
            title="Admin"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: 32,
              height: 32,
              borderRadius: "50%",
              border: `1px solid ${VM_RED}`,
              color: VM_RED,
              textDecoration: "none",
              background: "transparent",
            }}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
          </Link>
        </div>
      </div>
    </footer>
  );
}