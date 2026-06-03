import { useState, useEffect } from "react";
import { z } from "zod";
import {
  TIME_SLOT_OPTIONS_DEFAULT,
  TIME_SLOT_OPTIONS_SCHOOL,
} from "@/lib/facility-utils";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Database } from "@/integrations/supabase/types";

type LeadEventType = Database["public"]["Enums"]["event_type"];

const VM_RED = "#C0272D";
const VM_RED_SOFT_BG = "#fcebeb";
const fieldBg = "bg-white";

const EVENT_TYPES = [
  { value: "birthday", label: "Birthday Party" },
  { value: "school_trip", label: "School Trip" },
  { value: "hangout", label: "Hangout" },
  { value: "league_tournament", label: "League / Tournament" },
] as const;
const EVENT_TYPE_VALUES = EVENT_TYPES.map((e) => e.value) as [string, ...string[]];

const FACILITY_OPTIONS = [
  "General",
  "Village Bowl",
  "Under the Sea",
  "Ozone Trampoline Park",
  "Mini-Golf",
  "REV",
  "Glitch",
  "Ballpoint",
] as const;

const schema = z.object({
  name: z.string().trim().min(1, "Name is required").max(100),
  phone: z
    .string()
    .trim()
    .min(7, "Enter a valid phone number")
    .max(25)
    .regex(/^[+\d\s()-]+$/, "Only digits and + ( ) - allowed"),
  email: z.string().trim().email("Enter a valid email").max(255),
  event_type: z.enum(EVENT_TYPE_VALUES, { message: "Choose an event type" }),
  facility: z.enum(FACILITY_OPTIONS, { message: "Choose a facility" }),
  preferred_date: z.string().min(1, "Pick a preferred date"),
  preferred_start_time: z.string().optional().or(z.literal("")),
  preferred_end_time: z.string().optional().or(z.literal("")),
  notes: z.string().trim().max(1000).optional().or(z.literal("")),
  filled_by: z.string().trim().max(100).optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  const usesSlots = data.event_type === "birthday" || data.event_type === "school_trip";
  const usesFlexible = data.event_type === "hangout" || data.event_type === "league_tournament";
  if (usesSlots && !data.preferred_start_time) {
    ctx.addIssue({ code: "custom", message: "Choose a time slot", path: ["preferred_start_time"] });
  }
  if (usesFlexible) {
    if (!data.preferred_start_time) {
      ctx.addIssue({ code: "custom", message: "Start time is required", path: ["preferred_start_time"] });
    }
    if (!data.preferred_end_time) {
      ctx.addIssue({ code: "custom", message: "End time is required", path: ["preferred_end_time"] });
    }
    if (data.preferred_start_time && data.preferred_end_time && data.preferred_start_time >= data.preferred_end_time) {
      ctx.addIssue({ code: "custom", message: "End time must be after start", path: ["preferred_end_time"] });
    }
  }
});

type FieldErrors = Partial<Record<keyof z.infer<typeof schema>, string>>;

