// Edge function: create a new admin user (super-admin only)
// Uses service role to create the auth user with an initial password,
// then assigns the requested role(s) in public.user_roles.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

type AppRole =
  | "super_admin"
  | "general_executive"
  | "sales_executive"
  | "marketing_executive"
  | "clearance_executive"
  | "operations_executive"
  | "finance_executive"
  | "events_executive"
  | "support_executive"
  | "admin";

interface Body {
  email?: string;
  password?: string;
  display_name?: string;
  roles?: AppRole[];
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ??
      Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization") ?? "";
    if (!authHeader.startsWith("Bearer ")) {
      return json({ error: "Missing bearer token" }, 401);
    }

    // Verify caller via their JWT
    const userClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData, error: userErr } = await userClient.auth.getUser();
    if (userErr || !userData.user) {
      return json({ error: "Unauthorized" }, 401);
    }

    // Confirm caller is super_admin
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE);
    const { data: roleRows, error: roleErr } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userData.user.id)
      .eq("role", "super_admin")
      .limit(1);
    if (roleErr) return json({ error: roleErr.message }, 500);
    if (!roleRows || roleRows.length === 0) {
      return json({ error: "Forbidden: super admin only" }, 403);
    }

    const body = (await req.json()) as Body;
    const email = (body.email ?? "").trim().toLowerCase();
    const password = body.password ?? "";
    const display_name = (body.display_name ?? "").trim() || null;
    const roles = (body.roles ?? []).filter(Boolean) as AppRole[];

    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return json({ error: "Valid email is required" }, 400);
    }
    if (password.length < 8) {
      return json({ error: "Password must be at least 8 characters" }, 400);
    }
    if (roles.length === 0) {
      return json({ error: "Assign at least one role" }, 400);
    }

    // Create the user (email confirmed so they can log in immediately)
    const { data: created, error: createErr } = await admin.auth.admin
      .createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: display_name ? { display_name } : undefined,
      });
    if (createErr || !created.user) {
      return json({ error: createErr?.message ?? "Failed to create user" }, 400);
    }

    const newUserId = created.user.id;

    // Ensure profile exists / update display name
    await admin.from("profiles").upsert(
      {
        user_id: newUserId,
        email,
        display_name: display_name ?? email,
      },
      { onConflict: "user_id" },
    );

    // Insert role rows (ignore duplicates)
    const roleInserts = roles.map((role) => ({ user_id: newUserId, role }));
    const { error: insertRolesErr } = await admin
      .from("user_roles")
      .upsert(roleInserts, { onConflict: "user_id,role" });
    if (insertRolesErr) {
      return json(
        { error: `User created but role assignment failed: ${insertRolesErr.message}` },
        500,
      );
    }

    return json({ ok: true, user_id: newUserId, email });
  } catch (e) {
    return json({ error: (e as Error).message }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
