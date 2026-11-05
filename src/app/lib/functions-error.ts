export interface ExtractedFunctionError {
  errorCode?: string;
  message: string;
  status?: number;
}

/**
 * Safely extracts error information from a Supabase Edge Function invocation.
 *
 * When an Edge Function returns a non-2xx status code:
 * - Supabase's `functions.invoke()` returns a `FunctionsHttpError` in `error`
 * - `data` is typically `null`
 * - The actual HTTP response with JSON body is stored in `error.context` (Fetch Response)
 *
 * This helper inspects `fnError.context`, `data`, and the error object to return
 * the actual response message, with sensible fallbacks when messages are missing.
 */
export async function extractEdgeFunctionError(
  fnError: unknown,
  data?: unknown,
): Promise<ExtractedFunctionError> {
  let errorCode: string | undefined;
  let serverMessage: string | undefined;
  let status: number | undefined;

  // 1. Inspect fnError.context (FunctionsHttpError context is a Fetch Response)
  if (fnError && typeof fnError === "object" && "context" in fnError) {
    const ctx = (fnError as { context?: unknown }).context;
    if (ctx && typeof ctx === "object") {
      if ("status" in ctx && typeof (ctx as { status: unknown }).status === "number") {
        status = (ctx as { status: number }).status;
      }

      // Check if context is a Response object with json() / text()
      if ("json" in ctx && typeof (ctx as { json: unknown }).json === "function") {
        try {
          const res =
            "clone" in ctx && typeof (ctx as { clone: unknown }).clone === "function"
              ? (ctx as Response).clone()
              : (ctx as Response);
          const body = (await res.json()) as { error?: unknown; message?: unknown } | null;
          if (body && typeof body === "object") {
            if (typeof body.error === "string") errorCode = body.error;
            if (typeof body.message === "string" && body.message.trim()) {
              serverMessage = body.message.trim();
            }
          }
        } catch {
          // If json parsing fails, try reading as text
          try {
            const res =
              "clone" in ctx && typeof (ctx as { clone: unknown }).clone === "function"
                ? (ctx as Response).clone()
                : (ctx as Response);
            const text = await res.text();
            if (text) {
              const body = JSON.parse(text) as { error?: unknown; message?: unknown };
              if (body && typeof body === "object") {
                if (typeof body.error === "string") errorCode = body.error;
                if (typeof body.message === "string" && body.message.trim()) {
                  serverMessage = body.message.trim();
                }
              }
            }
          } catch {
            // Non-JSON response body
          }
        }
      }
    }
  }

  // 2. Inspect data if error payload was returned in data
  if (!serverMessage && data && typeof data === "object") {
    const d = data as { error?: unknown; message?: unknown };
    if (typeof d.error === "string") errorCode = d.error;
    if (typeof d.message === "string" && d.message.trim()) {
      serverMessage = d.message.trim();
    }
  }

  // 3. Inspect fnError if it's an Error instance with JSON string message
  if (!serverMessage && fnError instanceof Error && fnError.message) {
    const rawMsg = fnError.message;
    try {
      const parsed = JSON.parse(rawMsg) as { error?: unknown; message?: unknown };
      if (parsed && typeof parsed === "object") {
        if (typeof parsed.error === "string") errorCode = parsed.error;
        if (typeof parsed.message === "string" && parsed.message.trim()) {
          serverMessage = parsed.message.trim();
        }
      }
    } catch {
      // Use raw message only if it's not the generic SDK string
      if (rawMsg !== "Edge Function returned a non-2xx status code") {
        serverMessage = rawMsg;
      }
    }
  }

  // If a meaningful server message was extracted, return it
  if (serverMessage) {
    return { errorCode, message: serverMessage, status };
  }

  // Sensible fallbacks when server message was not provided or extractable
  if (errorCode === "email_already_exists" || status === 409) {
    return {
      errorCode: "email_already_exists",
      message: "An account with this email address already exists.",
      status: status ?? 409,
    };
  }
  if (errorCode === "invalid_email") {
    return {
      errorCode: "invalid_email",
      message: "Please enter a valid email address.",
      status: status ?? 400,
    };
  }
  if (errorCode === "password_too_short") {
    return {
      errorCode: "password_too_short",
      message: "Password must contain at least 6 characters.",
      status: status ?? 400,
    };
  }
  if (errorCode === "full_name_required") {
    return {
      errorCode: "full_name_required",
      message: "Please enter the user's full name.",
      status: status ?? 400,
    };
  }
  if (errorCode === "unauthorized" || status === 401) {
    return {
      errorCode: "unauthorized",
      message: "Your session is invalid or has expired. Please log in again.",
      status: status ?? 401,
    };
  }
  if (errorCode === "forbidden" || status === 403) {
    return {
      errorCode: "forbidden",
      message: "You do not have permission to create users.",
      status: status ?? 403,
    };
  }
  if (errorCode === "server_misconfigured") {
    return {
      errorCode: "server_misconfigured",
      message:
        "User creation service is not configured correctly. Please contact the administrator.",
      status: status ?? 500,
    };
  }
  if (status && status >= 500) {
    return {
      errorCode: "server_error",
      message: "An unexpected server error occurred. Please try again later.",
      status,
    };
  }

  return {
    errorCode,
    message: "Failed to create user. Please check the entered details and try again.",
    status,
  };
}

