import { useState, useRef, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { DocumentPreviewModal } from "@/components/DocumentPreviewModal";

// ── Type (matches the new table shape) ───────────────────────────────────────
export interface VMRDocument {
  id: string;
  label: string;
  description: string;
  url: string;
  fileType: "pdf" | "image";
  category: string;
  position: number;
}

// ── Category display config (labels + icons stay in code — not in DB) ────────
// Only the documents themselves come from the DB.
// Category metadata is static — adding a new category means adding one line here.
const CATEGORY_CONFIG: Record<string, {
  heading: string;
  icon: React.ReactNode;
}> = {
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

// ── Icons ─────────────────────────────────────────────────────────────────────
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

// ── Component ─────────────────────────────────────────────────────────────────
export function DocumentsDropdown() {
  const [open, setOpen]           = useState(false);
  const [activeDoc, setActiveDoc] = useState<VMRDocument | null>(null);
  const containerRef              = useRef<HTMLDivElement>(null);

  // ── Fetch documents from Supabase ─────────────────────────────────────────
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["public", "documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_documents")
        .select("id, label, description, category, url, file_type, position")
        .eq("is_active", true)
        .order("category", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id:          r.id,
        label:       r.label,
        description: r.description ?? "",
        url:         r.url,
        fileType:    r.file_type as "pdf" | "image",
        category:    r.category,
        position:    r.position,
      })) as VMRDocument[];
    },
    staleTime: 5 * 60 * 1000,
  });

  // ── Group by category, preserving the config order ───────────────────────
  const grouped = Object.keys(CATEGORY_CONFIG)
    .map((cat) => ({
      id:   cat,
      ...CATEGORY_CONFIG[cat],
      docs: rows.filter((r) => r.category === cat),
    }))
    .filter((g) => g.docs.length > 0); // hide empty categories

  // ── Close on outside click ────────────────────────────────────────────────
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
    function handler(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false); }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  const openDoc = useCallback((doc: VMRDocument) => {
    setOpen(false);
    setActiveDoc(doc);
  }, []);

  return (
    <>
      <div ref={containerRef} style={{ position: "relative", display: "inline-block" }}>
        {/* ── Trigger ── */}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-haspopup="true"
          aria-expanded={open}
          style={{
            display: "flex", alignItems: "center", gap: 5,
            padding: "7px 12px", borderRadius: 8, border: "none",
            background: open ? "rgba(192,39,45,0.08)" : "transparent",
            color: open ? "#C0272D" : "inherit",
            fontSize: 14, fontWeight: 500, fontFamily: "inherit",
            cursor: "pointer", transition: "background 0.15s, color 0.15s",
          }}
        >
          Documents
          <span style={{ display: "flex", transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "rotate(0deg)" }}>
            <ChevronDownIcon />
          </span>
        </button>

        {/* ── Dropdown panel ── */}
        {open && (
          <div
            role="menu"
            style={{
              position: "absolute", top: "calc(100% + 8px)", right: 0, left: "auto",
              width: grouped.length > 1 ? 560 : 300,
              background: "#fff",
              border: "0.5px solid #e8e4de",
              borderRadius: 14,
              boxShadow: "0 8px 32px rgba(0,0,0,0.10), 0 1px 4px rgba(0,0,0,0.06)",
              overflow: "hidden", zIndex: 9999,
              animation: "ddFadeIn 0.15s ease both",
            }}
          >
            <style>{`
              @keyframes ddFadeIn {
                from { opacity: 0; transform: translateY(-6px) scale(0.98); }
                to   { opacity: 1; transform: translateY(0) scale(1); }
              }
            `}</style>

            {isLoading ? (
              // Loading state
              <div style={{ padding: "20px 16px", fontSize: 12, color: "#aaa", textAlign: "center" }}>
                Loading documents…
              </div>
            ) : grouped.length === 0 ? (
              // Empty state
              <div style={{ padding: "20px 16px", fontSize: 12, color: "#aaa", textAlign: "center" }}>
                No documents available.
              </div>
            ) : (
              // Two-column grid — same layout as before
              <div style={{
                display: "grid",
                gridTemplateColumns: grouped.length > 1 ? "1fr 1px 1fr" : "1fr",
                padding: "8px 0",
              }}>
                {grouped.map((cat, catIdx) => (
                  <>
                    <div key={cat.id} style={{ padding: "4px 0" }}>
                      {/* Category heading */}
                      <div style={{
                        display: "flex", alignItems: "center", gap: 7,
                        padding: "10px 16px 6px",
                        fontSize: 10, fontWeight: 700, letterSpacing: "0.08em",
                        textTransform: "uppercase", color: "#aaa8a0",
                      }}>
                        <span style={{ color: "#C0272D" }}>{cat.icon}</span>
                        {cat.heading}
                      </div>

                      {/* Doc items */}
                      {cat.docs.map((doc) => (
                        <button
                          key={doc.id}
                          type="button"
                          role="menuitem"
                          onClick={() => openDoc(doc)}
                          style={{
                            display: "flex", alignItems: "center",
                            justifyContent: "space-between",
                            width: "100%", padding: "9px 16px",
                            border: "none", background: "transparent",
                            cursor: "pointer", textAlign: "left", gap: 12,
                            transition: "background 0.12s", fontFamily: "inherit",
                            boxSizing: "border-box",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "#faf7f5")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: 13, fontWeight: 600, color: "#1a1a1a", marginBottom: 1 }}>
                              {doc.label}
                            </div>
                            <div style={{ fontSize: 11, color: "#999", whiteSpace: "normal" }}>
                              {doc.description}
                            </div>
                          </div>
                          <span style={{ color: "#C0272D", flexShrink: 0 }}>
                            <ExternalLinkIcon />
                          </span>
                        </button>
                      ))}
                    </div>

                    {/* Vertical divider between columns */}
                    {catIdx < grouped.length - 1 && (
                      <div
                        key={`div-${catIdx}`}
                        aria-hidden="true"
                        style={{ background: "#f0ece6", width: "1px", alignSelf: "stretch", margin: "8px 0" }}
                      />
                    )}
                  </>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Preview modal */}
      {activeDoc && (
        <DocumentPreviewModal doc={activeDoc} onClose={() => setActiveDoc(null)} />
      )}
    </>
  );
}
