import type { Database } from "@/integrations/supabase/types";

export type FacilityEnum = Database["public"]["Enums"]["facility"];
export type EventTypeEnum = Database["public"]["Enums"]["event_type"];
export type EventStatusEnum = Database["public"]["Enums"]["event_status"];
export type AppRoleEnum = Database["public"]["Enums"]["app_role"];
export type PaymentModeEnum = Database["public"]["Enums"]["payment_mode"];
export type SourceTypeEnum = Database["public"]["Enums"]["source_type"];

export const FACILITY_OPTIONS: { value: FacilityEnum; label: string }[] = [
  { value: "village_bowl", label: "Village Bowl" },
  { value: "under_the_sea", label: "Under the Sea" },
  { value: "ozone_trampoline_park", label: "Ozone Trampoline Park" },
  { value: "mini_golf", label: "Mini-Golf" },
  { value: "rev", label: "REV" },
  { value: "glitch", label: "Glitch" },
  { value: "ballpoint", label: "Ballpoint" },
];

export const EVENT_TYPE_OPTIONS: { value: EventTypeEnum; label: string }[] = [
  { value: "birthday", label: "Birthday Party" },
  { value: "school_trip", label: "School Trip" },
  { value: "hangout", label: "Hangout" },
  { value: "league_tournament", label: "League/Tournament" },
  { value: "buyout", label: "Buyout" },
  { value: "walk_in_rsvp", label: "Walk-In RSVP" },
  { value: "third_party_event", label: "Third Party Event" },
  { value: "in_house_event", label: "In-House Event" },
];

// Event types that use flexible (free-form) start/end times like Hangout
export const FLEXIBLE_TIME_EVENT_TYPES: EventTypeEnum[] = [
  "hangout",
  "buyout",
  "walk_in_rsvp",
  "third_party_event",
  "in_house_event",
];

export const isFlexibleTimeEventType = (t: EventTypeEnum | string | null | undefined) =>
  !!t && (FLEXIBLE_TIME_EVENT_TYPES as string[]).includes(t as string);

// Event spaces prefixed by a buyout marker — picking one locks the entire facility
export const isBuyoutSpace = (space: string | null | undefined) => {
  if (!space) return false;
  const s = space.trim();
  return /entire\s+(space|lounge)/i.test(s);
};

// Time overlap helper (HH:MM)
export const timesOverlap = (
  aStart: string,
  aEnd: string,
  bStart: string,
  bEnd: string,
) => aStart < bEnd && bStart < aEnd;

export const ROLE_OPTIONS: { value: AppRoleEnum; label: string }[] = [
  { value: "super_admin", label: "Super Admin" },
  { value: "general_executive", label: "General Executive" },
  { value: "clearance_executive", label: "Clearance Executive" },
  { value: "school_trips_executive", label: "School Trips Executive" },
  { value: "birthday_executive", label: "Birthday Executive" },
  { value: "league_executive", label: "League Executive" },
  { value: "marketing_executive", label: "Marketing Executive" },
  { value: "logistics_executive", label: "Logistics Executive" },
  { value: "hangout_executive", label: "Hangout Executive" },
  { value: "sales_executive", label: "Sales Executive" },
];

export const PAYMENT_MODE_OPTIONS: { value: PaymentModeEnum; label: string }[] = [
  { value: "mpesa", label: "M-Pesa" },
  { value: "card", label: "Card" },
  { value: "cash", label: "Cash" },
];

export const EVENT_SPACE_OPTIONS: string[] = [
  "Mezzanine Room",
  "Green Room",
  "Party Bus",
  "Pool Lounge",
  "Blue Room",
  "Immersive Room",
  "Coral Corner",
  "Jelly Fish Lounge",
  "Boat Bar Lounge",
  "Bowling Lounge 1",
  "Bowling Lounge 2",
  "Bowling Entire Lounge",
  "Terrace (Whole)",
  "Terrace 1",
  "Terrace 2",
  "In front of the DJ",
  "Colorful Corner",
  "Ballpoint Main Area",
  "Ballpoint Entire Space",
  "UTS Entire Space",
  "Ozone Entire Space",
  "Village Bowl Entire Space",
];

