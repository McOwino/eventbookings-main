import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { facilityLabel, type FacilityEnum } from "@/lib/facility-utils";
import { getFacilityColorFromEnum } from "@/lib/facility-colors";

export interface TournamentRow {
  id: string;
  name: string;
  facility: FacilityEnum;
  description: string | null;
  start_time?: string | null;
  end_time?: string | null;
  days_of_week: number[];
  start_date: string;
  end_date: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export const DAYS_OF_WEEK = [
  { value: 0, short: "Sun", label: "Sunday" },
  { value: 1, short: "Mon", label: "Monday" },
  { value: 2, short: "Tue", label: "Tuesday" },
  { value: 3, short: "Wed", label: "Wednesday" },
  { value: 4, short: "Thu", label: "Thursday" },
  { value: 5, short: "Fri", label: "Friday" },
  { value: 6, short: "Sat", label: "Saturday" },
] as const;

export const formatDays = (days: number[]) => {
  if (!days || days.length === 0) return "Active";
  return [...days]
    .sort((a, b) => a - b)
    .map((d) => DAYS_OF_WEEK.find((x) => x.value === d)?.short ?? d)
    .join(", ");
};

export const formatFacility = (f: FacilityEnum) => facilityLabel(f) ?? f;

export const publicTournamentsQueryOptions = () =>
  queryOptions({
    queryKey: ["public", "tournaments"],
    queryFn: async (): Promise<TournamentRow[]> => {
      const today = new Date().toISOString().slice(0, 10);
      const { data, error } = await supabase
        .from("tournaments" as never)
        .select(
          "id, name, facility, description, start_time, end_time, days_of_week, start_date, end_date, is_active, created_at, updated_at",
        )
        .eq("is_active", true)
        .gte("end_date", today)
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TournamentRow[];
    },
    staleTime: 30_000,
  });

/** Expand a TournamentRow into calendar event objects for dates within the provided window.
 * windowStart and windowEnd are YYYY-MM-DD strings (inclusive).
 */
export function expandTournamentToDates(
  t: TournamentRow,
  windowStart: string,
  windowEnd: string,
) {
  const pad = (n: number) => String(n).padStart(2, "0");
  const toLocalDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const formatSqlTime = (time?: string | null) => {
    if (!time) return "";
    const parts = time.split(":");
    const hh = Number(parts[0] ?? 0);
    const mm = Number(parts[1] ?? 0);
    const am = hh < 12;
    const h12 = hh % 12 || 12;
    return `${h12}:${String(mm).padStart(2, "0")} ${am ? "AM" : "PM"}`;
  };

  const start = new Date(t.start_date);
  const end = new Date(t.end_date);
  const ws = new Date(windowStart);
  const we = new Date(windowEnd);

  const from = start > ws ? start : ws;
  const to = end < we ? end : we;
  if (from > to) return [];

  const out: {
    id: string;
    title: string;
    facility: string;
    facilityColor: string;
    date: string;
    time: string;
    type: "league";
    status: "Confirmed";
  }[] = [];

  for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
    if ((t.days_of_week ?? []).includes(d.getDay())) {
      const dateStr = toLocalDate(new Date(d));
      const startFormatted = formatSqlTime(t.start_time ?? null);
      const endFormatted = formatSqlTime(t.end_time ?? null);
      const timeText = startFormatted && endFormatted
        ? `${startFormatted} - ${endFormatted}`
        : startFormatted || endFormatted || "";
      out.push({
        id: `${t.id}-${dateStr}`,
        title: t.name,
        facility: facilityLabel(t.facility) ?? String(t.facility),
        facilityColor: getFacilityColorFromEnum(t.facility),
        date: dateStr,
        time: timeText,
        type: "league",
        status: "Confirmed",
      });
    }
  }

  return out;
}

export const adminTournamentsQueryOptions = () =>
  queryOptions({
    queryKey: ["admin", "tournaments"],
    queryFn: async (): Promise<TournamentRow[]> => {
      const { data, error } = await supabase
        .from("tournaments" as never)
        .select(
          "id, name, facility, description, start_time, end_time, days_of_week, start_date, end_date, is_active, created_at, updated_at",
        )
        .order("start_date", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as TournamentRow[];
    },
    staleTime: 15_000,
  });
