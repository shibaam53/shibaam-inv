
import { createClient } from "npm:@supabase/supabase-js@2";

const allowedOrigin = Deno.env.get("ALLOWED_ORIGIN") ?? "*";

const cors = {
  "Access-Control-Allow-Origin": allowedOrigin,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Vary": "Origin",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...cors,
      "Content-Type": "application/json",
    },
  });
}

function errorResponse(
  error: string,
  message: string,
  status: number,
) {
  return json({ error, message }, status);
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: cors,
    });
  }

  if (req.method !== "POST") {
    return errorResponse(
      "method_not_allowed",
      "This request method is not supported.",
      405,
    );
  }

  // Environment configuration
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const secretKey = Deno.env.get("ADMIN_SECRET_KEY");

  if (!supabaseUrl || !secretKey) {
    console.error("Missing SUPABASE_URL or ADMIN_SECRET_KEY.");

    return errorResponse(
      "server_misconfigured",
      "User creation service is not configured correctly. Please contact the administrator.",
      500,
    );
  }

  const admin = createClient(supabaseUrl, secretKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  // Authenticate the requesting user
  const authorization = req.headers.get("Authorization") ?? "";
  const token = authorization.replace(/^Bearer\s+/i, "").trim();

  if (!token) {
    return errorResponse(
      "unauthorized",
      "You must be logged in to perform this action.",
      401,
    );
  }

  const { data: caller, error: callerError } =
    await admin.auth.getUser(token);

  if (callerError || !caller.user) {
    return errorResponse(
      "unauthorized",
      "Your session is invalid or has expired. Please log in again.",
      401,
    );
  }

  // Verify Super User permissions
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role, is_active")
    .eq("id", caller.user.id)
    .single();

  if (profileError || !profile || !profile.is_active ||
      profile.role !== "super_user") {
    return errorResponse(
      "forbidden",
      "You do not have permission to create users.",
      403,
    );
  }

  // Parse request body
  let body: {
    email?: string;
    password?: string;
    full_name?: string;
  };

  try {
    body = await req.json();
  } catch {
    return errorResponse(
      "invalid_json",
      "Invalid request data. Please try again.",
      400,
    );
  }

  // Normalize and validate inputs
  const email = (body.email ?? "").trim().toLowerCase();
  const password = body.password ?? "";
  const fullName = (body.full_name ?? "").trim();

  if (!fullName) {
    return errorResponse(
      "full_name_required",
      "Please enter the user's full name.",
      400,
    );
  }

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return errorResponse(
      "invalid_email",
      "Please enter a valid email address.",
      400,
    );
  }

  // Minimum password length: 6 characters
  if (password.length < 6) {
    return errorResponse(
      "password_too_short",
      "Password must contain at least 6 characters.",
      400,
    );
  }

  // Create Auth user
  const { data: created, error: createError } =
    await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: {
        full_name: fullName,
      },
    });

  if (createError || !created.user) {
    const errorMessage = createError?.message ?? "";

    console.error("User creation failed:", {
      code: createError?.code,
      message: errorMessage,
    });

    // Detect duplicate email
    const normalizedError = errorMessage.toLowerCase();

    const isDuplicateEmail =
      createError?.code === "email_exists" ||
      createError?.code === "user_already_exists" ||
      normalizedError.includes("already been registered") ||
      normalizedError.includes("already exists") ||
      normalizedError.includes("email_exists") ||
      normalizedError.includes("duplicate");

    if (isDuplicateEmail) {
      return errorResponse(
        "email_already_exists",
        "An account with this email address already exists.",
        409,
      );
    }

    return errorResponse(
      "could_not_create_user",
      "Unable to create this user. Please verify the details and try again.",
      400,
    );
  }

  // Success
  return json(
    {
      success: true,
      id: created.user.id,
      email: created.user.email,
      message: "User created successfully.",
    },
    201,
  );
});
