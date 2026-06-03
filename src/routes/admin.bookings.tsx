import { createFileRoute, useSearch } from "@tanstack/react-router";
import { AdminLeadsPanel } from "@/components/admin/AdminLeadsPanel";
import { AdminContractsPanel } from "@/components/admin/AdminContractsPanel";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  EVENT_TYPE_OPTIONS,
  FACILITY_OPTIONS,
  PAYMENT_MODE_OPTIONS,
  EVENT_SPACE_OPTIONS,
  TIME_SLOT_OPTIONS_DEFAULT,
  TIME_SLOT_OPTIONS_SCHOOL,
  SCHOOL_TRIP_PACKAGE_OPTIONS,
  BIRTHDAY_PACKAGES_BY_FACILITY,
  HANGOUT_PACKAGES,
  SCHOOL_TRIP_FIXED_COSTS,
  SCHOOL_TRIP_PLAY_COST_BY_FACILITY,
  addHoursToTime,
  facilityLabel,
  eventTypeLabel,
  formatCurrency,
  isFlexibleTimeEventType,
  isBuyoutSpace,
  timesOverlap,
  HAMECO_ADDITIONAL_OPTIONS,
  type EventTypeEnum,
  type FacilityEnum,
} from "@/lib/facility-utils";
import { Loader2, Plus, CheckCircle2, X, AlertTriangle, Trash2 } from "lucide-react";
import { ContractSigningModal } from "@/components/admin/ContractSigningModal";
import { FACILITY_TILL, FACILITY_LABEL, type ContractData } from "@/lib/contract-utils";
import styles from "@/styles/vmr-form.module.css";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Checkbox } from "@/components/ui/checkbox";

type BookingsSearch = { tab?: string };

export const Route = createFileRoute("/admin/bookings")({
  validateSearch: (search: Record<string, unknown>): BookingsSearch => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: BookingsPage,
});

const birthdayPersonSchema = z.object({
  name: z.string().trim().min(1).max(100),
  dob: z.string().min(1),
  gender: z.enum(["male", "female"]),
});

const bookingSchema = z.object({
  client_name: z.string().trim().min(1).max(150),
  contact_number: z.string().trim().min(5).max(30),
  email: z
    .string()
    .trim()
    .max(255)
    .optional()
    .or(z.literal(""))
    .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Invalid email address",
    }),
  organization: z.string().trim().max(150).optional().default(""),
  birthday_persons: z.array(birthdayPersonSchema).optional().default([]),
  event_type: z.enum([
    "birthday",
    "school_trip",
    "hangout",
    "league_tournament",
    "buyout",
    "walk_in_rsvp",
    "third_party_event",
    "in_house_event",
  ]),
  facility: z.enum([
    "village_bowl",
    "under_the_sea",
    "ozone_trampoline_park",
    "mini_golf",
    "rev",
    "glitch",
    "ballpoint",
  ]),
  event_space: z.string().trim().min(1).max(100),
  event_date: z.string().min(1),
  start_time: z.string().min(1),
  end_time: z.string().min(1),
  package_name: z.string().trim().min(1).max(150),
  package_options: z.array(z.string()).optional().default([]),
  cost_per_person: z.coerce.number().min(0),
  pax: z.coerce.number().int().min(10, { message: "Minimum 10 pax" }).max(10000),
  how_did_you_hear: z.string().max(200).optional().or(z.literal("")),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

type BookingForm = z.infer<typeof bookingSchema>;

// ─── Contracts ───────────────────────────────────────────────
type ContractRow = {
  id: string;
  event_id: string;
  content: string;          // the generated signing link (URL)
  signature_url: string | null;
  generated_by: string | null;
  created_at: string;
  // joined from events:
  client_name?: string;
  organization?: string | null;
  event_type?: EventTypeEnum;
  facility?: FacilityEnum;
  event_date?: string;
  status?: string;
};

