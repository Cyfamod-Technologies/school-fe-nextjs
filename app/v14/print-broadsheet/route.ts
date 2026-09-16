import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/config";
import { decryptCookieValue } from "@/lib/cookieCipher";
import { getBroadsheetError } from "@/lib/broadsheetResponse";

const REQUIRED_PARAMS = ["session_id", "term_id", "school_class_id"] as const;

const buildErrorHtml = (message: string) => {
  const safeMessage = message
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>Broadsheet Print</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 2rem; background: #f8fafc; color: #0f172a; }
    .card { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 30px rgba(15,23,42,0.12); text-align: center; }
    button { padding:0.6rem 1.2rem;border:none;border-radius:6px;background:#0f172a;color:#fff;cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unable to Prepare Broadsheet</h1>
    <p>${safeMessage}</p>
    <button onclick="window.close()">Close</button>
  </div>
</body>
</html>`;
};

const buildErrorResponse = (message: string, status: number) =>
  new NextResponse(buildErrorHtml(message), {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "private, no-store",
    },
  });

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;

    const missing = REQUIRED_PARAMS.filter((param) => {
      const value = searchParams.get(param);
      return !value || value.trim().length === 0;
    });

    if (missing.length > 0) {
      return buildErrorResponse(
        `Missing required filters: ${missing.join(", ")}`,
        400,
      );
    }

    // Optional trusted internal origin for server-to-server requests only.
    const backendBase = (process.env.BACKEND_INTERNAL_URL?.trim() || BACKEND_URL).replace(/\/+$/, "");
    const backendUrl = new URL(`${backendBase}/api/v1/broadsheet/print`);
    if (!["http:", "https:"].includes(backendUrl.protocol)) {
      throw new Error("Invalid backend protocol");
    }

    [...REQUIRED_PARAMS, "class_arm_id", "autoprint", "embedded"].forEach((param) => {
      const value = searchParams.get(param);
      if (value) {
        backendUrl.searchParams.set(param, value);
      }
    });

    const cookieStore = await cookies();
    const rawToken = cookieStore.get("token")?.value ?? null;
    const token = decryptCookieValue(rawToken) ?? rawToken;

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
      cache: "no-store",
      signal: AbortSignal.timeout(30_000),
    });

    const html = await response.text();
    const upstreamError = getBroadsheetError(response, html);
    if (upstreamError) {
      return buildErrorResponse(upstreamError.message, upstreamError.status);
    }

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": response.headers.get("content-type") ?? "text/html; charset=utf-8",
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    console.error("Broadsheet print route failed", error);
    return buildErrorResponse(
      "The broadsheet service could not be reached. Please try again or contact your administrator.",
      502,
    );
  }
}

export const runtime = "nodejs";
