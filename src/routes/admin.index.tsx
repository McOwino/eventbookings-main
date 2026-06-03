import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueries } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChartContainer, ChartTooltip, ChartTooltipContent,
  ChartLegend, ChartLegendContent,
} from "@/components/ui/chart";
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart,
  Pie, PieChart, XAxis, YAxis, ReferenceLine,
} from "recharts";
import { CalendarDays, Megaphone, Users, CreditCard, Wallet, Baby, MessageSquare, ClipboardCheck, Download, RotateCcw, TrendingUp, Star, Phone, BarChart2 } from "lucide-react";
import { facilityLabel, type FacilityEnum, FACILITY_OPTIONS, EVENT_TYPE_OPTIONS, eventTypeLabel, formatCurrency } from "@/lib/facility-utils";
import {
  buildFacilityChartConfig,
  getFacilityColorByEnum,
} from "@/lib/facility-colors";

// ─────────────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/")({
  component: AdminDashboard,
});

// ── Types & Utilities ─────────────────────────────────────────────────────────────

export interface ExportColumn<T> {
  header: string;
  value: (row: T) => string | number | null | undefined;
}

function escapeCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function exportCSV<T>(filename: string, columns: ExportColumn<T>[], rows: T[]) {
  const header = columns.map((c) => escapeCell(c.header)).join(",");
  const lines = rows.map((row) =>
    columns.map((c) => escapeCell(c.value(row))).join(","),
  );
  const csv = [header, ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${filename}-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

type AnalyticsRow = {
  event_id: string;
  booked_at: string;
  client_name: string;
  organization: string | null;
  contact_number: string;
  email: string | null;
  event_type: string;
  facility: string;
  event_space: string;
  event_date: string;
  start_time: string;
  end_time: string;
  pax: number;
  package_name: string | null;
  package_options: string[] | null;
  cost_per_person: number;
  gross_value: number;
  event_status: string;
  how_did_you_hear: string | null;
  notes: string | null;
  total_deposited: number;
  total_spend: number | null;
  clearance_deposit: number | null;
  balance_outstanding: number | null;
  clearance_mode: string | null;
  cleared_at: string | null;
  feedback_score: number | null;
  satisfaction_level: string | null;
  feedback_comments: string | null;
  feedback_name: string | null;
  inquiry_type: string | null;
  call_status: string | null;
  call_facility: string | null;
};

type Filters = {
  facility: string;
  eventType: string;
  status: string;
  from: string;
  to: string;
};

const DEFAULT_FILTERS: Filters = {
  facility: "all",
  eventType: "all",
  status: "all",
  from: "",
  to: "",
};

const EVENT_TYPE_COLORS = [
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(217 91% 60%)",
  "hsl(280 65% 60%)",
  "hsl(340 82% 52%)",
  "hsl(190 90% 50%)",
] as const;

const LEAD_SOURCE_COLORS = [
  "hsl(142 76% 36%)",
  "hsl(38 92% 50%)",
  "hsl(217 91% 60%)",
  "hsl(280 65% 60%)",
  "hsl(340 82% 52%)",
  "hsl(190 90% 50%)",
  "hsl(120 60% 40%)",
  "hsl(10 90% 50%)",
] as const;

// ── Sub-components ────────────────────────────────────────────────────────────

function GlobalFilterBar({
  filters,
  onChange,
}: {
  filters: Filters;
  onChange: (f: Filters) => void;
}) {
  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-4">
      <div className="space-y-1.5">
        <Label className="text-xs">From</Label>
        <Input
          type="date"
          value={filters.from}
          className="h-9 w-[150px] text-sm"
          onChange={(e) => onChange({ ...filters, from: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">To</Label>
        <Input
          type="date"
          value={filters.to}
          className="h-9 w-[150px] text-sm"
          onChange={(e) => onChange({ ...filters, to: e.target.value })}
        />
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Facility</Label>
        <Select value={filters.facility} onValueChange={(v) => onChange({ ...filters, facility: v })}>
          <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All facilities</SelectItem>
            {FACILITY_OPTIONS.map((f) => (
              <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Event type</Label>
        <Select value={filters.eventType} onValueChange={(v) => onChange({ ...filters, eventType: v })}>
          <SelectTrigger className="h-9 w-[160px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All types</SelectItem>
            {EVENT_TYPE_OPTIONS.map((t) => (
              <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <Label className="text-xs">Status</Label>
        <Select value={filters.status} onValueChange={(v) => onChange({ ...filters, status: v })}>
          <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All statuses</SelectItem>
            <SelectItem value="tentative">Tentative</SelectItem>
            <SelectItem value="confirmed">Confirmed</SelectItem>
            <SelectItem value="cleared">Cleared</SelectItem>
            <SelectItem value="canceled">Canceled</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <Button variant="outline" size="sm" onClick={() => onChange(DEFAULT_FILTERS)}>
        <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
      </Button>
    </div>
  );
}

function AdminDashboard() {
  const { user, roles, isSuperAdmin, hasAnyRole } = useAuth();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const canView = roles.length > 0;

  // ── Parallel queries ────────────────────────────────────────────────────────

  const [analyticsQ, membersQ, promosQ, callLogsQ, feedbackQ] = useQueries({
    queries: [
      {
        queryKey: ["admin", "analytics", filters],
        queryFn: async (): Promise<AnalyticsRow[]> => {
          let q = supabase.from("analytics_master").select("*");

          if (filters.facility !== "all") q = q.eq("facility", filters.facility);
          if (filters.eventType !== "all") q = q.eq("event_type", filters.eventType);
          if (filters.status !== "all") q = q.eq("event_status", filters.status);
          if (filters.from) q = q.gte("event_date", filters.from);
          if (filters.to) q = q.lte("event_date", filters.to);

          const { data, error } = await q
            .order("event_date", { ascending: false })
            .limit(2000);
          if (error) throw error;
          return (data ?? []) as AnalyticsRow[];
        },
        staleTime: 60_000,
      },
      {
        queryKey: ["admin", "analytics", "members"],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("kids_club_members")
            .select("membership_expiry, payment_amount, payment_date, payment_method, kid_name, guardian_names")
            .order("membership_expiry", { ascending: false })
            .limit(2000);
          if (error) throw error;
          return data ?? [];
        },
        staleTime: 60_000,
      },
      {
        queryKey: ["admin", "analytics", "promotions"],
        queryFn: async () => {
          const { count, error } = await supabase
            .from("promotions")
            .select("id", { count: "exact", head: true })
            .eq("is_active", true);
          if (error) throw error;
          return count ?? 0;
        },
        staleTime: 60_000,
      },
      {
        queryKey: ["admin", "analytics", "call-logs"],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("call_logs")
            .select("facility, inquiry_type")
            .order("call_time", { ascending: false })
            .limit(2000);
          if (error) throw error;
          return data ?? [];
        },
        staleTime: 60_000,
      },
      {
        queryKey: ["admin", "analytics", "feedback"],
        queryFn: async () => {
          const { data, error } = await supabase
            .from("feedback")
            .select("facility, score")
            .order("created_at", { ascending: false })
            .limit(2000);
          if (error) throw error;
          return data ?? [];
        },
        staleTime: 60_000,
      },
    ],
  });

  const rows = analyticsQ.data ?? [];
  const members = membersQ.data ?? [];
  const activePromos = promosQ.data ?? 0;
  const callLogs = callLogsQ.data ?? [];
  const feedback = feedbackQ.data ?? [];

  // ── KPIs ────────────────────────────────────────────────────────────────────

  const kpis = useMemo(() => {
    const grossRevenue = rows.reduce((s, r) => s + (r.gross_value ?? 0), 0);
    const totalDeposited = rows.reduce((s, r) => s + (r.total_deposited ?? 0), 0);
    const totalSpend = rows.reduce((s, r) => s + (r.total_spend ?? 0), 0);
    const avgFeedback = feedback.length
      ? (feedback.reduce((s, r) => s + r.score, 0) / feedback.length).toFixed(2)
      : null;
    const now = new Date().toISOString().slice(0, 10);
    const activeMembers = members.filter((m) => m.membership_expiry >= now).length;
    return { grossRevenue, totalDeposited, totalSpend, avgFeedback, activePromos, activeMembers };
  }, [rows, members, activePromos, feedback]);

  // ── Chart data ──────────────────────────────────────────────────────────────

  const { facilityData, typeData, monthTrend, callSourceData, statusData, callLogsFacilityData, callLogsInquiryData, feedbackFacilityData } = useMemo(() => {
    // Revenue by facility
    const facMap = new Map<string, number>();
    for (const r of rows) {
      facMap.set(r.facility, (facMap.get(r.facility) ?? 0) + (r.gross_value ?? 0));
    }
    const facilityData = Array.from(facMap.entries())
      .map(([k, v]) => ({
        facilityKey: k as FacilityEnum,
        facility: facilityLabel(k as FacilityEnum),
        revenue: v,
        fill: k === "general" ? "#888780" : getFacilityColorByEnum(k as FacilityEnum),
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // Bookings by event type
    const typeMap = new Map<string, number>();
    for (const r of rows) {
      typeMap.set(r.event_type, (typeMap.get(r.event_type) ?? 0) + 1);
    }
    const typeData = Array.from(typeMap.entries())
      .map(([k, v], idx) => ({
        type: eventTypeLabel(k as never),
        count: v,
        fill: EVENT_TYPE_COLORS[idx % EVENT_TYPE_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count);

    // Monthly trend (last 6 months)
    const months: { key: string; label: string }[] = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      months.push({
        key,
        label: d.toLocaleString("en", { month: "short" }),
      });
    }
    const monthIdx = new Map(months.map((m, i) => [m.key, i]));
    const monthTrend = months.map((m) => ({ month: m.label, gross: 0, deposited: 0, spend: 0 }));
    for (const r of rows) {
      const k = r.event_date.slice(0, 7);
      const i = monthIdx.get(k);
      if (i !== undefined) {
        monthTrend[i].gross += r.gross_value ?? 0;
        monthTrend[i].deposited += r.total_deposited ?? 0;
        monthTrend[i].spend += r.total_spend ?? 0;
      }
    }

    // Lead source breakdown
    const sourceMap = new Map<string, number>();
    for (const r of rows) {
      if (r.how_did_you_hear) {
        sourceMap.set(r.how_did_you_hear, (sourceMap.get(r.how_did_you_hear) ?? 0) + 1);
      }
    }
    const callSourceData = Array.from(sourceMap.entries())
      .map(([src, count], idx) => ({
        src,
        count,
        fill: LEAD_SOURCE_COLORS[idx % LEAD_SOURCE_COLORS.length],
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    // Events by status
    const STATUS_COLORS: Record<string, string> = {
      tentative:  "hsl(38 92% 50%)",
      confirmed:  "hsl(142 76% 36%)",
      cleared:    "hsl(217 91% 60%)",
      canceled:   "hsl(var(--muted-foreground))",
    };
    const statusMap = new Map<string, number>();
    for (const r of rows) {
      statusMap.set(r.event_status, (statusMap.get(r.event_status) ?? 0) + 1);
    }
    const statusData = Array.from(statusMap.entries()).map(([status, count]) => ({
      status: status.charAt(0).toUpperCase() + status.slice(1),
      statusKey: status,
      count,
      fill: STATUS_COLORS[status] ?? "#888780",
    }));

    // Call logs by facility
    const callFacilityMap = new Map<string, number>();
    for (const cl of callLogs) {
      for (const f of cl.facility) {
        callFacilityMap.set(f, (callFacilityMap.get(f) ?? 0) + 1);
      }
    }
    const callLogsFacilityData = Array.from(callFacilityMap.entries())
      .map(([f, n]) => ({
        facility: f === "general" ? "General" : facilityLabel(f as FacilityEnum),
        facilityKey: f,
        count: n,
        fill: f === "general" ? "#888780" : getFacilityColorByEnum(f as FacilityEnum),
      }))
      .sort((a, b) => b.count - a.count);

    // Call logs by inquiry type
    const callInquiryMap = new Map<string, number>();
    for (const cl of callLogs) {
      for (const i of cl.inquiry_type) {
        callInquiryMap.set(i, (callInquiryMap.get(i) ?? 0) + 1);
      }
    }
    const callLogsInquiryData = Array.from(callInquiryMap.entries())
      .map(([i, n]) => ({ inquiry: i, count: n }))
      .sort((a, b) => b.count - a.count);

    // Feedback by facility
    const feedbackFacilityMap = new Map<string, { sum: number; count: number }>();
    for (const fb of feedback) {
      const f = (feedbackFacilityMap.get(fb.facility) ?? { sum: 0, count: 0 });
      f.sum += fb.score;
      f.count += 1;
      feedbackFacilityMap.set(fb.facility, f);
    }
    const feedbackFacilityData = Array.from(feedbackFacilityMap.entries())
      .map(([facility, { sum, count }]) => {
        // Try to match facility name to enum for color
        let fill = "#888780"; // default gray
        const facilityLower = facility.toLowerCase();
        if (facilityLower === "general") {
          fill = "#888780";
        } else if (facilityLower.includes("village bowl") || facilityLower === "village_bowl") {
          fill = getFacilityColorByEnum("village_bowl");
        } else if (facilityLower.includes("under the sea") || facilityLower === "under_the_sea") {
          fill = getFacilityColorByEnum("under_the_sea");
        } else if (facilityLower.includes("ozone") || facilityLower === "ozone_trampoline_park") {
          fill = getFacilityColorByEnum("ozone_trampoline_park");
        } else if (facilityLower.includes("laser") || facilityLower === "laser_tag") {
          fill = getFacilityColorByEnum("laser_tag");
        } else if (facilityLower.includes("arcade") || facilityLower === "arcade_zone") {
          fill = getFacilityColorByEnum("arcade_zone");
        } else if (facilityLower.includes("bowling") || facilityLower === "bowling_alley") {
          fill = getFacilityColorByEnum("bowling_alley");
        }
        return {
          facility,
          avg: parseFloat((sum / count).toFixed(2)),
          count,
          fill,
        };
      })
      .sort((a, b) => b.avg - a.avg);

    return { facilityData, typeData, monthTrend, callSourceData, statusData, callLogsFacilityData, callLogsInquiryData, feedbackFacilityData };
  }, [rows, callLogs, feedback]);

  // ── CSV export columns ──────────────────────────────────────────────────────

  const analyticsColumns: ExportColumn<AnalyticsRow>[] = [
    { header: "Event Date",        value: (r) => r.event_date },
    { header: "Booked At",         value: (r) => r.booked_at?.slice(0, 10) },
    { header: "Client",            value: (r) => r.client_name },
    { header: "Organisation",      value: (r) => r.organization ?? "" },
    { header: "Contact",           value: (r) => r.contact_number },
    { header: "Email",             value: (r) => r.email ?? "" },
    { header: "Event Type",        value: (r) => r.event_type },
    { header: "Facility",          value: (r) => r.facility },
    { header: "Event Space",       value: (r) => r.event_space },
    { header: "Start Time",        value: (r) => r.start_time },
    { header: "End Time",          value: (r) => r.end_time },
    { header: "Pax",                value: (r) => r.pax },
    { header: "Package",            value: (r) => r.package_name ?? "" },
    { header: "Package Options",    value: (r) => r.package_options?.join("; ") ?? "" },
    { header: "Cost per Person",    value: (r) => r.cost_per_person },
    { header: "Gross Value",        value: (r) => r.gross_value },
    { header: "Status",            value: (r) => r.event_status },
    { header: "How did you hear",  value: (r) => r.how_did_you_hear ?? "" },
    { header: "Notes",             value: (r) => r.notes ?? "" },
    { header: "Total Deposited",   value: (r) => r.total_deposited },
    { header: "Total Spend",       value: (r) => r.total_spend ?? "" },
    { header: "Clearance Deposit", value: (r) => r.clearance_deposit ?? "" },
    { header: "Balance Outstanding", value: (r) => r.balance_outstanding ?? "" },
    { header: "Clearance Mode",    value: (r) => r.clearance_mode ?? "" },
    { header: "Cleared At",        value: (r) => r.cleared_at?.slice(0, 10) ?? "" },
    { header: "Feedback Score",    value: (r) => r.feedback_score ?? "" },
    { header: "Satisfaction Level", value: (r) => r.satisfaction_level ?? "" },
    { header: "Feedback Comments", value: (r) => r.feedback_comments ?? "" },
    { header: "Feedback Name",     value: (r) => r.feedback_name ?? "" },
    { header: "Inquiry Type",      value: (r) => r.inquiry_type ?? "" },
    { header: "Call Status",      value: (r) => r.call_status ?? "" },
    { header: "Call Facility",     value: (r) => r.call_facility ?? "" },
  ];

  const membersColumns: ExportColumn<any>[] = [
    { header: "Kid Name", value: (r) => r.kid_name },
    { header: "Guardian Names", value: (r) => r.guardian_names },
    { header: "Membership Expiry", value: (r) => r.membership_expiry },
    { header: "Payment Amount", value: (r) => r.payment_amount },
    { header: "Payment Date", value: (r) => r.payment_date },
    { header: "Payment Method", value: (r) => r.payment_method },
  ];

  const kpiNum = (n: number) => (n === 0 ? "—" : n.toLocaleString());

  const quickLinks = [
    { to: "/admin/bookings", label: "Bookings", icon: CalendarDays },
    { to: "/admin/payments", label: "Payments", icon: CreditCard },
    { to: "/admin/kids-club", label: "Membership", icon: Baby },
    { to: "/admin/feedback", label: "Feedback", icon: MessageSquare },
    { to: "/admin/promotions", label: "Promotions", icon: Megaphone },
    ...(isSuperAdmin ? [{ to: "/admin/users", label: "Users & Roles", icon: Users }] : []),
  ];

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You do not have access to the analytics hub.
        </CardContent>
      </Card>
    );
  }

  const isLoading = analyticsQ.isLoading || membersQ.isLoading || promosQ.isLoading || callLogsQ.isLoading || feedbackQ.isLoading;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">{user?.email}</p>
        {roles.length === 0 && (
          <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-200">
            You have no roles assigned yet. Ask a super admin to grant you access — most admin
            actions will fail until a role is assigned.
          </div>
        )}
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Dashboard, Analytics, &amp; Data Hub</h1>
          <p className="text-sm text-muted-foreground">
            Cross-module insights — events, revenue, feedback, memberships, and lead sources.
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => exportCSV("analytics", analyticsColumns, rows)}
          disabled={rows.length === 0}
        >
          <Download className="mr-2 h-4 w-4" /> Export filtered CSV
        </Button>
      </div>

      {/* Global filter bar */}
      <GlobalFilterBar filters={filters} onChange={setFilters} />

      {/* KPI strip */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {[
          { label: "Gross value", value: `KES ${kpis.grossRevenue.toLocaleString()}`, icon: TrendingUp },
          { label: "Total deposited", value: `KES ${kpis.totalDeposited.toLocaleString()}`, icon: CreditCard },
          { label: "Cleared spend", value: `KES ${kpis.totalSpend.toLocaleString()}`, icon: CreditCard },
          { label: "Avg feedback", value: kpis.avgFeedback ?? "—", icon: Star },
          { label: "Active promotions", value: kpiNum(kpis.activePromos), icon: Megaphone },
          { label: "Active members", value: kpiNum(kpis.activeMembers), icon: Users },
        ].map((k) => {
          const Icon = k.icon;
          return (
            <Card key={k.label}>
              <CardContent className="flex items-center gap-3 p-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">{k.label}</p>
                  <p className="text-base font-semibold leading-tight">{k.value}</p>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabbed content */}
      <Tabs defaultValue="overview" className="w-full">
        <div className="flex justify-center mb-4">
          <TabsList>
            <TabsTrigger value="overview"><BarChart2 className="mr-1.5 h-3.5 w-3.5" />Overview</TabsTrigger>
            <TabsTrigger value="events">Events</TabsTrigger>
            <TabsTrigger value="financials">Financials</TabsTrigger>
            <TabsTrigger value="feedback">Feedback</TabsTrigger>
            <TabsTrigger value="members">Members</TabsTrigger>
          </TabsList>
        </div>

        {/* ── OVERVIEW CHARTS ── */}
        <TabsContent value="overview" className="mt-0 space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Revenue trend — last 6 months</CardTitle>
                  <CardDescription>Gross value vs deposits vs cleared spend (KES)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[260px] w-full"
                    config={{
                      gross:     { label: "Gross",     color: "hsl(var(--primary))" },
                      deposited: { label: "Deposited", color: "hsl(142 76% 36%)" },
                      spend:     { label: "Spend",     color: "hsl(38 92% 50%)" },
                    }}
                  >
                    <LineChart data={monthTrend}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="month" tickLine={false} axisLine={false} />
                      <YAxis tickLine={false} axisLine={false} width={60} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                      <Line type="monotone" dataKey="gross"     stroke="var(--color-gross)"     strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="deposited" stroke="var(--color-deposited)" strokeWidth={2} dot={false} />
                      <Line type="monotone" dataKey="spend"     stroke="var(--color-spend)"     strokeWidth={2} dot={false} />
                    </LineChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Gross value by facility</CardTitle>
                  <CardDescription>Revenue potential for filtered date range (KES)</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[260px] w-full"
                    config={buildFacilityChartConfig(
                      facilityData.map((row) => ({
                        key: row.facilityKey,
                        label: row.facility,
                        color: row.fill,
                      })),
                    )}
                  >
                    <BarChart data={facilityData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis dataKey="facility" tickLine={false} axisLine={false} interval={0} angle={-20} textAnchor="end" height={60} fontSize={11} />
                      <YAxis tickLine={false} axisLine={false} width={60} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="revenue" radius={[4, 4, 0, 0]}>
                        {facilityData.map((row) => (
                          <Cell key={row.facilityKey} fill={row.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Bookings by event type</CardTitle>
                  <CardDescription>Distribution of event types in filtered range</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[260px] w-full"
                    config={{ count: { label: "Bookings", color: "hsl(var(--primary))" } }}
                  >
                    <BarChart data={typeData} layout="vertical">
                      <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                      <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                      <YAxis type="category" dataKey="type" tickLine={false} axisLine={false} width={130} fontSize={11} />
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                        {typeData.map((row, idx) => (
                          <Cell key={row.type} fill={row.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Events by status</CardTitle>
                  <CardDescription>Distribution of event statuses in filtered range</CardDescription>
                </CardHeader>
                <CardContent>
                  <ChartContainer
                    className="h-[240px] w-full"
                    config={{
                      tentative: { label: "Tentative", color: "hsl(38 92% 50%)" },
                      confirmed: { label: "Confirmed", color: "hsl(142 76% 36%)" },
                      cleared: { label: "Cleared", color: "hsl(217 91% 60%)" },
                      canceled: { label: "Canceled", color: "hsl(var(--muted-foreground))" },
                    }}
                  >
                    <PieChart>
                      <Pie
                        data={statusData}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={90}
                        label={({ status, count }) => `${status}: ${count}`}
                        labelLine={false}
                      >
                        {statusData.map((s) => (
                          <Cell key={s.statusKey} fill={`var(--color-${s.statusKey})`} />
                        ))}
                      </Pie>
                      <ChartTooltip content={<ChartTooltipContent />} />
                      <ChartLegend content={<ChartLegendContent />} />
                    </PieChart>
                  </ChartContainer>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Calls by facility</CardTitle>
                  <CardDescription>Call distribution by facility</CardDescription>
                </CardHeader>
                <CardContent>
                  {callLogsFacilityData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  ) : (
                    <ChartContainer
                      className="h-[240px] w-full"
                      config={{ count: { label: "Calls", color: "hsl(var(--primary))" } }}
                    >
                      <BarChart data={callLogsFacilityData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="facility" tickLine={false} axisLine={false} width={130} fontSize={11} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {callLogsFacilityData.map((row) => (
                            <Cell key={row.facilityKey} fill={row.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Calls by inquiry type</CardTitle>
                  <CardDescription>Call distribution by inquiry type</CardDescription>
                </CardHeader>
                <CardContent>
                  {callLogsInquiryData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  ) : (
                    <ChartContainer
                      className="h-[240px] w-full"
                      config={{ count: { label: "Calls", color: "hsl(var(--chart-2, 142 76% 36%))" } }}
                    >
                      <BarChart data={callLogsInquiryData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="inquiry" tickLine={false} axisLine={false} width={150} fontSize={11} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" fill="hsl(142 76% 36%)" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Avg feedback by facility</CardTitle>
                  <CardDescription>Based on {feedback.length} responses</CardDescription>
                </CardHeader>
                <CardContent>
                  {feedbackFacilityData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  ) : (
                    <ChartContainer
                      className="h-[240px] w-full"
                      config={{ avg: { label: "Avg Score", color: "hsl(var(--primary))" } }}
                    >
                      <BarChart data={feedbackFacilityData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis
                          dataKey="facility"
                          tickLine={false}
                          axisLine={false}
                          fontSize={11}
                          angle={-15}
                          textAnchor="end"
                          height={55}
                        />
                        <YAxis tickLine={false} axisLine={false} domain={[0, 10]} width={30} fontSize={11} />
                        <ReferenceLine y={7} stroke="#1D9E75" strokeDasharray="4 4" label={{ value: "Good (7)", position: "right", fontSize: 10 }} />
                        <ChartTooltip
                          content={
                            <ChartTooltipContent
                              formatter={(value, name, props) =>
                                [`${value}/10 (${props.payload.count} responses)`, "Avg Score"]
                              }
                            />
                          }
                        />
                        <Bar dataKey="avg" radius={[4, 4, 0, 0]}>
                          {feedbackFacilityData.map((row) => (
                            <Cell key={row.facility} fill={row.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Lead sources / How they found us</CardTitle>
                </CardHeader>
                <CardContent>
                  {callSourceData.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No data yet.</p>
                  ) : (
                    <ChartContainer
                      className="h-[240px] w-full"
                      config={{ count: { label: "Count", color: "hsl(var(--chart-2, 142 76% 36%))" } }}
                    >
                      <BarChart data={callSourceData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                        <XAxis type="number" tickLine={false} axisLine={false} allowDecimals={false} />
                        <YAxis type="category" dataKey="src" tickLine={false} axisLine={false} width={130} fontSize={11} />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                          {callSourceData.map((row, idx) => (
                            <Cell key={row.src} fill={row.fill} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ChartContainer>
                  )}
                </CardContent>
              </Card>
            </div>
        </TabsContent>

        {/* ── EVENTS TAB ── */}
        <TabsContent value="events" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Event details</CardTitle>
              <CardDescription>Filtered event records ({rows.length} rows)</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead className="text-xs">Date</TableHead>
                      <TableHead className="text-xs">Client</TableHead>
                      <TableHead className="text-xs">Type</TableHead>
                      <TableHead className="text-xs">Facility</TableHead>
                      <TableHead className="text-xs">Pax</TableHead>
                      <TableHead className="text-xs">Gross</TableHead>
                      <TableHead className="text-xs">Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                          No events match your filters.
                        </TableCell>
                      </TableRow>
                    ) : rows.map((r) => (
                      <TableRow key={r.event_id}>
                        <TableCell className="text-xs">{r.event_date}</TableCell>
                        <TableCell className="text-xs font-medium">{r.client_name}</TableCell>
                        <TableCell className="text-xs">{eventTypeLabel(r.event_type as never)}</TableCell>
                        <TableCell className="text-xs">{facilityLabel(r.facility as FacilityEnum)}</TableCell>
                        <TableCell className="text-xs">{r.pax}</TableCell>
                        <TableCell className="text-xs">{formatCurrency(r.gross_value)}</TableCell>
                        <TableCell className="text-xs">
                          <Badge variant={r.event_status === "confirmed" ? "default" : "secondary"}>
                            {r.event_status}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FINANCIALS TAB ── */}
        <TabsContent value="financials" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Financial summary</CardTitle>
              <CardDescription>Revenue, deposits, and spend for filtered range</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Gross value</p>
                  <p className="text-2xl font-semibold">{formatCurrency(kpis.grossRevenue)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Total deposited</p>
                  <p className="text-2xl font-semibold">{formatCurrency(kpis.totalDeposited)}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground">Cleared spend</p>
                  <p className="text-2xl font-semibold">{formatCurrency(kpis.totalSpend)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── FEEDBACK TAB ── */}
        <TabsContent value="feedback" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Feedback summary</CardTitle>
              <CardDescription>Based on {feedback.length} responses</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border p-4">
                <p className="text-xs text-muted-foreground">Average score</p>
                <p className="text-2xl font-semibold">{kpis.avgFeedback ?? "—"}</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── MEMBERS TAB ── */}
        <TabsContent value="members" className="mt-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">Kids Club Members</CardTitle>
                  <CardDescription>Membership records ({members.length} total)</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => exportCSV("members", membersColumns, members)}
                  disabled={members.length === 0}
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Export
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="max-h-[600px] overflow-auto rounded-md border">
                <Table>
                  <TableHeader className="bg-muted/50 sticky top-0">
                    <TableRow>
                      <TableHead className="text-xs">Kid Name</TableHead>
                      <TableHead className="text-xs">Guardian Names</TableHead>
                      <TableHead className="text-xs">Expiry</TableHead>
                      <TableHead className="text-xs">Payment Amount</TableHead>
                      <TableHead className="text-xs">Payment Date</TableHead>
                      <TableHead className="text-xs">Payment Method</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {members.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                          No members found.
                        </TableCell>
                      </TableRow>
                    ) : members.map((m, idx) => (
                      <TableRow key={idx}>
                        <TableCell className="text-xs font-medium">{m.kid_name}</TableCell>
                        <TableCell className="text-xs">{m.guardian_names}</TableCell>
                        <TableCell className="text-xs">{m.membership_expiry}</TableCell>
                        <TableCell className="text-xs">{formatCurrency(m.payment_amount)}</TableCell>
                        <TableCell className="text-xs">{m.payment_date}</TableCell>
                        <TableCell className="text-xs">{m.payment_method}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Quick actions</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((q) => {
            const Icon = q.icon;
            return (
              <Link
                key={q.to}
                to={q.to}
                className="flex items-center gap-2 rounded-md border bg-background px-3 py-2 text-sm hover:bg-accent"
              >
                <Icon className="h-4 w-4 text-primary" />
                {q.label}
              </Link>
            );
          })}
        </CardContent>
      </Card>
    </div>
  );
}
