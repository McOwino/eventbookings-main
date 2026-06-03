import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2, Plus, Trash2, Pencil } from "lucide-react";
import { FACILITY_OPTIONS, type FacilityEnum } from "@/lib/facility-utils";
import {
  adminTournamentsQueryOptions,
  DAYS_OF_WEEK,
  formatDays,
  formatFacility,
  type TournamentRow,
} from "@/lib/tournaments";

function fmtTime(time?: string | null) {
  if (!time) return "";
  const parts = time.split(":");
  const hh = Number(parts[0] ?? 0);
  const mm = Number(parts[1] ?? 0);
  const am = hh < 12;
  const h12 = hh % 12 || 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${am ? "AM" : "PM"}`;
}

export const Route = createFileRoute("/admin/tournaments")({
  component: TournamentsAdminPage,
});

const schema = z.object({
  name: z.string().trim().min(1).max(150),
  facility: z.string().min(1),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  days_of_week: z.array(z.number().int().min(0).max(6)),
  start_date: z.string().min(1),
  end_date: z.string().min(1),
  start_time: z.string().optional().or(z.literal("")),
  end_time: z.string().optional().or(z.literal("")),
  is_active: z.boolean(),
});

type FormData = z.infer<typeof schema>;

const emptyForm: FormData = {
  name: "",
  facility: "village_bowl",
  description: "",
  days_of_week: [],
  start_date: new Date().toISOString().slice(0, 10),
  end_date: new Date().toISOString().slice(0, 10),
  start_time: "",
  end_time: "",
  is_active: true,
};

function TournamentsAdminPage() {
  const { user, roles } = useAuth();
  const qc = useQueryClient();
  const { data, isLoading } = useQuery(adminTournamentsQueryOptions());

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
  const [editing, setEditing] = useState<TournamentRow | null>(null);
  const [form, setForm] = useState<FormData>(emptyForm);

  const reset = () => {
    setEditing(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    reset();
    setOpen(true);
  };

  const openEdit = (t: TournamentRow) => {
    setEditing(t);
    setForm({
      name: t.name,
      facility: t.facility,
      description: t.description ?? "",
      days_of_week: t.days_of_week ?? [],
      start_date: t.start_date,
      end_date: t.end_date,
      start_time: t.start_time ?? "",
      end_time: t.end_time ?? "",
      is_active: t.is_active,
    });
    setOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const parsed = schema.parse(form);
      if (parsed.end_date < parsed.start_date) {
        throw new Error("End date must be after start date");
      }
      const payload = {
        name: parsed.name,
        facility: parsed.facility as FacilityEnum,
        description: parsed.description || null,
        days_of_week: parsed.days_of_week,
        start_date: parsed.start_date,
        end_date: parsed.end_date,
        start_time: parsed.start_time || null,
        end_time: parsed.end_time || null,
        is_active: parsed.is_active,
      };
      if (editing) {
        const { error } = await supabase
          .from("tournaments" as never)
          .update(payload as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("tournaments" as never)
          .insert({ ...payload, created_by: user?.id ?? null } as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Tournament updated" : "Tournament created");
      qc.invalidateQueries({ queryKey: ["admin", "tournaments"] });
      qc.invalidateQueries({ queryKey: ["public", "tournaments"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("tournaments" as never).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "tournaments"] });
      qc.invalidateQueries({ queryKey: ["public", "tournaments"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleDay = (d: number) => {
    setForm((f) => ({
      ...f,
      days_of_week: f.days_of_week.includes(d)
        ? f.days_of_week.filter((x) => x !== d)
        : [...f.days_of_week, d],
    }));
  };

  const tournaments = data ?? [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Timed Events</h1>
          <p className="text-sm text-muted-foreground">
            Manage recurring leagues and one-off tournaments shown on the public site.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All tournaments</CardTitle>
          <CardDescription>
            Leave days of the week empty for a continuous active run with countdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : tournaments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No tournaments yet.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Days</TableHead>
                  <TableHead>Start</TableHead>
                  <TableHead>Start time</TableHead>
                  <TableHead>End</TableHead>
                  <TableHead>End time</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tournaments.map((t) => (
                  <TableRow key={t.id}>
                    <TableCell className="font-medium">{t.name}</TableCell>
                    <TableCell>{formatFacility(t.facility)}</TableCell>
                    <TableCell>{formatDays(t.days_of_week)}</TableCell>
                    <TableCell>{t.start_date}</TableCell>
                    <TableCell>{fmtTime(t.start_time)}</TableCell>
                    <TableCell>{t.end_date}</TableCell>
                    <TableCell>{fmtTime(t.end_time)}</TableCell>
                    <TableCell>
                      <Badge variant={t.is_active ? "default" : "secondary"}>
                        {t.is_active ? "Active" : "Hidden"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(t)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          if (confirm(`Delete "${t.name}"?`)) deleteMutation.mutate(t.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit tournament" : "New tournament"}</DialogTitle>
            <DialogDescription>
              Pick days of the week for recurring leagues, or leave empty for a continuous event.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-1.5">
              <Label>Name</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Friday Night Bowling League"
              />
            </div>
            <div className="grid gap-1.5">
              <Label>Facility</Label>
              <Select
                value={form.facility}
                onValueChange={(v) => setForm({ ...form, facility: v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FACILITY_OPTIONS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-1.5">
              <Label>Days of the week (optional)</Label>
              <div className="flex flex-wrap gap-3">
                {DAYS_OF_WEEK.map((d) => (
                  <label key={d.value} className="flex items-center gap-1.5 text-sm">
                    <Checkbox
                      checked={form.days_of_week.includes(d.value)}
                      onCheckedChange={() => toggleDay(d.value)}
                    />
                    {d.short}
                  </label>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Leave empty to show as "Active" with a countdown to the end date.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-1.5">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
                <Label className="mt-1">Start time (optional)</Label>
                <Input
                  type="time"
                  value={form.start_time ?? ""}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>
              <div className="grid gap-1.5">
                <Label>End date</Label>
                <Input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
                <Label className="mt-1">End time (optional)</Label>
                <Input
                  type="time"
                  value={form.end_time ?? ""}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>
            </div>
            <div className="grid gap-1.5">
              <Label>Description (optional)</Label>
              <Textarea
                rows={3}
                value={form.description ?? ""}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </div>
            <div className="flex items-center justify-between rounded-md border p-3">
              <div>
                <Label className="text-sm">Visible on public site</Label>
                <p className="text-xs text-muted-foreground">Toggle off to hide.</p>
              </div>
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editing ? "Save changes" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
