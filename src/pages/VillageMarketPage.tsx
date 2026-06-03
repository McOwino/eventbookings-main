import { useState, useMemo, useCallback, memo, useEffect, useRef, type ReactElement } from "react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Swiper, SwiperSlide } from "swiper/react";
import { Autoplay, FreeMode, Navigation, Thumbs } from "swiper/modules";
import type { Swiper as SwiperType } from "swiper";

import "swiper/css";
import "swiper/css/free-mode";
import "swiper/css/navigation";
import "swiper/css/thumbs";

import type { FacilitySlide } from "@/components/FacilityShowcase";
import type {
  EventStatus,
  PublicEvent,
  Promotion as ApiPromotion,
  EventType,
} from "@/lib/events-data";
import { supabase } from "@/integrations/supabase/client";
import {
  activePromotionsQueryOptions,
  facilityShowcaseQueryOptions,
  publicEventsQueryOptions,
} from "@/lib/queries";
import "@/styles/testimonials.css";
import { InterestForm } from "@/components/InterestForm";
import { PublicSiteFooter } from "@/components/public-site/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/public-site/PublicSiteHeader";
import { FACILITY_COLORS } from "@/lib/facility-colors";
import { PUBLIC_MAIN_PADDING, publicShellInnerStyle } from "@/lib/public-shell";
import {
  publicTournamentsQueryOptions,
  expandTournamentToDates,
  formatDays,
  formatFacility,
  type TournamentRow,
} from "@/lib/tournaments";
import styles from "@/styles/vmr-form.module.css";

// ── Types ────────────────────────────────────────────────────────────────────

interface ShowcaseSlide {
  title: string;
  subtitle?: string;
  image: string;
}

interface Promotion {
  id: string;
  title: string;
  type: "event" | "limited";
  facility: string;
  description?: string;
  endsAt: Date | null;
  image: string;
}

interface CalendarEvent {
  id: string;
  title: string;
  facility: string;
  facilityColor: string;
  date: string;
  time: string;
  type: "birthday" | "school" | "hangout" | "league";
  status: EventStatus;
  event_space?: string | null;
}

interface PublicFeedbackRow {
  id: string;
  name: string;
  facility: string;
  nature_of_visit?: string | null;
  score: number;
  satisfaction_level: string;
  comments: string | null;
  created_at: string;
}

const EVENT_STATUS_TAG: Record<
  EventStatus,
  { label: string; background: string; color: string }
> = {
  Confirmed: { label: "Confirmed", background: "#E8F5E9", color: "#2E7D32" },
  Tentative: { label: "Tentative", background: "#FFF8E1", color: "#E65100" },
  Canceled: { label: "Cancelled", background: "#FCEBEB", color: "#791F1F" },
};

function EventStatusTag({ status }: { status: EventStatus }) {
  const tag = EVENT_STATUS_TAG[status];
  return (
    <span
      style={{
        flexShrink: 0,
        fontSize: 11,
        fontWeight: 600,
        padding: "3px 8px",
        borderRadius: 6,
        background: tag.background,
        color: tag.color,
        textTransform: "capitalize",
        whiteSpace: "nowrap",
      }}
    >
      {tag.label}
    </span>
  );
}

// ── Fallback showcase (when API returns no slides) ───────────────────────────

