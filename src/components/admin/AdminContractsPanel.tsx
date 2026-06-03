import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import jsPDF from "jspdf";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  facilityLabel,
  eventTypeLabel,
  formatCurrency,
  type FacilityEnum,
} from "@/lib/facility-utils";
import { Loader2, FileText, Download } from "lucide-react";

interface EventLite {
  id: string;
  client_name: string;
  contact_number: string;
  email: string;
  organization: string | null;
  event_type: string;
  facility: string;
  event_space: string;
  event_date: string;
  start_time: string;
  end_time: string;
  package_name: string;
  cost_per_person: number;
  pax: number;
  status: string;
  notes: string | null;
  birthday_persons: unknown;
  package_options: unknown;
}

const FACILITY_TILL_NUMBERS: Record<FacilityEnum, string> = {
  village_bowl: "5541291",
  under_the_sea: "9840427",
  ozone_trampoline_park: "9840429",
  mini_golf: "9840415",
  rev: "9840417",
  glitch: "9840425",
  ballpoint: "9840423",
};

const FOOD_TILL_NUMBERS: Record<FacilityEnum, string> = {
  village_bowl: "5541292",
  under_the_sea: "9840428",
  ozone_trampoline_park: "9840430",
  mini_golf: "9840416",
  rev: "9840418",
  glitch: "9840426",
  ballpoint: "9840424",
};

function formatTimeToAMPM(timeStr: string): string {
  if (!timeStr) return "";
  const [hh, mm] = timeStr.split(":");
  let hour = parseInt(hh, 10);
  if (Number.isNaN(hour)) return timeStr;
  const suffix = hour >= 12 ? "PM" : "AM";
  hour = ((hour + 11) % 12) + 1;
  return `${hour}:${mm} ${suffix}`;
}

function formatDateLong(dateStr: string): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}

