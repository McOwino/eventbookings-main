import type { FacilityEnum } from "@/lib/facility-utils";
import { facilityLabel } from "@/lib/facility-utils";

/** Village Market brand — matches public header, forms, and CTAs */
export const VM_BRAND_RED = "#C0272D";
export const VM_BRAND_RED_HOVER = "#9e2227";
export const VM_CREAM = "#faf7f5";
export const VM_PAGE_BG = "#faf8f6";

/**
 * Facility hues keyed by display label (public calendar, event cards, admin charts).
 * Keep in sync with `--facility-*` tokens in styles.css.
 */
export const FACILITY_COLORS: Record<string, string> = {
  "Village Bowl": "#1D9E75",
  "Under the Sea": "#185FA5",
  "Ozone Trampoline Park": "#C0272D",
  "Mini-Golf": "#639922",
  REV: "#BA7517",
  Glitch: "#534AB7",
  Ballpoint: "#D4537E",
  "All Facilities": "#888780",
  "Village Market": "#888780",
};

export const FACILITY_COLORS_BY_ENUM: Record<FacilityEnum, string> = {
  village_bowl: "#1D9E75",
  under_the_sea: "#185FA5",
  ozone_trampoline_park: "#C0272D",
  mini_golf: "#639922",
  rev: "#BA7517",
  glitch: "#534AB7",
  ballpoint: "#D4537E",
};

export const DEFAULT_FACILITY_COLOR = "#888780";

export function getFacilityColorByEnum(
  facility: FacilityEnum | string | null | undefined,
): string {
  if (!facility) return DEFAULT_FACILITY_COLOR;
  return (
    FACILITY_COLORS_BY_ENUM[facility as FacilityEnum] ?? DEFAULT_FACILITY_COLOR
  );
}

export function getFacilityColor(label: string | null | undefined): string {
  if (!label) return DEFAULT_FACILITY_COLOR;
  return FACILITY_COLORS[label] ?? DEFAULT_FACILITY_COLOR;
}

/** Resolve color from DB facility enum. */
export function getFacilityColorFromEnum(
  facility: FacilityEnum | null | undefined,
): string {
  if (!facility) return DEFAULT_FACILITY_COLOR;
  return getFacilityColor(facilityLabel(facility));
}

/** Build ChartContainer config entries for a list of facility rows. */
export function buildFacilityChartConfig(
  rows: { key: string; label: string; color: string }[],
): Record<string, { label: string; color: string }> {
  return Object.fromEntries(
    rows.map((row) => [row.key, { label: row.label, color: row.color }]),
  );
}
