import { Link, Outlet, useLocation, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/hooks/use-auth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  CalendarDays,
  Megaphone,
  CreditCard,
  Users,
  LogOut,
  LayoutDashboard,
  Menu,
  KeyRound,
  Trophy,
  Phone,
  Baby,
  MessageSquare,
  Truck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { VM_PAGE_BG } from "@/lib/facility-colors";
import { SiteIdentityMark } from "@/components/SiteIdentityMark";
import { SITE_NAME } from "@/lib/site-branding";
import { useState } from "react";
import type { AppRoleEnum } from "@/lib/facility-utils";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  requireAnyRole?: AppRoleEnum[];
  requireSuperAdmin?: boolean;
}

const NAV: NavItem[] = [
  { to: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { to: "/admin/call-logs", label: "Call Centre", icon: Phone },
  { to: "/admin/bookings", label: "Bookings", icon: CalendarDays },
  { to: "/admin/logistics", label: "Logistics", icon: Truck, requireAnyRole: ["super_admin", "logistics_executive"] },
  {
    to: "/admin/payments",
    label: "Payments",
    icon: CreditCard,
    requireAnyRole: ["super_admin", "general_executive", "sales_executive", "clearance_executive"],
  },
  { to: "/admin/kids-club", label: "Membership", icon: Baby },
  { to: "/admin/tournaments", label: "Timed Events", icon: Trophy },
  {
    to: "/admin/promotions",
    label: "Promotions",
    icon: Megaphone,
    requireAnyRole: ["marketing_executive", "super_admin"],
  },
  { to: "/admin/feedback", label: "Feedback", icon: MessageSquare },
  { to: "/admin/account", label: "My Account", icon: KeyRound },
  { to: "/admin/users", label: "Users & Roles", icon: Users, requireSuperAdmin: true },
];

export function AdminShell() {
  const { user, roles, isSuperAdmin, hasAnyRole, signOut } = useAuth();
  const { data: newLeadsCount = 0 } = useQuery({
    queryKey: ["admin", "leads", "new-count", "sidebar"],
    queryFn: async () => {
      const { data: _d, count, error } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const { data: expiringMembersCount = 0 } = useQuery({
    queryKey: ["admin", "memberships", "expiring-count", "sidebar"],
    queryFn: async () => {
      const today = new Date();
      const nextMonth = new Date(today);
      nextMonth.setDate(today.getDate() + 30);

      const { count, error } = await (supabase as any)
        .from("memberships")
        .select("id", { count: "exact", head: true })
        .gte("membership_expiry", today.toISOString().split("T")[0])
        .lte("membership_expiry", nextMonth.toISOString().split("T")[0]);

      if (error) throw error;
      return count ?? 0;
    },
    staleTime: 30_000,
  });

  const { data: approaching75Count = 0 } = useQuery({
    queryKey: ["admin", "memberships", "75percent-count", "sidebar"],
    queryFn: async () => {
      const now = Date.now();
      const { data, error } = await (supabase as any)
        .from("memberships")
        .select("id, membership_start, membership_expiry");

      if (error) throw error;

      const count = (data ?? []).filter((m: any) => {
        try {
          const start = new Date(m.membership_start).getTime();
          const end = new Date(m.membership_expiry).getTime();
          if (Number.isNaN(start) || Number.isNaN(end) || end <= start) return false;
          const threshold = start + Math.floor((end - start) * 0.75);
          return now >= threshold && now < end;
        } catch {
          return false;
        }
      }).length;

      return count;
    },
    staleTime: 30_000,
  });

  // Check which alerts are dismissed from localStorage
  const expiringAlertDismissed = typeof window !== "undefined" && localStorage.getItem("kids-club-dismissed-expiring") === "true";
  const percent75AlertDismissed = typeof window !== "undefined" && localStorage.getItem("kids-club-dismissed-75percent") === "true";

  // Calculate visible alert count
  const visibleAlertCount = (expiringAlertDismissed ? 0 : expiringMembersCount) + (percent75AlertDismissed ? 0 : approaching75Count);

  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const visible = NAV.filter((n) => {
    if (n.requireSuperAdmin) return isSuperAdmin;
    if (n.requireAnyRole) return isSuperAdmin || hasAnyRole(n.requireAnyRole);
    return true;
  });

  const handleLogout = async () => {
    await signOut();
    navigate({ to: "/login" });
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#fcebeb" }}>
      {/* Mobile top bar */}
      <header className="sticky top-0 z-30 flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background"
          aria-label="Toggle menu"
        >
          <Menu className="h-4 w-4" />
        </button>
        <div className="flex items-center gap-2">
          <SiteIdentityMark height={28} linkToHome />
          <span className="text-sm font-semibold">Admin</span>
        </div>
        <Button size="sm" variant="ghost" onClick={handleLogout}>
          <LogOut className="h-4 w-4" />
        </Button>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-64 border-r bg-card transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0",
            open ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="flex h-full flex-col">
            <div className="border-b p-4">
              <div className="flex items-center gap-2.5">
                <SiteIdentityMark height={32} />
                <div className="min-w-0">
                  <p className="text-sm font-bold leading-tight">{SITE_NAME}</p>
                  <p className="text-[11px] font-medium text-muted-foreground">Admin</p>
                </div>
              </div>
              <p className="mt-2 truncate text-xs text-muted-foreground">{user?.email}</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {roles.length === 0 ? (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                    No roles
                  </span>
                ) : (
                  roles.slice(0, 3).map((r) => (
                    <span key={r} className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">
                      {r.replace(/_/g, " ")}
                    </span>
                  ))
                )}
              </div>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto p-3">
              {visible.map((item) => {
                const Icon = item.icon;
                const active =
                  item.to === "/admin"
                    ? location.pathname === "/admin"
                    : location.pathname.startsWith(item.to);
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "text-foreground hover:bg-accent",
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    <div className="flex items-center gap-2">
                      <span>{item.label}</span>
                      {item.to === "/admin/bookings" && newLeadsCount > 0 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-red-600 text-white text-[11px] font-semibold px-2 py-0.5">
                          {newLeadsCount}
                        </span>
                      )}
                      {item.to === "/admin/kids-club" && visibleAlertCount > 0 && (
                        <span className="inline-flex items-center justify-center rounded-full bg-amber-500 text-white text-[11px] font-semibold px-2 py-0.5">
                          {visibleAlertCount}
                        </span>
                      )}
                    </div>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t p-3">
              <Button size="sm" className="w-full bg-[#C0272D] hover:bg-[#9e2227] text-white border-0" onClick={handleLogout}>
                <LogOut className="mr-2 h-4 w-4" /> Sign out
              </Button>
              <Link
                to="/"
                className="mt-2 block text-center text-xs text-muted-foreground hover:underline"
              >
                ← Back to public site
              </Link>
            </div>
          </div>
        </aside>

        {open && (
          <div
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            onClick={() => setOpen(false)}
          />
        )}

        {/* Main */}
        <main className="flex-1 min-w-0 overflow-x-hidden px-4 py-6 sm:px-6 lg:px-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
