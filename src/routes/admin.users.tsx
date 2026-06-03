import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { ROLE_OPTIONS, type AppRoleEnum, roleLabel } from "@/lib/facility-utils";
import { Loader2, Plus, X, UserPlus, Eye, EyeOff, RefreshCw, Copy, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/admin/users")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: UsersPage,
});

interface ProfileWithRoles {
  user_id: string;
  display_name: string | null;
  email: string | null;
  roles: AppRoleEnum[];
}

function UsersPage() {
  const { isSuperAdmin } = useAuth();
  const qc = useQueryClient();
  const [adding, setAdding] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<ProfileWithRoles | null>(null);
  const [deleteInput, setDeleteInput] = useState("");

  const data = useQuery({
    queryKey: ["admin", "users-roles"],
    queryFn: async (): Promise<ProfileWithRoles[]> => {
      const [{ data: profiles, error: pe }, { data: roles, error: re }] = await Promise.all([
        supabase.from("profiles").select("user_id, display_name, email"),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (pe) throw pe;
      if (re) throw re;
      const byUser = new Map<string, AppRoleEnum[]>();
      (roles ?? []).forEach((r) => {
        const arr = byUser.get(r.user_id) ?? [];
        arr.push(r.role as AppRoleEnum);
        byUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({
        ...p,
        roles: byUser.get(p.user_id) ?? [],
      }));
    },
    enabled: isSuperAdmin,
  });

  const grant = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRoleEnum }) => {
      const { error } = await supabase
        .from("user_roles")
        .insert({ user_id: userId, role });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role granted");
      qc.invalidateQueries({ queryKey: ["admin", "users-roles"] });
      setAdding(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const revoke = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRoleEnum }) => {
      const { error } = await supabase
        .from("user_roles")
        .delete()
        .eq("user_id", userId)
        .eq("role", role);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Role revoked");
      qc.invalidateQueries({ queryKey: ["admin", "users-roles"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteUser = useMutation({
    mutationFn: async (userId: string) => {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { user_id: userId },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
    },
    onSuccess: () => {
      toast.success("Admin deleted");
      qc.invalidateQueries({ queryKey: ["admin", "users-roles"] });
      setDeleteTarget(null);
      setDeleteInput("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const submitDelete = () => {
    if (deleteInput.trim().toUpperCase() !== "YES") {
      toast.error("Type YES to confirm deletion");
      return;
    }
    if (deleteTarget) deleteUser.mutate(deleteTarget.user_id);
  };

  if (!isSuperAdmin) {
    return (
      <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
        Only super admins can manage users and roles.
      </CardContent></Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Users & roles</h1>
        <p className="text-sm text-muted-foreground">
          Grant or revoke role-based access for signed-up users.
        </p>
      </div>

      <CreateAdminCard onCreated={() => qc.invalidateQueries({ queryKey: ["admin", "users-roles"] })} />

      <Card>
        <CardContent className="overflow-x-auto p-0">
          {data.isLoading ? (
            <div className="py-10 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" /></div>
          ) : (data.data ?? []).length === 0 ? (
            <div className="py-10 text-center text-sm text-muted-foreground">No users yet.</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>User</TableHead>
                  <TableHead>Roles</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(data.data ?? []).map((u) => (
                  <TableRow key={u.user_id}>
                    <TableCell>
                      <div className="font-medium">{u.display_name || "Unnamed"}</div>
                      <div className="text-xs text-muted-foreground">{u.email}</div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {u.roles.length === 0 && (
                          <span className="text-xs text-muted-foreground">None</span>
                        )}
                        {u.roles.map((r) => (
                          <Badge key={r} variant="secondary" className="gap-1">
                            {roleLabel(r)}
                            <button
                              onClick={() => revoke.mutate({ userId: u.user_id, role: r })}
                              className="ml-1 rounded hover:bg-destructive/20"
                              aria-label={`Revoke ${r}`}
                            >
                              <X className="h-3 w-3" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {adding === u.user_id ? (
                        <div className="flex justify-end">
                          <AddRolePicker
                            existing={u.roles}
                            onPick={(role) => grant.mutate({ userId: u.user_id, role })}
                            onCancel={() => setAdding(null)}
                          />
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button size="sm" variant="outline" onClick={() => setAdding(u.user_id)}>
                            <Plus className="mr-1 h-3.5 w-3.5" /> Add role
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => { setDeleteTarget(u); setDeleteInput(""); }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={!!deleteTarget}
        onOpenChange={(o) => {
          if (!o) { setDeleteTarget(null); setDeleteInput(""); }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-destructive">Delete admin user?</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <strong>{deleteTarget?.display_name || deleteTarget?.email}</strong> from
              both the users table and Supabase Auth. This cannot be undone.
              <span className="mt-2 block">
                Type <span className="font-mono font-bold">YES</span> to confirm.
              </span>
            </DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            value={deleteInput}
            onChange={(e) => setDeleteInput(e.target.value)}
            placeholder="Type YES to confirm"
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); submitDelete(); } }}
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setDeleteInput(""); }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={submitDelete}
              disabled={deleteUser.isPending}
            >
              {deleteUser.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function AddRolePicker({
  existing, onPick, onCancel,
}: {
  existing: AppRoleEnum[];
  onPick: (role: AppRoleEnum) => void;
  onCancel: () => void;
}) {
  const [val, setVal] = useState<string>("");
  const available = ROLE_OPTIONS.filter((o) => !existing.includes(o.value));
  return (
    <div className="flex items-center gap-2">
      <Select value={val} onValueChange={setVal}>
        <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder="Select role" /></SelectTrigger>
        <SelectContent>
          {available.map((o) => (
            <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button size="sm" disabled={!val} onClick={() => val && onPick(val as AppRoleEnum)}>Save</Button>
      <Button size="sm" variant="ghost" onClick={onCancel}>Cancel</Button>
    </div>
  );
}

function generatePassword(len = 12) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
  let out = "";
  const arr = new Uint32Array(len);
  crypto.getRandomValues(arr);
  for (let i = 0; i < len; i++) out += chars[arr[i] % chars.length];
  return out;
}

function CreateAdminCard({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState(generatePassword());
  const [showPwd, setShowPwd] = useState(false);
  const [selectedRoles, setSelectedRoles] = useState<AppRoleEnum[]>([]);
  const [created, setCreated] = useState<{ email: string; password: string } | null>(null);

  const create = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("admin-create-user", {
        body: {
          email: email.trim().toLowerCase(),
          password,
          display_name: displayName.trim() || undefined,
          roles: selectedRoles,
        },
      });
      if (error) throw error;
      if ((data as { error?: string })?.error) throw new Error((data as { error: string }).error);
      return data as { ok: true; email: string };
    },
    onSuccess: (data) => {
      toast.success(`Admin created: ${data.email}`);
      setCreated({ email: data.email, password });
      setEmail("");
      setDisplayName("");
      setSelectedRoles([]);
      setPassword(generatePassword());
      onCreated();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleRole = (r: AppRoleEnum) =>
    setSelectedRoles((rs) => (rs.includes(r) ? rs.filter((x) => x !== r) : [...rs, r]));

  const copyCreds = async () => {
    if (!created) return;
    await navigator.clipboard.writeText(`Email: ${created.email}\nPassword: ${created.password}`);
    toast.success("Credentials copied");
  };

  if (!open) {
    return (
      <Card>
        <CardContent className="flex items-center justify-between p-4">
          <div>
            <p className="text-sm font-semibold">Add a new admin</p>
            <p className="text-xs text-muted-foreground">
              Create a user with email + initial password and assign roles. They can change their
              password later from their dashboard.
            </p>
          </div>
          <Button onClick={() => setOpen(true)}>
            <UserPlus className="mr-2 h-4 w-4" /> Add admin
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold">Create new admin</p>
          <Button variant="ghost" size="sm" onClick={() => { setOpen(false); setCreated(null); }}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="new-email">Email</Label>
            <Input
              id="new-email"
              type="email"
              autoComplete="off"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-name">Display name (optional)</Label>
            <Input
              id="new-name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Jane Doe"
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="new-pwd">Initial password</Label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Input
                id="new-pwd"
                type={showPwd ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pr-10 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPwd ? "Hide" : "Show"}
              >
                {showPwd ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
              <RefreshCw className="mr-1 h-3.5 w-3.5" /> Generate
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Min 8 characters. Share securely — the admin can change it from their dashboard.
          </p>
        </div>

        <div className="space-y-1.5">
          <Label>Assign roles</Label>
          <div className="flex flex-wrap gap-1.5">
            {ROLE_OPTIONS.map((o) => {
              const active = selectedRoles.includes(o.value);
              return (
                <button
                  key={o.value}
                  type="button"
                  onClick={() => toggleRole(o.value)}
                  className={`rounded-full border px-3 py-1 text-xs transition ${
                    active
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-border bg-background hover:bg-accent"
                  }`}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={() => { setOpen(false); setCreated(null); }}>
            Cancel
          </Button>
          <Button
            onClick={() => create.mutate()}
            disabled={
              create.isPending ||
              !email.trim() ||
              password.length < 8 ||
              selectedRoles.length === 0
            }
          >
            {create.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Create admin
          </Button>
        </div>

        {created && (
          <div className="rounded-md border border-primary/30 bg-primary/5 p-3 text-sm">
            <div className="mb-2 flex items-center justify-between">
              <p className="font-semibold">Save these credentials now</p>
              <Button size="sm" variant="outline" onClick={copyCreds}>
                <Copy className="mr-1 h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <p className="font-mono text-xs">Email: {created.email}</p>
            <p className="font-mono text-xs">Password: {created.password}</p>
            <p className="mt-2 text-xs text-muted-foreground">
              The new admin can sign in at /login and change their password from their dashboard.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
