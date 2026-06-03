import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Phone, CheckCircle2, UserPlus, XCircle } from "lucide-react";
import { FACILITY_OPTIONS, facilityLabel, type FacilityEnum } from "@/lib/facility-utils";
import { useNavigate } from "@tanstack/react-router";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const LEAD_EVENT_TYPES = [
  { value: "birthday", label: "Birthday Party" },
  { value: "school_trip", label: "School Trip" },
  { value: "hangout", label: "Hangout" },
  { value: "league_tournament", label: "League / Tournament" },
] as const;

const LEAD_FACILITIES = [
  "General", "Village Bowl", "Under the Sea", "Ozone Trampoline Park",
  "Mini-Golf", "REV", "Glitch", "Ballpoint",
] as const;

type CallStatus = "open" | "closed_assisted" | "lead" | "failed_to_assist";

const STATUS_LABEL: Record<CallStatus, string> = {
  open: "Open",
  closed_assisted: "Closed (Assisted)",
  lead: "Converted to Lead",
  failed_to_assist: "Failed to Assist",
};

const STATUS_VARIANT: Record<CallStatus, "default" | "secondary" | "outline" | "destructive"> = {
  open: "outline",
  closed_assisted: "default",
  lead: "secondary",
  failed_to_assist: "destructive",
};

export const Route = createFileRoute("/admin/call-logs")({
  component: CallLogsPage,
});

const FACILITY_CHOICES: { value: string; label: string }[] = [
  ...FACILITY_OPTIONS,
  { value: "general", label: "General Facility" },
];

const INQUIRY_TYPES = [
  "Rates",
  "Timings",
  "Lost and Found",
  "Reservation",
  "Birthday Inquiry",
  "School Trip Inquiry",
  "Hangout Inquiry",
  "Requirements Inquiry",
  "Promotion Requirement",
  "General Inquiry",
] as const;

type CallLogRow = {
  id: string;
  call_time: string;
  caller_name: string;
  client_phone: string | null;
  facility: string[];
  inquiry_type: string[];
  respondent_name: string;
  duration_seconds: number;
  notes: string | null;
  created_at: string;
  status: CallStatus;
  closed_at: string | null;
  converted_lead_id: string | null;
};

const schema = z.object({
  call_time: z.string().min(1, "Required"),
  caller_name: z.string().trim().min(1, "Required").max(150),
  client_phone: z.string().trim().max(50).optional().or(z.literal("")),
  facility: z.array(z.string()).min(1, "Pick at least one facility"),
  inquiry_type: z.array(z.string()).min(1, "Pick at least one inquiry type"),
  respondent_name: z.string().trim().min(1, "Required").max(150),
  duration_minutes: z.number().min(0).max(1440),
  duration_seconds_part: z.number().min(0).max(59),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
});

type FormData = z.infer<typeof schema>;

const nowLocal = () => {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 16);
};

const emptyForm = (): FormData => ({
  call_time: nowLocal(),
  caller_name: "",
  client_phone: "",
  facility: [],
  inquiry_type: [],
  respondent_name: "",
  duration_minutes: 0,
  duration_seconds_part: 0,
  notes: "",
});