export const TIME_SLOT_OPTIONS_DEFAULT = [
  { value: "morning", label: "Morning Slot (10:00 AM – 1:00 PM)", start: "10:00", end: "13:00" },
  { value: "afternoon", label: "Afternoon Slot (2:30 PM – 5:30 PM)", start: "14:30", end: "17:30" },
];

export const TIME_SLOT_OPTIONS_SCHOOL = [
  { value: "morning", label: "Morning Slot (10:00 AM – 12:00 PM)", start: "10:00", end: "12:00" },
  { value: "afternoon", label: "Afternoon Slot (12:00 PM – 2:00 PM)", start: "12:00", end: "14:00" },
];

export const SCHOOL_TRIP_PACKAGE_OPTIONS = ["Play", "Eat", "Learn", "Drinks"] as const;

// Birthday packages by facility (value = facility enum)
export const BIRTHDAY_PACKAGES_BY_FACILITY: Record<FacilityEnum, { name: string; cost: number }[]> = {
  under_the_sea: [
    { name: "Immersive Delights - Beach Party", cost: 2600 },
    { name: "Kiddie Fiesta - Let's Par Tee", cost: 2400 },
  ],
  ozone_trampoline_park: [
    { name: "Kiddie Fiesta - Jump Party", cost: 2400 },
    { name: "Teen Spirit - Let's Par Tee", cost: 1500 },
  ],
  village_bowl: [
    { name: "Immersive Delights - King Pin Party", cost: 2600 },
    { name: "Kiddie Fiesta - King Pin Party", cost: 2400 },
    { name: "Big Kids Bliss - King Pin Party", cost: 1500 },
  ],
  glitch: [
    { name: "Immersive Delights - Game On", cost: 2600 },
    { name: "Teen Spirit - Game On", cost: 1500 },
  ],
  rev: [{ name: "Teen Spirit - Power Up", cost: 1500 }],
  mini_golf: [{ name: "Big Kids Bliss - Game On", cost: 1500 }],
  ballpoint: [{ name: "Big Kids Bliss - Let's Par Tee", cost: 1500 }],
};

// Hangout packages — duration in hours
export const HANGOUT_PACKAGES: { name: string; cost: number; durationHours: number }[] = [
  { name: "Facility Package", cost: 1740, durationHours: 3 },
  { name: "Half Day Team Building", cost: 4408, durationHours: 4 },
  { name: "Full Day Team Building", cost: 7308, durationHours: 6 },
];

// School-trip per-person costs
export const SCHOOL_TRIP_FIXED_COSTS: Record<"Eat" | "Learn" | "Drinks", number> = {
  Eat: 370,
  Learn: 300,
  Drinks: 100,
};
export const SCHOOL_TRIP_PLAY_COST_BY_FACILITY: Record<FacilityEnum, number> = {
  ozone_trampoline_park: 500,
  under_the_sea: 500,
  rev: 500,
  glitch: 500,
  mini_golf: 300,
  village_bowl: 300,
  ballpoint: 300,
};

// Add a hangout-friendly time slot helper (no fixed slots)
export function addHoursToTime(time: string, hours: number): string {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return "";
  const total = h * 60 + m + hours * 60;
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hh = String(Math.floor(wrapped / 60)).padStart(2, "0");
  const mm = String(wrapped % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

export const HAMECO_ADDITIONAL_OPTIONS = [
  "Socks",
  "Candle",
  "Pinata",
  "Clown",
  "Face Painter",
  "Themed Plates",
  "Chivary Chair",
  "Extra Deco",
  "Balloon Garland",
  "Gift Bags",
] as const;

export const facilityLabel = (f: FacilityEnum | null | undefined) =>
  FACILITY_OPTIONS.find((o) => o.value === f)?.label ?? "—";
export const eventTypeLabel = (t: EventTypeEnum | null | undefined) =>
  EVENT_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? "—";
export const roleLabel = (r: AppRoleEnum | null | undefined) =>
  ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r ?? "—";

export const formatCurrency = (n: number | null | undefined) =>
  `KES ${(Number(n ?? 0)).toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