function compressPayload(str: string): string {
  return btoa(unescape(encodeURIComponent(str)))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function buildSignLink(data: ContractData): string {
  const linkId =
    Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const encoded = compressPayload(JSON.stringify(data));
  const base = `${window.location.origin}/sign`;
  return `${base}?c=${encodeURIComponent(encoded)}&id=${linkId}`;
}

const confirmPaymentSchema = z.object({
  amount: z.coerce.number().positive(),
  mode: z.enum(["mpesa", "card", "cash"]),
  date_paid: z.string().min(1),
  confirmation_code: z.string().trim().min(1).max(100),
});

const clearanceSchema = z.object({
  event_id: z.string().uuid(),
  source: z.enum(["in_bound", "out_bound"]),
  out_bound_contact: z.string().max(150).optional().or(z.literal("")),
  actual_pax: z.coerce.number().int().min(0),
  hameco_per_person: z.coerce.number().min(0),
  hameco_additional_spend: z.coerce.number().min(0),
  hameco_additional_details: z.string().max(500).optional().or(z.literal("")),
  kiddie_meal_amount: z.coerce.number().min(0),
  additional_food_order: z.coerce.number().min(0),
  deposit: z.coerce.number().min(0),
});

type ConfirmPaymentForm = z.infer<typeof confirmPaymentSchema>;

const BOOKING_TABS = ["leads", "tentative", "confirmed", "clearance", "canceled", "contracts"] as const;

function BookingsPage() {
  const { tab: tabSearch } = useSearch({ from: "/admin/bookings" });
  const defaultTab = BOOKING_TABS.includes(tabSearch as (typeof BOOKING_TABS)[number])
    ? (tabSearch as (typeof BOOKING_TABS)[number])
    : "leads";

  const { user, roles } = useAuth();
  const qc = useQueryClient();

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You do not have access to this page.
        </CardContent>
      </Card>
    );
  }
  const [open, setOpen] = useState(false);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [clearanceId, setClearanceId] = useState<string | null>(null);
  const [contractTarget, setContractTarget] = useState<ContractData | null>(null);
  const [cancelTarget, setCancelTarget] = useState<EventRow | null>(null);
  const [cancelInput, setCancelInput] = useState("");
  const [cancelReason, setCancelReason] = useState("");
  const [showArchive, setShowArchive] = useState(false);

  const events = useQuery({
    queryKey: ["admin", "events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("status", ["tentative", "confirmed"])
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const payments = useQuery({
    queryKey: ["admin", "payments", "by-event"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("event_id, amount, payment_mode, date_paid, confirmation_code, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: newLeadsCount = 0 } = useQuery({
    queryKey: ["admin", "leads", "new-count"],
    queryFn: async () => {
      const { data: _d, count, error } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });
  
  const contracts = useQuery({
    queryKey: ["admin", "contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("contracts")
        .select(`
          id,
          event_id,
          content,
          signature_url,
          generated_by,
          created_at,
          events (
            client_name,
            organization,
            event_type,
            facility,
            event_date,
            status
          )
        `)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((c: any) => ({
        id:            c.id,
        event_id:      c.event_id,
        content:       c.content,
        signature_url: c.signature_url,
        generated_by:  c.generated_by,
        created_at:    c.created_at,
        client_name:   c.events?.client_name,
        organization:  c.events?.organization,
        event_type:    c.events?.event_type,
        facility:      c.events?.facility,
        event_date:    c.events?.event_date,
        status:        c.events?.status,
      })) as ContractRow[];
    },
  });

  // Map event_id -> first (deposit) payment recorded
  const depositByEvent = new Map<string, { amount: number; payment_mode: "mpesa" | "card" | "cash"; date_paid: string; confirmation_code: string }>();
  for (const p of payments.data ?? []) {
    if (!depositByEvent.has(p.event_id)) {
      depositByEvent.set(p.event_id, {
        amount: Number(p.amount),
        payment_mode: p.payment_mode,
        date_paid: p.date_paid,
        confirmation_code: p.confirmation_code,
      });
    }
  }

  const create = useMutation({
    mutationFn: async (input: BookingForm) => {
      // ── conflict checks (unchanged) ──
      const { data: sameDay, error: fetchErr } = await supabase
        .from("events")
        .select("id, facility, event_space, start_time, end_time, status, event_type")
        .eq("event_date", input.event_date)
        .eq("facility", input.facility)
        .neq("status", "canceled");
      if (fetchErr) throw fetchErr;

      const newStart = input.start_time.slice(0, 5);
      const newEnd = input.end_time.slice(0, 5);
      const newIsBuyout =
        input.event_type === "buyout" || isBuyoutSpace(input.event_space);

      for (const row of sameDay ?? []) {
        const exStart = (row.start_time ?? "").slice(0, 5);
        const exEnd = (row.end_time ?? "").slice(0, 5);
        if (!timesOverlap(newStart, newEnd, exStart, exEnd)) continue;

        const exIsBuyout =
          row.event_type === "buyout" || isBuyoutSpace(row.event_space);

        if (exIsBuyout)
          throw new Error(`This facility is bought out for the selected time (${exStart}–${exEnd}). No bookings allowed.`);
        if (newIsBuyout)
          throw new Error(`Cannot book a buyout — facility already has a booking at ${exStart}–${exEnd}.`);
        if (row.event_space === input.event_space)
          throw new Error(`"${input.event_space}" is already booked ${exStart}–${exEnd} on this date.`);
      }

      // ── insert event ──
      const { data: inserted, error } = await supabase
        .from("events")
        .insert({
          client_name:    input.client_name,
          contact_number: input.contact_number,
          email:          input.email ?? "",
          organization:   input.organization || null,
          event_type:     input.event_type,
          facility:       input.facility,
          event_space:    input.event_space,
          event_date:     input.event_date,
          start_time:     input.start_time,
          end_time:       input.end_time,
          package_name:   input.package_name,
          cost_per_person: input.cost_per_person,
          pax:            input.pax,
          notes:          input.notes || null,
          birthday_persons: input.birthday_persons ?? [],
          how_did_you_hear: input.how_did_you_hear || null,
          package_options:  input.package_options  ?? [],
          status:         "tentative",
          created_by:     user?.id ?? null,
        })
        .select()
        .single();
      if (error) throw error;

      // ── build sign link & insert into contracts ──
      const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const evtDate = new Date(input.event_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      const contractPayload: ContractData = {
        etype:       input.event_type,
        fac:         input.facility,
        name:        input.client_name,
        contact:     input.contact_number,
        email:       input.email ?? "",
        org:         input.organization ?? "",
        eventSpace:  input.event_space,
        pkg:         input.package_name,
        pax:         input.pax,
        cpp:         input.cost_per_person,
        startTime:   input.start_time,
        endTime:     input.end_time,
        notes:       input.notes ?? "",
        till:        FACILITY_TILL[input.facility] ?? "",
        bdayPersons: input.birthday_persons ?? [],
        schPkgs:     input.package_options  ?? [],
        evtDate,
        today,
        total:       Number(input.pax) * Number(input.cost_per_person),
        eventId:     (inserted as any).id,
      };

      const signLink = buildSignLink(contractPayload);

      const { error: contractErr } = await supabase.from("contracts").insert({
        event_id:     (inserted as any).id,
        content:      signLink,
        generated_by: user?.id ?? null,
      });
      if (contractErr) throw contractErr;

      return { inserted, contractPayload, signLink };
    },

    onSuccess: ({ inserted, contractPayload }) => {
      toast.success("Booking created — signing link generated");
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["admin", "contracts"] });
      qc.invalidateQueries({ queryKey: ["public", "events"] });
      setOpen(false);
      setContractTarget({ ...contractPayload, eventId: (inserted as any).id });
    },

    onError: (e: Error) => toast.error(e.message),
  });

  const confirmBooking = useMutation({
    mutationFn: async ({
      id,
      payment,
      warningAck,
    }: {
      id: string;
      payment: ConfirmPaymentForm | null;
      warningAck?: string;
    }) => {
      if (payment) {
        const { error: payErr } = await (supabase as any).from("payments").insert({
          event_id: id,
          amount: payment.amount,
          payment_mode: payment.mode,
          date_paid: payment.date_paid,
          confirmation_code: payment.confirmation_code,
          created_by: user?.id ?? null,
        });
        if (payErr) throw payErr;
      }
      const { error } = await supabase
        .from("events")
        .update({
          status: "confirmed",
          confirmed_by: user?.id ?? null,
          confirmed_at: new Date().toISOString(),
          confirmed_without_deposit: !payment,
          confirm_warning_ack: warningAck ?? null,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_data, vars) => {
      toast.success(
        vars.payment ? "Booking confirmed & deposit recorded" : "Booking confirmed without deposit",
      );
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
      qc.invalidateQueries({ queryKey: ["admin", "payments", "by-event"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["public", "events"] });
      setConfirmId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cancelBooking = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const { error } = await supabase
        .from("events")
        .update({ status: "canceled", cancellation_reason: reason, cancellation_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Booking canceled");
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["public", "events"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const clearEvent = useMutation({
    mutationFn: async (input: z.infer<typeof clearanceSchema>) => {
      const hamecoPackage = input.actual_pax * input.hameco_per_person;
      const totalHameco = hamecoPackage + input.hameco_additional_spend;
      const totalFameco = input.kiddie_meal_amount + input.additional_food_order;
      const totalSpend = totalHameco + totalFameco;
      const topUp = totalSpend - input.deposit;

      const { error: cErr } = await supabase.from("clearances").insert({
        event_id: input.event_id,
        source: input.source,
        out_bound_contact: input.out_bound_contact || null,
        actual_pax: input.actual_pax,
        hameco_per_person: input.hameco_per_person,
        hameco_package_spend: hamecoPackage,
        hameco_additional_spend: input.hameco_additional_spend,
        hameco_additional_details: input.hameco_additional_details || null,
        total_hameco_spend: totalHameco,
        kiddie_meal_amount: input.kiddie_meal_amount,
        additional_food_order: input.additional_food_order,
        total_fameco_spend: totalFameco,
        total_spend: totalSpend,
        deposit: input.deposit,
        top_up_balance: topUp,
        cleared_by: user?.id ?? null,
      });
      if (cErr) throw cErr;

      const { error: eErr } = await supabase
        .from("events")
        .update({ status: "cleared" })
        .eq("id", input.event_id);
      if (eErr) throw eErr;
    },
    onSuccess: () => {
      toast.success("Event cleared successfully");
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["admin", "clearances"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["public", "events"] });
      setClearanceId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archivedEvents = useQuery({
    queryKey: ["admin", "events", "archive"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("status", ["cleared", "canceled"])
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: showArchive,
  });

  // Signed contracts: event_ids where signature_url is not null
  const signedContractEventIds = new Set(
    (contracts.data ?? [])
      .filter((c) => !!c.signature_url)
      .map((c) => c.event_id)
  );

  // Split archived into their sub-groups for the three tabs
  const archivedAll = archivedEvents.data ?? [];
  const archivedCleared = archivedAll.filter((e) => e.status === "cleared");
  const archivedCanceled = archivedAll.filter((e) => e.status === "canceled");
  const archivedSigned = (contracts.data ?? []).filter((c) => !!c.signature_url);

  const all = events.data ?? [];
  const today = new Date().toISOString().slice(0, 10);

  const tentative = all.filter((e) => e.status === "tentative");
  const confirmed = all.filter(
    (e) => e.status === "confirmed" && e.event_date >= today
  );
  const awaitingClearance = all.filter(
    (e) => e.status === "confirmed" && e.event_date < today
  );
  const unsignedContracts = (contracts.data ?? []).filter((c) => !c.signature_url);

  // At-risk: tentative + no deposit recorded + event starts within next 24h
  const now = Date.now();
  const in24h = now + 24 * 60 * 60 * 1000;
  const atRisk = tentative.filter((e) => {
    const start = new Date(`${e.event_date}T${e.start_time}`).getTime();
    return (
      !depositByEvent.has(e.id) &&
      start >= now &&
      start <= in24h
    );
  });

  const handleCreate = (data: BookingForm) => create.mutate(data);

  const requestCancel = (id: string) => {
    const row = all.find((r) => r.id === id) ?? null;
    setCancelTarget(row as EventRow | null);
    setCancelInput("");
  };

  const submitCancel = () => {
    const value = cancelInput.trim().toUpperCase();
    if (value === "NO") {
      toast.message("Cancellation aborted");
      setCancelTarget(null);
      setCancelInput("");
      return;
    }
    if (value !== "YES") {
      toast.error("Type YES to confirm or NO to abort");
      return;
    }
    if (!cancelReason.trim()) {
      toast.error("Please provide a reason for cancellation");
      return;
    }
    if (cancelTarget) cancelBooking.mutate({ id: cancelTarget.id, reason: cancelReason.trim() });
    setCancelTarget(null);
    setCancelInput("");
    setCancelReason("");
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Bookings</h1>
          <p className="text-sm text-muted-foreground">
            Create tentative bookings, then confirm to lock them in.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New booking
        </Button>
      </div>

      {atRisk.length > 0 && (
        <Alert variant="destructive" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>
            {atRisk.length} booking{atRisk.length > 1 ? "s" : ""} starting within 24 hours without a confirmed deposit
          </AlertTitle>
          <AlertDescription>
            <ul className="mt-2 space-y-1 text-sm">
              {atRisk.map((e) => (
                <li key={e.id} className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{e.organization || e.client_name}</span>
                  <span className="text-xs opacity-80">
                    · {facilityLabel(e.facility)} · {e.event_date} {e.start_time.slice(0, 5)}
                  </span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="ml-auto h-7"
                    onClick={() => setConfirmId(e.id)}
                  >
                    Confirm now
                  </Button>
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <div className="flex justify-end mb-2">
        <Button
          size="sm"
          variant={showArchive ? "default" : "outline"}
          onClick={() => setShowArchive((s) => !s)}
        >
          {showArchive ? "Hide archive" : "Show archive"}
        </Button>
      </div>

      <Tabs defaultValue={defaultTab} key={defaultTab}>
          <TabsList className="flex h-auto flex-wrap gap-1">
          <TabsTrigger value="leads">
            <div className="flex items-center gap-2">
              <span>Leads</span>
              {newLeadsCount > 0 && (
                <span className="inline-flex items-center justify-center rounded-full bg-red-600 text-white text-xs font-semibold px-2 py-0.5">
                  {newLeadsCount}
                </span>
              )}
            </div>
          </TabsTrigger>
          <TabsTrigger value="tentative">Tentative ({tentative.length})</TabsTrigger>
          <TabsTrigger value="confirmed">Confirmed ({confirmed.length})</TabsTrigger>
          <TabsTrigger value="clearance">
            Clearance
            {awaitingClearance.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-xs font-semibold px-2 py-0.5">
                {awaitingClearance.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="contracts">
            Contracts
            {unsignedContracts.length > 0 && (
              <span className="ml-1.5 inline-flex items-center justify-center rounded-full bg-blue-500 text-white text-xs font-semibold px-2 py-0.5">
                {unsignedContracts.length}
              </span>
            )}
          </TabsTrigger>
          {showArchive && (
            <>
              <TabsTrigger value="cleared">
                Cleared ({archivedCleared.length})
              </TabsTrigger>
              <TabsTrigger value="canceled">
                Cancelled ({archivedCanceled.length})
              </TabsTrigger>
              <TabsTrigger value="signed-contracts">
                Signed ({archivedSigned.length})
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent value="leads" className="mt-4">
          <AdminLeadsPanel embedded />
        </TabsContent>

        <TabsContent value="tentative" className="mt-4">
          <BookingTable
            rows={tentative}
            loading={events.isLoading}
            onConfirm={(id) => setConfirmId(id)}
            onCancel={requestCancel}
            showActions
          />
        </TabsContent>
        <TabsContent value="confirmed" className="mt-4">
          <BookingTable
            rows={confirmed}
            loading={events.isLoading}
            onCancel={requestCancel}
            deposits={depositByEvent}
            onGenerateContract={(id) => {
              const e = all.find((r) => r.id === id) as any | undefined;
              if (!e) return;
              try {
                const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
                const evtDate = new Date(e.event_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
                setContractTarget({
                  etype: e.event_type,
                  fac: e.facility,
                  name: e.client_name,
                  contact: e.contact_number ?? "",
                  email: e.email ?? "",
                  org: e.organization ?? "",
                  eventSpace: e.event_space ?? "",
                  pkg: e.package_name ?? "",
                  pax: e.pax ?? 0,
                  cpp: e.cost_per_person ?? 0,
                  startTime: e.start_time ?? "",
                  endTime: e.end_time ?? "",
                  notes: e.notes ?? "",
                  till: FACILITY_TILL[e.facility] ?? "",
                  bdayPersons: e.birthday_persons ?? [],
                  schPkgs: e.package_options ?? [],
                  evtDate,
                  today,
                  total: Number(e.pax || 0) * Number(e.cost_per_person || 0),
                  eventId: e.id,
                });
              } catch (err) {
                // ignore
              }
            }}
          />
        </TabsContent>
        <TabsContent value="clearance" className="mt-4">
          <BookingTable
            rows={awaitingClearance}
            loading={events.isLoading}
            onClear={(id) => setClearanceId(id)}
            deposits={depositByEvent}
            showActions
          />
        </TabsContent>

        {showArchive && (
          <>
            <TabsContent value="cleared" className="mt-4">
              <BookingTable
                rows={archivedCleared}
                loading={archivedEvents.isLoading}
                deposits={depositByEvent}
              />
            </TabsContent>

            <TabsContent value="canceled" className="mt-4">
              <BookingTable
                rows={archivedCanceled}
                loading={archivedEvents.isLoading}
              />
            </TabsContent>

            <TabsContent value="signed-contracts" className="mt-4">
              <ContractsTab
                rows={archivedSigned}
                loading={contracts.isLoading}
              />
            </TabsContent>
          </>
        )}

        <TabsContent value="contracts" className="mt-4">
          <ContractsTab rows={unsignedContracts} loading={contracts.isLoading} />
        </TabsContent>
      </Tabs>

      <BookingFormDialog
        open={open}
        onOpenChange={setOpen}
        pending={create.isPending}
        onSubmit={handleCreate}
      />

      <ConfirmBookingDialog
        eventId={confirmId}
        event={confirmId ? all.find((e) => e.id === confirmId) ?? null : null}
        isAtRisk={confirmId ? atRisk.some((e) => e.id === confirmId) : false}
        pending={confirmBooking.isPending}
        onCancel={() => setConfirmId(null)}
        onConfirmWithDeposit={(payment) => {
          if (!confirmId) return;
          confirmBooking.mutate({ id: confirmId, payment });
        }}
        onConfirmWithoutDeposit={(warningAck) => {
          if (!confirmId) return;
          confirmBooking.mutate({ id: confirmId, payment: null, warningAck });
        }}
      />

      <ClearanceDialog
        eventId={clearanceId}
        event={clearanceId ? all.find((e) => e.id === clearanceId) ?? null : null}
        pending={clearEvent.isPending}
        onCancel={() => setClearanceId(null)}
        onSubmit={(data) => {
          if (!clearanceId) return;
          clearEvent.mutate({ ...data, event_id: clearanceId });
        }}
      />

      <Dialog
        open={!!cancelTarget}
        onOpenChange={(o) => {
          if (!o) {
            setCancelTarget(null);
            setCancelInput("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">DO YOU WANT TO CANCEL?</DialogTitle>
            <DialogDescription>
              Type <span className="font-mono font-bold">YES</span> to cancel this booking, or{" "}
              <span className="font-mono font-bold">NO</span> to abort.
              {cancelTarget && (
                <span className="mt-2 block text-xs">
                  Booking: <strong>{cancelTarget.organization || cancelTarget.client_name}</strong>
                  {" · "}
                  {cancelTarget.event_date}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>
          <div>
            <Label>Reason for cancellation *</Label>
            <Textarea
              autoFocus
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              placeholder="Enter a brief reason for cancelling this booking"
              rows={3}
            />
          </div>
          <div className="mt-3">
            <Label>Confirm cancellation</Label>
            <Input
              value={cancelInput}
              onChange={(e) => setCancelInput(e.target.value)}
              placeholder="Type YES to cancel or NO to abort"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submitCancel();
                }
              }}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCancelTarget(null);
                setCancelInput("");
              }}
            >
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={submitCancel}
              disabled={cancelBooking.isPending}
            >
              {cancelBooking.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <ContractSigningModal
        open={!!contractTarget}
        onClose={() => setContractTarget(null)}
        data={contractTarget}
      />
    </div>
  );
}

function getConfirmWarning(event: { event_type: EventTypeEnum; package_name: string } | null): string | null {
  if (!event) return null;
  const pkg = (event.package_name ?? "").toLowerCase();
  if (event.event_type === "school_trip" && pkg.includes("eat")) {
    return "This booking has an 'Eat' package. If the client fails to show, you will be charged an amount equivalent to the meals provided.";
  }
  if (event.event_type === "hangout" && (pkg.includes("half day") || pkg.includes("full day") || pkg.includes("team building"))) {
    return "This booking has a food order that must be confirmed in time for the kitchen team. If the client fails to meet the agreed amount, you will be charged an amount equivalent to the meals provided.";
  }
  if (event.event_type === "birthday") {
    return "This booking will use inventory/food items for preparation and during the event. If the client fails to meet the agreed amount, you will be charged an amount equivalent to these items.";
  }
  return "Caution: confirming without a deposit means you accept responsibility for this booking. Your name will be logged against this confirmation.";
}

function ConfirmBookingDialog({
  eventId,
  event,
  isAtRisk,
  pending,
  onCancel,
  onConfirmWithDeposit,
  onConfirmWithoutDeposit,
}: {
  eventId: string | null;
  event: { event_type: EventTypeEnum; package_name: string; client_name: string; organization: string | null } | null;
  isAtRisk: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirmWithDeposit: (payment: ConfirmPaymentForm) => void;
  onConfirmWithoutDeposit: (warningAck: string) => void;
}) {
  const [mode, setMode] = useState<"deposit" | "no-deposit">("deposit");
  const warning = getConfirmWarning(event);
  return (
    <Dialog open={!!eventId} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Confirm booking</DialogTitle>
          <DialogDescription>
            Record a deposit payment, or — if this is an at-risk booking — confirm without a deposit.
          </DialogDescription>
        </DialogHeader>

        {isAtRisk && warning && (
          <Alert variant="destructive" className="border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200 [&>svg]:text-amber-600">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Warning</AlertTitle>
            <AlertDescription>{warning}</AlertDescription>
          </Alert>
        )}

        {isAtRisk && (
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              variant={mode === "deposit" ? "default" : "outline"}
              onClick={() => setMode("deposit")}
            >
              Record deposit
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === "no-deposit" ? "default" : "outline"}
              onClick={() => setMode("no-deposit")}
            >
              Confirm without deposit
            </Button>
          </div>
        )}

        {!isAtRisk || mode === "deposit" ? (
          <ConfirmPaymentForm
            pending={pending}
            onCancel={onCancel}
            onSubmit={onConfirmWithDeposit}
          />
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              By proceeding, you acknowledge the warning above. Your admin account will be logged
              against this confirmation.
            </p>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={pending}
                onClick={() => onConfirmWithoutDeposit(warning ?? "acknowledged")}
              >
                {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                I acknowledge — confirm without deposit
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ConfirmPaymentForm({
  pending,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  onCancel: () => void;
  onSubmit: (payment: ConfirmPaymentForm) => void;
}) {
  const [mode, setMode] = useState("");
  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = confirmPaymentSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    onSubmit(parsed.data);
  };
  return (
    <form onSubmit={handle} className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <Label className="text-xs">Deposit amount (KES)</Label>
          <Input name="amount" type="number" min="0.01" step="0.01" required />
        </div>
        <div>
          <Label className="text-xs">Payment mode</Label>
          <input type="hidden" name="mode" value={mode} required />
          <Select value={mode} onValueChange={setMode}>
            <SelectTrigger><SelectValue placeholder="Select mode" /></SelectTrigger>
            <SelectContent>
              {PAYMENT_MODE_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Date paid</Label>
          <Input
            name="date_paid"
            type="date"
            required
            defaultValue={new Date().toISOString().slice(0, 10)}
          />
        </div>
        <div>
          <Label className="text-xs">Confirmation code</Label>
          <Input name="confirmation_code" required maxLength={100} />
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>Cancel</Button>
        <Button type="submit" disabled={pending}>
          {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Confirm booking
        </Button>
      </DialogFooter>
    </form>
  );
}

function ClearanceDialog({
  eventId,
  event,
  pending,
  onCancel,
  onSubmit,
}: {
  eventId: string | null;
  event: { client_name: string; organization: string | null; event_date: string } | null;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (data: z.infer<typeof clearanceSchema>) => void;
}) {
  const [source, setSource] = useState("in_bound");
  const [actualPax, setActualPax] = useState(0);
  const [hamecoPP, setHamecoPP] = useState(0);
  const [hamecoAdd, setHamecoAdd] = useState(0);
  const [kiddie, setKiddie] = useState(0);
  const [foodOrder, setFoodOrder] = useState(0);
  const [deposit, setDeposit] = useState(0);
  const [hamecoDetails, setHamecoDetails] = useState<string[]>([]);

  const calc = useMemo(() => {
    const hamecoPackage = actualPax * hamecoPP;
    const totalHameco = hamecoPackage + hamecoAdd;
    const totalFameco = kiddie + foodOrder;
    const totalSpend = totalHameco + totalFameco;
    const topUp = totalSpend - deposit;
    return { hamecoPackage, totalHameco, totalFameco, totalSpend, topUp };
  }, [actualPax, hamecoPP, hamecoAdd, kiddie, foodOrder, deposit]);

  const toggleHamecoDetail = (opt: string) =>
    setHamecoDetails((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("event_id", eventId || "");
    fd.set("source", source);
    fd.set("hameco_additional_details", hamecoDetails.join(", "));
    const parsed = clearanceSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <Dialog open={!!eventId} onOpenChange={(o) => !o && onCancel()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Clearance form</DialogTitle>
          <DialogDescription>Totals calculate automatically.</DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label className="text-xs">Event</Label>
              <div className="text-sm font-medium">
                {event ? `${event.organization || event.client_name} · ${event.event_date}` : "—"}
              </div>
              <input type="hidden" name="event_id" value={eventId || ""} />
            </div>
            <div>
              <Label className="text-xs">Source</Label>
              <input type="hidden" name="source" value={source} required />
              <Select value={source} onValueChange={setSource}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="in_bound">In-bound</SelectItem>
                  <SelectItem value="out_bound">Out-bound</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Out-bound contact (if applicable)</Label>
              <Input name="out_bound_contact" maxLength={150} />
            </div>
            <div>
              <Label className="text-xs">Actual pax</Label>
              <Input
                name="actual_pax"
                type="number"
                min="0"
                step="1"
                defaultValue="0"
                onChange={(e) => setActualPax(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Hameco per person</Label>
              <Input
                name="hameco_per_person"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                onChange={(e) => setHamecoPP(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Hameco additional</Label>
              <Input
                name="hameco_additional_spend"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                onChange={(e) => setHamecoAdd(Number(e.target.value) || 0)}
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">Hameco additional details</Label>
              <input type="hidden" name="hameco_additional_details" value={hamecoDetails.join(", ")} />
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
                {HAMECO_ADDITIONAL_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox checked={hamecoDetails.includes(opt)} onCheckedChange={() => toggleHamecoDetail(opt)} />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs">Kiddie meal</Label>
              <Input
                name="kiddie_meal_amount"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                onChange={(e) => setKiddie(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Additional food order</Label>
              <Input
                name="additional_food_order"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                onChange={(e) => setFoodOrder(Number(e.target.value) || 0)}
              />
            </div>
            <div>
              <Label className="text-xs">Deposit paid</Label>
              <Input
                name="deposit"
                type="number"
                min="0"
                step="0.01"
                defaultValue="0"
                onChange={(e) => setDeposit(Number(e.target.value) || 0)}
              />
            </div>
          </div>

          <Card className="bg-muted/40">
            <CardHeader className="py-3">
              <CardTitle className="text-sm">Calculated</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Hameco package spend</span>
                <span>{formatCurrency(calc.hamecoPackage)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Hameco</span>
                <span>{formatCurrency(calc.totalHameco)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total Fameco</span>
                <span>{formatCurrency(calc.totalFameco)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-muted-foreground">Total spend</span>
                <span>{formatCurrency(calc.totalSpend)}</span>
              </div>
              <div className="flex justify-between font-semibold">
                <span className="text-muted-foreground">Top-up / balance</span>
                <span>{formatCurrency(calc.topUp)}</span>
              </div>
            </CardContent>
          </Card>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save & mark cleared
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}


type BirthdayPerson = { name: string; dob: string; gender?: string };

function BookingFormDialog({
  open,
  onOpenChange,
  pending,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  pending: boolean;
  onSubmit: (data: BookingForm) => void;
}) {
  const [eventType, setEventType] = useState<string>("");
  const [facility, setFacility] = useState<string>("");
  const [eventSpace, setEventSpace] = useState<string>("");
  const [birthdayPersons, setBirthdayPersons] = useState<BirthdayPerson[]>([
    { name: "", dob: "", gender: "" },
  ]);
  const [packageOptions, setPackageOptions] = useState<string[]>([]);
  const [packageName, setPackageName] = useState<string>("");
  const [costPerPerson, setCostPerPerson] = useState<string>("");
  const [eventDate, setEventDate] = useState<string>("");
  const [timeSlot, setTimeSlot] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("");
  const [endTime, setEndTime] = useState<string>("");
  const [pax, setPax] = useState<string>("");
  const [howHear, setHowHear] = useState<string>("");

  const HEARD_OPTIONS: { value: string; label: string }[] = [
    { value: "referral", label: "Referrals (Word of Mouth)" },
    { value: "repeat_client", label: "Repeat Client (Previously used services)" },
    { value: "social_media", label: "Social Media (Instagram, Facebook, TikTok, etc.)" },
    { value: "search_engine", label: "Search Engine (Google, Bing, etc.)" },
    { value: "walk_in", label: "Walk In (Passing by)" },
    { value: "online_review", label: "Online Review Site (Yelp, Google Reviews)" },
    { value: "paid_ad", label: "Paid Online Ad (Google Ads, YouTube, retargeting)" },
    { value: "email", label: "Email (newsletter, promotion)" },
    { value: "texts", label: "Texts (SMS marketing)" },
    { value: "event_trade_show", label: "Event or Trade Show" },
    { value: "billboard", label: "Billboard" },
    { value: "flyer", label: "Flyer or Leaflet" },
    { value: "radio", label: "Radio Ad" },
    { value: "tv", label: "TV Ad" },
    { value: "podcast", label: "Podcast Ad or Mention" },
    { value: "press", label: "Press / News Article" },
    { value: "blog", label: "Blog or Article" },
    { value: "conference", label: "Conference or Networking Event" },
  ];

  const isBirthday = eventType === "birthday";
  const isSchool = eventType === "school_trip";
  const isHangout = eventType === "hangout";
  const isLeague = eventType === "league_tournament";
  // Flexible time event types (buyout, walk-in, 3p, in-house) reuse the same free start/end
  // inputs as Hangout (handled by the !usesFixedSlots branch below).
  const _isFlexible = isFlexibleTimeEventType(eventType);
  void _isFlexible;
  const slots = isSchool ? TIME_SLOT_OPTIONS_SCHOOL : TIME_SLOT_OPTIONS_DEFAULT;
  const usesFixedSlots = isBirthday || isSchool;

  // Birthday packages depend on facility
  const birthdayPackageList =
    isBirthday && facility ? BIRTHDAY_PACKAGES_BY_FACILITY[facility as FacilityEnum] ?? [] : [];

  // Recompute school-trip cost from checkboxes + facility
  const recomputeSchoolCost = (opts: string[], fac: string) => {
    let total = 0;
    for (const o of opts) {
      if (o === "Play") {
        total += fac ? SCHOOL_TRIP_PLAY_COST_BY_FACILITY[fac as FacilityEnum] ?? 0 : 0;
      } else if (o === "Eat" || o === "Learn" || o === "Drinks") {
        total += SCHOOL_TRIP_FIXED_COSTS[o];
      }
    }
    setCostPerPerson(total ? String(total) : "");
    setPackageName(opts.length ? `School Trip: ${opts.join(" + ")}` : "");
  };

  const togglePackageOption = (opt: string) => {
    const next = packageOptions.includes(opt)
      ? packageOptions.filter((o) => o !== opt)
      : [...packageOptions, opt];
    setPackageOptions(next);
    if (isSchool) recomputeSchoolCost(next, facility);
  };

  const addBirthdayPerson = () =>
    setBirthdayPersons((prev) => [...prev, { name: "", dob: "", gender: "" }]);
  const removeBirthdayPerson = (i: number) =>
    setBirthdayPersons((prev) => prev.filter((_, idx) => idx !== i));
  const updateBirthdayPerson = (i: number, key: keyof BirthdayPerson, value: string) =>
    setBirthdayPersons((prev) =>
      prev.map((p, idx) => (idx === i ? { ...p, [key]: value } : p)),
    );

  const applySlot = (val: string) => {
    setTimeSlot(val);
    const slot = slots.find((s) => s.value === val);
    if (slot) {
      setStartTime(slot.start);
      setEndTime(slot.end);
    }
  };

  // Hangout end-time recalculation
  const recalcHangoutEnd = (start: string, pkgName: string) => {
    const pkg = HANGOUT_PACKAGES.find((p) => p.name === pkgName);
    if (start && pkg) setEndTime(addHoursToTime(start, pkg.durationHours));
  };

  // Event type change: reset dependent state
  const onEventTypeChange = (val: string) => {
    setEventType(val);
    setPackageName("");
    setCostPerPerson("");
    setPackageOptions([]);
    setTimeSlot("");
    setStartTime("");
    setEndTime("");
    if (val === "hangout") {
      // default to facility package
      const def = HANGOUT_PACKAGES[0];
      setPackageName(def.name);
      setCostPerPerson(String(def.cost));
    }
  };

  const onFacilityChange = (val: string) => {
    setFacility(val);
    if (isBirthday) {
      // reset package since list changes
      setPackageName("");
      setCostPerPerson("");
    } else if (isSchool) {
      recomputeSchoolCost(packageOptions, val);
    }
  };

  const onBirthdayPackageChange = (name: string) => {
    setPackageName(name);
    const pkg = birthdayPackageList.find((p) => p.name === name);
    if (pkg) setCostPerPerson(String(pkg.cost));
  };

  const onHangoutPackageChange = (name: string) => {
    setPackageName(name);
    const pkg = HANGOUT_PACKAGES.find((p) => p.name === name);
    if (pkg) {
      setCostPerPerson(String(pkg.cost));
      recalcHangoutEnd(startTime, name);
    }
  };

  const onHangoutStartChange = (val: string) => {
    setStartTime(val);
    recalcHangoutEnd(val, packageName);
  };

  // School-trip date guard: disable weekends
  const isWeekend = (d: string) => {
    if (!d) return false;
    const dt = new Date(d);
    const day = dt.getDay();
    return day === 0 || day === 6;
  };

  const reset = () => {
    setEventType("");
    setFacility("");
    setEventSpace("");
    setBirthdayPersons([{ name: "", dob: "", gender: "" }]);
    setPackageOptions([]);
    setPackageName("");
    setCostPerPerson("");
    setEventDate("");
    setTimeSlot("");
    setStartTime("");
    setEndTime("");
    setPax("");
  };

  const handle = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd) as Record<string, string>;
    const cleanedBirthdays = isBirthday
      ? birthdayPersons.filter((p) => p.name.trim() && p.dob && p.gender)
      : [];
    if (isBirthday && cleanedBirthdays.length === 0) {
      toast.error("Add at least one birthday person");
      return;
    }
    if (isSchool && isWeekend(eventDate)) {
      toast.error("School trips cannot be booked on weekends");
      return;
    }
    if (isSchool && packageOptions.length === 0) {
      toast.error("Select at least one school trip option");
      return;
    }
    const payload = {
      ...raw,
      event_type: eventType,
      facility,
      event_space: eventSpace,
      event_date: eventDate || raw.event_date,
      start_time: startTime || raw.start_time,
      end_time: endTime || raw.end_time,
      package_name: packageName || raw.package_name,
      cost_per_person: costPerPerson || raw.cost_per_person,
      birthday_persons: cleanedBirthdays,
      package_options: isSchool ? packageOptions : [],
    };
    const parsed = bookingSchema.safeParse(payload);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    onSubmit(parsed.data);
    reset();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        onOpenChange(o);
        if (!o) reset();
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Event Booking Form</DialogTitle>
          <DialogDescription>
            Fill in the details below to book your event.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handle} className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Full Name *" name="client_name" required />
            <Field label="Contact Number *" name="contact_number" required />
          </div>
          <Field label="Email Address" name="email" type="email" />

          <div>
            <Label className="text-xs">Event Type *</Label>
            <Select value={eventType} onValueChange={onEventTypeChange}>
              <SelectTrigger>
                <SelectValue placeholder="Select Event Type" />
              </SelectTrigger>
              <SelectContent>
                {EVENT_TYPE_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Organisation/Institution: show only when an event type (other than birthday) is selected */}
          {!isBirthday && eventType ? (
            (isSchool || isHangout || isLeague) ? (
              <Field label="Organisation/Institution *" name="organization" required />
            ) : (
              <Field label="Organisation/Institution" name="organization" />
            )
          ) : null}

          {isBirthday && (
            <div>
              <Label className="text-xs">Birthday Person(s) *</Label>
              <p className="mb-2 text-xs text-muted-foreground">
                Add the name and date of birth for each birthday person
              </p>
              <div className="space-y-2">
                {birthdayPersons.map((p, i) => (
                  <div key={i} className="flex gap-2">
                    <div className="flex-1">
                      <Input
                        placeholder="Name"
                        value={p.name}
                        onChange={(e) => updateBirthdayPerson(i, "name", e.target.value)}
                        maxLength={100}
                      />
                    </div>
                    <div className="w-40">
                      <Input
                        type="date"
                        value={p.dob}
                        onChange={(e) => updateBirthdayPerson(i, "dob", e.target.value)}
                      />
                    </div>
                    <div className="w-36">
                      <Select value={p.gender || ""} onValueChange={(v) => updateBirthdayPerson(i, "gender", v)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Gender" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">Male</SelectItem>
                          <SelectItem value="female">Female</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {birthdayPersons.length > 1 && (
                      <Button
                        type="button"
                        size="icon"
                        variant="outline"
                        onClick={() => removeBirthdayPerson(i)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="mt-2"
                onClick={addBirthdayPerson}
              >
                <Plus className="mr-1 h-4 w-4" /> Add Another Birthday Person
              </Button>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label className="text-xs">Event Date *</Label>
              <Input
                name="event_date"
                type="date"
                value={eventDate}
                onChange={(e) => {
                  const v = e.target.value;
                  if (isSchool && isWeekend(v)) {
                    toast.error("School trips are weekdays only");
                    return;
                  }
                  setEventDate(v);
                }}
                required
              />
            </div>
            {/* Time inputs: hidden for fixed-slot event types */}
            {!usesFixedSlots ? (
              <>
                <div>
                  <Label className="text-xs">Start Time *</Label>
                  <Input
                    name="start_time"
                    type="time"
                    value={startTime}
                    min={isHangout ? "09:00" : undefined}
                    max={isHangout ? "19:00" : undefined}
                    onChange={(e) =>
                      isHangout ? onHangoutStartChange(e.target.value) : setStartTime(e.target.value)
                    }
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs">End Time {isHangout ? "(auto)" : "*"}</Label>
                  <Input
                    name="end_time"
                    type="time"
                    value={endTime}
                    readOnly={isHangout}
                    onChange={(e) => setEndTime(e.target.value)}
                    required
                  />
                </div>
              </>
            ) : (
              <>
                <input type="hidden" name="start_time" value={startTime} />
                <input type="hidden" name="end_time" value={endTime} />
              </>
            )}
          </div>

          {usesFixedSlots && (
            <div>
              <Label className="text-xs">Select Time Slot *</Label>
              <Select value={timeSlot} onValueChange={applySlot}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Time Slot" />
                </SelectTrigger>
                <SelectContent>
                  {slots.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Facility of Interest *</Label>
              <Select value={facility} onValueChange={onFacilityChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Facility" />
                </SelectTrigger>
                <SelectContent>
                  {FACILITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">Event Space *</Label>
              <Select value={eventSpace} onValueChange={setEventSpace}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Event Space" />
                </SelectTrigger>
                <SelectContent>
                  {EVENT_SPACE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* PACKAGE SECTION — varies by event type */}
          {isSchool ? (
            <div>
              <Label className="text-xs">School Trip Package Options *</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-4">
                {SCHOOL_TRIP_PACKAGE_OPTIONS.map((opt) => (
                  <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={packageOptions.includes(opt)}
                      onCheckedChange={() => togglePackageOption(opt)}
                    />
                    <span>{opt}</span>
                  </label>
                ))}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Cost per person updates automatically based on selections and facility.
              </p>
              <input type="hidden" name="package_name" value={packageName} />
            </div>
          ) : isBirthday ? (
            <div>
              <Label className="text-xs">Package *</Label>
              <Select
                value={packageName}
                onValueChange={onBirthdayPackageChange}
                disabled={!facility}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={facility ? "Select Package" : "Select facility first"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {birthdayPackageList.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name} — {formatCurrency(p.cost)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="package_name" value={packageName} />
            </div>
          ) : isHangout ? (
            <div>
              <Label className="text-xs">Package *</Label>
              <Select value={packageName} onValueChange={onHangoutPackageChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Select Package" />
                </SelectTrigger>
                <SelectContent>
                  {HANGOUT_PACKAGES.map((p) => (
                    <SelectItem key={p.name} value={p.name}>
                      {p.name} — {formatCurrency(p.cost)} ({p.durationHours}h)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <input type="hidden" name="package_name" value={packageName} />
            </div>
          ) : (
            <Field label="Package *" name="package_name" required />
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label className="text-xs">Number of Persons (PAX) * (Min 10)</Label>
              <Input
                name="pax"
                type="number"
                min="10"
                required
                value={pax}
                onChange={(e) => setPax(e.target.value)}
              />
            </div>
            <div>
              <Label className="text-xs">Cost per Person (KES) *</Label>
              <Input
                name="cost_per_person"
                type="number"
                min="0"
                step="0.01"
                value={costPerPerson}
                onChange={(e) => setCostPerPerson(e.target.value)}
                readOnly={isBirthday || isSchool || isHangout}
                required
              />
              <div className="mt-2 flex items-center justify-end">
                <div className="rounded-full bg-muted px-3 py-1 text-sm">
                  Total: {formatCurrency(((parseFloat(costPerPerson) || 0) * (parseInt(pax || "0") || 0)))}
                </div>
              </div>
            </div>
          </div>
          <div>
            <Label className="text-xs">How did you hear about us?</Label>
            <input type="hidden" name="how_did_you_hear" value={howHear} />
            <Select value={howHear} onValueChange={setHowHear}>
              <SelectTrigger>
                <SelectValue placeholder="Select an option" />
              </SelectTrigger>
              <SelectContent>
                {HEARD_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-xs">Additional Notes / Special Requests</Label>
            <Textarea name="notes" rows={3} maxLength={1000} />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending}>
              {pending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save &amp; Generate Sign Link
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{children}</div>
    </div>
  );
}

function Field({
  label,
  name,
  type = "text",
  required,
  placeholder,
  min,
  step,
}: {
  label: string;
  name: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
  min?: string;
  step?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input name={name} type={type} required={required} placeholder={placeholder} min={min} step={step} />
    </div>
  );
}

function SelectField({
  label,
  name,
  options,
  required,
}: {
  label: string;
  name: string;
  options: { value: string; label: string }[];
  required?: boolean;
}) {
  const [val, setVal] = useState("");
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <input type="hidden" name={name} value={val} required={required} />
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger>
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface EventRow {
  id: string;
  client_name: string;
  contact_number?: string;
  organization: string | null;
  event_type: EventTypeEnum;
  facility: FacilityEnum;
  event_date: string;
  start_time: string;
  end_time: string;
  status: string;
  pax: number;
  cancellation_reason?: string | null;
  cancellation_at?: string | null;
  birthday_persons?: any;
}

function statusBadge(status: string) {
  const map: Record<string, string> = {
    tentative: "bg-amber-500/15 text-amber-700 dark:text-amber-400",
    confirmed: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-400",
    cleared: "bg-blue-500/15 text-blue-700 dark:text-blue-400",
    canceled: "bg-muted text-muted-foreground",
  };
  return (
    <Badge variant="outline" className={map[status] ?? ""}>
      {status}
    </Badge>
  );
}

type DepositInfo = { amount: number; payment_mode: "mpesa" | "card" | "cash"; date_paid: string; confirmation_code: string };

function BookingTable({
  rows,
  loading,
  onConfirm,
  onCancel,
  onClear,
  showActions,
  deposits,
  onGenerateContract,
}: {
  rows: EventRow[];
  loading: boolean;
  onConfirm?: (id: string) => void;
  onCancel?: (id: string) => void;
  onClear?: (id: string) => void;
  showActions?: boolean;
  deposits?: Map<string, DepositInfo>;
  onGenerateContract?: (id: string) => void;
}) {
  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }
  if (!rows.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No bookings here.
        </CardContent>
      </Card>
    );
  }
  const showDeposit = !!deposits;
  const showCancelReason = rows.some((r) => r.status === "canceled");
  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[700px]">
            <Table>
              <TableHeader>
            <TableRow>
              <TableHead>Events Name</TableHead>
              <TableHead>Contact Person</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Time</TableHead>
              <TableHead>Pax</TableHead>
              <TableHead>Status</TableHead>
              {showCancelReason && <TableHead>Cancellation reason</TableHead>}
              {showDeposit && <TableHead className="text-right">Deposit</TableHead>}
              {showDeposit && <TableHead>Conf. code</TableHead>}
              {showDeposit && <TableHead>Date paid</TableHead>}
              {(onConfirm || onCancel) && <TableHead className="text-right">Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => {
              const dep = deposits?.get(r.id);
              return (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">
                    {(() => {
                      if (r.event_type === "birthday" && Array.isArray(r.birthday_persons) && r.birthday_persons.length > 0) {
                        return r.birthday_persons.map((p: any) => p.name).join(", ");
                      }
                      return r.organization || r.client_name;
                    })()}
                  </TableCell>
                  <TableCell>{r.client_name}</TableCell>
                  <TableCell>{r.contact_number}</TableCell>
                  <TableCell>{eventTypeLabel(r.event_type)}</TableCell>
                  <TableCell>{facilityLabel(r.facility)}</TableCell>
                  <TableCell>{r.event_date}</TableCell>
                  <TableCell className="whitespace-nowrap">
                    {r.start_time.slice(0, 5)}–{r.end_time.slice(0, 5)}
                  </TableCell>
                  <TableCell>{r.pax}</TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                  {showCancelReason && (
                    <TableCell className="max-w-[240px]">
                      {r.cancellation_reason ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {showDeposit && (
                    <TableCell className="text-right font-semibold">
                      {dep ? formatCurrency(dep.amount) : <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {showDeposit && (
                    <TableCell className="font-mono text-xs">
                      {dep?.confirmation_code ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {showDeposit && (
                    <TableCell>
                      {dep?.date_paid ?? <span className="text-muted-foreground">—</span>}
                    </TableCell>
                  )}
                  {(onConfirm || onCancel || onClear) && (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        {showActions && onConfirm && (
                          <Button size="sm" onClick={() => onConfirm(r.id)}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Confirm
                          </Button>
                        )}
                        {onCancel && (
                          <Button size="sm" variant="outline" onClick={() => onCancel(r.id)}>
                            <X className="mr-1 h-3.5 w-3.5" /> Cancel
                          </Button>
                        )}
                        {showActions && onClear && (
                          <Button size="sm" onClick={() => onClear(r.id)}>
                            <CheckCircle2 className="mr-1 h-3.5 w-3.5" /> Clear
                          </Button>
                        )}
                        {showActions && onGenerateContract && (
                          <Button size="sm" variant="outline" onClick={() => onGenerateContract(r.id)}>
                            Contract
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ContractsTab({
  rows,
  loading,
}: {
  rows: ContractRow[];
  loading: boolean;
}) {
  const qc = useQueryClient();
  const { user } = useAuth();

  const regenerate = useMutation({
    mutationFn: async (row: ContractRow) => {
      const { data: ev, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", row.event_id)
        .single();
      if (error) throw error;

      const today = new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
      const evtDate = new Date(ev.event_date + "T12:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });

      const contractPayload: ContractData = {
        etype:       ev.event_type,
        fac:         ev.facility,
        name:        ev.client_name,
        contact:     ev.contact_number,
        email:       ev.email ?? "",
        org:         ev.organization ?? "",
        eventSpace:  ev.event_space,
        pkg:         ev.package_name ?? "",
        pax:         ev.pax,
        cpp:         ev.cost_per_person,
        startTime:   ev.start_time,
        endTime:     ev.end_time,
        notes:       ev.notes ?? "",
        till:        FACILITY_TILL[ev.facility as FacilityEnum] ?? "",
        bdayPersons: (ev.birthday_persons as { name: string; dob: string }[]) ?? [],
        schPkgs:     (ev.package_options as string[]) ?? [],
        evtDate,
        today,
        total:       Number(ev.pax) * Number(ev.cost_per_person),
        eventId:     ev.id,
      };

      const newLink = buildSignLink(contractPayload);

      const { error: upErr } = await supabase
        .from("contracts")
        .update({ content: newLink, generated_by: user?.id ?? null })
        .eq("id", row.id);
      if (upErr) throw upErr;

      return newLink;
    },
    onSuccess: (link) => {
      navigator.clipboard.writeText(link).catch(() => {});
      toast.success("New signing link generated & copied");
      qc.invalidateQueries({ queryKey: ["admin", "contracts"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-10">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!rows.length) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          No contracts yet. Contracts are created automatically when a new booking is saved.
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <div className="min-w-[800px]">
            <Table>
              <TableHeader>
            <TableRow>
              <TableHead>Client</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Facility</TableHead>
              <TableHead>Date</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Signed</TableHead>
              <TableHead>Sign Link</TableHead>
              <TableHead className="text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">
                  {r.organization || r.client_name || "—"}
                </TableCell>
                <TableCell>
                  {r.event_type ? eventTypeLabel(r.event_type) : "—"}
                </TableCell>
                <TableCell>
                  {r.facility ? facilityLabel(r.facility) : "—"}
                </TableCell>
                <TableCell>{r.event_date ?? "—"}</TableCell>
                <TableCell>
                  {r.status ? statusBadge(r.status) : "—"}
                </TableCell>
                <TableCell>
                  {r.signature_url ? (
                    <Badge variant="outline" className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400">
                      Signed
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-500/15 text-amber-700 dark:text-amber-400">
                      Pending
                    </Badge>
                  )}
                </TableCell>
                <TableCell className="max-w-[180px]">
                  {r.content ? (
                    <div className="flex items-center gap-1">
                      <span className="truncate font-mono text-xs text-muted-foreground max-w-[120px]" title={r.content}>
                        {r.content.length > 40 ? r.content.slice(0, 40) + "…" : r.content}
                      </span>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 shrink-0 px-1 text-xs"
                        onClick={() => {
                          navigator.clipboard.writeText(r.content);
                          toast.success("Link copied");
                        }}
                      >
                        Copy
                      </Button>
                    </div>
                  ) : (
                    <span className="text-muted-foreground text-xs">—</span>
                  )}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-1">
                    {r.signature_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        asChild
                      >
                        <a href={r.signature_url} target="_blank" rel="noopener noreferrer">
                          View PDF
                        </a>
                      </Button>
                    )}
                    {!r.signature_url && (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={regenerate.isPending}
                        onClick={() => regenerate.mutate(r)}
                      >
                        {regenerate.isPending && (
                          <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                        )}
                        Regenerate Link
                      </Button>
                    )}
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
