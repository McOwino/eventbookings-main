// Public-side data types & helpers for the calendar/carousel.
// Data is now sourced live from Lovable Cloud; mappers normalize DB rows
// into the UI-friendly shapes below.

import type { Database } from "@/integrations/supabase/types";

export const FACILITIES = [
  "Village Bowl",
  "Under the Sea",
  "Ozone Trampoline Park",
  "Mini-Golf",
  "REV",
  "Glitch",
  "Ballpoint",
] as const;

export type Facility = (typeof FACILITIES)[number];
export type EventType =
  | "Birthday Party"
  | "School Trip"
  | "Hangout"
  | "Buyout"
  | "Walk-In RSVP"
  | "Third Party Event"
  | "In-House Event";
export type EventStatus = "Tentative" | "Confirmed" | "Canceled";

export interface PublicEvent {
  id: string;
  name: string;
  facility: Facility;
  type: EventType;
  date: string; // YYYY-MM-DD
  startTime: string;
  endTime: string;
  status: EventStatus;
  event_space?: string | null;
}

export const facilityColorClass: Record<Facility, string> = {
  "Village Bowl": "bg-facility-village-bowl",
  "Under the Sea": "bg-facility-under-the-sea",
  "Ozone Trampoline Park": "bg-facility-ozone",
  "Mini-Golf": "bg-facility-mini-golf",
  REV: "bg-facility-rev",
  Glitch: "bg-facility-glitch",
  Ballpoint: "bg-facility-ballpoint",
};

// ---- DB <-> UI mappers ----------------------------------------------------

type FacilityEnum =
  | "village_bowl"
  | "under_the_sea"
  | "ozone_trampoline_park"
  | "mini_golf"
  | "rev"
  | "glitch"
  | "ballpoint";

const facilityLabel: Record<FacilityEnum, Facility> = {
  village_bowl: "Village Bowl",
  under_the_sea: "Under the Sea",
  ozone_trampoline_park: "Ozone Trampoline Park",
  mini_golf: "Mini-Golf",
  rev: "REV",
  glitch: "Glitch",
  ballpoint: "Ballpoint",
};

const eventTypeLabel: Record<string, EventType | null> = {
  birthday: "Birthday Party",
  school_trip: "School Trip",
  hangout: "Hangout",
  league_tournament: null,
  buyout: "Buyout",
  walk_in_rsvp: "Walk-In RSVP",
  third_party_event: "Third Party Event",
  in_house_event: "In-House Event",
};

const statusLabel: Record<string, EventStatus | null> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  canceled: "Canceled",
  cleared: "Confirmed",
};

// Loosely-typed event row to avoid coupling to generated table types when
// they are not yet regenerated. Fields below mirror the SQL schema.
export interface DbEventRow {
  id: string;
  client_name: string;
  organization: string | null;
  event_type: string;
  facility: string;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  event_space?: string | null;
}

export function mapEventRow(row: DbEventRow): PublicEvent | null {
  const type = eventTypeLabel[row.event_type] ?? null;
  const status = statusLabel[row.status] ?? null;
  const facility = facilityLabel[row.facility as FacilityEnum] ?? null;
  if (!type || !status || !facility) return null;

  const displayName =
    row.organization?.trim() ||
    (type === "Birthday Party" ? `${row.client_name}'s Party` : row.client_name);

  return {
    id: row.id,
    name: displayName,
    facility,
    type,
    date: row.event_date, // already YYYY-MM-DD
    startTime: row.start_time.slice(0, 5),
    endTime: row.end_time.slice(0, 5),
    status,
    event_space: row.event_space ?? null,
  };
}

// ---- Promotions -----------------------------------------------------------

export interface Promotion {
  id: string;
  title: string;
  description: string;
  facility: Facility | "All Facilities";
  endsOn: string;
  kind: "Event" | "Limited-time offer";
  imageUrl?: string | null;
  imageHue: string;
}

export interface DbPromotionRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  facility: string | null;
  starts_at: string | null;
  ends_at: string | null;
  event_date: string | null;
  is_active: boolean;
}

const PROMO_HUES = [
  "from-pink-500 via-fuchsia-500 to-purple-600",
  "from-emerald-400 via-green-500 to-teal-600",
  "from-violet-500 via-purple-500 to-indigo-600",
  "from-sky-400 via-blue-500 to-cyan-600",
  "from-amber-400 via-orange-500 to-red-500",
];

export function mapPromotionRow(row: DbPromotionRow, idx: number): Promotion | null {
  const endsOn = row.event_date ?? row.ends_at;
  if (!endsOn) return null;
  const facility = row.facility
    ? facilityLabel[row.facility as FacilityEnum] ?? "All Facilities"
    : "All Facilities";
  return {
    id: row.id,
    title: row.title,
    description: row.description ?? "",
    facility,
    endsOn,
    kind: row.event_date ? "Event" : "Limited-time offer",
    imageUrl: row.image_url,
    imageHue: PROMO_HUES[idx % PROMO_HUES.length],
  };
}

// ---- Helpers --------------------------------------------------------------

export function eventsForDate(events: PublicEvent[], date: Date): PublicEvent[] {
  const key = toLocalYmd(date);
  return events.filter((e) => e.date === key);
}

export function toLocalYmd(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

// Re-export the Database type so other modules can opt into it.
export type { Database };
