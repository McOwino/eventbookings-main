import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { z } from "zod";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { FACILITY_OPTIONS } from "@/lib/facility-utils";
import { PublicSiteFooter } from "@/components/public-site/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/public-site/PublicSiteHeader";
import { PUBLIC_MAIN_PADDING, publicShellInnerStyle } from "@/lib/public-shell";
import type { CSSProperties } from "react";

const NATURE_OF_VISIT_OPTIONS = [
  "Gaming", "Birthday", "Hangout", "RSVP", "School Trip",
  "Food and Drinks", "Promotions", "Events", "Tournament",
  "Leagues", "Workshops", "Village Camps", "Holiday Event"
];

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background: "#faf8f6",
  fontFamily: "'Georgia', 'Times New Roman', serif",
};

export const Route = createFileRoute("/feedback")({
  head: () => ({
    meta: [
      { title: "Submit Feedback — Village Market Recreation" },
      { name: "description", content: "Share your experience at our facilities. Your feedback helps us improve." },
    ],
  }),
  component: FeedbackPage,
});

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  contact: z.string().trim().min(1, "Contact is required").max(120),
  facility: z.string().min(1, "Please select a facility"),
  nature_of_visit: z.string().optional(),
  score: z.number().int().min(0).max(10),
  comments: z.string().trim().max(1000).optional(),
});

function getSatisfactionLevel(score: number) {
  if (score >= 8) return "excellent";
  if (score >= 6) return "good";
  if (score >= 3) return "poor";
  return "very poor";
}

