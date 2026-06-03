import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, MapPin, CalendarDays } from "lucide-react";
import { publicTournamentsQueryOptions, formatDays, formatFacility, type TournamentRow } from "@/lib/tournaments";

function Countdown({ endDate }: { endDate: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const end = new Date(endDate + "T23:59:59").getTime();
  const diff = Math.max(0, end - now);
  const d = Math.floor(diff / 86400000);
  const h = Math.floor((diff % 86400000) / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return (
    <span className="font-mono text-xs tabular-nums">
      {d}d {String(h).padStart(2, "0")}h {String(m).padStart(2, "0")}m {String(s).padStart(2, "0")}s
    </span>
  );
}

function TournamentCard({ t }: { t: TournamentRow }) {
  const noDays = !t.days_of_week || t.days_of_week.length === 0;
  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Trophy className="h-4 w-4 text-primary" />
            {t.name}
          </CardTitle>
          {noDays ? (
            <Badge variant="default">Active</Badge>
          ) : (
            <Badge variant="secondary">{formatDays(t.days_of_week)}</Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2 text-sm">
        <div className="flex items-center gap-2 text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          {formatFacility(t.facility)}
        </div>
        <div className="flex items-center gap-2 text-muted-foreground">
          <CalendarDays className="h-3.5 w-3.5" />
          {t.start_date} → {t.end_date}
        </div>
        {t.description ? (
          <p className="text-muted-foreground">{t.description}</p>
        ) : null}
        {noDays ? (
          <div className="rounded-md border bg-muted/40 px-2 py-1.5 text-xs">
            Ends in <Countdown endDate={t.end_date} />
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export function TournamentsSection() {
  const { data, isLoading } = useQuery(publicTournamentsQueryOptions());
  const tournaments = data ?? [];

  return (
    <section className="mx-auto max-w-6xl px-4 sm:px-6">
      <h2 className="mb-4 text-lg font-semibold">Leagues & Tournaments</h2>
      {isLoading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : tournaments.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No active leagues or tournaments right now. Check back soon!
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {tournaments.map((t) => (
            <TournamentCard key={t.id} t={t} />
          ))}
        </div>
      )}
    </section>
  );
}
