import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";
import { PUBLIC_HEADER_MIN_HEIGHT_PX } from "@/lib/public-shell";

export interface VMRDocument {
  id: string;
  label: string;
  description: string;
  url: string;
  fileType: "pdf" | "image";
}

interface DocCategory {
  id: string;
  heading: string;
  icon: React.ReactNode;
  docs: VMRDocument[];
}

// Category metadata — heading and icon keyed by the category slug stored in DB
const CATEGORY_META: Record<string, { heading: string; icon: React.ReactNode }> = {
  "booking-guides": {
    heading: "Booking Guides",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H19a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1H6.5a1 1 0 0 1 0-5H20"/>
      </svg>
    ),
  },
  "menus": {
    heading: "Menus",
    icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2"/><path d="M7 2v20"/><path d="M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3zm0 0v7"/>
      </svg>
    ),
  },
};

// Category order for consistent display
const CATEGORY_ORDER = ["booking-guides", "menus"];

interface DocumentRow {
  id: string;
  label: string;
  description: string | null;
  category: string;
  url: string;
  file_type: string;
  position: number;
  is_active: boolean;
}

export function usePublicDocuments() {
  return useQuery({
    queryKey: ["public", "documents"],
    queryFn: async (): Promise<DocCategory[]> => {
      const { data, error } = await supabase
        .from("public_documents")
        .select("id, label, description, category, url, file_type, position")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw error;

      const rows = (data ?? []) as DocumentRow[];

      // Group rows by category, preserving CATEGORY_ORDER
      const grouped = new Map<string, VMRDocument[]>();
      rows.forEach((r) => {
        const arr = grouped.get(r.category) ?? [];
        arr.push({
          id: r.id,
          label: r.label,
          description: r.description ?? "",
          url: r.url,
          fileType: r.file_type as "pdf" | "image",
        });
        grouped.set(r.category, arr);
      });

      // Build DocCategory array in defined order, skip empty categories
      return CATEGORY_ORDER
        .filter((cat) => grouped.has(cat))
        .map((cat) => ({
          id: cat,
          heading: CATEGORY_META[cat]?.heading ?? cat,
          icon: CATEGORY_META[cat]?.icon ?? null,
          docs: grouped.get(cat)!,
        }));
    },
    staleTime: 1000 * 60 * 5, // cache for 5 minutes
  });
}

const ChevronDownIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="m6 9 6 6 6-6"/>
  </svg>
);

const ExternalLinkIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 3h6v6M10 14 21 3M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
  </svg>
);

interface DocumentsDropdownProps {
  /** Match the red public site header (white trigger, bordered). */
  onBrandRed?: boolean;
}

export function DocumentsDropdown({ onBrandRed = false }: DocumentsDropdownProps) {
  const [open, setOpen] = useState(false);
  const [activeDoc, setActiveDoc] = useState<VMRDocument | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { data: categories = [] } = usePublicDocuments();

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const openDoc = useCallback((doc: VMRDocument) => {
    setOpen(false);
    setActiveDoc(doc);
  }, []);

  const triggerColor = onBrandRed
    ? open
      ? "#C0272D"
      : "#fff"
    : open
      ? "#C0272D"
      : "inherit";

  const triggerBackground = onBrandRed
    ? open
      ? "#fff"
      : "transparent"
    : open
      ? "rgba(192,39,45,0.08)"
      : "transparent";

  const triggerBorder = onBrandRed ? "0.5px solid rgba(255,255,255,0.4)" : "none";

  return (
    <>
      <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={open}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 5,
            padding: onBrandRed ? "7px 14px" : "7px 12px",
            borderRadius: 8,
            border: triggerBorder,
            background: triggerBackground,
            color: triggerColor,
            fontSize: onBrandRed ? 13 : 14,
            fontWeight: onBrandRed ? 500 : 500,
            fontFamily: "inherit",
            cursor: "pointer",
            transition: "background 0.15s, color 0.15s",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => {
            if (open) return;
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = onBrandRed ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.05)";
          }}
          onMouseLeave={(e) => {
            if (open) return;
            const el = e.currentTarget as HTMLButtonElement;
            el.style.background = "transparent";
          }}
        >
          Documents
          <span
            style={{
              display: "flex",
              transition: "transform 0.2s",
              transform: open ? "rotate(180deg)" : "rotate(0deg)",
            }}
          >
            <ChevronDownIcon />
          </span>
        </button>

        {open && (
          <div
            className="docs-dropdown-panel"
            role="menu"
            style={{
              position: "absolute",
              top: "calc(100% + 8px)",
              right: 0,
              left: "auto",
              width: "min(560px, calc(100vw - 24px))",
              background: "#fff",
              border: "0.5px solid #e8e4de",
              borderRadius: 14,
              boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
              overflow: "hidden",
              zIndex: 9999,
              animation: "ddFadeIn 0.15s ease both",
            }}
          >
            <style>{`
              @keyframes ddFadeIn {
                from { opacity: 0; transform: translateY(-6px) scale(0.98); }
                to   { opacity: 1; transform: translateY(0)  scale(1);    }
              }
              @keyframes ddFadeInTablet {
                from { opacity: 0; transform: translateX(-50%) translateY(-6px) scale(0.98); }
                to   { opacity: 1; transform: translateX(-50%) translateY(0) scale(1); }
              }
              @media (min-width: 641px) and (max-width: 1023px) {
                .docs-dropdown-panel {
                  position: fixed !important;
                  left: 50% !important;
                  right: auto !important;
                  top: calc(${PUBLIC_HEADER_MIN_HEIGHT_PX}px + 8px) !important;
                  transform: translateX(-50%);
                  animation: ddFadeInTablet 0.15s ease both !important;
                }
              }
              @media (max-width: 520px) {
                .docs-dropdown-cols {
                  flex-direction: column !important;
                }
                .docs-dropdown-col + .docs-dropdown-col {
                  border-left: none !important;
                  border-top: 0.5px solid #f0ece6;
                }
              }
            `}</style>

            <div
              className="docs-dropdown-cols"
              style={{
                display: "flex",
                flexDirection: "row",
                alignItems: "stretch",
                padding: "8px 0",
              }}
            >
              {categories.map((cat, catIdx) => (
                <div
                  key={cat.id}
                  className="docs-dropdown-col"
                  style={{
                    flex: 1,
                    minWidth: 0,
                    borderLeft: catIdx > 0 ? "0.5px solid #f0ece6" : "none",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 7,
                      padding: "10px 16px 6px",
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: "0.08em",
                      textTransform: "uppercase",
                      color: "#aaa8a0",
                    }}
                  >
                    <span style={{ color: "#C0272D" }}>{cat.icon}</span>
                    {cat.heading}
                  </div>

                  {cat.docs.map((doc) => (
                    <button
                      key={doc.id}
                      type="button"
                      role="menuitem"
                      onClick={() => openDoc(doc)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        width: "100%",
                        padding: "9px 16px",
                        border: "none",
                        background: "transparent",
                        cursor: "pointer",
                        textAlign: "left",
                        gap: 10,
                        transition: "background 0.12s",
                        fontFamily: "inherit",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "#faf7f5";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 1 }}>
                          {doc.label}
                        </div>
                        <div style={{ fontSize: 11, color: "#999" }}>{doc.description}</div>
                      </div>
                      <span style={{ color: "#C0272D", flexShrink: 0 }}>
                        <ExternalLinkIcon />
                      </span>
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeDoc && (
        <DocumentPreviewModal doc={activeDoc} onClose={() => setActiveDoc(null)} />
      )}
    </>
  );
}