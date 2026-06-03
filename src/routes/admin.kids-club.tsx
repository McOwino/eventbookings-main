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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Baby, AlertTriangle, RefreshCw, Pencil, X } from "lucide-react";

export const Route = createFileRoute("/admin/kids-club")({
  component: KidsClubPage,
});

type MemberRow = {
  id: string;
  kid_name: string;
  kid_dob: string | null;
  guardian_names: string;
  guardian_phone: string | null;
  guardian_email: string | null;
  payment_amount: number;
  payment_date: string;
  payment_method: string | null;
  transaction_ref: string | null;
  membership_start: string;
  membership_expiry: string;
  membership_type_id?: string | null;
  membership_period_value?: number | null;
  membership_period_unit?: "day" | "week" | "month" | "year" | null;
  notes: string | null;
  created_at: string;
};

type MembershipType = {
  id: string;
  name: string;
  created_at?: string | null;
};

const memberSchema = z.object({
  kid_name: z.string().trim().min(1, "Kid name required").max(100),
  kid_dob: z.string().optional().or(z.literal("")),
  guardian_names: z.string().trim().min(1, "Guardian name required").max(200),
  guardian_phone: z.string().trim().max(40).optional().or(z.literal("")),
  guardian_email: z.string().trim().email("Invalid email").max(200).optional().or(z.literal("")),
  payment_amount: z.coerce.number().min(0),
  payment_date: z.string().min(1, "Payment date required"),
  payment_method: z.string().trim().max(50).optional().or(z.literal("")),
  transaction_ref: z.string().trim().max(100).optional().or(z.literal("")),
  membership_start: z.string().min(1, "Start date required"),
  membership_type_id: z.string().min(1, "Membership type is required"),
  membership_period_value: z.coerce.number().int().min(1).optional(),
  membership_period_unit: z.enum(["day", "week", "month", "year"]).optional(),
  notes: z.string().max(1000).optional().or(z.literal("")),
});

type MemberInput = z.infer<typeof memberSchema>;

const PAYMENT_METHODS = ["Cash", "M-Pesa", "Card", "Bank Transfer", "Other"];

type StatusKey = "active" | "expiring" | "expired";

function getStatus(expiry: string): StatusKey {
  const now = new Date();
  const exp = new Date(expiry);
  const days = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 0) return "expired";
  if (days <= 30) return "expiring";
  return "active";
}

