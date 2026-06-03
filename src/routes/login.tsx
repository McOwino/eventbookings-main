import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { SiteIdentityMark } from "@/components/SiteIdentityMark";
import { SITE_NAME } from "@/lib/site-branding";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import { PublicSiteFooter } from "@/components/public-site/PublicSiteFooter";
import { PublicSiteHeader } from "@/components/public-site/PublicSiteHeader";
import { PUBLIC_MAIN_PADDING, publicShellInnerStyle } from "@/lib/public-shell";

const fieldBg = "bg-white";

const pageShell: CSSProperties = {
  minHeight: "100vh",
  background: "#ffffff",
  fontFamily: "'Georgia', 'Times New Roman', serif",
};

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: `Admin sign in — ${SITE_NAME}` }] }),
  component: LoginPage,
});

const credSchema = z.object({
  email: z.string().trim().email("Invalid email").max(255),
  password: z.string().min(6, "At least 6 characters").max(72),
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleSignIn = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const parsed = credSchema.safeParse({
      email: fd.get("email"),
      password: fd.get("password"),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword(parsed.data);
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Signed in");
    navigate({ to: "/admin" });
  };

  return (
    <div className="flex min-h-screen flex-col" style={pageShell}>
      <PublicSiteHeader />

      <main
        className="shell-max flex flex-1 flex-col justify-center"
        style={{
          ...publicShellInnerStyle,
          padding: PUBLIC_MAIN_PADDING,
        }}
      >
        <div className="mx-auto w-full max-w-md">
          <form
            onSubmit={handleSignIn}
            className="rounded-2xl border border-[#e8e4de] bg-[#fcebeb] p-8 shadow-sm sm:p-10"
          >
            <div className="mb-6 flex items-center gap-3">
              <SiteIdentityMark height={40} />
              <div>
                <h1 className="text-lg font-semibold leading-tight">Admin sign in</h1>
                <p className="text-xs text-muted-foreground">
                  Sign in with email and password to manage events, promotions, and clearances.
                </p>
              </div>
            </div>

            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="signin-email">Email</Label>
                <Input
                  id="signin-email"
                  name="email"
                  type="email"
                  className={fieldBg}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="signin-password">Password</Label>
                <Input
                  id="signin-password"
                  name="password"
                  type="password"
                  className={fieldBg}
                  required
                  autoComplete="current-password"
                />
              </div>
              <Button
                type="submit"
                disabled={loading}
                className={cn(
                  "mt-2 h-10 w-full border-0 px-6 text-white shadow-sm",
                  "bg-[#C0272D] hover:bg-[#9e2227] focus-visible:ring-[#C0272D]/35",
                )}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
            </div>

            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link to="/" className="text-[#C0272D] underline-offset-2 hover:underline">
                Back to home
              </Link>
            </p>
          </form>
        </div>
      </main>

      <PublicSiteFooter />
    </div>
  );
}
