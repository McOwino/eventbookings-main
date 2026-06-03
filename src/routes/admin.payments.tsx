import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PAYMENT_MODE_OPTIONS, formatCurrency } from "@/lib/facility-utils";
import { ALL_ROLES, CLEARANCE_ROLES } from "@/lib/roles";
import { AdminClearancePanel } from "@/components/admin/AdminClearancePanel";
import { Plus, Loader2 } from "lucide-react";
// DocumentsDropdown removed from payments header per request

type PaymentsSearch = { tab?: string };

export const Route = createFileRoute("/admin/payments")({
  validateSearch: (search: Record<string, unknown>): PaymentsSearch => ({
    tab: typeof search.tab === "string" ? search.tab : undefined,
  }),
  component: PaymentsPage,
});

const paySchema = z.object({
  event_id: z.string().uuid(),
  amount: z.coerce.number().positive(),
  payment_mode: z.enum(["mpesa", "card", "cash"]),
  date_paid: z.string().min(1),
  confirmation_code: z.string().trim().min(1).max(100),
});

function DepositTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const events = useQuery({
    queryKey: ["admin", "events", "for-payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("id, client_name, organization, event_date, status")
        .neq("status", "canceled")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const payments = useQuery({
    queryKey: ["admin", "payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("date_paid", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (input: z.infer<typeof paySchema>) => {
      // 1. Insert the payment (unchanged)
      const { error: payErr } = await (supabase as any).from("payments").insert({
        ...input,
        payment_mode: input.payment_mode,
        created_by: user?.id ?? null,
      });
      if (payErr) throw payErr;

      // 2. Check the event's current status
      const { data: ev, error: evErr } = await supabase
        .from("events")
        .select("status")
        .eq("id", input.event_id)
        .single();
      if (evErr) throw evErr;

      // 3. If still tentative, confirm it — mirroring what confirmBooking does
      if (ev.status === "tentative") {
        const { error: updateErr } = await supabase
          .from("events")
          .update({
            status: "confirmed",
            confirmed_by: user?.id ?? null,
            confirmed_at: new Date().toISOString(),
            confirmed_without_deposit: false,
          })
          .eq("id", input.event_id);
        if (updateErr) throw updateErr;
      }
    },
    onSuccess: () => {
      toast.success("Payment recorded & booking confirmed");
      qc.invalidateQueries({ queryKey: ["admin", "payments"] });
      qc.invalidateQueries({ queryKey: ["admin", "events"] });
      qc.invalidateQueries({ queryKey: ["admin", "dashboard-stats"] });
      qc.invalidateQueries({ queryKey: ["public", "events"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    // If payment_mode is cash and confirmation code is empty, autofill a placeholder
    const payment_mode = String(fd.get("payment_mode") ?? "");
    if (payment_mode === "cash" && !(fd.get("confirmation_code") ?? "")) {
      fd.set("confirmation_code", "NO TRANSACTION CODE");
    }
    const parsed = paySchema.safeParse(Object.fromEntries(fd));
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    create.mutate(parsed.data);
  };

  const eventLabel = (id: string) => {
    const ev = events.data?.find((e) => e.id === id);
    if (!ev) return id.slice(0, 8);
    return `${ev.organization || ev.client_name} · ${ev.event_date}`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Record deposit
        </Button>
      </div>

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {payments.isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (payments.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No deposits recorded.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Event</TableHead>
                  <TableHead>Mode</TableHead>
                  <TableHead>Confirmation</TableHead>
                  <TableHead className="text-right">Amount</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(payments.data ?? []).map((p) => (
                  <TableRow key={p.id}>
                    <TableCell>{p.date_paid}</TableCell>
                    <TableCell>{eventLabel(p.event_id)}</TableCell>
                    <TableCell className="uppercase">{p.mode}</TableCell>
                    <TableCell className="font-mono text-xs">{p.confirmation_code}</TableCell>
                    <TableCell className="text-right font-semibold">{formatCurrency(p.amount)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record deposit</DialogTitle>
            <DialogDescription>Link the deposit to an event.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <EventSelect events={events.data ?? []} />
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label className="text-xs">Amount (KES)</Label>
                <Input name="amount" type="number" min="0.01" step="0.01" required />
              </div>
              <ModeSelect />
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
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={create.isPending}>
                {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PaymentsPage() {
  const { hasAnyRole } = useAuth();
  const { tab: tabSearch } = useSearch({ from: "/admin/payments" });

  const depositAllowed = hasAnyRole([...ALL_ROLES]);
  const clearanceAllowed = hasAnyRole(CLEARANCE_ROLES);
  const pageAllowed = depositAllowed || clearanceAllowed;

  const defaultTab =
    tabSearch === "clearance" && clearanceAllowed
      ? "clearance"
      : tabSearch === "deposit" && depositAllowed
        ? "deposit"
        : clearanceAllowed && !depositAllowed
          ? "clearance"
          : "deposit";

  if (!pageAllowed) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You do not have access to payments or clearance.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Payments</h1>
        <p className="text-sm text-muted-foreground">
          Record event deposits and process post-event clearance.
        </p>
      </div>
      {/* DocumentsDropdown removed from payments header */}

      <Tabs defaultValue={defaultTab} key={defaultTab}>
        <div className="flex justify-center">
          <TabsList>
            {depositAllowed && <TabsTrigger value="deposit">Deposit</TabsTrigger>}
            {clearanceAllowed && <TabsTrigger value="clearance">Clearance</TabsTrigger>}
          </TabsList>
        </div>

        {depositAllowed && (
          <TabsContent value="deposit" className="mt-4">
            <DepositTab />
          </TabsContent>
        )}

        {clearanceAllowed && (
          <TabsContent value="clearance" className="mt-4">
            <AdminClearancePanel embedded />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

function EventSelect({
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
          <SelectValue placeholder="Select event" />
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

function ModeSelect() {
  const [val, setVal] = useState("");
  return (
    <div>
      <Label className="text-xs">Mode</Label>
      <input type="hidden" name="payment_mode" value={val} required />
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger>
          <SelectValue placeholder="Select mode" />
        </SelectTrigger>
        <SelectContent>
          {PAYMENT_MODE_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>
              {o.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