const FALLBACK_SLIDES: ShowcaseSlide[] = [
  {
    title: "Ozone Trampoline Park",
    subtitle: "Where we defy gravity and like birds get to feel the flow of air — perfection",
    image: "https://efwpetazxbuxyttxvecu.supabase.co/storage/v1/object/public/promotions/showcase/1591ab49-9552-4e98-84cc-31bf230225e6/1777269466799.jpg",
  },
  {
    title: "Best Parties in Town",
    image: "https://efwpetazxbuxyttxvecu.supabase.co/storage/v1/object/public/promotions/showcase/1591ab49-9552-4e98-84cc-31bf230225e6/1777269642733.jpg",
  },
  {
    title: "Jump into the Fun Pit",
    image: "https://efwpetazxbuxyttxvecu.supabase.co/storage/v1/object/public/promotions/showcase/1591ab49-9552-4e98-84cc-31bf230225e6/1777270711189.jpg",
  },
  {
    title: "Under The Sea",
    subtitle: "Where kids meet future friends whilst shaping their senses in a funtastic way",
    image: "https://efwpetazxbuxyttxvecu.supabase.co/storage/v1/object/public/promotions/showcase/1591ab49-9552-4e98-84cc-31bf230225e6/1777269567151.jpg",
  },
  {
    title: "The Higher You Go",
    image: "https://efwpetazxbuxyttxvecu.supabase.co/storage/v1/object/public/promotions/showcase/1591ab49-9552-4e98-84cc-31bf230225e6/1777269708545.jpg",
  },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function mapShowcaseSlides(rows: FacilitySlide[]): ShowcaseSlide[] {
  const mapped = rows
    .filter((s) => s.image_url)
    .map((s) => ({
      title: s.title,
      subtitle: s.description ?? undefined,
      image: s.image_url as string,
    }));
  return mapped.length > 0 ? mapped : FALLBACK_SLIDES;
}

function mapApiPromotion(p: ApiPromotion): Promotion {
  return {
    id: p.id,
    title: p.title,
    type: p.kind === "Limited-time offer" ? "limited" : "event",
    facility: p.facility === "All Facilities" ? "Village Market" : p.facility,
    description: p.description || undefined,
    endsAt: new Date(p.endsOn),
    image: p.imageUrl || "https://placehold.co/800x450/1a1a1a/ffffff?text=Promotion",
  };
}

function mapEventType(t: EventType): CalendarEvent["type"] {
  if (t === "Birthday Party") return "birthday";
  if (t === "School Trip") return "school";
  if (t === "Hangout") return "hangout";
  return "hangout";
}

function formatTime12(hhmm: string): string {
  const [hs, ms] = hhmm.split(":");
  const h = Number(hs ?? 0);
  const m = Number(ms ?? 0);
  const am = h < 12;
  const h12 = h % 12 || 12;
  return `${h12}:${String(m).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

/** Maps a 0-10 score to a 1-5 star count for display only. */
function scoreToStars(score: number): number {
  return Math.round((score / 10) * 5);
}

function StarRow({ score }: { score: number }) {
  const stars = scoreToStars(score);
  return (
    <div style={{ display: "flex", gap: 2, justifyContent: "center" }}>
      {Array.from({ length: 5 }, (_, i) => (
        <span
          key={i}
          style={{
            fontSize: 18,
            color: i < stars ? "#C0272D" : "#e8e4de",
            lineHeight: 1,
          }}
        >
          ★
        </span>
      ))}
    </div>
  );
}

function mapPublicEventToCalendar(e: PublicEvent): CalendarEvent {
  return {
    id: e.id,
    title: e.name,
    facility: e.facility,
    facilityColor: FACILITY_COLORS[e.facility] ?? "#888780",
    date: e.date,
    time: formatTime12(e.startTime),
    type: mapEventType(e.type),
    status: e.status,
    event_space: e.event_space ?? undefined,
  };
}

// ── NEW: rich countdown helpers ──────────────────────────────────────────────

/** Break a millisecond duration into { d, h, m, s } zero-padded strings. */
function msToCountdown(ms: number): { d: string; h: string; m: string; s: string } {
  if (ms <= 0) return { d: "00", h: "00", m: "00", s: "00" };
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return {
    d: String(d).padStart(2, "0"),
    h: String(h).padStart(2, "0"),
    m: String(m).padStart(2, "0"),
    s: String(s).padStart(2, "0"),
  };
}

type DaysLeftStatus = "urgent" | "expiring" | "good" | "ended";

function getDaysLeftInfo(endsAt: Date | null): { text: string; status: DaysLeftStatus } {
  if (!endsAt) return { text: "No expiry", status: "good" };
  const ms = endsAt.getTime() - Date.now();
  if (ms <= 0) return { text: "Ended", status: "ended" };
  const days = Math.ceil(ms / 86400000);
  if (days <= 1) return { text: "Last day — hurry!", status: "urgent" };
  if (days <= 3) return { text: `${days} days left`, status: "urgent" };
  if (days <= 7) return { text: `${days} days left`, status: "expiring" };
  return { text: `${days} days remaining`, status: "good" };
}

// Keep old helper so EventCalendar is unaffected
function timeLeft(date: Date): { label: string; urgent: boolean } {
  const diff = date.getTime() - Date.now();
  if (diff <= 0) return { label: "Ended", urgent: false };
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  if (days === 0) return { label: `${hours}h left`, urgent: true };
  if (days <= 3) return { label: `${days}d ${hours}h left`, urgent: true };
  return { label: `${days}d left`, urgent: false };
}

function isExpired(date: Date | null) {
  if (!date) return false;
  return date.getTime() < Date.now();
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-KE", {
    weekday: "long", month: "long", day: "numeric",
  });
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

/** Formats a Date to YYYY-MM-DD using LOCAL time (no UTC shift). */
function toLocalDateStr(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** 6-week grid for a month (outside = adjacent month days). */
function buildMonthCells(calYear: number, calMonth: number): { date: string; day: number; outside: boolean }[] {
  const days = getDaysInMonth(calYear, calMonth);
  const firstDay = getFirstDayOfMonth(calYear, calMonth);
  const prevMonthDays = getDaysInMonth(calYear, calMonth - 1);
  const cells: { date: string; day: number; outside: boolean }[] = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = prevMonthDays - i;
    cells.push({
      date: toLocalDateStr(new Date(calYear, calMonth - 1, d)),
      day: d,
      outside: true,
    });
  }
  for (let d = 1; d <= days; d++) {
    cells.push({
      date: toLocalDateStr(new Date(calYear, calMonth, d)),
      day: d,
      outside: false,
    });
  }
  for (let d = 1, rem = 42 - cells.length; d <= rem; d++) {
    cells.push({
      date: toLocalDateStr(new Date(calYear, calMonth + 1, d)),
      day: d,
      outside: true,
    });
  }
  return cells;
}

// ── Icons (inline SVG) ───────────────────────────────────────────────────────

const Icons = {
  Sparkles: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594z" />
      <path d="M20 2v4M22 4h-4" /><circle cx="4" cy="20" r="2" />
    </svg>
  ),
  MapPin: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  ),
  Clock: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  Hourglass: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 22h14M5 2h14M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2" />
    </svg>
  ),
  Tag: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z" />
      <circle cx="7.5" cy="7.5" r=".5" fill="currentColor" />
    </svg>
  ),
  ChevronLeft: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  ),
  ChevronRight: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  ),
  CalendarOff: () => (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4M16 2v4M3 10h18M2 2l20 20" /><rect width="18" height="18" x="3" y="4" rx="2" />
    </svg>
  ),
  Trophy: () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18M4 22h16M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22M18 2H6v7a6 6 0 0 0 12 0V2z" />
    </svg>
  ),
  GraduationCap: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.42 10.922a1 1 0 0 0-.019-1.838L12.83 5.18a2 2 0 0 0-1.66 0L2.6 9.08a1 1 0 0 0 0 1.832l8.57 3.908a2 2 0 0 0 1.66 0z" />
      <path d="M22 10v6M6 12.5V16a6 3 0 0 0 12 0v-3.5" />
    </svg>
  ),
  PartyPopper: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5.8 11.3 2 22l10.7-3.79M4 3h.01M22 8h.01M15 2h.01M22 20h.01m0-18-2.24.75a2.9 2.9 0 0 0-1.96 3.12c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 10m8 3-.82-.33c-.86-.34-1.82.2-1.98 1.11-.11.7-.72 1.22-1.43 1.22H17m-6-11 .33.82c.34.86-.2 1.82-1.11 1.98C9.52 4.9 9 5.52 9 6.23V7M11 13c1.93 1.93 2.83 4.17 2 5-.83.83-3.07-.07-5-2-1.93-1.93-2.83-4.17-2-5 .83-.83 3.07.07 5 2Z" />
    </svg>
  ),
  Users: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </svg>
  ),
  CalendarDays: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 2v4M16 2v4" /><rect width="18" height="18" x="3" y="4" rx="2" /><path d="M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01" />
    </svg>
  ),
};

type TabType = "overall" | "school" | "birthday" | "hangout";

const WEEKDAY_LABELS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"] as const;

const CALENDAR_TABS: { key: TabType; label: string; Icon: () => ReactElement }[] = [
  { key: "overall", label: "Overall", Icon: Icons.CalendarDays },
  { key: "school", label: "School", Icon: Icons.GraduationCap },
  { key: "birthday", label: "Birthday", Icon: Icons.PartyPopper },
  { key: "hangout", label: "Hangout", Icon: Icons.Users },
];

// ── Sub-components ───────────────────────────────────────────────────────────

function OurFacilitySection({ slides, loading }: { slides: ShowcaseSlide[]; loading?: boolean }) {
  const [thumbsSwiper, setThumbsSwiper] = useState<SwiperType | null>(null);

  if (loading) {
    return (
      <section className="vm-our-facility" style={{ width: "100%", background: "#000000", margin: 0, padding: 0 }}>
        <div
          className="shell-max vm-facility-loading-skel"
          style={{
            margin: "0 auto",
            height: "min(52vw, 420px)",
            maxWidth: 1100,
            background: "#171717",
            borderRadius: 0,
          }}
        />
      </section>
    );
  }

  return (
    <section className="vm-our-facility" style={{ width: "100%", background: "#000000", margin: 0, padding: 0 }}>
      <div className="shell-max vm-facility-showcase" style={{ margin: "0 auto", padding: "0 clamp(8px, 2vw, 20px) clamp(14px, 2vw, 22px)", boxSizing: "border-box" }}>
        <Swiper
          spaceBetween={20}
          speed={1400}
          roundLengths
          loop={slides.length > 1}
          loopAdditionalSlides={1}
          navigation
          autoplay={
            slides.length > 1
              ? { delay: 3000, disableOnInteraction: false, pauseOnMouseEnter: true }
              : false
          }
          thumbs={{ swiper: thumbsSwiper && !thumbsSwiper.destroyed ? thumbsSwiper : null }}
          modules={[Autoplay, FreeMode, Navigation, Thumbs]}
          className="vm-facility-main"
        >
          {slides.map((s, idx) => (
            <SwiperSlide key={`${s.title}-${idx}`}>
              <div
                className="vm-facility-slide-frame"
                style={{ position: "relative", width: "100%", overflow: "hidden", background: "#0a0a0a" }}
              >
                <img src={s.image} alt={s.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(0,0,0,0.82) 0%, rgba(0,0,0,0.25) 45%, transparent 100%)",
                    pointerEvents: "none",
                  }}
                />
                <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "clamp(14px, 3vw, 28px)" }}>
                  <h3
                    className="hero-slide-sub"
                    style={{
                      margin: 0,
                      fontSize: "clamp(17px, 3.2vw, 34px)",
                      fontWeight: 700,
                      color: "#fff",
                      letterSpacing: "-0.02em",
                    }}
                  >
                    {s.title}
                  </h3>
                  {s.subtitle && (
                    <p style={{ margin: "8px 0 0", fontSize: "clamp(12px, 1.4vw, 15px)", color: "rgba(255,255,255,0.85)", maxWidth: "min(36rem, 90%)" }}>
                      {s.subtitle}
                    </p>
                  )}
                </div>
              </div>
            </SwiperSlide>
          ))}
        </Swiper>

        <Swiper
          onSwiper={setThumbsSwiper}
          spaceBetween={10}
          slidesPerView={3.2}
          breakpoints={{
            640: { slidesPerView: 4.5 },
            900: { slidesPerView: 5.5 },
            1200: { slidesPerView: 6.5 },
          }}
          freeMode
          watchSlidesProgress
          modules={[FreeMode, Navigation, Thumbs]}
          className="vm-facility-thumbs"
          style={{ marginTop: 12 }}
        >
          {slides.map((s, idx) => (
            <SwiperSlide key={`thumb-${s.title}-${idx}`} className="vm-facility-thumb-slide">
              <div style={{ height: 52, borderRadius: 8, overflow: "hidden", cursor: "pointer" }}>
                <img src={s.image} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            </SwiperSlide>
          ))}
        </Swiper>
      </div>
    </section>
  );
}

// ── Calendar ─────────────────────────────────────────────────────────────────

function EventCalendar({ events }: { events: CalendarEvent[] }) {
  const [tab, setTab] = useState<TabType>("overall");
  const [selectedDate, setSelectedDate] = useState(() => toLocalDateStr(new Date()));
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  const todayStr = toLocalDateStr(new Date());

  const cells = useMemo(() => buildMonthCells(calYear, calMonth), [calYear, calMonth]);

  const eventDays = useMemo(
    () => new Set(
      events
        .filter(e => tab === "overall" || (e.type !== "league" && e.type === tab))
        .map(e => e.date),
    ),
    [events, tab]
  );

  const filteredEvents = useMemo(
    () => events.filter(e =>
      e.date === selectedDate &&
      (tab === "overall" || (e.type !== "league" && e.type === tab)),
    ),
    [events, selectedDate, tab]
  );

  const monthName = useMemo(
    () => new Date(calYear, calMonth).toLocaleString("en-KE", { month: "long", year: "numeric" }),
    [calYear, calMonth]
  );

  const prevMonth = useCallback(() => {
    setCalMonth(m => {
      if (m === 0) {
        setCalYear(y => y - 1);
        return 11;
      }
      return m - 1;
    });
  }, []);

  const nextMonth = useCallback(() => {
    setCalMonth(m => {
      if (m === 11) {
        setCalYear(y => y + 1);
        return 0;
      }
      return m + 1;
    });
  }, []);

  return (
    <div className="event-cal-outer">
      <div className="event-cal-body">
        <div className="event-cal-left">
          {/* Tabs — same column width as mini calendar */}
          <div className="event-cal-tabs" style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6, background: "#C0272D", padding: 6, borderRadius: 12, width: "100%", boxSizing: "border-box" }}>
            {CALENDAR_TABS.map(t => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                style={{
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 6,
                  padding: "8px 4px", borderRadius: 8, border: "none", cursor: "pointer",
                  fontSize: 13, fontWeight: 500, fontFamily: "inherit",
                  background: tab === t.key ? "#fff" : "transparent",
                  color: tab === t.key ? "#C0272D" : "rgba(255,255,255,0.85)",
                  boxShadow: tab === t.key ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s",
                }}
              >
                <t.Icon /><span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Mini calendar — same width as tabs (column) */}
          <div className="event-cal-mini" style={{
            background: "#fff", border: "0.5px solid #e8e4de", borderRadius: 8,
            padding: "8px 10px", boxSizing: "border-box",
            width: "100%", minWidth: 296, maxWidth: "100%", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <button
                type="button"
                onClick={prevMonth}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", padding: 2, borderRadius: 4 }}
              >
                <Icons.ChevronLeft />
              </button>
              <span style={{ fontSize: 12, fontWeight: 600, color: "#1a1a1a", lineHeight: 1.2 }}>{monthName}</span>
              <button
                type="button"
                onClick={nextMonth}
                style={{ background: "none", border: "none", cursor: "pointer", color: "#555", display: "flex", padding: 2, borderRadius: 4 }}
              >
                <Icons.ChevronRight />
              </button>
            </div>
            <div className="event-cal-grid" style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 1, width: "100%" }}>
              {WEEKDAY_LABELS.map(d => (
                <div key={d} className="event-cal-dow" style={{ textAlign: "center", fontSize: 10, color: "#888", fontWeight: 500, padding: "0 0 4px", lineHeight: 1 }}>{d}</div>
              ))}
              {cells.map((c, i) => {
                const isToday = c.date === todayStr;
                const isSelected = c.date === selectedDate;
                const hasEvent = eventDays.has(c.date);
                return (
                  <button
                    key={i}
                    type="button"
                    className="event-cal-day-btn"
                    onClick={() => setSelectedDate(c.date)}
                    style={{
                      width: "100%", height: 32, minHeight: 32, maxHeight: 32,
                      display: "flex", flexDirection: "column",
                      alignItems: "center", justifyContent: "center",
                      border: "none", borderRadius: 4, cursor: "pointer",
                      fontSize: 11, fontFamily: "inherit", padding: 0,
                      fontWeight: isSelected || isToday ? 700 : hasEvent ? 600 : 400,
                      background: isSelected ? "#C0272D" : isToday ? "#FCEBEB" : hasEvent ? "#FFF0F0" : "transparent",
                      color: isSelected ? "#fff" : isToday ? "#C0272D" : c.outside ? "#bbb" : "#1a1a1a",
                      transition: "all 0.12s",
                      position: "relative",
                    }}
                  >
                    {c.day}
                    {hasEvent && !isSelected && (
                      <span className="event-cal-dot" style={{
                        position: "absolute", bottom: 3, left: "50%", transform: "translateX(-50%)",
                        width: 3, height: 3, borderRadius: "50%", background: "#C0272D",
                      }} />
                    )}
                  </button>
                );
              })}
            </div>
            <div style={{ borderTop: "0.5px solid #f0ece6", marginTop: 6, paddingTop: 6, display: "flex", flexWrap: "wrap", gap: "4px 10px", fontSize: 10, color: "#999" }}>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#C0272D", display: "inline-block", flexShrink: 0 }} />
                Has events
              </span>
              <span style={{ display: "flex", alignItems: "center", gap: 3 }}>
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#e8e4de", display: "inline-block", flexShrink: 0 }} />
                No events
              </span>
            </div>
          </div>
        </div>

        {/* Events panel */}
        <div className="event-cal-panel">
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 12 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#1a1a1a" }}>
              {formatDate(selectedDate)}
            </h3>
            <span style={{ fontSize: 13, color: "#aaa" }}>
              {filteredEvents.length} event{filteredEvents.length !== 1 ? "s" : ""}
            </span>
          </div>

          {filteredEvents.length === 0 ? (
            <div style={{
              border: "0.5px dashed #d8d4ce", borderRadius: 14,
              padding: "32px 20px", textAlign: "center",
            }}>
              <div style={{ color: "#ccc", marginBottom: 8 }}><Icons.CalendarOff /></div>
              <p style={{ margin: "0 0 4px", fontWeight: 600, color: "#888", fontSize: 14 }}>Nothing on for today</p>
              <p style={{ margin: 0, fontSize: 12, color: "#aaa" }}>
                Check another date or submit an event interest above
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {filteredEvents.map((ev) => (
                <div
                  key={ev.id}
                  style={{
                    background: "#fff",
                    border: "0.5px solid #e8e4de",
                    borderLeft: `3px solid ${ev.facilityColor}`,
                    borderRadius: "0 10px 10px 0",
                    padding: "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 4,
                    opacity: ev.status === "Canceled" ? 0.65 : 1,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      justifyContent: "space-between",
                      gap: 10,
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14, color: "#1a1a1a", minWidth: 0 }}>
                      {ev.title}
                    </span>
                    <EventStatusTag status={ev.status} />
                  </div>
                  <div style={{ display: "flex", gap: 12, fontSize: 12, color: "#888", flexWrap: "wrap" }}>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Icons.MapPin />
                      {ev.facility}
                    </span>
                    <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                      <Icons.Clock />
                      {ev.time}
                    </span>
                    {ev.event_space && (
                      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                        <Icons.Tag />
                        {ev.event_space}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Facility legend */}
          <div style={{
            marginTop: 16, background: "#C0272D", borderRadius: 10,
            padding: "10px 14px",
          }}>
            <p style={{ margin: "0 0 8px", fontSize: 11, fontWeight: 600, color: "rgba(255,255,255,0.7)", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              Facility colours
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
              {Object.entries(FACILITY_COLORS).map(([name, color]) => (
                <span key={name} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 12, color: "#ffffff" }}>
                  <span style={{ width: 10, height: 10, borderRadius: 3, background: color as string, flexShrink: 0 }} />
                  {name}
                </span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── NEW: Promotions poster slider ────────────────────────────────────────────

/** One animated countdown unit (days / hrs / min / sec). */
function CountdownUnit({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
      <div
        style={{
          background: "rgba(255,255,255,0.07)",
          border: "0.5px solid rgba(255,255,255,0.14)",
          borderRadius: 6,
          width: 44,
          height: 46,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "'Georgia', 'Times New Roman', serif",
          fontSize: 20,
          fontWeight: 700,
          color: "#fff",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </div>
      <span style={{ fontSize: 9, color: "rgba(255,255,255,0.45)", textTransform: "uppercase", letterSpacing: "0.08em" }}>
        {label}
      </span>
    </div>
  );
}

const STATUS_DOT_COLORS: Record<DaysLeftStatus, string> = {
  good: "#69d285",
  expiring: "#ffa940",
  urgent: "#ff6b6b",
  ended: "#888780",
};

function PromotionSlide({
  promotion,
  active,
}: {
  promotion: Promotion;
  active: boolean;
}) {
  const expired = isExpired(promotion.endsAt);

  // Live ticking countdown
  const [countdown, setCountdown] = useState(() =>
    msToCountdown(promotion.endsAt ? promotion.endsAt.getTime() - Date.now() : 0)
  );
  const [daysInfo, setDaysInfo] = useState(() => getDaysLeftInfo(promotion.endsAt));

  useEffect(() => {
    if (!promotion.endsAt || expired) return;
    const tick = () => {
      const ms = promotion.endsAt!.getTime() - Date.now();
      setCountdown(msToCountdown(ms));
      setDaysInfo(getDaysLeftInfo(promotion.endsAt));
    };
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [promotion.endsAt, expired]);

  const dotColor = STATUS_DOT_COLORS[daysInfo.status];

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        minHeight: 420,
        display: "flex",
        flexDirection: "column",
        justifyContent: "flex-end",
        overflow: "hidden",
        opacity: expired ? 0.5 : 1,
        filter: expired ? "grayscale(0.6)" : "none",
        transition: "opacity 0.3s",
      }}
    >
      {/* Background image */}
      <img
        src={promotion.image}
        alt={promotion.title}
        loading="lazy"
        style={{
          position: "absolute",
          inset: 0,
          width: "100%",
          height: "100%",
          objectFit: "cover",
          transform: active ? "scale(1.04)" : "scale(1)",
          transition: "transform 6s ease",
          opacity: 1,
        }}
      />
      {/* Dark vignette */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "linear-gradient(135deg, rgba(13,13,13,0.88) 0%, rgba(13,13,13,0.6) 45%, rgba(13,13,13,0.25) 100%)",
        }}
      />

      {/* Top-left badge */}
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 20,
          display: "flex",
          alignItems: "center",
          gap: 6,
          background: promotion.type === "limited" ? "rgba(192,39,45,0.9)" : "rgba(0,0,0,0.5)",
          border: "0.5px solid rgba(255,255,255,0.15)",
          borderRadius: 20,
          padding: "4px 12px",
          fontSize: 11,
          fontWeight: 600,
          color: "#fff",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
        }}
      >
        <Icons.Tag />
        {promotion.type === "limited" ? "Limited offer" : "Event"}
      </div>



      {/* Bottom content */}
      <div
        style={{
          position: "relative",
          zIndex: 2,
          padding: "28px 24px 24px",
          display: "flex",
          gap: 24,
          alignItems: "flex-end",
        }}
      >
        {/* Left: text */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 10,
              letterSpacing: "2px",
              textTransform: "uppercase",
              color: "rgba(255,255,255,0.55)",
              marginBottom: 6,
              display: "flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <Icons.MapPin />
            {promotion.facility}
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "clamp(18px, 2.2vw, 22px)",
              fontWeight: 700,
              color: "#ffffff",
              lineHeight: 1.25,
              marginBottom: 6,
            }}
          >
            {promotion.title}
          </h3>
          {promotion.description && (
            <p
              style={{
                margin: "0 0 12px",
                fontSize: 13,
                color: "rgba(255,255,255,0.9)",
                lineHeight: 1.55,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {promotion.description}
            </p>
          )}
          {/* Days-left pill */}
          {promotion.endsAt && (
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                fontSize: 12,
                fontWeight: 600,
                color: dotColor,
              }}
            >
              <span
                style={{
                  width: 7,
                  height: 7,
                  borderRadius: "50%",
                  background: dotColor,
                  boxShadow: `0 0 6px ${dotColor}`,
                  flexShrink: 0,
                }}
              />
              {daysInfo.text}
            </div>
          )}
        </div>

        {/* Right: countdown clock */}
        {promotion.endsAt && !expired && (
          <div style={{ flexShrink: 0, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
            <span
              style={{
                fontSize: 9,
                fontWeight: 600,
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                color: "rgba(255,255,255,0.45)",
              }}
            >
              Ends in
            </span>
            <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
              <CountdownUnit value={countdown.d} label="days" />
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>:</span>
              <CountdownUnit value={countdown.h} label="hrs" />
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>:</span>
              <CountdownUnit value={countdown.m} label="min" />
              <span style={{ fontSize: 16, color: "rgba(255,255,255,0.25)", marginBottom: 14 }}>:</span>
              <CountdownUnit value={countdown.s} label="sec" />
            </div>
          </div>
        )}
        {expired && (
          <div
            style={{
              flexShrink: 0,
              background: "rgba(255,255,255,0.07)",
              border: "0.5px solid rgba(255,255,255,0.12)",
              borderRadius: 8,
              padding: "8px 14px",
              fontSize: 12,
              fontWeight: 600,
              color: "rgba(255,255,255,0.4)",
            }}
          >
            Offer ended
          </div>
        )}
      </div>
    </div>
  );
}

function PromotionsSection({ promotions }: { promotions: Promotion[] }) {
  const sorted = useMemo(
    () =>
      [...promotions].sort((a, b) => {
        const aExp = isExpired(a.endsAt);
        const bExp = isExpired(b.endsAt);
        if (aExp !== bExp) return aExp ? 1 : -1;
        return 0;
      }),
    [promotions]
  );

  const [current, setCurrent] = useState(0);
  const [progress, setProgress] = useState(0);
  const AUTO = 8000;
  const progRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startRef = useRef(Date.now());
  const pausedRef = useRef(false);
  const remainingRef = useRef(AUTO);

  const startSlide = useCallback(() => {
    if (progRef.current) clearInterval(progRef.current);
    if (autoRef.current) clearTimeout(autoRef.current);
    
    startRef.current = Date.now();
    progRef.current = setInterval(() => {
      const elapsed = Date.now() - startRef.current;
      setProgress(Math.min(100, (elapsed / remainingRef.current) * 100));
    }, 60);
    
    autoRef.current = setTimeout(() => {
      setCurrent((c) => (c + 1) % sorted.length);
      setProgress(0);
      remainingRef.current = AUTO;
      startSlide();
    }, remainingRef.current);
  }, [sorted.length]);

  const go = useCallback(
    (n: number) => {
      setCurrent(((n % sorted.length) + sorted.length) % sorted.length);
      setProgress(0);
      remainingRef.current = AUTO;
      if (!pausedRef.current) {
        startSlide();
      } else {
        startRef.current = Date.now();
      }
    },
    [sorted.length, startSlide]
  );

  useEffect(() => {
    if (sorted.length <= 1) return;
    startSlide();
    return () => {
      if (progRef.current) clearInterval(progRef.current);
      if (autoRef.current) clearTimeout(autoRef.current);
    };
  }, [sorted.length, startSlide]);

  if (sorted.length === 0) return null;

  return (
    <section
      className="vm-promotions-section"
      style={{
        background: "#0d0d0d",
        marginLeft: "calc(-1 * clamp(16px, 4vw, 28px))",
        marginRight: "calc(-1 * clamp(16px, 4vw, 28px))",
        padding: "clamp(28px, 4vw, 44px) 0 clamp(32px, 5vw, 52px)",
      }}
    >
      <div
        className="shell-max"
        style={{
          maxWidth: "100%",
          margin: "0 auto",
          paddingLeft: "clamp(16px, 4vw, 28px)",
          paddingRight: "clamp(16px, 4vw, 28px)",
        }}
      >
        {/* Section header */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            justifyContent: "space-between",
            marginBottom: 20,
            flexWrap: "wrap",
            gap: 14,
          }}
        >
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ color: "#C0272D" }}><Icons.Sparkles /></div>
              <h2
                style={{
                  margin: 0,
                  fontSize: "clamp(18px, 2.2vw, 24px)",
                  fontWeight: 800,
                  color: "#ffffff",
                  letterSpacing: "-0.02em",
                }}
              >
                Promotions &amp; Events
              </h2>
            </div>
            <p style={{ margin: 0, fontSize: 14, color: "#888780" }}>
              Limited-time offers — tap to explore.
            </p>
          </div>

          {/* Dot navigation */}
          {sorted.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                type="button"
                onClick={() => go(current - 1)}
                aria-label="Previous promotion"
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  border: "0.5px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.07)",
                  color: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Icons.ChevronLeft />
              </button>
              {sorted.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  aria-label={`Go to promotion ${i + 1}`}
                  onClick={() => go(i)}
                  style={{
                    width: i === current ? 20 : 7,
                    height: 7,
                    borderRadius: 4,
                    border: "none",
                    background: i === current ? "#C0272D" : "rgba(255,255,255,0.25)",
                    cursor: "pointer",
                    padding: 0,
                    transition: "all 0.25s",
                  }}
                />
              ))}
              <button
                type="button"
                onClick={() => go(current + 1)}
                aria-label="Next promotion"
                style={{
                  width: 32, height: 32, borderRadius: "50%",
                  border: "0.5px solid rgba(255,255,255,0.15)",
                  background: "rgba(255,255,255,0.07)",
                  color: "#fff", cursor: "pointer",
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}
              >
                <Icons.ChevronRight />
              </button>
            </div>
          )}
        </div>

        {/* Poster slider */}
        <div
          onMouseEnter={() => {
            if (pausedRef.current) return;
            pausedRef.current = true;
            remainingRef.current = remainingRef.current - (Date.now() - startRef.current);
            if (progRef.current) clearInterval(progRef.current);
            if (autoRef.current) clearTimeout(autoRef.current);
          }}
          onMouseLeave={() => {
            if (!pausedRef.current) return;
            pausedRef.current = false;
            startSlide();
          }}
          style={{
            borderRadius: 14,
            overflow: "hidden",
            position: "relative",
            width: "100%",
          }}
        >
          {/* Auto-advance progress bar */}
          {sorted.length > 1 && (
            <div style={{ height: 3, background: "rgba(255,255,255,0.08)" }}>
              <div
                style={{
                  height: "100%",
                  width: `${progress}%`,
                  background: "linear-gradient(90deg, #C0272D, #ff6b6b)",
                  transition: "width 0.06s linear",
                }}
              />
            </div>
          )}

          {/* Slides (CSS-only transition — no Swiper) */}
          <div style={{ position: "relative", overflow: "hidden" }}>
            {sorted.map((p, i) => (
              <div
                key={p.id}
                style={{
                  display: i === current ? "block" : "none",
                }}
              >
                <PromotionSlide promotion={p} active={i === current} />
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/** Shared style for the ← → control buttons */
const ctrlBtnStyle: React.CSSProperties = {
  width: 38,
  height: 38,
  borderRadius: "50%",
  border: "0.5px solid #e8e4de",
  background: "#fff",
  color: "#888780",
  fontSize: 16,
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.15s",
};

function getSatisfactionStyle(level: string) {
  switch (level.toLowerCase()) {
    case "excellent": return { background: "rgba(34,197,94,0.15)", color: "#15803d" };
    case "good": return { background: "rgba(234,179,8,0.15)", color: "#a16207" };
    case "poor": return { background: "rgba(249,115,22,0.15)", color: "#c2410c" };
    default: return { background: "rgba(239,68,68,0.15)", color: "#b91c1c" };
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

interface TestimonialSettings {
  shuffle: boolean;
  autoplay: boolean;
  speed_ms: number;
}

function TestimonialsSection({
  rows,
  settings,
}: {
  rows: PublicFeedbackRow[];
  settings: TestimonialSettings;
}) {
  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const entries = useMemo(() => {
    const copy = [...rows];
    if (settings.shuffle) {
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
    }
    return copy;
  }, [rows, settings.shuffle]);

  const total = entries.length;
  const entry = entries[index];

  const stopPlay = useCallback(() => {
    setPlaying(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  const next = useCallback(() => {
    setIndex((i) => (i + 1) % Math.max(total, 1));
  }, [total]);

  const prev = useCallback(() => {
    setIndex((i) => (i - 1 + total) % Math.max(total, 1));
  }, [total]);

  const togglePlay = useCallback(() => {
    setPlaying((p) => {
      if (p) {
        if (timerRef.current) clearInterval(timerRef.current);
        return false;
      }
      timerRef.current = setInterval(
        () => setIndex((i) => (i + 1) % Math.max(total, 1)),
        settings.speed_ms
      );
      return true;
    });
  }, [total, settings.speed_ms]);

  useEffect(() => {
    if (total === 0 || !settings.autoplay) return;
    setPlaying(true);
    timerRef.current = setInterval(() => {
      setIndex((i) => (i + 1) % Math.max(total, 1));
    }, settings.speed_ms);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [total, settings.autoplay, settings.speed_ms]);

  if (total === 0) return null;

  return (
    <section className="fb-section-wrap" style={{ paddingBottom: "40px" }}>
      <div style={{ maxWidth: 700, margin: "0 auto" }}>

        <div style={{ marginBottom: "1.5rem" }}>
          <p className="fb-section-title">Testimonials</p>
          <p className="fb-section-sub">What our guests say</p>
        </div>

        {/* Card */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 425 }}>
          <div key={entry.id} className="t-card-red">

            {/* Quote badge */}
            <div className="t-quote-badge">❝</div>

            {/* Quote text */}
            <p className="t-text-red">"{entry.comments || "Great experience!"}"</p>

            {/* Divider */}
            <div className="t-divider-red" />

            {/* Author — Dancing Script via .t-author-red */}
            <div className="t-author-red">{entry.name}</div>

            {/* Meta tags */}
            <div className="t-meta-red">
              <span className="t-tag-red">📍 {entry.facility}</span>
              <span className="t-tag-red">Score {entry.score}/10</span>
              <span className="t-tag-red" style={{ ...getSatisfactionStyle(entry.satisfaction_level) }}>
                {capitalize(entry.satisfaction_level)}
              </span>
              {entry.nature_of_visit && (
                <span className="t-tag-red">✨ {entry.nature_of_visit}</span>
              )}
            </div>

            {/* Stars */}
            <StarRow score={entry.score} />

          </div>
        </div>

        {/* Progress dots */}
        <div className="t-prog-dots">
          {Array.from({ length: Math.min(total, 7) }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => { stopPlay(); setIndex(i); }}
              className={`t-prog-dot${i === index % Math.min(total, 7) ? " active" : ""}`}
              aria-label={`Testimonial ${i + 1}`}
            />
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "1rem", marginTop: "1.5rem" }}>
          <button type="button" className="t-ctrl-btn" onClick={() => { stopPlay(); prev(); }} aria-label="Previous">←</button>
          <button type="button" className="t-ctrl-btn t-ctrl-btn-play" onClick={togglePlay} aria-label={playing ? "Pause" : "Play"}>
            {playing ? "⏸" : "▶"}
          </button>
          <button type="button" className="t-ctrl-btn" onClick={() => { stopPlay(); next(); }} aria-label="Next">→</button>
          <span className="t-counter-text">{index + 1} / {total}</span>
        </div>

      </div>
    </section>
  );
}



// ── Main page ────────────────────────────────────────────────────────────────

export default function VillageMarketPage() {
  const eventsQuery = useQuery(publicEventsQueryOptions());
  const showcaseQuery = useQuery(facilityShowcaseQueryOptions());
  const promosQuery = useQuery(activePromotionsQueryOptions());
  const tournamentsQuery = useQuery(publicTournamentsQueryOptions());

  const slides = useMemo(
    () => mapShowcaseSlides((showcaseQuery.data as any[]) ?? []),
    [showcaseQuery.data],
  );

  const calendarEvents = useMemo(() => {
    const today = new Date();
    const windowStart = toLocalDateStr(new Date(today.getFullYear(), today.getMonth() - 1, 1));
    const windowEnd = toLocalDateStr(new Date(today.getFullYear(), today.getMonth() + 3, 0));

    const fromEvents = ((eventsQuery.data as any[]) ?? []).map(mapPublicEventToCalendar);
    const fromTournaments = ((tournamentsQuery.data as TournamentRow[]) ?? []).flatMap((t) =>
      expandTournamentToDates(t, windowStart, windowEnd),
    );

    return [...fromEvents, ...fromTournaments];
  }, [eventsQuery.data, tournamentsQuery.data]);

  const promotions = useMemo(
    () => ((promosQuery.data as any[]) ?? []).map(mapApiPromotion),
    [promosQuery.data],
  );

  const feedbackQuery = useQuery({
    queryKey: ["public", "testimonials"],
    queryFn: async () => {
      // Fetch settings and feedback in parallel — no blocking dependency
      const [settingsRes, feedbackRes] = await Promise.all([
        (supabase as any)
          .from("testimonial_settings")
          .select("min_score, max_cards, shuffle, autoplay, speed_ms")
          .eq("id", 1)
          .maybeSingle(),
        supabase
          .from("feedback")
          .select("id, name, facility, nature_of_visit, score, satisfaction_level, comments, created_at")
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      if (feedbackRes.error) {
        console.error("Supabase feedback query error:", feedbackRes.error);
        throw feedbackRes.error;
      }

      const s = settingsRes.data ?? {
        min_score: 7, max_cards: 10,
        shuffle: true, autoplay: true, speed_ms: 5000,
      };

      // Re-filter client-side using actual settings
      const allRows = (feedbackRes.data ?? []) as PublicFeedbackRow[];
      const rows = allRows
        .filter((r) => r.score >= s.min_score)
        .slice(0, s.max_cards);

      return { rows, settings: s };
    },
    staleTime: 5 * 60 * 1000,
  });

  const feedbackRows = feedbackQuery.data?.rows ?? [];
  const settings = feedbackQuery.data?.settings ?? {
    min_score: 7, max_cards: 10,
    shuffle: true, autoplay: true, speed_ms: 5000,
  };

  return (
    <div style={{ minHeight: "100vh", background: "#faf8f6", fontFamily: "'Georgia', 'Times New Roman', serif" }}>
      <style>{`
        
        * { box-sizing: border-box; }
        body { margin: 0; }
        button:focus-visible { outline: 2px solid #C0272D; outline-offset: 2px; }
        input:focus, select:focus, textarea:focus {
          outline: none;
          border-color: #C0272D !important;
          box-shadow: 0 0 0 3px rgba(192,39,45,0.12);
        }
        ::-webkit-scrollbar { display: none; }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .section-animate {
          animation: fadeUp 0.5s ease both;
          /* Fallback: ensure visible if animation never fires */
          opacity: 1;
        }

        :root {
          --brand-red: #C0272D;
          --muted-fb: #8a7560;
        }


        @media (max-width: 640px) {
          .cal-grid { grid-template-columns: 1fr !important; }
        }
        .vm-our-facility {
          margin: 0;
          padding: 0;
        }
        .vm-our-facility .vm-facility-main.swiper {
          margin-block-start: 0;
          padding-block-start: 0;
          overflow: hidden;
          box-sizing: border-box;
        }
        .vm-facility-showcase .vm-facility-main .swiper-slide {
          height: auto;
          box-sizing: border-box;
        }
        .vm-facility-slide-frame {
          aspect-ratio: 21 / 9;
          width: 100%;
          box-sizing: border-box;
        }
        @media (min-width: 1024px) {
          .vm-facility-slide-frame {
            aspect-ratio: 21 / 8.1;
          }
          .vm-facility-loading-skel {
            height: min(46.8vw, 378px) !important;
          }
        }
        .vm-facility-showcase .vm-facility-main .swiper-button-next,
        .vm-facility-showcase .vm-facility-main .swiper-button-prev {
          color: #fff;
          background: rgba(0, 0, 0, 0.55);
          width: 42px;
          height: 42px;
          border-radius: 50%;
          backdrop-filter: blur(6px);
        }
        .vm-facility-showcase .vm-facility-main .swiper-button-next::after,
        .vm-facility-showcase .vm-facility-main .swiper-button-prev::after {
          font-size: 16px;
          font-weight: 700;
        }
        .vm-facility-showcase .vm-facility-thumbs .swiper-slide {
          opacity: 0.5;
          transition: opacity 0.22s ease;
        }
        .vm-facility-showcase .vm-facility-thumbs .swiper-slide-thumb-active {
          opacity: 1;
          outline: 2px solid #C0272D;
          outline-offset: 2px;
          border-radius: 8px;
        }
        @media (min-width: 640px) {
          .vm-facility-thumb-slide > div {
            height: 60px !important;
          }
        }

        .event-cal-body {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 20px;
          align-items: start;
        }
        .event-cal-left {
          display: flex;
          flex-direction: column;
          gap: 12px;
          width: fit-content;
          max-width: 100%;
          align-self: start;
        }
        .event-cal-left .event-cal-tabs {
          margin-bottom: 0;
        }

        /* ── Tablet Mode (Event Calendar) ── */
        @media (min-width: 641px) and (max-width: 1023px) {
          .desktop-calendar-section {
            min-height: 55vh; /* Reduced height by 10% as requested */
            display: flex;
            flex-direction: column;
          }
          .desktop-calendar-section .event-cal-body {
            flex: 1;
            min-height: 0;
            height: 100%;
            align-items: stretch;
            gap: 24px;
          }
          .desktop-calendar-section .event-cal-left {
            align-self: stretch;
            height: 100%;
            min-height: 0;
            display: flex;
            flex-direction: column;
            justify-content: space-evenly;
          }
          .desktop-calendar-section .event-cal-mini {
            flex: 1;
            height: auto;
            min-height: 0;
            display: flex;
            flex-direction: column;
            justify-content: space-evenly;
            padding: 16px 18px !important;
          }
          .desktop-calendar-section .event-cal-grid {
            flex: 1;
            align-content: space-evenly;
            gap: 4px !important;
          }
          .desktop-calendar-section .event-cal-day-btn {
            height: clamp(40px, 5.5vh, 52px) !important;
            min-height: clamp(40px, 5.5vh, 52px) !important;
            max-height: clamp(40px, 5.5vh, 52px) !important;
          }
          .desktop-calendar-section .event-cal-panel {
            min-height: 0;
            height: 100%;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
            justify-content: space-evenly;
          }
        }

        @media (min-width: 1024px) {
          .hero-slide-sub { max-width: min(56rem, 50vw); }
          .desktop-calendar-section {
            min-height: 70vh;
            display: flex;
            flex-direction: column;
          }
          .desktop-calendar-section .calendar-section-head {
            flex-shrink: 0;
          }
          .desktop-calendar-section .event-cal-outer {
            flex: 1;
            display: flex;
            flex-direction: column;
            min-height: 0;
          }
          .desktop-calendar-section .event-cal-body {
            flex: 1;
            min-height: 0;
            height: 100%;
            align-items: stretch;
            gap: 28px;
          }
          .desktop-calendar-section .event-cal-left {
            align-self: stretch;
            height: 100%;
            min-height: 0;
            gap: 16px;
            width: auto;
            min-width: min(100%, 360px);
            max-width: min(100%, 480px);
          }
          .desktop-calendar-section .event-cal-mini {
            align-self: stretch;
            flex: 1;
            height: auto;
            min-height: 0;
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;
            padding: 16px 18px !important;
            border-radius: 12px !important;
            display: flex;
            flex-direction: column;
          }
          .desktop-calendar-section .event-cal-mini > div:first-child {
            margin-bottom: 10px !important;
          }
          .desktop-calendar-section .event-cal-mini > div:first-child span {
            font-size: 15px !important;
          }
          .desktop-calendar-section .event-cal-mini > div:first-child button {
            padding: 6px !important;
          }
          .desktop-calendar-section .event-cal-grid {
            gap: 4px !important;
            flex: 1;
            align-content: start;
          }
          .desktop-calendar-section .event-cal-dow {
            font-size: 12px !important;
            padding: 0 0 8px !important;
            font-weight: 600 !important;
          }
          .desktop-calendar-section .event-cal-day-btn {
            height: clamp(40px, 5.5vh, 52px) !important;
            min-height: clamp(40px, 5.5vh, 52px) !important;
            max-height: clamp(40px, 5.5vh, 52px) !important;
            font-size: 14px !important;
            border-radius: 8px !important;
          }
          .desktop-calendar-section .event-cal-dot {
            width: 4px !important;
            height: 4px !important;
            bottom: 5px !important;
          }
          .desktop-calendar-section .event-cal-mini > div:last-child {
            margin-top: auto !important;
            padding-top: 12px !important;
            font-size: 12px !important;
          }
          .desktop-calendar-section .event-cal-mini > div:last-child span span {
            width: 8px !important;
            height: 8px !important;
          }
          .desktop-calendar-section .event-cal-panel {
            min-height: 0;
            height: 100%;
            overflow-y: auto;
            display: flex;
            flex-direction: column;
          }
        }
      `}</style>

      <PublicSiteHeader />

      {/* ── Our facility (logo strip + Swiper) ── */}
      <OurFacilitySection slides={slides} loading={showcaseQuery.isLoading} />

      {/* ── Content ── */}
      <main className="shell-max" style={{ ...publicShellInnerStyle, padding: PUBLIC_MAIN_PADDING }}>
        <div style={{ display: "flex", flexDirection: "column", gap: "clamp(40px, 6vw, 64px)" }}>

          {/* Interest form */}
          <section
            className="section-animate"
            style={{
              animationDelay: "0.05s",
              background: "#ffffff",
              marginLeft: "calc(-1 * clamp(16px, 4vw, 28px))",
              marginRight: "calc(-1 * clamp(16px, 4vw, 28px))",
              padding: "clamp(32px, 5vw, 56px) clamp(16px, 4vw, 28px)",
            }}
          >
            <div className="mx-auto max-w-6xl">
              <InterestForm />
            </div>
          </section>

          {/* Event calendar */}
          <section
            className="section-animate desktop-calendar-section"
            style={{
              animationDelay: "0.1s",
              background: "#ffffff",
              marginLeft: "calc(-1 * clamp(16px, 4vw, 28px))",
              marginRight: "calc(-1 * clamp(16px, 4vw, 28px))",
              padding: "clamp(32px, 5vw, 56px) clamp(16px, 4vw, 28px)",
            }}
          >
            <div className="mx-auto max-w-6xl">
              <div className="calendar-section-head" style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 16 }}>
                <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#1a1a1a", letterSpacing: "-0.02em" }}>
                  Event calendar
                </h2>
              </div>
              <EventCalendar events={calendarEvents} />
            </div>
          </section>

          {/* Testimonials */}
          <section className="section-animate" style={{ animationDelay: "0.15s" }}>
            <TestimonialsSection
              rows={feedbackRows}
              settings={settings}
            />
          </section>



          {/* Promotions */}
          <section className="section-animate" style={{ animationDelay: "0.2s" }}>
            <PromotionsSection promotions={promotions} />
          </section>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}