function FeedbackSubmitSection() {
  const [form, setForm] = useState({
    name: "", contact: "", facility: "", nature_of_visit: "", score: "", comments: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = schema.safeParse({
      ...form,
      score: form.score === "" ? NaN : Number(form.score),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Please check the form");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("feedback").insert({
      name: parsed.data.name,
      contact: parsed.data.contact,
      facility: parsed.data.facility,
      nature_of_visit: parsed.data.nature_of_visit || null,
      score: parsed.data.score,
      satisfaction_level: getSatisfactionLevel(parsed.data.score),
      comments: parsed.data.comments || null,
    });
    setSubmitting(false);
    if (error) { toast.error(error.message); return; }
    setSubmitted(true);
  };

  const reset = () => {
    setForm({ name: "", contact: "", facility: "", nature_of_visit: "", score: "", comments: "" });
    setSubmitted(false);
  };

  return (
    <section className="fb-section-wrap">
      <div style={{ width: "100%", maxWidth: 700, margin: "0 auto" }}>
        <p className="fb-section-title">Share Your Experience</p>
        <p className="fb-section-sub">Your feedback shapes our events</p>
        <div className="fb-card">
          {submitted ? (
            <div style={{ textAlign: "center", padding: "2rem 1rem" }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem" }}>🎉</div>
              <p style={{ fontFamily: "'Cormorant Garamond', Georgia, serif", fontSize: "1.4rem", fontStyle: "italic", color: "var(--dark-fb)", marginBottom: "0.5rem" }}>
                Thank you for your feedback!
              </p>
              <p style={{ fontSize: "0.82rem", color: "var(--muted-fb)", marginBottom: "1.5rem" }}>
                Your testimonial has been submitted and may appear in our carousel.
              </p>
              <button type="button" className="fb-submit-btn" onClick={reset}>Submit Another</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="fb-form-grid">
                <div>
                  <label className="fb-label">Full Name <span style={{ color: "var(--brand-red)" }}>*</span></label>
                  <input type="text" className="fb-input" placeholder="Jane Doe" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div>
                  <label className="fb-label">Contact (phone/email) <span style={{ color: "var(--brand-red)" }}>*</span></label>
                  <input type="text" className="fb-input" placeholder="jane@email.com" value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} required />
                </div>
                <div>
                  <label className="fb-label">Facility Visited <span style={{ color: "var(--brand-red)" }}>*</span></label>
                  <select className="fb-input" value={form.facility} onChange={(e) => setForm({ ...form, facility: e.target.value })} required>
                    <option value="">Select facility...</option>
                    {FACILITY_OPTIONS.map((f) => <option key={f.value} value={f.label}>{f.label}</option>)}
                    <option value="General">General</option>
                  </select>
                </div>
                <div>
                  <label className="fb-label">Nature of Visit</label>
                  <select className="fb-input" value={form.nature_of_visit} onChange={(e) => setForm({ ...form, nature_of_visit: e.target.value })}>
                    <option value="">Select nature of visit...</option>
                    {NATURE_OF_VISIT_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
                <div className="fb-full-col">
                  <label className="fb-label">Score (0-10) <span style={{ color: "var(--brand-red)" }}>*</span></label>
                  <input type="number" min="0" max="10" className="fb-input" value={form.score} onChange={(e) => setForm({ ...form, score: e.target.value })} required />
                </div>
                <div className="fb-full-col">
                  <label className="fb-label">Your Testimonial</label>
                  <textarea className="fb-input" rows={4} placeholder="Tell us about your experience..." value={form.comments} onChange={(e) => setForm({ ...form, comments: e.target.value })} style={{ resize: "vertical" }} />
                </div>
                <div className="fb-full-col">
                  <button type="submit" className="fb-submit-btn" disabled={submitting}>
                    {submitting ? "Submitting..." : "Submit Feedback"}
                  </button>
                </div>
              </div>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

function FeedbackPage() {
  const { data: feedbackRows = [] } = useQuery({
    queryKey: ["public-feedback"],
    queryFn: async () => {
      const { data, error } = await supabase.from("feedback").select("*").limit(50).order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  return (
    <div className="flex min-h-screen flex-col" style={pageShell}>
      <PublicSiteHeader />
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400&family=Dancing+Script:wght@600&display=swap');
        
        :root {
          --brand-red: #C0272D;
          --brand-red-light: #e8a1a3;
          --cream-fb: #faf8f6;
          --warm-white: #ffffff;
          --dark-fb: #2c2416;
          --muted-fb: #8a7560;
          --card-bg-fb: rgba(255,255,255,0.92);
        }

        .fb-section-wrap {
          background: #fcebeb;
          background-image:
            radial-gradient(ellipse at 20% 50%, rgba(192,39,45,0.05) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, rgba(192,39,45,0.08) 0%, transparent 50%);
          padding: clamp(32px, 5vw, 56px) clamp(16px, 4vw, 28px);
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .fb-section-title {
          font-family: 'Cormorant Garamond', Georgia, serif;
          font-size: clamp(1.7rem, 3vw, 2.2rem);
          color: var(--brand-red);
          font-weight: 600;
          font-style: italic;
          margin: 0 0 0.2rem;
          line-height: 1.2;
          text-align: center;
        }
        .fb-section-sub {
          font-size: 0.75rem;
          letter-spacing: 0.15em;
          text-transform: uppercase;
          color: var(--muted-fb);
          margin: 0 0 1.8rem;
          text-align: center;
        }

        .fb-card {
          background: var(--card-bg-fb);
          border-radius: 16px;
          padding: clamp(1.2rem, 3vw, 2rem);
          box-shadow: 0 8px 40px rgba(192,39,45,0.08), 0 2px 8px rgba(192,39,45,0.04);
          border: 1px solid rgba(255,255,255,0.8);
          backdrop-filter: blur(8px);
        }

        .fb-form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 1rem;
        }
        @media (max-width: 600px) {
          .fb-form-grid { grid-template-columns: 1fr; }
        }
        .fb-full-col { grid-column: 1 / -1; }

        .fb-label {
          display: block;
          font-size: 0.72rem;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          color: var(--muted-fb);
          margin-bottom: 0.4rem;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
        }

        .fb-input {
          width: 100%;
          border: 1px solid rgba(192,39,45,0.2);
          border-radius: 8px;
          padding: 0.65rem 0.9rem;
          background: #ffffff;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.88rem;
          color: var(--dark-fb);
          transition: border-color 0.2s, box-shadow 0.2s;
          outline: none;
        }
        .fb-input:focus {
          border-color: var(--brand-red);
          box-shadow: 0 0 0 3px rgba(192,39,45,0.1);
        }

        .fb-submit-btn {
          background: linear-gradient(135deg, #C0272D, #9e2227);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 0.75rem 2rem;
          font-family: 'DM Sans', sans-serif;
          font-size: 0.8rem;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          cursor: pointer;
          transition: all 0.2s;
          font-weight: 500;
          width: 100%;
        }
        .fb-submit-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 20px rgba(192,39,45,0.3);
        }
        .fb-submit-btn:disabled { opacity: 0.6; cursor: not-allowed; transform: none; }
      `}</style>
      <main
        className="flex flex-1 flex-col min-w-0 overflow-x-hidden"
        style={{ width: "100%", boxSizing: "border-box", padding: 0 }}
      >
        <FeedbackSubmitSection />
      </main>
      <PublicSiteFooter fullWidth />
    </div>
  );
}
