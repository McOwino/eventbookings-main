import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  mapEventRow,
  mapPromotionRow,
  type DbEventRow,
  type DbPromotionRow,
  type PublicEvent,
  type Promotion,
} from "./events-data";

export const publicEventsQueryOptions = () =>
  queryOptions({
    queryKey: ["public", "events"],
    queryFn: async (): Promise<PublicEvent[]> => {
      const { data, error } = await supabase
        .from("events" as never)
        .select(
          "id, client_name, organization, event_type, facility, event_date, start_time, end_time, status, event_space, pax",
        )
        .order("event_date", { ascending: true });
      if (error) throw error;
      return ((data ?? []) as unknown as DbEventRow[])
        .map(mapEventRow)
        .filter((e): e is PublicEvent => e !== null);
    },
    staleTime: 30_000,
  });

export const activePromotionsQueryOptions = () =>
  queryOptions({
    queryKey: ["public", "promotions"],
    queryFn: async (): Promise<Promotion[]> => {
      const { data, error } = await supabase
        .from("promotions" as never)
        .select(
          "id, title, description, image_url, facility, starts_at, ends_at, event_date, is_active",
        )
        .eq("is_active", true)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as DbPromotionRow[])
        .map((row, i) => mapPromotionRow(row, i))
        .filter((p): p is Promotion => p !== null);
    },
    staleTime: 30_000,
  });

export interface FacilityShowcaseSlide {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
}

export const facilityShowcaseQueryOptions = () =>
  queryOptions({
    queryKey: ["public", "facility_showcase"],
    queryFn: async (): Promise<FacilityShowcaseSlide[]> => {
      const { data, error } = await supabase
        .from("facility_showcase" as never)
        .select("id, title, description, image_url, position")
        .eq("is_active", true)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as FacilityShowcaseSlide[];
    },
    staleTime: 30_000,
  });
