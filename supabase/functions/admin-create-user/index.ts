// Edge Function: admin-create-user
// Lets an ACTIVE SUPER USER create a login for a staff member (public signup is disabled).
// The secret key never reaches the browser: it lives only in this function's secrets.
//
// Deploy : npx supabase functions deploy admin-create-user --no-verify-jwt
// Secrets: npx supabase secrets set ADMIN_SECRET_KEY=sb_secret_xxx [ALLOWED_ORIGIN=https://your-app.vercel.app]
// (--no-verify-jwt because this function verifies the caller itself, below.)
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";
const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);

  const url = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("ADMIN_SECRET_KEY");
  if (!url || !secretKey) return json({ error: "server_misconfigured" }, 500);

  const admin = createClient(url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // 1) Who is calling? Validate the user's access token with Supabase Auth.
  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "unauthorized" }, 401);
  const { data: caller, error: callerError } = await admin.auth.getUser(token);
  if (callerError || !caller.user) return json({ error: "unauthorized" }, 401);

  // 2) Must be an active Super User (role comes from the profiles table, never from the token).
  const { data: profile } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", caller.user.id)
    .single();
  if (!profile || !profile.is_active || profile.role !== "super_user") {
    return json({ error: "forbidden" }, 403);
  }

  // 3) Validate input.
  let body: { email?: string; password?: string; full_name?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_json" }, 400);
  }
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: "invalid_email" }, 400);
  if (password.length < 10) return json({ error: "password_too_short" }, 400);
  if (!fullName) return json({ error: "full_name_required" }, 400);

  // 4) Create the user. A database trigger creates the profile as an ACTIVE NORMAL USER.
  //    Promoting to Super User is a separate, deliberate step (admin_update_profile).
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (createError || !created.user) {
    return json({ error: "could_not_create_user" }, 400);
  }
  return json({ id: created.user.id, email: created.user.email }, 201);
});