const formatDuration = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}m ${sec}s`;
};

function CallLogsPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const navigate = useNavigate();

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
  const [form, setForm] = useState<FormData>(emptyForm());
  const [filterFacility, setFilterFacility] = useState<string>("all");
  const [filterInquiry, setFilterInquiry] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [leadDialog, setLeadDialog] = useState<{ log: CallLogRow } | null>(null);
  const [leadForm, setLeadForm] = useState({
    name: "", phone: "", email: "", event_type: "birthday",
    facility: "General", preferred_date: "", notes: "",
  });

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "call_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("call_logs" as never)
        .select("*")
        .order("call_time", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CallLogRow[];
    },
  });

  const logs = data ?? [];

  const filtered = useMemo(() => {
    return logs.filter((l) => {
      if (filterFacility !== "all" && !l.facility.includes(filterFacility)) return false;
      if (filterInquiry !== "all" && !l.inquiry_type.includes(filterInquiry)) return false;
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      return true;
    });
  }, [logs, filterFacility, filterInquiry, filterStatus]);

  const stats = useMemo(() => {
    const byFacility = new Map<string, number>();
    const byInquiry = new Map<string, number>();
    let totalDuration = 0;
    for (const l of logs) {
      totalDuration += l.duration_seconds;
      l.facility.forEach((f) => byFacility.set(f, (byFacility.get(f) ?? 0) + 1));
      l.inquiry_type.forEach((i) => byInquiry.set(i, (byInquiry.get(i) ?? 0) + 1));
    }
    return {
      total: logs.length,
      avgDuration: logs.length ? Math.round(totalDuration / logs.length) : 0,
      byFacility: [...byFacility.entries()].sort((a, b) => b[1] - a[1]),
      byInquiry: [...byInquiry.entries()].sort((a, b) => b[1] - a[1]),
    };
  }, [logs]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      const duration_seconds = parsed.duration_minutes * 60 + parsed.duration_seconds_part;
      const payload = {
        call_time: new Date(parsed.call_time).toISOString(),
        caller_name: parsed.caller_name,
        client_phone: parsed.client_phone || null,
        facility: parsed.facility,
        inquiry_type: parsed.inquiry_type,
        respondent_name: parsed.respondent_name,
        duration_seconds,
        notes: parsed.notes || null,
        created_by: user?.id ?? null,
      };
      const { error } = await supabase.from("call_logs" as never).insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Call logged");
      qc.invalidateQueries({ queryKey: ["admin", "call_logs"] });
      setOpen(false);
      setForm(emptyForm());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // delete capability removed per request

  const closeMutation = useMutation({
    mutationFn: async ({ id, status, leadId }: { id: string; status: CallStatus; leadId?: string }) => {
      const { error } = await supabase
        .from("call_logs" as never)
        .update({
          status,
          closed_at: new Date().toISOString(),
          closed_by: user?.id ?? null,
          ...(leadId ? { converted_lead_id: leadId } : {}),
        } as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Marked ${STATUS_LABEL[vars.status]}`);
      qc.invalidateQueries({ queryKey: ["admin", "call_logs"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const convertToLead = useMutation({
    mutationFn: async () => {
      if (!leadDialog) throw new Error("No call selected");
      const payload = {
        name: leadForm.name.trim(),
        phone: leadForm.phone.trim(),
        email: leadForm.email.trim() || "n/a@callcenter.local",
        event_type: leadForm.event_type,
        facility: leadForm.facility,
        preferred_date: leadForm.preferred_date || null,
        notes: leadForm.notes.trim() || null,
        filled_by: leadDialog.log.respondent_name,
        status: "new",
      };
      const { data, error } = await supabase
        .from("leads" as never)
        .insert(payload as never)
        .select("id")
        .single();
      if (error) throw error;
      const newId = (data as { id: string }).id;
      await closeMutation.mutateAsync({ id: leadDialog.log.id, status: "lead", leadId: newId });
      return newId;
    },
    onSuccess: () => {
      toast.success("Lead created");
      qc.invalidateQueries({ queryKey: ["admin", "leads"] });
      setLeadDialog(null);
      navigate({ to: "/admin/leads" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openLeadDialog = (log: CallLogRow) => {
    const facMatch = log.facility.find((f) => f !== "general");
    const facLbl = facMatch ? facilityLabel(facMatch as FacilityEnum) : "General";
    const allowed = (LEAD_FACILITIES as readonly string[]).includes(facLbl) ? facLbl : "General";
    setLeadForm({
      name: log.caller_name,
      phone: log.client_phone ?? "",
      email: "",
      event_type: log.inquiry_type.some((i) => i.toLowerCase().includes("birthday"))
        ? "birthday"
        : log.inquiry_type.some((i) => i.toLowerCase().includes("school"))
        ? "school_trip"
        : log.inquiry_type.some((i) => i.toLowerCase().includes("hangout"))
        ? "hangout"
        : "birthday",
      facility: allowed,
      preferred_date: "",
      notes: log.notes ?? "",
    });
    setLeadDialog({ log });
  };

  const toggleArr = (key: "facility" | "inquiry_type", v: string) => {
    setForm((f) => ({
      ...f,
      [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v],
    }));
  };

  const facLabel = (v: string) =>
    v === "general" ? "General" : facilityLabel(v as FacilityEnum);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Call Center</h1>
          <p className="text-sm text-muted-foreground">
            Log and segment calls received from prospects and customers.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button onClick={() => { setForm(emptyForm()); setOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Log call
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Total calls</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold">{stats.total}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Avg duration</CardDescription></CardHeader>
          <CardContent><p className="text-3xl font-bold">{formatDuration(stats.avgDuration)}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Top inquiry</CardDescription></CardHeader>
          <CardContent>
            <p className="text-xl font-semibold">
              {stats.byInquiry[0]?.[0] ?? "—"}
            </p>
            <p className="text-sm text-muted-foreground">{stats.byInquiry[0]?.[1] ?? 0} calls</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Calls by facility</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.byFacility.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : stats.byFacility.map(([f, n]) => (
              <div key={f} className="flex items-center justify-between text-sm">
                <span>{facLabel(f)}</span>
                <Badge variant="secondary">{n}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Calls by inquiry</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {stats.byInquiry.length === 0 ? (
              <p className="text-sm text-muted-foreground">No data yet.</p>
            ) : stats.byInquiry.map(([i, n]) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span>{i}</span>
                <Badge variant="secondary">{n}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Call log</CardTitle>
          <CardDescription>Filter by facility or inquiry to segment.</CardDescription>
          <div className="flex flex-wrap gap-2 pt-2">
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={filterFacility}
              onChange={(e) => setFilterFacility(e.target.value)}
            >
              <option value="all">All facilities</option>
              {FACILITY_CHOICES.map((f) => (
                <option key={f.value} value={f.value}>{f.label}</option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={filterInquiry}
              onChange={(e) => setFilterInquiry(e.target.value)}
            >
              <option value="all">All inquiries</option>
              {INQUIRY_TYPES.map((i) => (
                <option key={i} value={i}>{i}</option>
              ))}
            </select>
            <select
              className="rounded-md border bg-background px-2 py-1 text-sm"
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
            >
              <option value="all">All statuses</option>
              {(Object.keys(STATUS_LABEL) as CallStatus[]).map((s) => (
                <option key={s} value={s}>{STATUS_LABEL[s]}</option>
              ))}
            </select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <p className="text-sm text-muted-foreground p-6">Loading…</p>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground p-6">
              <Phone className="h-8 w-8 opacity-50" />
              No calls match your filters.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[720px]">
                <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Time</TableHead>
                  <TableHead>Caller</TableHead>
                  <TableHead>Facilities</TableHead>
                  <TableHead>Inquiry</TableHead>
                  <TableHead>Respondent</TableHead>
                  <TableHead>Duration</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="whitespace-nowrap text-xs">
                      {new Date(l.call_time).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{l.caller_name}</div>
                      {l.client_phone && (
                        <div className="text-xs text-muted-foreground">{l.client_phone}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {l.facility.map((f) => (
                          <Badge key={f} variant="outline" className="text-[10px]">
                            {facLabel(f)}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {l.inquiry_type.map((i) => (
                          <Badge key={i} variant="secondary" className="text-[10px]">{i}</Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>{l.respondent_name}</TableCell>
                    <TableCell className="whitespace-nowrap">{formatDuration(l.duration_seconds)}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[l.status ?? "open"]} className="text-[10px]">
                        {STATUS_LABEL[l.status ?? "open"]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        {(l.status ?? "open") === "open" && (
                          <>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => closeMutation.mutate({ id: l.id, status: "closed_assisted" })}
                            >
                              <CheckCircle2 className="mr-1 h-3 w-3" /> Closed
                            </Button>
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => openLeadDialog(l)}
                            >
                              <UserPlus className="mr-1 h-3 w-3" /> Lead
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              className="h-7 px-2 text-[11px]"
                              onClick={() => closeMutation.mutate({ id: l.id, status: "failed_to_assist" })}
                            >
                              <XCircle className="mr-1 h-3 w-3" /> Failed
                            </Button>
                          </>
                        )}
                        {/* delete removed */}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Log a call</DialogTitle>
            <DialogDescription>Record details from this call.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Time of call</Label>
              <Input
                type="datetime-local"
                value={form.call_time}
                onChange={(e) => setForm({ ...form, call_time: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Caller name</Label>
                <Input
                  value={form.caller_name}
                  onChange={(e) => setForm({ ...form, caller_name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Caller phone (optional)</Label>
                <Input
                  value={form.client_phone ?? ""}
                  onChange={(e) => setForm({ ...form, client_phone: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Facilities of interest</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {FACILITY_CHOICES.map((f) => (
                  <label key={f.value} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.facility.includes(f.value)}
                      onCheckedChange={() => toggleArr("facility", f.value)}
                    />
                    {f.label}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Nature of inquiry</Label>
              <div className="grid grid-cols-2 gap-2 rounded-md border p-3">
                {INQUIRY_TYPES.map((i) => (
                  <label key={i} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.inquiry_type.includes(i)}
                      onCheckedChange={() => toggleArr("inquiry_type", i)}
                    />
                    {i}
                  </label>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Respondent name</Label>
                <Input
                  value={form.respondent_name}
                  onChange={(e) => setForm({ ...form, respondent_name: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>Duration</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={0}
                    value={form.duration_minutes}
                    onChange={(e) => setForm({ ...form, duration_minutes: Number(e.target.value) || 0 })}
                  />
                  <span className="text-xs text-muted-foreground">m</span>
                  <Input
                    type="number"
                    min={0}
                    max={59}
                    value={form.duration_seconds_part}
                    onChange={(e) => setForm({ ...form, duration_seconds_part: Number(e.target.value) || 0 })}
                  />
                  <span className="text-xs text-muted-foreground">s</span>
                </div>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Notes (optional)</Label>
              <Textarea
                rows={3}
                value={form.notes ?? ""}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!leadDialog} onOpenChange={(o) => !o && setLeadDialog(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Convert call to lead</DialogTitle>
            <DialogDescription>
              This will create a lead and mark the call as converted.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Name</Label>
                <Input value={leadForm.name} onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })} />
              </div>
              <div className="grid gap-1.5">
                <Label>Phone</Label>
                <Input value={leadForm.phone} onChange={(e) => setLeadForm({ ...leadForm, phone: e.target.value })} />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Email (optional)</Label>
              <Input value={leadForm.email} onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Event type</Label>
                <Select value={leadForm.event_type} onValueChange={(v) => setLeadForm({ ...leadForm, event_type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_EVENT_TYPES.map((e) => (
                      <SelectItem key={e.value} value={e.value}>{e.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-1.5">
                <Label>Facility</Label>
                <Select value={leadForm.facility} onValueChange={(v) => setLeadForm({ ...leadForm, facility: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LEAD_FACILITIES.map((f) => (
                      <SelectItem key={f} value={f}>{f}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Preferred date (optional)</Label>
              <Input
                type="date"
                value={leadForm.preferred_date}
                onChange={(e) => setLeadForm({ ...leadForm, preferred_date: e.target.value })}
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Notes</Label>
              <Textarea
                rows={3}
                value={leadForm.notes}
                onChange={(e) => setLeadForm({ ...leadForm, notes: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setLeadDialog(null)}>Cancel</Button>
            <Button
              onClick={() => convertToLead.mutate()}
              disabled={convertToLead.isPending || !leadForm.name.trim() || !leadForm.phone.trim()}
            >
              {convertToLead.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create lead & close call
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
