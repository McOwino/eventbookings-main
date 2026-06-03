import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import { Mail, Phone, CalendarDays, Clock } from "lucide-react";
import { toast } from "sonner";

export interface Lead {
  id: string;
  name: string;
  phone: string;
  email: string;
  event_type: string;
  facility: string | null;
  filled_by: string | null;
  preferred_date: string | null;
  preferred_start_time: string | null;
  preferred_end_time: string | null;
  notes: string | null;
  status: string;
  created_at: string;
}

const STATUSES = ["new", "contacted", "converted", "closed"] as const;

function formatLeadTime(start: string | null, end: string | null) {
  if (!start && !end) return "—";
  const s = start?.slice(0, 5) ?? "";
  const e = end?.slice(0, 5) ?? "";
  if (s && e) return `${s} – ${e}`;
  return s || e || "—";
}

export function AdminLeadsPanel({ embedded = false }: { embedded?: boolean }) {
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "leads"],
    queryFn: async (): Promise<Lead[]> => {
      const { data, error } = await supabase
        .from("leads" as never)
        .select(
          "id, name, phone, email, event_type, facility, filled_by, preferred_date, preferred_start_time, preferred_end_time, notes, status, created_at",
        )
        .order("preferred_date", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as Lead[];
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from("leads" as never)
        .update({ status } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["admin", "leads"] });
    },
    onError: () => toast.error("Failed to update status"),
  });

  const leads = data ?? [];

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground">
            People who submitted the public interest form, sorted by soonest preferred date.
          </p>
        </div>
      )}

      {isLoading ? (
        <div className="h-40 animate-pulse rounded-xl bg-muted" />
      ) : leads.length === 0 ? (
        <div className="rounded-xl border bg-card p-10 text-center text-sm text-muted-foreground">
          No leads yet.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="hidden grid-cols-[1.2fr_1.4fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr] gap-3 border-b bg-muted/40 px-4 py-3 text-xs font-medium uppercase tracking-wide text-muted-foreground xl:grid">
            <div>Lead</div>
            <div>Contact</div>
            <div>Event type</div>
            <div>Preferred date</div>
            <div>Preferred time</div>
            <div>Submitted</div>
            <div>Status</div>
          </div>
          <ul className="divide-y">
            {leads.map((l) => (
              <li
                key={l.id}
                className="grid grid-cols-1 gap-3 px-4 py-4 xl:grid-cols-[1.2fr_1.4fr_0.9fr_0.9fr_0.9fr_0.9fr_1fr] xl:items-center"
              >
                <div>
                  <p className="font-medium">{l.name}</p>
                  {l.notes && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{l.notes}</p>
                  )}
                </div>
                <div className="space-y-0.5 text-sm">
                  <a href={`mailto:${l.email}`} className="flex items-center gap-1.5 hover:underline">
                    <Mail className="h-3.5 w-3.5" /> {l.email}
                  </a>
                  <a
                    href={`tel:${l.phone}`}
                    className="flex items-center gap-1.5 text-muted-foreground hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {l.phone}
                  </a>
                </div>
                <div className="text-sm">
                  <div>{l.event_type}</div>
                  {l.facility && <div className="text-xs text-muted-foreground">{l.facility}</div>}
                  {l.filled_by && <div className="text-xs text-muted-foreground">By: {l.filled_by}</div>}
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <CalendarDays className="h-3.5 w-3.5 text-muted-foreground" />
                  {l.preferred_date ? format(new Date(l.preferred_date), "MMM d, yyyy") : "—"}
                </div>
                <div className="flex items-center gap-1.5 text-sm">
                  <Clock className="h-3.5 w-3.5 text-muted-foreground" />
                  {formatLeadTime(l.preferred_start_time, l.preferred_end_time)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {format(new Date(l.created_at), "MMM d, yyyy")}
                </div>
                <div>
                  <Select
                    value={l.status}
                    onValueChange={(s) => updateStatus.mutate({ id: l.id, status: s })}
                  >
                    <SelectTrigger className="h-8 w-full max-w-[140px] text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUSES.map((s) => (
                        <SelectItem key={s} value={s} className="text-xs capitalize">
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
