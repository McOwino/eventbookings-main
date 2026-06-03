import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Users, MapPin, Clock, FileText } from "lucide-react";
import { facilityLabel, type FacilityEnum } from "@/lib/facility-utils";
import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/admin/logistics")({
  component: LogisticsPage,
});

function LogisticsPage() {
  const { roles } = useAuth();
  const today = new Date().toISOString().split("T")[0];
  const [filterDate, setFilterDate] = useState("");
  const [filterTime, setFilterTime] = useState("");
  // Package tab has its own independent date filter (defaults to today)
  const [packageDate, setPackageDate] = useState(today);

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You do not have access to this page.
        </CardContent>
      </Card>
    );
  }

  const { data: events, isLoading } = useQuery({
    queryKey: ["admin", "logistics", "events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select(`*`)
        .gte("event_date", today)
        .neq("status", "canceled")
        .order("event_date", { ascending: true })
        .order("start_time", { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["admin", "logistics", "payments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filteredEvents = (events ?? []).filter((e) => {
    if (filterDate && e.event_date !== filterDate) return false;
    if (filterTime && !e.start_time.startsWith(filterTime)) return false;
    return true;
  });

  const schoolTrips = filteredEvents.filter((e) => e.event_type === "school_trip");
  const birthdayParties = filteredEvents.filter((e) => e.event_type === "birthday");
  const hangouts = filteredEvents.filter((e) => e.event_type === "hangout");

  // Events for the packages tab — filtered by selected date only
  const packageEvents = (events ?? []).filter((e) =>
    packageDate ? e.event_date === packageDate : true
  );

  const getWeekday = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { weekday: "long" });
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  };

  // Derive the display name for an event
  const getEventName = (event: any): string => {
    if (
      event.event_type === "birthday" &&
      Array.isArray(event.birthday_persons) &&
      event.birthday_persons.length > 0
    ) {
      return event.birthday_persons.map((p: any) => p.name).join(", ");
    }
    return event.organization || event.client_name || "";
  };

  // Open the package preview in a new tab, encoding the event as a URL param
  const openPackage = (event: any) => {
    // Find the most recent payment for this event
    const eventPayment = (payments ?? []).find((p: any) => p.event_id === event.id);
    const payload = {
      eventName: getEventName(event),
      clientName: event.client_name || "",
      eventDate: event.event_date || "",
      eventTime: event.start_time ? `${event.start_time.slice(0, 5)} - ${event.end_time?.slice(0, 5) ?? ""}` : "",
      facility: event.facility ? facilityLabel(event.facility as FacilityEnum) : "",
      eventSpace: event.event_space || "",
      pax: event.pax != null ? String(event.pax) : "",
      packageName: event.package_name || "",
      packageDetails: event.package_options && Array.isArray(event.package_options)
        ? event.package_options.join(", ")
        : (event.notes || ""),
      costPerPerson: event.cost_per_person != null ? String(event.cost_per_person) : "",
      payment_mode: eventPayment?.payment_mode || "",
      payment_date: eventPayment?.date_paid || "",
      payment_amount: eventPayment?.amount != null ? String(eventPayment.amount) : "",
      confirmation_code: eventPayment?.confirmation_code || "",
    };
    const encoded = btoa(encodeURIComponent(JSON.stringify(payload)));
    window.open(`/package-preview?data=${encoded}`, "_blank");
  };

  // ── Sub-components ────────────────────────────────────────────────────────

  const EventCard = ({ event }: { event: any }) => (
    <Card className="overflow-hidden transition-all hover:shadow-md">
      <CardHeader className="bg-muted/30 pb-3">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary mb-1">
              <Calendar className="h-4 w-4" />
              <span className="uppercase tracking-wider">{getWeekday(event.event_date)}</span>
              <span className="text-muted-foreground font-normal">|</span>
              <span className="text-muted-foreground">{formatDate(event.event_date)}</span>
            </div>
            <CardTitle className="text-lg">{getEventName(event)}</CardTitle>
          </div>
          <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary uppercase">
            {event.status}
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-4 grid gap-3 sm:grid-cols-2">
        <div className="flex items-center gap-2 text-sm">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span>{event.start_time.slice(0, 5)} - {event.end_time.slice(0, 5)}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="h-4 w-4 text-muted-foreground" />
          <span>{event.facility ? facilityLabel(event.facility as FacilityEnum) : "General"} — {event.event_space}</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Users className="h-4 w-4 text-muted-foreground" />
          <span>{event.pax} PAX</span>
        </div>
        {event.client_name && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{event.client_name}</span>
          </div>
        )}
        {event.contact_number && (
          <div className="flex items-center gap-2 text-sm">
            <FileText className="h-4 w-4 text-muted-foreground" />
            <span>{event.contact_number}</span>
          </div>
        )}
        {event.package_name && (
          <div className="col-span-full text-sm mt-2">
            <strong>Package:</strong> {event.package_name}
          </div>
        )}
        {event.package_options && Array.isArray(event.package_options) && event.package_options.length > 0 && (
          <div className="col-span-full text-sm">
            <strong>Options:</strong> {event.package_options.join(", ")}
          </div>
        )}
        {event.notes && (
          <div className="col-span-full text-sm mt-2 bg-muted p-2 rounded-md">
            <strong>Notes:</strong> {event.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );

  const EventList = ({ list }: { list: any[] }) => {
    if (isLoading) {
      return <div className="py-10 text-center text-muted-foreground">Loading logistics data...</div>;
    }
    if (!list.length) {
      return <div className="py-10 text-center text-muted-foreground">No upcoming events match the current filters.</div>;
    }
    return (
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {list.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
      </div>
    );
  };

  // Packages tab — table view filtered by date with "View Package" per row
  const PackagesTab = () => {
    if (isLoading) {
      return <div className="py-10 text-center text-muted-foreground">Loading...</div>;
    }

    return (
      <div className="space-y-4">
        {/* Date filter */}
        <div className="flex items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input
              type="date"
              value={packageDate}
              onChange={(e) => setPackageDate(e.target.value)}
              className="h-9 w-[160px] text-sm"
            />
          </div>
          {packageDate && (
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setPackageDate("")}
            >
              Clear
            </Button>
          )}
        </div>

        {packageEvents.length === 0 ? (
          <div className="py-10 text-center text-muted-foreground">
            No events found{packageDate ? ` for ${formatDate(packageDate)}` : ""}.
          </div>
        ) : (
          <div className="rounded-md border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-muted/50 text-left">
                  <th className="px-4 py-3 font-semibold">Event</th>
                  <th className="px-4 py-3 font-semibold">Time</th>
                  <th className="px-4 py-3 font-semibold">Venue / Space</th>
                  <th className="px-4 py-3 font-semibold">PAX</th>
                  <th className="px-4 py-3 font-semibold">Package</th>
                  <th className="px-4 py-3 font-semibold"></th>
                </tr>
              </thead>
              <tbody>
                {packageEvents.map((event, i) => (
                  <tr
                    key={event.id}
                    className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}
                  >
                    <td className="px-4 py-3 font-medium">{getEventName(event)}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {event.facility ? facilityLabel(event.facility as FacilityEnum) : "General"}
                      {event.event_space ? ` — ${event.event_space}` : ""}
                    </td>
                    <td className="px-4 py-3">{event.pax ?? "—"}</td>
                    <td className="px-4 py-3">{event.package_name || <span className="text-muted-foreground">—</span>}</td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5"
                        onClick={() => openPackage(event)}
                      >
                        <FileText className="h-3.5 w-3.5" />
                        View Package
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Logistics Overview</h1>
          <p className="text-sm text-muted-foreground">
            Upcoming scheduled events grouped by type.
          </p>
        </div>

        {/* Global filters (hidden on Packages tab visually, but kept in state) */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">Filter Date</Label>
            <Input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="h-9 w-[160px] text-sm"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Filter Time</Label>
            <Input
              type="time"
              value={filterTime}
              onChange={(e) => setFilterTime(e.target.value)}
              className="h-9 w-[140px] text-sm"
            />
          </div>
          {(filterDate || filterTime) && (
            <Button
              variant="outline"
              className="h-9"
              onClick={() => { setFilterDate(""); setFilterTime(""); }}
            >
              Clear
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="all" className="w-full">
        <div className="flex justify-center mb-6">
          <TabsList className="h-10">
            <TabsTrigger value="all">All ({filteredEvents.length})</TabsTrigger>
            <TabsTrigger value="school_trips">School Trips ({schoolTrips.length})</TabsTrigger>
            <TabsTrigger value="birthday">Birthday ({birthdayParties.length})</TabsTrigger>
            <TabsTrigger value="hangout">Hangouts ({hangouts.length})</TabsTrigger>
            <TabsTrigger value="packages">Packages</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="mt-0">
          <EventList list={filteredEvents} />
        </TabsContent>
        <TabsContent value="school_trips" className="mt-0">
          <EventList list={schoolTrips} />
        </TabsContent>
        <TabsContent value="birthday" className="mt-0">
          <EventList list={birthdayParties} />
        </TabsContent>
        <TabsContent value="hangout" className="mt-0">
          <EventList list={hangouts} />
        </TabsContent>
        <TabsContent value="packages" className="mt-0">
          <PackagesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}