import { describe, it, expect } from "vitest";
import { extractEdgeFunctionError } from "./functions-error";

describe("extractEdgeFunctionError", () => {
  it("extracts duplicate email (HTTP 409) message correctly", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "email_already_exists",
        message: "An account with this email address already exists.",
      }),
      {
        status: 409,
        headers: { "Content-Type": "application/json" },
      },
    );

    const fnError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    const result = await extractEdgeFunctionError(fnError, null);
    expect(result.errorCode).toBe("email_already_exists");
    expect(result.message).toBe(
      "An account with this email address already exists.",
    );
    expect(result.status).toBe(409);
  });

  it("extracts invalid email (HTTP 400) message correctly", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "invalid_email",
        message: "Please enter a valid email address.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );

    const fnError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    const result = await extractEdgeFunctionError(fnError, null);
    expect(result.errorCode).toBe("invalid_email");
    expect(result.message).toBe("Please enter a valid email address.");
    expect(result.status).toBe(400);
  });

  it("extracts password too short (HTTP 400) message correctly", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "password_too_short",
        message: "Password must contain at least 6 characters.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );

    const fnError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    const result = await extractEdgeFunctionError(fnError, null);
    expect(result.errorCode).toBe("password_too_short");
    expect(result.message).toBe(
      "Password must contain at least 6 characters.",
    );
    expect(result.status).toBe(400);
  });

  it("extracts missing full name (HTTP 400) message correctly", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "full_name_required",
        message: "Please enter the user's full name.",
      }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      },
    );

    const fnError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    const result = await extractEdgeFunctionError(fnError, null);
    expect(result.errorCode).toBe("full_name_required");
    expect(result.message).toBe("Please enter the user's full name.");
    expect(result.status).toBe(400);
  });

  it("extracts unauthorized (HTTP 401) message correctly", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "unauthorized",
        message: "Your session is invalid or has expired. Please log in again.",
      }),
      {
        status: 401,
        headers: { "Content-Type": "application/json" },
      },
    );

    const fnError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    const result = await extractEdgeFunctionError(fnError, null);
    expect(result.errorCode).toBe("unauthorized");
    expect(result.message).toBe(
      "Your session is invalid or has expired. Please log in again.",
    );
    expect(result.status).toBe(401);
  });

  it("extracts forbidden (HTTP 403) message correctly", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "forbidden",
        message: "You do not have permission to create users.",
      }),
      {
        status: 403,
        headers: { "Content-Type": "application/json" },
      },
    );

    const fnError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    const result = await extractEdgeFunctionError(fnError, null);
    expect(result.errorCode).toBe("forbidden");
    expect(result.message).toBe(
      "You do not have permission to create users.",
    );
    expect(result.status).toBe(403);
  });

  it("extracts server misconfiguration (HTTP 500) message correctly", async () => {
    const mockResponse = new Response(
      JSON.stringify({
        error: "server_misconfigured",
        message:
          "User creation service is not configured correctly. Please contact the administrator.",
      }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );

    const fnError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    const result = await extractEdgeFunctionError(fnError, null);
    expect(result.errorCode).toBe("server_misconfigured");
    expect(result.message).toBe(
      "User creation service is not configured correctly. Please contact the administrator.",
    );
    expect(result.status).toBe(500);
  });

  it("provides sensible fallback when HTTP 500 returns non-JSON body", async () => {
    const mockResponse = new Response("Internal Server Error", {
      status: 500,
      headers: { "Content-Type": "text/plain" },
    });

    const fnError = {
      name: "FunctionsHttpError",
      message: "Edge Function returned a non-2xx status code",
      context: mockResponse,
    };

    const result = await extractEdgeFunctionError(fnError, null);
    expect(result.message).toBe(
      "An unexpected server error occurred. Please try again later.",
    );
    expect(result.status).toBe(500);
  });

  it("extracts error payload if returned in data object", async () => {
    const data = {
      error: "email_already_exists",
      message: "An account with this email address already exists.",
    };

    const result = await extractEdgeFunctionError(null, data);
    expect(result.errorCode).toBe("email_already_exists");
    expect(result.message).toBe(
      "An account with this email address already exists.",
    );
  });
});

