import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FACILITY_OPTIONS, facilityLabel } from "@/lib/facility-utils";
import { PROMO_EDIT_ROLES } from "@/lib/roles";
import { Loader2, Plus, Pencil, Trash2, Image as ImageIcon } from "lucide-react";

export const Route = createFileRoute("/admin/promotions")({
  component: PromotionsPage,
});

const promoSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(500).optional().or(z.literal("")),
  facility: z.string().optional().or(z.literal("")),
  starts_at: z.string().optional().or(z.literal("")),
  ends_at: z.string().optional().or(z.literal("")),
  event_date: z.string().optional().or(z.literal("")),
});

interface PromoRow {
  id: string;
  title: string;
  description: string | null;
  facility: string | null;
  starts_at: string | null;
  ends_at: string | null;
  event_date: string | null;
  is_active: boolean;
  image_url: string | null;
}

function PromotionsPage() {
  const { roles, hasAnyRole, user } = useAuth();
  const canView = roles.length > 0;
  const canEdit = hasAnyRole(PROMO_EDIT_ROLES);
  const qc = useQueryClient();
  const [editing, setEditing] = useState<PromoRow | null>(null);
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  const promos = useQuery({
    queryKey: ["admin", "promotions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("promotions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as PromoRow[];
    },
  });

  const openCreate = () => {
    setEditing(null);
    setImageUrl(null);
    setOpen(true);
  };
  const openEdit = (p: PromoRow) => {
    setEditing(p);
    setImageUrl(p.image_url);
    setOpen(true);
  };

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user?.id ?? "anon"}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("promotions").upload(path, file, {
      upsert: false,
    });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("promotions").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  };

  const save = useMutation({
    mutationFn: async (input: z.infer<typeof promoSchema>) => {
      const payload = {
        title: input.title,
        description: input.description || null,
        facility: (input.facility || null) as PromoRow["facility"],
        starts_at: input.starts_at || null,
        ends_at: input.ends_at || null,
        event_date: input.event_date || null,
        image_url: imageUrl,
      };
      const client = supabase as unknown as {
        from: (t: string) => {
          update: (p: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
          insert: (p: unknown) => Promise<{ error: Error | null }>;
        };
      };
      if (editing) {
        const { error } = await client.from("promotions").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await client.from("promotions").insert({
          ...payload,
          is_active: true,
          created_by: user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Promotion updated" : "Promotion created");
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
      qc.invalidateQueries({ queryKey: ["public", "promotions"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase
        .from("promotions")
        .update({ is_active: active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
      qc.invalidateQueries({ queryKey: ["public", "promotions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("promotions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "promotions"] });
      qc.invalidateQueries({ queryKey: ["public", "promotions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd) as Record<string, string>;
    const parsed = promoSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    save.mutate(parsed.data);
  };

  if (!canView) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          You do not have access to promotions.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Promotions</h1>
          <p className="text-sm text-muted-foreground">
            What's shown on the public carousel.
          </p>
        </div>
        {canEdit && (
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> New promotion
          </Button>
        )}
      </div>

      <PromotionsVisibilityToggle />

      {promos.isLoading ? (
        <Card><CardContent className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : (promos.data ?? []).length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No promotions yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(promos.data ?? []).map((p) => (
            <Card key={p.id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {p.image_url ? (
                  <img src={p.image_url} alt={p.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <Badge className="absolute right-2 top-2" variant={p.is_active ? "default" : "secondary"}>
                  {p.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{p.title}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {facilityLabel(p.facility as never)} · {p.event_date ?? p.ends_at ?? "—"}
                    </p>
                  </div>
                  <Switch
                    checked={p.is_active}
                    onCheckedChange={(c) => toggle.mutate({ id: p.id, active: c })}
                  />
                </div>
                {p.description && (
                  <p className="line-clamp-2 text-xs text-muted-foreground">{p.description}</p>
                )}
                {canEdit && (
                  <div className="flex justify-end gap-1">
                    <Button size="sm" variant="outline" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm("Delete this promotion?")) remove.mutate(p.id);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit promotion" : "New promotion"}</DialogTitle>
            <DialogDescription>Shown on the public carousel when active.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input name="title" required maxLength={150} defaultValue={editing?.title ?? ""} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea name="description" maxLength={500} rows={3} defaultValue={editing?.description ?? ""} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <FacilitySelect defaultValue={editing?.facility ?? ""} />
              <div>
                <Label className="text-xs">Event date (if applicable)</Label>
                <Input name="event_date" type="date" defaultValue={editing?.event_date ?? ""} />
              </div>
              <div>
                <Label className="text-xs">Starts</Label>
                <Input name="starts_at" type="date" defaultValue={editing?.starts_at ?? ""} />
              </div>
              <div>
                <Label className="text-xs">Ends</Label>
                <Input name="ends_at" type="date" defaultValue={editing?.ends_at ?? ""} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Image</Label>
              <div className="mt-1 flex items-center gap-3">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-16 w-24 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded bg-muted">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {imageUrl ? "Replace" : "Upload"}
                </Button>
                {imageUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(null)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <FacilityShowcaseManager userId={user?.id ?? null} />
      <DocumentsManager userId={user?.id ?? null} />
    </div>
  );
}

function FacilitySelect({ defaultValue }: { defaultValue: string }) {
  const ALL = "__all__";
  const [val, setVal] = useState(defaultValue || ALL);
  return (
    <div>
      <Label className="text-xs">Facility (optional)</Label>
      <input type="hidden" name="facility" value={val === ALL ? "" : val} />
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger>
          <SelectValue placeholder="All facilities" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All facilities</SelectItem>
          {FACILITY_OPTIONS.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

// ============================================================
// Facility Showcase Manager (slides under "Our Facilities")
// ============================================================
interface ShowcaseRow {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  position: number;
  is_active: boolean;
}

const showcaseSchema = z.object({
  title: z.string().trim().min(1).max(150),
  description: z.string().trim().max(2000).optional().or(z.literal("")),
  position: z.coerce.number().int().min(0).default(0),
});

function FacilityShowcaseManager({ userId }: { userId: string | null }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ShowcaseRow | null>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const slides = useQuery({
    queryKey: ["admin", "facility_showcase"],
    queryFn: async () => {
      const { data, error } = await (supabase as unknown as {
        from: (t: string) => {
          select: (c: string) => {
            order: (c: string, o: { ascending: boolean }) => Promise<{ data: ShowcaseRow[] | null; error: Error | null }>;
          };
        };
      })
        .from("facility_showcase")
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as ShowcaseRow[];
    },
  });

  const upload = async (file: File) => {
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Max 5MB");
      return;
    }
    setUploading(true);
    const ext = file.name.split(".").pop() || "jpg";
    const path = `showcase/${userId ?? "anon"}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("promotions").upload(path, file, { upsert: false });
    if (error) {
      toast.error(error.message);
      setUploading(false);
      return;
    }
    const { data } = supabase.storage.from("promotions").getPublicUrl(path);
    setImageUrl(data.publicUrl);
    setUploading(false);
  };

  const openCreate = () => {
    setEditing(null);
    setImageUrl(null);
    setOpen(true);
  };
  const openEdit = (s: ShowcaseRow) => {
    setEditing(s);
    setImageUrl(s.image_url);
    setOpen(true);
  };

  const save = useMutation({
    mutationFn: async (input: z.infer<typeof showcaseSchema>) => {
      const payload = {
        title: input.title,
        description: input.description || null,
        position: input.position,
        image_url: imageUrl,
      };
      const client = supabase as unknown as {
        from: (t: string) => {
          update: (p: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
          insert: (p: unknown) => Promise<{ error: Error | null }>;
        };
      };
      if (editing) {
        const { error } = await client.from("facility_showcase").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await client.from("facility_showcase").insert({
          ...payload,
          is_active: true,
          created_by: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Slide updated" : "Slide added");
      qc.invalidateQueries({ queryKey: ["admin", "facility_showcase"] });
      qc.invalidateQueries({ queryKey: ["public", "facility_showcase"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const client = supabase as unknown as {
        from: (t: string) => {
          update: (p: unknown) => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
        };
      };
      const { error } = await client.from("facility_showcase").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "facility_showcase"] });
      qc.invalidateQueries({ queryKey: ["public", "facility_showcase"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const client = supabase as unknown as {
        from: (t: string) => {
          delete: () => { eq: (c: string, v: string) => Promise<{ error: Error | null }> };
        };
      };
      const { error } = await client.from("facility_showcase").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["admin", "facility_showcase"] });
      qc.invalidateQueries({ queryKey: ["public", "facility_showcase"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd) as Record<string, string>;
    const parsed = showcaseSchema.safeParse(raw);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    save.mutate(parsed.data);
  };

  return (
    <div className="space-y-4 border-t pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Our Facilities — Showcase Slides</h2>
          <p className="text-sm text-muted-foreground">
            Slides displayed in the public "Our Facilities" carousel.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New slide
        </Button>
      </div>

      {slides.isLoading ? (
        <Card><CardContent className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : (slides.data ?? []).length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">No facility slides yet.</CardContent></Card>
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(slides.data ?? []).map((s) => (
            <Card key={s.id} className="overflow-hidden">
              <div className="relative aspect-video bg-muted">
                {s.image_url ? (
                  <img src={s.image_url} alt={s.title} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center text-muted-foreground">
                    <ImageIcon className="h-8 w-8" />
                  </div>
                )}
                <Badge className="absolute right-2 top-2" variant={s.is_active ? "default" : "secondary"}>
                  {s.is_active ? "Active" : "Hidden"}
                </Badge>
                <Badge className="absolute left-2 top-2" variant="outline">
                  #{s.position}
                </Badge>
              </div>
              <CardContent className="space-y-2 p-3">
                <div className="flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-semibold">{s.title}</p>
                  <Switch
                    checked={s.is_active}
                    onCheckedChange={(c) => toggle.mutate({ id: s.id, active: c })}
                  />
                </div>
                {s.description && (
                  <p className="line-clamp-3 whitespace-pre-line text-xs text-muted-foreground">{s.description}</p>
                )}
                <div className="flex justify-end gap-1">
                  <Button size="sm" variant="outline" onClick={() => openEdit(s)}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      if (confirm("Delete this slide?")) remove.mutate(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit slide" : "New slide"}</DialogTitle>
            <DialogDescription>Appears in the public "Our Facilities" carousel.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <Label className="text-xs">Title</Label>
              <Input name="title" required maxLength={150} defaultValue={editing?.title ?? ""} />
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Textarea name="description" maxLength={2000} rows={5} defaultValue={editing?.description ?? ""} />
            </div>
            <div>
              <Label className="text-xs">Display order (lower shows first)</Label>
              <Input name="position" type="number" min={0} defaultValue={editing?.position ?? 0} />
            </div>

            <div>
              <Label className="text-xs">Image</Label>
              <div className="mt-1 flex items-center gap-3">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-16 w-24 rounded object-cover" />
                ) : (
                  <div className="flex h-16 w-24 items-center justify-center rounded bg-muted">
                    <ImageIcon className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) upload(f);
                  }}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                  {uploading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {imageUrl ? "Replace" : "Upload"}
                </Button>
                {imageUrl && (
                  <Button type="button" variant="ghost" size="sm" onClick={() => setImageUrl(null)}>
                    Remove
                  </Button>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Create"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function PromotionsVisibilityToggle() {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["app_settings", "promotions_visible"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "promotions_visible")
        .maybeSingle();
      if (error) throw error;
      return data?.value === true || data?.value === "true";
    },
  });

  const update = useMutation({
    mutationFn: async (visible: boolean) => {
      const { error } = await supabase
        .from("app_settings")
        .upsert({ key: "promotions_visible", value: visible, updated_at: new Date().toISOString() });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["app_settings", "promotions_visible"] });
      qc.invalidateQueries({ queryKey: ["public", "promotions"] });
      toast.success("Promotion visibility updated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardContent className="flex items-center justify-between gap-4 py-4">
        <div>
          <p className="font-semibold">Show promotions on public site</p>
          <p className="text-xs text-muted-foreground">
            Master switch — when off, the public promotions section is hidden regardless of individual statuses.
          </p>
        </div>
        <Switch
          checked={!!q.data}
          disabled={q.isLoading || update.isPending}
          onCheckedChange={(c) => update.mutate(c)}
        />
      </CardContent>
    </Card>
  );
}

// ── Types ─────────────────────────────────────────────────────────────────────
interface DocumentRow {
  id: string;
  label: string;
  description: string | null;
  category: string;
  url: string;
  file_type: string;
  position: number;
  is_active: boolean;
}

const DOCUMENT_CATEGORIES = [
  { value: "booking-guides", label: "Booking Guides" },
  { value: "menus",          label: "Menus" },
];

const docSchema = z.object({
  label:       z.string().trim().min(1).max(150),
  description: z.string().trim().max(300).optional().or(z.literal("")),
  category:    z.string().min(1),
  url:         z.string().url("Must be a valid URL"),
  file_type:   z.enum(["pdf", "image"]),
  position:    z.coerce.number().int().min(0).default(0),
});

function DocumentsManager({ userId }: { userId: string | null }) {
  const qc        = useQueryClient();
  const [open, setOpen]       = useState(false);
  const [editing, setEditing] = useState<DocumentRow | null>(null);
  const [uploading, setUploading] = useState(false);
  const [pdfUrl, setPdfUrl]   = useState<string | null>(null);
  const [dialogKey, setDialogKey] = useState(0);
  const fileRef               = useRef<HTMLInputElement>(null);

  const docs = useQuery({
    queryKey: ["admin", "public_documents"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("public_documents")
        .select("*")
        .order("category", { ascending: true })
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as DocumentRow[];
    },
  });

  const openCreate = () => {
    setEditing(null);
    setPdfUrl(null);
    setDialogKey((k) => k + 1);
    setOpen(true);
  };
  const openEdit   = (d: DocumentRow) => {
    setEditing(d);
    setPdfUrl(d.url);
    setDialogKey((k) => k + 1);
    setOpen(true);
  };

  // Upload PDF to Supabase Storage — same pattern as image upload in promotions
  const uploadPdf = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB per document"); return; }
    setUploading(true);
    const ext  = file.name.split(".").pop() || "pdf";
    const path = `docs/${userId ?? "anon"}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("docs").upload(path, file, { upsert: false });
    if (error) { toast.error(error.message); setUploading(false); return; }
    const { data } = supabase.storage.from("docs").getPublicUrl(path);
    setPdfUrl(data.publicUrl);
    setUploading(false);
    toast.success("File uploaded — URL filled in automatically");
  };

  const save = useMutation({
    mutationFn: async (input: z.infer<typeof docSchema>) => {
      const payload = {
        label:       input.label,
        description: input.description || null,
        category:    input.category,
        url:         pdfUrl ?? input.url,  // prefer uploaded URL, fallback to typed URL
        file_type:   input.file_type,
        position:    input.position,
      };
      if (editing) {
        const { error } = await supabase.from("public_documents").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("public_documents").insert({
          ...payload,
          is_active:  true,
          created_by: userId,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Document updated" : "Document added");
      qc.invalidateQueries({ queryKey: ["admin", "public_documents"] });
      qc.invalidateQueries({ queryKey: ["public", "documents"] });
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("public_documents").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "public_documents"] });
      qc.invalidateQueries({ queryKey: ["public", "documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("public_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Deleted");
      qc.invalidateQueries({ queryKey: ["admin", "public_documents"] });
      qc.invalidateQueries({ queryKey: ["public", "documents"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const raw = Object.fromEntries(fd) as Record<string, string>;
    const parsed = docSchema.safeParse(raw);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    save.mutate(parsed.data);
  };

  // Group for display
  const byCategory = DOCUMENT_CATEGORIES.map((cat) => ({
    ...cat,
    rows: (docs.data ?? []).filter((d) => d.category === cat.value),
  }));

  return (
    <div className="space-y-4 border-t pt-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold">Public Documents</h2>
          <p className="text-sm text-muted-foreground">
            Documents shown in the "Documents" dropdown on the public site.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Add document
        </Button>
      </div>

      {docs.isLoading ? (
        <Card><CardContent className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></CardContent></Card>
      ) : (
        // Render each category as a labelled group
        <div className="space-y-6">
          {byCategory.map((cat) => (
            <div key={cat.value}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                {cat.label}
              </p>
              {cat.rows.length === 0 ? (
                <Card>
                  <CardContent className="py-6 text-center text-sm text-muted-foreground">
                    No {cat.label.toLowerCase()} added yet.
                  </CardContent>
                </Card>
              ) : (
                <div className="rounded-md border overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-muted/50 text-left">
                        <th className="px-3 py-2 font-semibold">Document</th>
                        <th className="px-3 py-2 font-semibold">Description</th>
                        <th className="px-3 py-2 font-semibold">Type</th>
                        <th className="px-3 py-2 font-semibold">Order</th>
                        <th className="px-3 py-2 font-semibold">Visible</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {cat.rows.map((d, i) => (
                        <tr key={d.id} className={i % 2 === 0 ? "bg-white" : "bg-muted/20"}>
                          <td className="px-3 py-2 font-medium">{d.label}</td>
                          <td className="px-3 py-2 text-muted-foreground text-xs max-w-[200px] truncate">
                            {d.description ?? "—"}
                          </td>
                          <td className="px-3 py-2">
                            <Badge variant="outline">{d.file_type.toUpperCase()}</Badge>
                          </td>
                          <td className="px-3 py-2 text-muted-foreground">#{d.position}</td>
                          <td className="px-3 py-2">
                            <Switch
                              checked={d.is_active}
                              onCheckedChange={(c) => toggle.mutate({ id: d.id, active: c })}
                            />
                          </td>
                          <td className="px-3 py-2 text-right">
                            <div className="flex justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => openEdit(d)}>
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm" variant="outline"
                                onClick={() => { if (confirm("Delete this document?")) remove.mutate(d.id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit dialog */}
      <Dialog key={dialogKey} open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit document" : "Add document"}</DialogTitle>
            <DialogDescription>
              Shown in the Documents dropdown on the public site.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-3">
            {/* Label */}
            <div>
              <Label className="text-xs">Document name <span className="text-red-500">*</span></Label>
              <Input name="label" required maxLength={150} defaultValue={editing?.label ?? ""} />
            </div>

            {/* Description */}
            <div>
              <Label className="text-xs">Short description</Label>
              <Input name="description" maxLength={300} defaultValue={editing?.description ?? ""} />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {/* Category */}
              <CategorySelect defaultValue={editing?.category ?? "booking-guides"} />

              {/* File type */}
              <FileTypeSelect defaultValue={(editing?.file_type ?? "pdf") as "pdf" | "image"} />

              {/* Sort order */}
              <div>
                <Label className="text-xs">Display order (lower = first)</Label>
                <Input name="position" type="number" min={0} defaultValue={editing?.position ?? 0} />
              </div>
            </div>

            {/* URL — upload OR paste */}
            <div>
              <Label className="text-xs">Document URL <span className="text-red-500">*</span></Label>
              <div className="flex gap-2 mt-1">
                <Input
                  name="url_display"
                  type="url"
                  placeholder="https://…"
                  value={pdfUrl ?? ""}
                  onChange={(e) => setPdfUrl(e.target.value)}
                  className="flex-1"
                />
                <input type="hidden" name="url" value={pdfUrl ?? ""} />
                <input
                  ref={fileRef}
                  type="file"
                  accept=".pdf,image/*"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) uploadPdf(f); }}
                />
                <Button
                  type="button" variant="outline" size="sm"
                  onClick={() => fileRef.current?.click()}
                  disabled={uploading}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Upload"}
                </Button>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Upload a new file OR paste a Supabase Storage URL directly.
              </p>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editing ? "Save changes" : "Add document"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Small select helpers ───────────────────────────────────────────────────────
function CategorySelect({ defaultValue }: { defaultValue: string }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div>
      <Label className="text-xs">Category <span className="text-red-500">*</span></Label>
      <input type="hidden" name="category" value={val} />
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          {DOCUMENT_CATEGORIES.map((c) => (
            <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

function FileTypeSelect({ defaultValue }: { defaultValue: "pdf" | "image" }) {
  const [val, setVal] = useState(defaultValue);
  return (
    <div>
      <Label className="text-xs">File type</Label>
      <input type="hidden" name="file_type" value={val} />
      <Select value={val} onValueChange={(v) => setVal(v as "pdf" | "image")}>
        <SelectTrigger><SelectValue /></SelectTrigger>
        <SelectContent>
          <SelectItem value="pdf">PDF</SelectItem>
          <SelectItem value="image">Image</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