function MembershipTypesCard({
  types, onCreated, onDeleted,
}: {
  types: MembershipType[];
  onCreated: () => void;
  onDeleted: () => void;
}) {
  const [name, setName] = useState("");
  // membership type form simplified to only require the event type (name)
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [saving, setSaving] = useState(false);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error("Event type is required");
      return;
    }
    setSaving(true);
    const { error } = await (supabase as any)
      .from("membership_types")
      .insert({ name: name.trim() });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Membership type created");
    setName(""); setStartDate(""); setEndDate("");
    onCreated();
  };

  const handleDelete = async (id: string, typeName: string) => {
    if (!confirm(`Delete membership type "${typeName}"?`)) return;
    const { error } = await (supabase as any)
      .from("membership_types")
      .delete()
      .eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Deleted");
    onDeleted();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Membership Types</CardTitle>
        <CardDescription>
          Define the types of memberships available. Members are assigned one of these.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Label>Event type *</Label>
            <Input placeholder="e.g. Annual Pass" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
        </div>
        <Button size="sm" onClick={handleCreate} disabled={saving}>
          {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
          Add Type
        </Button>

        {types.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {types.map((t) => (
                <TableRow key={t.id}>
                  <TableCell className="font-medium">{t.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button size="sm" variant="ghost" onClick={() => handleDelete(t.id, t.name)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

function statusBadge(s: StatusKey) {
  if (s === "active") return <Badge variant="default">Active</Badge>;
  if (s === "expiring") return <Badge variant="secondary">Expiring Soon</Badge>;
  return <Badge variant="destructive">Expired</Badge>;
}

function addPeriod(dateStr: string, value: number, unit: "day" | "week" | "month" | "year") {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  const v = Number(value) || 1;
  switch (unit) {
    case "day":
      d.setDate(d.getDate() + v);
      break;
    case "week":
      d.setDate(d.getDate() + v * 7);
      break;
    case "month":
      d.setMonth(d.getMonth() + v);
      break;
    case "year":
    default:
      d.setFullYear(d.getFullYear() + v);
      break;
  }
  return d.toISOString().slice(0, 10);
}

function KidsClubPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You do not have access to this page.
        </CardContent>
      </Card>
    );
  }
  const [editing, setEditing] = useState<MemberRow | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | StatusKey>("all");
  const [showExpiringAlert, setShowExpiringAlert] = useState(() => {
    const saved = localStorage.getItem("kids-club-dismissed-expiring");
    return saved !== "true";
  });
  const [show75PercentAlert, setShow75PercentAlert] = useState(() => {
    const saved = localStorage.getItem("kids-club-dismissed-75percent");
    return saved !== "true";
  });

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["kids-club-members"],
    queryFn: async () => {
            const { data, error } = await (supabase as any)
              .from("memberships")
        .select("*")
        .order("membership_expiry", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MemberRow[];
    },
  });

  const { data: membershipTypes = [] } = useQuery({
    queryKey: ["membership-types"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("membership_types")
        .select("*")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as MembershipType[];
    },
  });

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const s = getStatus(m.membership_expiry);
      if (statusFilter !== "all" && s !== statusFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        if (
          !m.kid_name.toLowerCase().includes(q) &&
          !m.guardian_names.toLowerCase().includes(q) &&
          !(m.guardian_phone || "").toLowerCase().includes(q)
        )
          return false;
      }
      return true;
    });
  }, [members, search, statusFilter]);

  const expiringSoon = useMemo(
    () => members.filter((m) => getStatus(m.membership_expiry) === "expiring"),
    [members],
  );
  const expired = useMemo(
    () => members.filter((m) => getStatus(m.membership_expiry) === "expired"),
    [members],
  );
  const approaching75 = useMemo(() => {
    const now = Date.now();
    return members.filter((m) => {
      try {
        const start = new Date(m.membership_start).getTime();
        const end = new Date(m.membership_expiry).getTime();
        if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return false;
        const threshold = start + Math.floor((end - start) * 0.75);
        return now >= threshold && now < end;
      } catch {
        return false;
      }
    });
  }, [members]);
  const active = members.length - expired.length;

  const upsert = useMutation({
    mutationFn: async (input: MemberInput & { id?: string }) => {
      const payload = {
        kid_name: input.kid_name,
        kid_dob: input.kid_dob || null,
        guardian_names: input.guardian_names,
        guardian_phone: input.guardian_phone || null,
        guardian_email: input.guardian_email || null,
        payment_amount: input.payment_amount,
        payment_date: input.payment_date,
        payment_method: input.payment_method || null,
        transaction_ref: input.transaction_ref || null,
        membership_start: input.membership_start,
        // expiry derived from selected membership type if provided; otherwise use membership period
        membership_expiry: (() => {
          const chosen = membershipTypes.find((t) => t.id === (input as any).membership_type_id);
          if (chosen && (chosen as any).end_date) return (chosen as any).end_date;
          const val = (input as any).membership_period_value ?? 1;
          const unit = (input as any).membership_period_unit ?? "year";
           return addPeriod(input.membership_start, val, unit as any);
        })(),
        membership_type_id: (input as any).membership_type_id || null,
        membership_period_value: (input as any).membership_period_value ?? null,
        membership_period_unit: (input as any).membership_period_unit ?? null,
        notes: input.notes || null,
      };
      if (input.id) {
        const { error } = await (supabase as any)
          .from("memberships")
          .update(payload)
          .eq("id", input.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("memberships")
          .insert({ ...payload, created_by: user?.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-club-members"] });
      toast.success(editing ? "Member updated" : "Member added");
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const renew = useMutation({
    mutationFn: async (m: MemberRow) => {
      const today = new Date().toISOString().slice(0, 10);
      const val = m.membership_period_value ?? 1;
      const unit = (m.membership_period_unit as any) ?? "year";
      const expiry = addPeriod(today, val, unit);
      const { error } = await (supabase as any)
        .from("memberships")
        .update({
          membership_start: today,
          membership_expiry: expiry,
        })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-club-members"] });
      toast.success("Membership renewed for 1 year");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("memberships")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["kids-club-members"] });
      toast.success("Member removed");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Baby className="h-6 w-6" /> Membership
          </h1>
          <p className="text-sm text-muted-foreground">
            Manage memberships. Each membership is valid for 1 year.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setOpen(true); }}>
          <Plus className="mr-2 h-4 w-4" /> Add Member
        </Button>
      </div>

      {expiringSoon.length > 0 && showExpiringAlert && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{expiringSoon.length} membership(s) expiring within 30 days</AlertTitle>
          <AlertDescription>
            {expiringSoon.slice(0, 5).map((m) => m.kid_name).join(", ")}
            {expiringSoon.length > 5 ? "…" : ""}
          </AlertDescription>
          <button
            onClick={() => {
              setShowExpiringAlert(false);
              localStorage.setItem("kids-club-dismissed-expiring", "true");
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-4">
        <Card>
          <CardHeader className="pb-2"><CardDescription>Active</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{active}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Expiring Soon</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{expiringSoon.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Expired</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{expired.length}</p></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardDescription>Near 75% Used</CardDescription></CardHeader>
          <CardContent><p className="text-2xl font-bold">{approaching75.length}</p></CardContent>
        </Card>
      </div>

      {approaching75.length > 0 && show75PercentAlert && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>{approaching75.length} membership(s) past 75% of their validity</AlertTitle>
          <AlertDescription>
            {approaching75.slice(0, 8).map((m) => m.kid_name).join(", ")}
            {approaching75.length > 8 ? "…" : ""}
          </AlertDescription>
          <button
            onClick={() => {
              setShow75PercentAlert(false);
              localStorage.setItem("kids-club-dismissed-75percent", "true");
            }}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
        </Alert>
      )}

      <MembershipTypesCard
        types={membershipTypes}
        onCreated={() => qc.invalidateQueries({ queryKey: ["membership-types"] })}
        onDeleted={() => qc.invalidateQueries({ queryKey: ["membership-types"] })}
      />

      <Card>
        <CardHeader>
          <CardTitle>Members</CardTitle>
          <div className="flex flex-wrap gap-2 pt-2">
            <Input
              className="max-w-xs"
              placeholder="Search name or phone…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
              <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="expiring">Expiring Soon</SelectItem>
                <SelectItem value="expired">Expired</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">No members found.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Kid</TableHead>
                  <TableHead>Guardian</TableHead>
                  <TableHead>Contact</TableHead>
                  <TableHead>Paid</TableHead>
                  <TableHead>Expires</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((m) => {
                  const s = getStatus(m.membership_expiry);
                  return (
                    <TableRow key={m.id}>
                      <TableCell className="font-medium">{m.kid_name}</TableCell>
                      <TableCell>{m.guardian_names}</TableCell>
                      <TableCell className="text-xs">
                        {m.guardian_phone}
                        {m.guardian_phone && m.guardian_email ? <br /> : null}
                        {m.guardian_email}
                      </TableCell>
                      <TableCell>KES {Number(m.payment_amount).toLocaleString()}</TableCell>
                      <TableCell>{m.membership_expiry}</TableCell>
                      <TableCell>{statusBadge(s)}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="ghost" onClick={() => { setEditing(m); setOpen(true); }}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => renew.mutate(m)}>
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => {
                              if (confirm(`Remove ${m.kid_name}?`)) remove.mutate(m.id);
                            }}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <MemberDialog
        open={open}
        editing={editing}
        membershipTypes={membershipTypes}
        onClose={() => { setOpen(false); setEditing(null); }}
        onSubmit={(v) => upsert.mutate(editing ? { ...v, id: editing.id } : v)}
        submitting={upsert.isPending}
      />
    </div>
  );
}

function MemberDialog({
  open, editing, onClose, onSubmit, submitting, membershipTypes,
}: {
  open: boolean;
  editing: MemberRow | null;
  onClose: () => void;
  onSubmit: (v: MemberInput) => void;
  submitting: boolean;
  membershipTypes: MembershipType[];
}) {
  const today = new Date().toISOString().slice(0, 10);
  const [form, setForm] = useState<MemberInput>(() => ({
    kid_name: editing?.kid_name ?? "",
    kid_dob: editing?.kid_dob ?? "",
    guardian_names: editing?.guardian_names ?? "",
    guardian_phone: editing?.guardian_phone ?? "",
    guardian_email: editing?.guardian_email ?? "",
    payment_amount: editing?.payment_amount ?? 0,
    payment_date: editing?.payment_date ?? today,
    payment_method: editing?.payment_method ?? "",
    transaction_ref: editing?.transaction_ref ?? "",
    membership_start: editing?.membership_start ?? today,
    membership_type_id: (editing as any)?.membership_type_id ?? "",
    membership_period_value: editing?.membership_period_value ?? 1,
    membership_period_unit: (editing?.membership_period_unit as any) ?? "year",
    notes: editing?.notes ?? "",
  }));

  // Reset form when dialog opens for a different record
  useMemo(() => {
      if (open) {
      setForm({
        kid_name: editing?.kid_name ?? "",
        kid_dob: editing?.kid_dob ?? "",
        guardian_names: editing?.guardian_names ?? "",
        guardian_phone: editing?.guardian_phone ?? "",
        guardian_email: editing?.guardian_email ?? "",
        payment_amount: editing?.payment_amount ?? 0,
        payment_date: editing?.payment_date ?? today,
        payment_method: editing?.payment_method ?? "",
        transaction_ref: editing?.transaction_ref ?? "",
        membership_start: editing?.membership_start ?? today,
        membership_type_id: (editing as any)?.membership_type_id ?? "",
        membership_period_value: editing?.membership_period_value ?? 1,
        membership_period_unit: (editing?.membership_period_unit as any) ?? "year",
        notes: editing?.notes ?? "",
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, editing?.id]);

  const set = <K extends keyof MemberInput>(k: K, v: MemberInput[K]) =>
    setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = memberSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Invalid input");
      return;
    }
    onSubmit(parsed.data);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit Member" : "Add Member"}</DialogTitle>
          <DialogDescription>
            Membership expiry is calculated from the chosen start date and validity period.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Kid's full name *</Label>
              <Input value={form.kid_name} onChange={(e) => set("kid_name", e.target.value)} />
            </div>
            <div>
              <Label>Date of birth</Label>
              <Input type="date" value={form.kid_dob} onChange={(e) => set("kid_dob", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Parent / guardian name(s) *</Label>
              <Input value={form.guardian_names} onChange={(e) => set("guardian_names", e.target.value)} />
            </div>
            <div>
              <Label>Phone</Label>
              <Input value={form.guardian_phone} onChange={(e) => set("guardian_phone", e.target.value)} />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" value={form.guardian_email} onChange={(e) => set("guardian_email", e.target.value)} />
            </div>
            <div>
              <Label>Payment amount *</Label>
              <Input
                type="number" min="0" step="0.01"
                value={form.payment_amount}
                onChange={(e) => set("payment_amount", Number(e.target.value))}
              />
            </div>
            <div>
              <Label>Payment date *</Label>
              <Input type="date" value={form.payment_date} onChange={(e) => set("payment_date", e.target.value)} />
            </div>
            <div>
              <Label>Payment method</Label>
              <Select value={form.payment_method || ""} onValueChange={(v) => set("payment_method", v)}>
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Transaction ID / receipt</Label>
              <Input value={form.transaction_ref} onChange={(e) => set("transaction_ref", e.target.value)} />
            </div>
            <div className="sm:col-span-2">
              <Label>Membership type *</Label>
              <Select
                value={(form as any).membership_type_id || ""}
                onValueChange={(v) => {
                  set("membership_type_id" as any, v as any);
                  const chosen = membershipTypes.find((t) => t.id === v);
                  if (chosen) set("membership_start" as any, chosen.start_date as any);
                }}
              >
                <SelectTrigger><SelectValue placeholder="Select a membership type" /></SelectTrigger>
                <SelectContent>
                  {membershipTypes.map((t) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Membership start date *</Label>
              <Input
                type="date" value={form.membership_start}
                onChange={(e) => set("membership_start", e.target.value)}
              />

              <div className="grid sm:grid-cols-3 gap-2 mt-3">
                <div>
                  <Label>Validity</Label>
                  <Input
                    type="number" min={1}
                    value={(form as any).membership_period_value ?? 1}
                    onChange={(e) => set("membership_period_value" as any, Number(e.target.value) as any)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <Label>&nbsp;</Label>
                  <Select value={(form as any).membership_period_unit ?? "year"} onValueChange={(v) => set("membership_period_unit" as any, v as any)}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="day">day(s)</SelectItem>
                      <SelectItem value="week">week(s)</SelectItem>
                      <SelectItem value="month">month(s)</SelectItem>
                      <SelectItem value="year">year(s)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">
                Expires on {
                  (() => {
                    const chosen = membershipTypes.find((t) => t.id === (form as any).membership_type_id);
                    if (chosen && (chosen as any).end_date) return (chosen as any).end_date;
                    return form.membership_start ? addPeriod(form.membership_start, (form as any).membership_period_value ?? 1, (form as any).membership_period_unit ?? "year") : "—";
                  })()
                }
              </p>
            </div>
            <div className="sm:col-span-2">
              <Label>Notes</Label>
              <Textarea rows={2} value={form.notes} onChange={(e) => set("notes", e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
