import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/config";
import { decryptCookieValue } from "@/lib/cookieCipher";

const REQUIRED_PARAMS = ["session_id", "term_id"] as const;
const DEFAULT_COOKIE_SECRET = "lynx-cookie-secret";
const SANCTUM_TOKEN_PATTERN = /^\d+\|/;

const looksLikeSanctumToken = (value: string | null | undefined): value is string =>
  Boolean(value && SANCTUM_TOKEN_PATTERN.test(value));

const xorCipher = (value: string, secret: string): string => {
  if (!secret) return value;
  let output = "";
  for (let i = 0; i < value.length; i++) {
    output += String.fromCharCode(value.charCodeAt(i) ^ secret.charCodeAt(i % secret.length));
  }
  return output;
};

const decryptWithSecret = (value: string | null | undefined, secret: string): string | null => {
  if (!value) return null;
  try {
    return xorCipher(Buffer.from(value, "base64").toString("utf-8"), secret);
  } catch {
    return null;
  }
};

/**
 * Try every possible way to turn a raw cookie value into a Sanctum token.
 */
const resolveTokenFromCookie = (raw: string | null | undefined): string | null => {
  if (!raw) return null;

  // It might be URL-encoded
  let value = raw;
  try { value = decodeURIComponent(value); } catch { /* keep as-is */ }

  // 1. Decrypt with the app's COOKIE_SECRET (from env)
  const d1 = decryptCookieValue(value);
  if (looksLikeSanctumToken(d1)) return d1;

  // 2. Decrypt with the hardcoded fallback secret
  const d2 = decryptWithSecret(value, DEFAULT_COOKIE_SECRET);
  if (looksLikeSanctumToken(d2)) return d2;

  // 3. Maybe it's already a plain token
  if (looksLikeSanctumToken(value)) return value;

  return null;
};

/**
 * Resolve the student bearer token from every available source.
 * Priority: query-string _st  →  cookie  →  null
 */
const resolveStudentToken = (
  searchParams: URLSearchParams,
  cookieValue: string | null | undefined,
): string | null => {
  // 1. Token passed directly via query string (already decrypted client-side)
  const queryToken = searchParams.get("_st");
  if (queryToken) {
    const fromQuery = resolveTokenFromCookie(queryToken);
    if (fromQuery) return fromQuery;
  }

  // 2. Fall back to cookie
  return resolveTokenFromCookie(cookieValue);
};

const normalizeErrorMessage = (message: string, status?: number) => {
  const trimmed = (message ?? "").trim();
  if (!trimmed || /^<\s*(!DOCTYPE|html)/i.test(trimmed)) {
    if (status === 404) {
      return "No results were found for the selected session and term.";
    }
    if (status === 403) {
      return "You do not have permission to download this result.";
    }
    return "Unable to prepare result. Please verify the selection.";
  }
  return trimmed;
};

const buildErrorHtml = (message: string) => {
  const safeMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  const jsMessage = JSON.stringify(message);
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Result Download</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 2rem; background: #f8fafc; color: #0f172a; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 30px rgba(15,23,42,0.12); text-align: center; }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    p { margin-bottom: 1rem; }
    button { padding:0.6rem 1.2rem;border:none;border-radius:6px;background:#0f172a;color:#fff;cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unable to Prepare Result</h1>
    <p>${safeMessage}</p>
    <button onclick="window.close()">Close</button>
  </div>
  <script>
    try { alert(${jsMessage}); } catch (error) { console.error(error); }
  </script>
</body>
</html>`;
};

const buildErrorResponse = (message: string, status: number) =>
  new NextResponse(buildErrorHtml(message), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    for (const param of REQUIRED_PARAMS) {
      if (!searchParams.get(param)) {
        return buildErrorResponse(
          `Missing required filters: ${REQUIRED_PARAMS.join(", ")}`,
          400,
        );
      }
    }

    const backendUrl = new URL(
      `${BACKEND_URL}/api/v1/student/results/download`,
    );
    REQUIRED_PARAMS.forEach((param) => {
      const value = searchParams.get(param);
      if (value) {
        backendUrl.searchParams.set(param, value);
      }
    });

    const cookieStore = await cookies();
    const token = resolveStudentToken(
      searchParams,
      cookieStore.get("student_token")?.value ?? null,
    );

    if (!token) {
      console.error("Student print-result: no valid token resolved.");
    }

    const proxyHeaders = new Headers({
      Accept: "text/html",
      "X-Requested-With": "XMLHttpRequest",
    });

    if (token) {
      proxyHeaders.set("Authorization", `Bearer ${token}`);
    }

    const cookieHeader = cookieStore
      .getAll()
      .map((cookie) => `${cookie.name}=${cookie.value}`)
      .join("; ");

    if (cookieHeader) {
      proxyHeaders.set("Cookie", cookieHeader);
    }

    const response = await fetch(backendUrl.toString(), {
      headers: proxyHeaders,
      credentials: "include",
    });

    if (!response.ok) {
      let errorMessage = "Unable to load result.";
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorMessage;
        } catch (error) {
          console.error("Failed to parse result download error response", error);
        }
      } else {
        const text = await response.text().catch(() => "");
        if (text.trim().length > 0) {
          errorMessage = text.trim();
        }
      }

      return buildErrorResponse(
        normalizeErrorMessage(errorMessage, response.status),
        response.status,
      );
    }

    const html = await response.text();
    const contentType =
      response.headers.get("content-type") ?? "text/html; charset=utf-8";

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("Student result download route failed", error);
    const message =
      error instanceof Error
        ? error.message || "Unexpected error while generating result."
        : "Unexpected error while generating result.";
    return buildErrorResponse(message, 500);
  }
}
export const runtime = "nodejs";
