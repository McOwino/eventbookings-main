import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { formatCurrency, HAMECO_ADDITIONAL_OPTIONS } from "@/lib/facility-utils";
import { Plus, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";

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

export function AdminClearancePanel({ embedded = false }: { embedded?: boolean }) {
  const { user, hasAnyRole } = useAuth();
  const allowed = hasAnyRole(["super_admin", "clearance_executive"]);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const events = useQuery({
    queryKey: ["admin", "events", "for-clearance"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, client_name, organization, event_date, status")
        .in("status", ["confirmed", "cleared"])
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: allowed,
  });

  const clearances = useQuery({
    queryKey: ["admin", "clearances"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clearances")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
    enabled: allowed,
  });

  const [actualPax, setActualPax] = useState(0);
  const [hamecoPP, setHamecoPP] = useState(0);
  const [hamecoAdd, setHamecoAdd] = useState(0);
  const [kiddie, setKiddie] = useState(0);
  const [foodOrder, setFoodOrder] = useState(0);
  const [deposit, setDeposit] = useState(0);

  const calc = useMemo(() => {
    const hamecoPackage = actualPax * hamecoPP;
    const totalHameco = hamecoPackage + hamecoAdd;
    const totalFameco = kiddie + foodOrder;
    const totalSpend = totalHameco + totalFameco;
    const topUp = totalSpend - deposit;
    return { hamecoPackage, totalHameco, totalFameco, totalSpend, topUp };
  }, [actualPax, hamecoPP, hamecoAdd, kiddie, foodOrder, deposit]);

  const create = useMutation({
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
      toast.success("Event cleared");
      qc.invalidateQueries({ queryKey: ["admin", "clearances"] });
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard-stats"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = clearanceSchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    create.mutate(parsed.data);
  };

  if (!allowed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Only clearance executives and super admins can clear events.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      <div className="flex items-center justify-between">
        {!embedded ? (
          <div>
            <h1 className="text-2xl font-bold">Clearance</h1>
            <p className="text-sm text-muted-foreground">Reconcile spend after the event.</p>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Reconcile spend after the event.</p>
        )}
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> New clearance
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {clearances.isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (clearances.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No clearances yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead>Pax</TableHead>
                  <TableHead className="text-right">Hameco</TableHead>
                  <TableHead className="text-right">Fameco</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Deposit</TableHead>
                  <TableHead className="text-right">Top-up</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(clearances.data ?? []).map((c) => (
                  <TableRow key={c.id}>
                    <TableCell>{c.source}</TableCell>
                    <TableCell>{c.actual_pax}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.total_hameco_spend)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.total_fameco_spend)}</TableCell>
                    <TableCell className="text-right font-semibold">
                      {formatCurrency(c.total_spend)}
                    </TableCell>
                    <TableCell className="text-right">{formatCurrency(c.deposit)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(c.top_up_balance)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Clearance form</DialogTitle>
            <DialogDescription>Totals calculate automatically.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <ClearanceEventSelect events={events.data ?? []} />
              <ClearanceSourceSelect />
              <div className="sm:col-span-2">
                <Label className="text-xs">Out-bound contact (if applicable)</Label>
                <Input name="out_bound_contact" maxLength={150} />
              </div>
              <ClearanceNum name="actual_pax" label="Actual pax" onChange={setActualPax} step="1" />
              <ClearanceNum name="hameco_per_person" label="Hameco per person" onChange={setHamecoPP} />
              <ClearanceNum name="hameco_additional_spend" label="Hameco additional" onChange={setHamecoAdd} />
              <div className="sm:col-span-2">
                <Label className="text-xs">Hameco additional details</Label>
                <HamecoAdditionalDetails />
              </div>
              <ClearanceNum name="kiddie_meal_amount" label="Kiddie meal" onChange={setKiddie} />
              <ClearanceNum name="additional_food_order" label="Additional food order" onChange={setFoodOrder} />
              <ClearanceNum name="deposit" label="Deposit paid" onChange={setDeposit} />
            </div>

            <Card className="bg-muted/40">
              <CardHeader className="py-3">
                <CardTitle className="text-sm">Calculated</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-1 text-sm sm:grid-cols-2">
                <ClearanceRow label="Hameco package spend" value={calc.hamecoPackage} />
                <ClearanceRow label="Total Hameco" value={calc.totalHameco} />
                <ClearanceRow label="Total Fameco" value={calc.totalFameco} />
                <ClearanceRow label="Total spend" value={calc.totalSpend} bold />
                <ClearanceRow label="Top-up / balance" value={calc.topUp} bold />
              </CardContent>
            </Card>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save & mark cleared
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ClearanceNum({
  name,
  label,
  onChange,
  step = "0.01",
}: {
  name: string;
  label: string;
  onChange: (n: number) => void;
  step?: string;
}) {
  return (
    <div>
      <Label className="text-xs">{label}</Label>
      <Input
        name={name}
        type="number"
        min="0"
        step={step}
        defaultValue="0"
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

function ClearanceRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "font-semibold" : ""}`}>
      <span className="text-muted-foreground">{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}

function ClearanceEventSelect({
  events,
}: {
  events: { id: string; client_name: string; organization: string | null; event_date: string }[];
}) {
  const [val, setVal] = useState("");
  return (
    <div>
      <Label className="text-xs">Event</Label>
      <input type="hidden" name="event_id" value={val} required />
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger>
          <SelectValue placeholder="Confirmed event" />
        </SelectTrigger>
        <SelectContent>
          {events.map((e) => (
            <SelectItem key={e.id} value={e.id}>
              {e.organization || e.client_name} · {e.event_date}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function ClearanceSourceSelect() {
  const [val, setVal] = useState("in_bound");
  return (
    <div>
      <Label className="text-xs">Source</Label>
      <input type="hidden" name="source" value={val} required />
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="in_bound">In-bound</SelectItem>
          <SelectItem value="out_bound">Out-bound</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}

function HamecoAdditionalDetails() {
  const [selected, setSelected] = useState<string[]>([]);
  const toggle = (opt: string) =>
    setSelected((prev) => (prev.includes(opt) ? prev.filter((o) => o !== opt) : [...prev, opt]));
  return (
    <>
      <input type="hidden" name="hameco_additional_details" value={selected.join(", ")} />
      <div className="grid grid-cols-2 gap-2 rounded-md border p-3 sm:grid-cols-3">
        {HAMECO_ADDITIONAL_OPTIONS.map((opt) => (
          <label key={opt} className="flex cursor-pointer items-center gap-2 text-sm">
            <Checkbox checked={selected.includes(opt)} onCheckedChange={() => toggle(opt)} />
            <span>{opt}</span>
          </label>
        ))}
      </div>
    </>
  );
}