export function InterestForm() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [eventType, setEventType] = useState<string>("");
  const [facility, setFacility] = useState<string>("");
  const [preferredDate, setPreferredDate] = useState("");
  const [timeSlot, setTimeSlot] = useState("");
  const [preferredStartTime, setPreferredStartTime] = useState("");
  const [preferredEndTime, setPreferredEndTime] = useState("");
  const [notes, setNotes] = useState("");
  const [filledBy, setFilledBy] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  const isBirthday = eventType === "birthday";
  const isSchool = eventType === "school_trip";
  const isHangout = eventType === "hangout";
  const isLeague = eventType === "league_tournament";
  const usesFixedSlots = isBirthday || isSchool;
  const usesFlexibleTime = isHangout || isLeague;
  const slots = isSchool ? TIME_SLOT_OPTIONS_SCHOOL : TIME_SLOT_OPTIONS_DEFAULT;

  useEffect(() => {
    setTimeSlot("");
    setPreferredStartTime("");
    setPreferredEndTime("");
  }, [eventType]);

  const applySlot = (val: string) => {
    setTimeSlot(val);
    const slot = slots.find((s) => s.value === val);
    if (slot) {
      setPreferredStartTime(slot.start);
      setPreferredEndTime(slot.end);
    }
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setServerError(null);
    const parsed = schema.safeParse({
      name,
      phone,
      email,
      event_type: eventType,
      facility,
      preferred_date: preferredDate,
      preferred_start_time: preferredStartTime || undefined,
      preferred_end_time: preferredEndTime || undefined,
      notes,
      filled_by: filledBy,
    });
    if (!parsed.success) {
      const fe: FieldErrors = {};
      for (const issue of parsed.error.issues) {
        const k = issue.path[0] as keyof FieldErrors;
        if (!fe[k]) fe[k] = issue.message;
      }
      setErrors(fe);
      return;
    }
    setErrors({});
    setSubmitting(true);

    const baseNotes = parsed.data.notes || null;
    const timeNote =
      parsed.data.preferred_start_time || parsed.data.preferred_end_time
        ? `Preferred time: ${parsed.data.preferred_start_time ?? ""}${parsed.data.preferred_end_time ? ` – ${parsed.data.preferred_end_time}` : ""}`
        : null;
    const notesWithTime = [baseNotes, timeNote].filter(Boolean).join("\n") || null;

    const leadEventType = parsed.data.event_type as LeadEventType;

    const rpcPayload = {
      p_name: parsed.data.name,
      p_phone: parsed.data.phone,
      p_email: parsed.data.email,
      p_event_type: leadEventType,
      p_facility: parsed.data.facility,
      p_preferred_date: parsed.data.preferred_date,
      p_preferred_start_time: parsed.data.preferred_start_time || null,
      p_preferred_end_time: parsed.data.preferred_end_time || null,
      p_notes: baseNotes,
      p_filled_by: parsed.data.filled_by || null,
    };

    let error: { message?: string; code?: string } | null = null;

    const rpc = await supabase.rpc("submit_public_lead", rpcPayload);
    error = rpc.error;

    if (error?.code === "PGRST202" || error?.message?.includes("submit_public_lead")) {
      const insert = await supabase.from("leads").insert({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        event_type: leadEventType,
        facility: parsed.data.facility,
        preferred_date: parsed.data.preferred_date,
        preferred_start_time: parsed.data.preferred_start_time || null,
        preferred_end_time: parsed.data.preferred_end_time || null,
        notes: baseNotes,
        filled_by: parsed.data.filled_by || null,
      });
      error = insert.error;
    }

    if (
      error?.code === "PGRST204" &&
      (error.message?.includes("preferred_start_time") ||
        error.message?.includes("preferred_end_time"))
    ) {
      const fallback = await supabase.from("leads").insert({
        name: parsed.data.name,
        phone: parsed.data.phone,
        email: parsed.data.email,
        event_type: leadEventType,
        facility: parsed.data.facility,
        preferred_date: parsed.data.preferred_date,
        notes: notesWithTime,
        filled_by: parsed.data.filled_by || null,
      });
      error = fallback.error;
    }

    setSubmitting(false);
    if (error) {
      console.error("Lead submit failed:", error);
      setServerError("Sorry — we couldn't submit that. Please try again.");
      return;
    }
    setSubmitted(true);
    setName("");
    setPhone("");
    setEmail("");
    setEventType("");
    setFacility("");
    setPreferredDate("");
    setTimeSlot("");
    setPreferredStartTime("");
    setPreferredEndTime("");
    setNotes("");
    setFilledBy("");
  }

  if (submitted) {
    return (
      <div className="rounded-2xl border border-[#e8e4de] bg-[#fcebeb] p-8 text-center shadow-sm sm:p-10">
        <div
          className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full"
          style={{ backgroundColor: VM_RED_SOFT_BG }}
        >
          <CheckCircle2 className="h-6 w-6" style={{ color: VM_RED }} />
        </div>
        <h3 className="text-lg font-semibold" style={{ color: VM_RED }}>
          Thanks — we got it!
        </h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Our team will reach out to you shortly to plan your event.
        </p>
        <Button className="mt-4" variant="outline" onClick={() => setSubmitted(false)}>
          Submit another
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#e8e4de] bg-[#fcebeb] p-8 shadow-sm sm:p-10"
      noValidate
    >
      <div className="mb-6 flex items-center gap-3">
        <div
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full ring-1 ring-[#C0272D]/20"
          style={{ backgroundColor: VM_RED_SOFT_BG }}
        >
          <Sparkles className="h-5 w-5" style={{ color: VM_RED }} />
        </div>
        <div>
          <h2 className="text-lg font-semibold leading-tight">Interested in an event?</h2>
          <p className="text-xs text-muted-foreground">
            Tell us a little about you and we'll get back to you with options.
          </p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor="if-name">Full name</Label>
          <Input
            id="if-name"
            className={fieldBg}
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Jane Doe"
            maxLength={100}
            required
          />
          {errors.name && <p className="text-xs text-destructive">{errors.name}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="if-phone">Phone</Label>
          <Input
            id="if-phone"
            className={fieldBg}
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="+254 700 000 000"
            inputMode="tel"
            maxLength={25}
            required
          />
          {errors.phone && <p className="text-xs text-destructive">{errors.phone}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="if-email">Email</Label>
          <Input
            id="if-email"
            className={fieldBg}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            maxLength={255}
            required
          />
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="if-type">Event type</Label>
          <Select value={eventType} onValueChange={setEventType}>
            <SelectTrigger id="if-type" className={fieldBg}>
              <SelectValue placeholder="Select an event type" />
            </SelectTrigger>
            <SelectContent>
              {EVENT_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.event_type && (
            <p className="text-xs text-destructive">{errors.event_type}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="if-facility">Facility</Label>
          <Select value={facility} onValueChange={setFacility}>
            <SelectTrigger id="if-facility" className={fieldBg}>
              <SelectValue placeholder="Select a facility" />
            </SelectTrigger>
            <SelectContent>
              {FACILITY_OPTIONS.map((f) => (
                <SelectItem key={f} value={f}>
                  {f}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.facility && (
            <p className="text-xs text-destructive">{errors.facility}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
          <Label htmlFor="if-date">Preferred date</Label>
          <Input
            id="if-date"
            className={fieldBg}
            type="date"
            min={today}
            value={preferredDate}
            onChange={(e) => setPreferredDate(e.target.value)}
            required
          />
          {errors.preferred_date && (
            <p className="text-xs text-destructive">{errors.preferred_date}</p>
          )}
        </div>

        {usesFixedSlots && (
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-2">
            <Label htmlFor="if-time-slot">Preferred time slot</Label>
            <Select value={timeSlot} onValueChange={applySlot}>
              <SelectTrigger id="if-time-slot" className={fieldBg}>
                <SelectValue placeholder="Select a time slot" />
              </SelectTrigger>
              <SelectContent>
                {slots.map((s) => (
                  <SelectItem key={s.value} value={s.value}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.preferred_start_time && (
              <p className="text-xs text-destructive">{errors.preferred_start_time}</p>
            )}
          </div>
        )}

        {usesFlexibleTime && (
          <>
            <div className="space-y-1.5">
              <Label htmlFor="if-start">Preferred start time</Label>
              <Input
                id="if-start"
                className={fieldBg}
                type="time"
                value={preferredStartTime}
                onChange={(e) => setPreferredStartTime(e.target.value)}
                required
              />
              {errors.preferred_start_time && (
                <p className="text-xs text-destructive">{errors.preferred_start_time}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="if-end">Preferred end time</Label>
              <Input
                id="if-end"
                className={fieldBg}
                type="time"
                value={preferredEndTime}
                onChange={(e) => setPreferredEndTime(e.target.value)}
                required
              />
              {errors.preferred_end_time && (
                <p className="text-xs text-destructive">{errors.preferred_end_time}</p>
              )}
            </div>
          </>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="if-filled-by">Filled by (optional)</Label>
          <Input
            id="if-filled-by"
            className={fieldBg}
            value={filledBy}
            onChange={(e) => setFilledBy(e.target.value)}
            placeholder="Staff or person submitting on their behalf"
            maxLength={100}
          />
          {errors.filled_by && (
            <p className="text-xs text-destructive">{errors.filled_by}</p>
          )}
        </div>

        <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
          <Label htmlFor="if-notes">Notes (optional)</Label>
          <Textarea
            id="if-notes"
            className={fieldBg}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Number of guests, facility preference, special requests…"
            maxLength={1000}
            rows={4}
          />
          {errors.notes && <p className="text-xs text-destructive">{errors.notes}</p>}
        </div>
      </div>

      {serverError && (
        <p className="mt-4 text-sm text-destructive">{serverError}</p>
      )}

      <Button
        type="submit"
        disabled={submitting}
        className={cn(
          "mt-6 h-10 w-full border-0 px-6 text-white shadow-sm sm:w-auto",
          "bg-[#C0272D] hover:bg-[#9e2227] focus-visible:ring-[#C0272D]/35",
        )}
      >
        {submitting ? "Submitting…" : "Submit interest"}
      </Button>
    </form>
  );
}
