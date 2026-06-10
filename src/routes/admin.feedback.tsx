import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, RotateCcw, Filter } from "lucide-react";
import { FACILITY_OPTIONS } from "@/lib/facility-utils";
import { toast } from "sonner";
// DocumentsDropdown removed from feedback header per request

export const Route = createFileRoute("/admin/feedback")({
  component: AdminFeedback,
});

interface FeedbackRow {
  id: string;
  name: string;
  contact: string;
  facility: string;
  nature_of_visit: string;
  score: number;
  satisfaction_level: string;
  comments: string | null;
  created_at: string;
}

const LEVELS = ["excellent", "good", "poor", "very poor"] as const;

function levelStyles(level: string) {
  switch (level) {
    case "excellent":
      return "bg-green-500/15 text-green-700 dark:text-green-400";
    case "good":
      return "bg-yellow-500/15 text-yellow-700 dark:text-yellow-400";
    case "poor":
      return "bg-orange-500/15 text-orange-700 dark:text-orange-400";
    default:
      return "bg-red-500/15 text-red-700 dark:text-red-400";
  }
}

function capitalize(s: string) {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/** Maps a 0-10 score to a 1-5 star visual count. */
function scoreToStars(score: number): number {
  return Math.round((score / 10) * 5);
}

function escapeCsv(v: string) {
  return `"${v.replace(/"/g, '""')}"`;
}

function AdminFeedback() {
  const { roles } = useAuth();
  const qc = useQueryClient();

  useEffect(() => {
    const channel = supabase
      .channel("admin-feedback-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "feedback" },
        () => { qc.invalidateQueries({ queryKey: ["admin", "feedback"] }); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [qc]);

  const [facility, setFacility] = useState<string>("all");
  const [level, setLevel] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You do not have access to this page.
        </CardContent>
      </Card>
    );
  }

  const { data, isLoading } = useQuery({
    queryKey: ["admin", "feedback"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);
      if (error) throw error;
      return data as FeedbackRow[];
    },
  });

  // ── Testimonial panel state ──────────────────────────────────────────
  const [tMinScore, setTMinScore]     = useState(7);
  const [tMaxCards, setTMaxCards]     = useState(10);
  const [tShuffle, setTShuffle]       = useState(true);
  const [tAutoplay, setTAutoplay]     = useState(true);
  const [tSpeed, setTSpeed]           = useState(5000);
  const [tIndex, setTIndex]           = useState(0);
  const [tPlaying, setTPlaying]       = useState(false);
  const [isSaving, setIsSaving]       = useState(false);
  
  const tTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load saved settings from DB on mount
  useEffect(() => {
    (supabase as any)
      .from("testimonial_settings")
      .select("min_score, max_cards, shuffle, autoplay, speed_ms")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (!data) return;
        setTMinScore(data.min_score);
        setTMaxCards(data.max_cards);
        setTShuffle(data.shuffle);
        setTAutoplay(data.autoplay);
        setTSpeed(data.speed_ms);
      });
  }, []);

  const filtered = useMemo(() => {
    const rows = data ?? [];
    return rows.filter((r) => {
      if (facility !== "all" && r.facility !== facility) return false;
      if (level !== "all" && r.satisfaction_level !== level) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !r.name.toLowerCase().includes(s) &&
          !r.contact.toLowerCase().includes(s)
        )
          return false;
      }
      const t = new Date(r.created_at).getTime();
      if (start && t < new Date(start).getTime()) return false;
      if (end && t > new Date(end + "T23:59:59").getTime()) return false;
      return true;
    });
  }, [data, facility, level, search, start, end]);

  const summary = useMemo(() => {
    if (filtered.length === 0) return null;
    const total = filtered.length;
    const avg = (filtered.reduce((a, b) => a + b.score, 0) / total).toFixed(2);
    const facilityScores: Record<string, { sum: number; count: number }> = {};
    for (const r of filtered) {
      const f = (facilityScores[r.facility] ??= { sum: 0, count: 0 });
      f.sum += r.score;
      f.count += 1;
    }
    let bestFacility = "";
    let bestAvg = -1;
    let mostFacility = "";
    let mostCount = -1;
    for (const [f, v] of Object.entries(facilityScores)) {
      const a = v.sum / v.count;
      if (a > bestAvg) {
        bestAvg = a;
        bestFacility = f;
      }
      if (v.count > mostCount) {
        mostCount = v.count;
        mostFacility = f;
      }
    }
    return { total, avg, bestFacility, bestAvg, mostFacility, mostCount };
  }, [filtered]);

  const reset = () => {
    setFacility("all");
    setLevel("all");
    setSearch("");
    setStart("");
    setEnd("");
  };

  const exportCsv = () => {
    const header = ["Name", "Contact", "Facility", "Nature of Visit", "Score", "Level", "Comments", "Date"];
    const rows = filtered.map((r) => [
      r.name,
      r.contact,
      r.facility,
      r.nature_of_visit ?? "",
      String(r.score),
      capitalize(r.satisfaction_level),
      r.comments ?? "",
      new Date(r.created_at).toLocaleString(),
    ]);
    const csv = [header, ...rows].map((r) => r.map(escapeCsv).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "feedback_export.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  const facilityNames = useMemo(() => {
    const set = new Set<string>(FACILITY_OPTIONS.map((f) => f.label));
    set.add("General");
    (data ?? []).forEach((r) => set.add(r.facility));
    return Array.from(set);
  }, [data]);

  const testimonialPool = useMemo(() => {
    const qualifying = (data ?? []).filter((r) => r.score >= tMinScore);
    const pool = tShuffle ? [...qualifying].sort(() => Math.random() - 0.5) : qualifying;
    return pool.slice(0, tMaxCards);
  }, [data, tMinScore, tMaxCards, tShuffle]);

  const tEntry = testimonialPool[tIndex] ?? null;
  const tTotal = testimonialPool.length;

  const tStopPlay = useCallback(() => {
    setTPlaying(false);
    if (tTimerRef.current) clearInterval(tTimerRef.current);
  }, []);

  const tNext = useCallback(() => {
    setTIndex((i) => (i + 1) % Math.max(tTotal, 1));
  }, [tTotal]);

  const tTogglePlay = useCallback(() => {
    setTPlaying((p) => {
      if (p) { if (tTimerRef.current) clearInterval(tTimerRef.current); return false; }
      tTimerRef.current = setInterval(() => setTIndex((i) => (i + 1) % Math.max(tTotal, 1)), tSpeed);
      return true;
    });
  }, [tTotal, tSpeed]);

  const saveSettings = async () => {
    setIsSaving(true);
    const { error } = await (supabase as any)
      .from("testimonial_settings")
      .update({
        min_score:  tMinScore,
        max_cards:  tMaxCards,
        shuffle:    tShuffle,
        autoplay:   tAutoplay,
        speed_ms:   tSpeed,
        updated_at: new Date().toISOString(),
      })
      .eq("id", 1);
      
    setIsSaving(false);
    if (error) {
      toast.error("Failed to save settings: " + error.message);
    } else {
      toast.success("Settings saved to public carousel!");
    }
  };

  useEffect(() => { setTIndex(0); tStopPlay(); }, [testimonialPool, tStopPlay]);
  useEffect(() => () => { if (tTimerRef.current) clearInterval(tTimerRef.current); }, []);

  return (
    <div className="space-y-6">
      {/* ── TESTIMONIAL ADMIN PANEL ─────────────────────────────────────── */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <span style={{ color: "#C0272D", fontSize: 18 }}>❝</span>
            Testimonial Display Settings
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-0.5">Controls which feedback appears in the public testimonial carousel. Score range: 0 – 10.</p>
        </CardHeader>

        <CardContent className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 items-end">
            <div className="space-y-1.5">
              <Label className="text-xs">Min score (0-10)</Label>
              <Select value={String(tMinScore)} onValueChange={(v) => { tStopPlay(); setTMinScore(Number(v)); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[0,1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n}+ &nbsp;
                      <span style={{ color: "#C0272D" }}>{"★".repeat(scoreToStars(n))}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Max cards shown</Label>
              <Select value={String(tMaxCards)} onValueChange={(v) => { tStopPlay(); setTMaxCards(Number(v)); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {[5,10,20,50].map((n) => (<SelectItem key={n} value={String(n)}>{n}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Auto-play speed</Label>
              <Select value={String(tSpeed)} onValueChange={(v) => { tStopPlay(); setTSpeed(Number(v)); }}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3000">Fast (3 s)</SelectItem>
                  <SelectItem value="5000">Normal (5 s)</SelectItem>
                  <SelectItem value="8000">Slow (8 s)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Shuffle order</Label>
              <div className="flex items-center gap-2 h-10">
                <input type="checkbox" id="t-shuffle" checked={tShuffle} onChange={(e) => { tStopPlay(); setTShuffle(e.target.checked); }} className="h-4 w-4 accent-[#C0272D]" />
                <label htmlFor="t-shuffle" className="text-sm cursor-pointer">{tShuffle ? "On" : "Off"}</label>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Auto-play on load</Label>
              <div className="flex items-center gap-2 h-10">
                <input type="checkbox" id="t-autoplay" checked={tAutoplay} onChange={(e) => setTAutoplay(e.target.checked)} className="h-4 w-4 accent-[#C0272D]" />
                <label htmlFor="t-autoplay" className="text-sm cursor-pointer">{tAutoplay ? "On" : "Off"}</label>
              </div>
            </div>
          </div>

          <p className="text-xs text-muted-foreground">{testimonialPool.length} of {(data ?? []).filter((r) => r.score >= tMinScore).length} qualifying entries shown (score ≥ {tMinScore}/10 {" · "}≈ {scoreToStars(tMinScore)}/5 stars displayed).</p>

          {tEntry ? (
            <div className="rounded-2xl border bg-muted/30 p-6 text-center relative max-w-lg mx-auto">
              <div style={{ position: "absolute", top: -18, left: "50%", transform: "translateX(-50%)", width: 38, height: 38, borderRadius: "50%", background: "#C0272D", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 30, boxShadow: "0 3px 12px rgba(192,39,45,0.3)" }}>❝</div>
              <p className="italic text-sm leading-relaxed text-foreground mt-2 mb-4">"{tEntry.comments || "Great experience!"}"</p>
              <div style={{ width: 48, height: 1, background: "linear-gradient(90deg, transparent, #C0272D, transparent)", margin: "0 auto 12px" }} />
              <p className="text-sm font-medium text-foreground mb-2" style={{ fontStyle: "italic" }}>{tEntry.name}</p>
              <div className="flex justify-center flex-wrap gap-2 mb-3">
                <span className="text-xs px-3 py-0.5 rounded-full bg-[#FCEBEB] text-[#791F1F] font-medium">📍 {tEntry.facility}</span>
                <span className="text-xs px-3 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Score {tEntry.score}/10</span>
                <span className={`text-xs px-3 py-0.5 rounded-full font-medium ${levelStyles(tEntry.satisfaction_level)}`}>{capitalize(tEntry.satisfaction_level)}</span>
              </div>
              <div className="flex justify-center gap-0.5 mb-4">{Array.from({ length: 5 }, (_, i) => (<span key={i} style={{ fontSize: 18, color: i < scoreToStars(tEntry.score) ? "#C0272D" : "#e8e4de" }}>★</span>))}</div>
              <div className="flex items-center justify-center gap-3">
                <button type="button" onClick={() => { tStopPlay(); setTIndex((i) => (i - 1 + tTotal) % tTotal); }} className="w-9 h-9 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">←</button>
                <button type="button" onClick={tTogglePlay} className="w-11 h-11 rounded-full flex items-center justify-center text-white text-lg transition-all" style={{ background: "#C0272D", boxShadow: "0 3px 12px rgba(192,39,45,0.3)" }}>{tPlaying ? "⏸" : "▶"}</button>
                <button type="button" onClick={() => { tStopPlay(); tNext(); }} className="w-9 h-9 rounded-full border flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors">→</button>
                <span className="text-xs text-muted-foreground ml-1">{tIndex + 1} / {tTotal}</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed p-8 text-center text-muted-foreground text-sm">No feedback meets the current minimum score ({tMinScore}/10). Lower the threshold to preview testimonials.</div>
          )}

          <div className="flex justify-end pt-2 border-t">
            <Button
              size="sm"
              className="bg-[#C0272D] hover:bg-[#a82227] text-white"
              onClick={saveSettings}
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save to Public Carousel"}
            </Button>
          </div>
        </CardContent>
      </Card>
      {/* ── END TESTIMONIAL ADMIN PANEL ─────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold">Feedback</h1>
        <p className="text-sm text-muted-foreground">
          Customer feedback submitted from the public form.
        </p>
      </div>
      {/* DocumentsDropdown removed from feedback header */}

      {summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total feedback</p>
              <p className="text-2xl font-semibold">{summary.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Average score</p>
              <p className="text-2xl font-semibold">{summary.avg}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Best performing</p>
              <p className="text-base font-semibold">{summary.bestFacility}</p>
              <p className="text-xs text-muted-foreground">avg {summary.bestAvg.toFixed(2)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Most feedback</p>
              <p className="text-base font-semibold">{summary.mostFacility}</p>
              <p className="text-xs text-muted-foreground">{summary.mostCount} entries</p>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Filter className="h-4 w-4" /> Filters
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          <div className="space-y-1.5">
            <Label className="text-xs">Facility</Label>
            <Select value={facility} onValueChange={setFacility}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All facilities</SelectItem>
                {facilityNames.map((f) => (
                  <SelectItem key={f} value={f}>
                    {f}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Level</Label>
            <Select value={level} onValueChange={setLevel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All levels</SelectItem>
                {LEVELS.map((l) => (
                  <SelectItem key={l} value={l}>
                    {capitalize(l)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Search name/contact</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search..." />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Start date</Label>
            <Input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">End date</Label>
            <Input type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="mr-1 h-4 w-4" /> Reset
            </Button>
            <Button size="sm" onClick={exportCsv}>
              <Download className="mr-1 h-4 w-4" /> CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[720px]">
              <thead className="border-b bg-muted/50">
                <tr className="text-left">
                  <th className="px-3 py-2">Name</th>
                  <th className="px-3 py-2">Contact</th>
                  <th className="px-3 py-2">Facility</th>
                  <th className="px-3 py-2">Nature of Visit</th>
                  <th className="px-3 py-2">Score</th>
                  <th className="px-3 py-2">Level</th>
                  <th className="px-3 py-2">Comments</th>
                  <th className="px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      Loading...
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-3 py-6 text-center text-muted-foreground">
                      No feedback found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-b-0">
                      <td className="px-3 py-2">{r.name}</td>
                      <td className="px-3 py-2">{r.contact}</td>
                      <td className="px-3 py-2">{r.facility}</td>
                      <td className="px-3 py-2">{r.nature_of_visit}</td>
                      <td className="px-3 py-2 font-semibold">{r.score}</td>
                      <td className="px-3 py-2">
                        <span
                          className={`inline-block rounded-md px-2 py-0.5 text-xs font-medium ${levelStyles(
                            r.satisfaction_level,
                          )}`}
                        >
                          {capitalize(r.satisfaction_level)}
                        </span>
                      </td>
                      <td className="px-3 py-2 max-w-xs truncate" title={r.comments ?? ""}>
                        {r.comments}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                        {new Date(r.created_at).toLocaleString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}