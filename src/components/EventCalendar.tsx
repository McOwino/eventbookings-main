import { useMemo, useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import {
  type PublicEvent,
  eventsForDate,
  facilityColorClass,
  toLocalYmd,
} from "@/lib/events-data";
import { cn } from "@/lib/utils";

function statusVariant(status: PublicEvent["status"]) {
  if (status === "Confirmed") return "default";
  if (status === "Tentative") return "secondary";
  return "destructive";
}

export function EventCalendar({
  events,
  loading = false,
}: {
  events: PublicEvent[];
  loading?: boolean;
}) {
  const [selected, setSelected] = useState<Date>(new Date());

  const eventDayKeys = useMemo(
    () => new Set(events.map((e) => e.date)),
    [events],
  );

  const isEventDay = (date: Date) => eventDayKeys.has(toLocalYmd(date));

  const dayEvents = eventsForDate(events, selected);

  return (
    <div className="grid gap-6 lg:grid-cols-[auto_1fr]">
      <div className="rounded-2xl border bg-card p-2 shadow-sm">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={(d) => d && setSelected(d)}
          modifiers={{ hasEvent: isEventDay }}
          modifiersClassNames={{
            hasEvent:
              "bg-event-day/20 text-foreground font-semibold rounded-md hover:bg-event-day/30",
          }}
          className={cn("p-3 pointer-events-auto")}
        />
        <div className="flex flex-wrap items-center gap-3 border-t px-4 py-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-event-day/40" />
            Has events
          </div>
          <div className="flex items-center gap-1.5">
            <span className="inline-block h-3 w-3 rounded-sm bg-muted" />
            No events
          </div>
        </div>
      </div>

      <div>
        <div className="mb-3 flex items-baseline justify-between">
          <h3 className="text-lg font-semibold">
            {selected.toLocaleDateString(undefined, {
              weekday: "long",
              month: "long",
              day: "numeric",
            })}
          </h3>
          <span className="text-sm text-muted-foreground">
            {dayEvents.length} event{dayEvents.length === 1 ? "" : "s"}
          </span>
        </div>

        {dayEvents.length === 0 ? (
          <div className="rounded-xl border border-dashed bg-card/50 p-10 text-center text-sm text-muted-foreground">
            No events scheduled for this date.
          </div>
        ) : (
          <ul className="space-y-3">
            {dayEvents.map((e) => (
              <li
                key={e.id}
                className="flex items-stretch overflow-hidden rounded-xl border bg-card shadow-sm"
              >
                <div className={cn("w-2 shrink-0", facilityColorClass[e.facility])} />
                <div className="flex flex-1 flex-wrap items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="font-semibold">{e.name}</div>
                    <div className="mt-0.5 text-sm text-muted-foreground">
                      <EventStatusTag status={e.status} />
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {e.facility} · {e.type}
                    </div>
                    {e.event_space ? (
                      <div className="mt-0.5 text-sm text-muted-foreground">{e.event_space}</div>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm tabular-nums text-muted-foreground">
                      {e.startTime}–{e.endTime}
                    </span>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}

        <FacilityLegend />
      </div>
    </div>
  );
}

function FacilityLegend() {
  return (
    <div className="mt-6 rounded-xl border bg-muted/30 p-4">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Facility colors
      </div>
      <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
        {Object.entries(facilityColorClass).map(([name, cls]) => (
          <div key={name} className="flex items-center gap-2">
            <span className={cn("inline-block h-3 w-3 rounded-sm", cls)} />
            {name}
          </div>
        ))}
      </div>
    </div>
  );
}