function getCurrentDate(): string {
  return new Date().toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function generateBirthdayContract(e: EventLite): string {
  const facility = e.facility as FacilityEnum;
  const tillNumber = FACILITY_TILL_NUMBERS[facility] ?? "";
  const foodTill = FOOD_TILL_NUMBERS[facility] ?? "";
  const total = e.cost_per_person * e.pax;
  const includesKiddieMeal = /kiddie fiesta|immersive delights/i.test(e.package_name);
  const persons = Array.isArray(e.birthday_persons)
    ? (e.birthday_persons as { name?: string; dob?: string }[])
    : [];
  const birthdayList = persons.length
    ? persons.map((p) => `${p.name ?? ""} (DOB: ${p.dob ?? ""})`).join(", ")
    : "—";

  return [
    "BIRTHDAY PARTY AGREEMENT",
    "",
    `Date: ${getCurrentDate()}`,
    "",
    `Client: ${e.client_name}`,
    `Contact: ${e.contact_number}`,
    `Email: ${e.email || "—"}`,
    `Organisation: ${e.organization || "—"}`,
    "",
    `Facility: ${facilityLabel(facility)}`,
    `Event space: ${e.event_space}`,
    `Event date: ${formatDateLong(e.event_date)}`,
    `Time: ${formatTimeToAMPM(e.start_time)} – ${formatTimeToAMPM(e.end_time)}`,
    "",
    `Package: ${e.package_name}`,
    `Birthday person(s): ${birthdayList}`,
    `Guests (pax): ${e.pax}`,
    `Cost per person: ${formatCurrency(e.cost_per_person)}`,
    `Total package value: ${formatCurrency(total)}`,
    includesKiddieMeal ? "Includes kiddie meal component." : "",
    "",
    `Facility till number: ${tillNumber}`,
    `Food till number: ${foodTill}`,
    "",
    "Terms:",
    "- Bookings confirmed upon receiving deposit and signed agreement. Payments are non-refundable.",
    "- Final guest count must be confirmed 48 hours before the event.",
    "- Venue rules and safety briefing apply to all guests.",
    e.notes ? `Notes: ${e.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function generateSchoolTripContract(e: EventLite): string {
  const facility = e.facility as FacilityEnum;
  const tillNumber = FACILITY_TILL_NUMBERS[facility] ?? "";
  const foodTill = FOOD_TILL_NUMBERS[facility] ?? "";
  const total = e.cost_per_person * e.pax;
  const options = Array.isArray(e.package_options)
    ? (e.package_options as string[]).join(", ")
    : e.package_name;

  return [
    "SCHOOL TRIP AGREEMENT",
    "",
    `Date: ${getCurrentDate()}`,
    "",
    `School / organisation: ${e.organization || e.client_name}`,
    `Contact person: ${e.client_name}`,
    `Contact number: ${e.contact_number}`,
    `Email: ${e.email || "—"}`,
    "",
    `Facility: ${facilityLabel(facility)}`,
    `Event date: ${formatDateLong(e.event_date)}`,
    `Time: ${formatTimeToAMPM(e.start_time)} – ${formatTimeToAMPM(e.end_time)}`,
    "",
    `Programme: ${options}`,
    `Students (pax): ${e.pax}`,
    `Cost per student: ${formatCurrency(e.cost_per_person)}`,
    `Total: ${formatCurrency(total)}`,
    "",
    `Facility till number: ${tillNumber}`,
    `Food till number: ${foodTill}`,
    "",
    "Terms:",
    "- CBC educational tour terms apply. Minimum group sizes as per brochure.",
    "- Teachers must supervise students at all times.",
    "- Bookings confirmed upon deposit and signed agreement.",
    e.notes ? `Notes: ${e.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function generateHangoutContract(e: EventLite): string {
  const facility = e.facility as FacilityEnum;
  const tillNumber = FACILITY_TILL_NUMBERS[facility] ?? "";
  const foodTill = FOOD_TILL_NUMBERS[facility] ?? "";
  const total = e.cost_per_person * e.pax;

  return [
    "HANGOUT / TEAM BUILDING AGREEMENT",
    "",
    `Date: ${getCurrentDate()}`,
    "",
    `Client: ${e.client_name}`,
    `Organisation: ${e.organization || "—"}`,
    `Contact: ${e.contact_number}`,
    `Email: ${e.email || "—"}`,
    "",
    `Facility: ${facilityLabel(facility)}`,
    `Event space: ${e.event_space}`,
    `Event date: ${formatDateLong(e.event_date)}`,
    `Time: ${formatTimeToAMPM(e.start_time)} – ${formatTimeToAMPM(e.end_time)}`,
    "",
    `Package: ${e.package_name}`,
    `Participants (pax): ${e.pax}`,
    `Package cost: ${formatCurrency(e.cost_per_person)}`,
    `Total: ${formatCurrency(total)}`,
    "",
    `Facility till number: ${tillNumber}`,
    `Food till number: ${foodTill}`,
    "",
    "Terms:",
    "- Hangout and team-building packages as per selected brochure tier.",
    "- Food orders must be confirmed in time for kitchen preparation where applicable.",
    "- Bookings confirmed upon deposit and signed agreement.",
    e.notes ? `Notes: ${e.notes}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function generateContractText(e: EventLite): string {
  if (e.event_type === "birthday") return generateBirthdayContract(e);
  if (e.event_type === "school_trip") return generateSchoolTripContract(e);
  return generateHangoutContract(e);
}

function downloadPdf(e: EventLite, content: string) {
  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 40;
  const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
  const lines = doc.splitTextToSize(content, pageWidth);
  let y = margin;
  const lineHeight = 14;
  const pageHeight = doc.internal.pageSize.getHeight();

  for (const line of lines) {
    if (y > pageHeight - margin) {
      doc.addPage();
      y = margin;
    }
    doc.text(line, margin, y);
    y += lineHeight;
  }

  const slug = (e.organization || e.client_name).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  doc.save(`contract-${slug}-${e.event_date}.pdf`);
}

export function AdminContractsPanel({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const qc = useQueryClient();

  const events = useQuery({
    queryKey: ["admin", "events", "for-contracts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .in("status", ["tentative", "confirmed", "cleared"])
        .order("event_date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as EventLite[];
    },
  });

  const contracts = useQuery({
    queryKey: ["admin", "contracts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contracts").select("*").order("created_at", {
        ascending: false,
      });
      if (error) throw error;
      return data ?? [];
    },
  });

  const create = useMutation({
    mutationFn: async (event: EventLite) => {
      const content = generateContractText(event);
      // create a PDF locally for download
      downloadPdf(event, content);
      // also upload unsigned PDF to storage so we can share it with the client for signing
      try {
        const doc = new jsPDF({ unit: "pt", format: "a4" });
        const margin = 40;
        const pageWidth = doc.internal.pageSize.getWidth() - margin * 2;
        const lines = doc.splitTextToSize(content, pageWidth);
        let y = margin;
        const lineHeight = 14;
        const pageHeight = doc.internal.pageSize.getHeight();
        for (const line of lines) {
          if (y > pageHeight - margin) {
            doc.addPage();
            y = margin;
          }
          doc.text(line, margin, y);
          y += lineHeight;
        }
        const slug = (event.organization || event.client_name).replace(/[^a-z0-9]+/gi, "-").toLowerCase();
        const fname = `contract-${slug}-${event.event_date}.pdf`;
        const pdfBytes = doc.output("arraybuffer");
        const filePath = `unsigned/${fname}`;
        const { error: uploadError } = await supabase.storage.from("contracts").upload(filePath, new Uint8Array(pdfBytes), { contentType: "application/pdf", upsert: true });
        let publicUrl: string | null = null;
        if (!uploadError) {
          const { data: urlData } = supabase.storage.from("contracts").getPublicUrl(filePath);
          publicUrl = urlData?.publicUrl ?? null;
        }
        const { error } = await supabase.from("contracts").upsert({
          event_id: event.id,
          content,
          signature_url: publicUrl,
          generated_by: user?.id ?? null,
        }, { onConflict: "event_id" });
        if (error) throw error;
      } catch (err) {
        throw err;
      }
    },
    onSuccess: () => {
      toast.success("Contract generated");
      qc.invalidateQueries({ queryKey: ["admin", "contracts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const regenerate = (event: EventLite) => {
    const content = generateContractText(event);
    downloadPdf(event, content);
  };

  return (
    <div className={embedded ? "space-y-4" : "space-y-6"}>
      {!embedded && (
        <div>
          <h1 className="text-2xl font-bold">Contracts</h1>
          <p className="text-sm text-muted-foreground">
            Generate and download PDF contracts for events. Templates are tailored per event type
            with facility-specific till numbers.
          </p>
        </div>
      )}

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {events.isLoading ? (
            <div className="py-10 text-center">
              <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (events.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">
              No events available for contracts.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Client</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Facility</TableHead>
                  <TableHead>Date</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(events.data ?? []).map((e) => {
                  const existing = contracts.data?.find((c) => c.event_id === e.id);
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="font-medium">
                        {e.organization || e.client_name}
                      </TableCell>
                      <TableCell>{eventTypeLabel(e.event_type as never)}</TableCell>
                      <TableCell>{facilityLabel(e.facility as never)}</TableCell>
                      <TableCell>{e.event_date}</TableCell>
                      <TableCell>
                        {existing ? (
                          <Badge>Generated</Badge>
                        ) : (
                          <Badge variant="secondary">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right">
                        {existing ? (
                          existing.signature_url ? (
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="outline" onClick={() => window.open(existing.signature_url, "_blank") }>
                                <Download className="mr-1 h-3.5 w-3.5" /> Open
                              </Button>
                              <Button size="sm" onClick={() => { navigator.clipboard.writeText(existing.signature_url); toast.success("Link copied"); }}>
                                Copy link
                              </Button>
                            </div>
                          ) : (
                            <Button size="sm" variant="outline" onClick={() => regenerate(e)}>
                              <Download className="mr-1 h-3.5 w-3.5" /> Download
                            </Button>
                          )
                        ) : (
                          <Button
                            size="sm"
                            onClick={() => create.mutate(e)}
                            disabled={create.isPending}
                          >
                            <FileText className="mr-1 h-3.5 w-3.5" /> Generate
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
