import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/config";
import { decryptCookieValue } from "@/lib/cookieCipher";

const REQUIRED_PARAMS = ["session_id", "term_id"] as const;

type RequiredParam = (typeof REQUIRED_PARAMS)[number];

const normalizeErrorMessage = (message: string, status?: number) => {
  const trimmed = (message ?? "").trim();
  if (!trimmed || /^<\s*(!DOCTYPE|html)/i.test(trimmed)) {
    if (status === 422) {
      return "No scratch cards were generated for the selected filters.";
    }
    if (status === 404) {
      return "The requested records could not be found.";
    }
    return "Unable to prepare scratch cards. Please ensure PINs exist for the selected students.";
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
  <title>Scratch Card Printing</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 2rem; background: #f8fafc; color: #0f172a; }
    .card { max-width: 560px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 30px rgba(15,23,42,0.12); text-align: center; }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    p { margin-bottom: 1rem; }
    button { padding: 0.6rem 1.2rem; border:none; border-radius:6px; background:#0f172a; color:#fff; cursor:pointer; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unable to Prepare Scratch Cards</h1>
    <p>${safeMessage}</p>
    <button onclick="window.close()">Close</button>
  </div>
  <script>
    try {
      alert(${jsMessage});
    } catch (error) {
      console.error(error);
    }
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

function validateParams(searchParams: URLSearchParams): { valid: boolean; missing: RequiredParam[] } {
  const missing: RequiredParam[] = [];
  REQUIRED_PARAMS.forEach((param) => {
    const value = searchParams.get(param);
    if (!value || value.trim().length === 0) {
      missing.push(param);
    }
  });
  return { valid: missing.length === 0, missing };
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const validation = validateParams(searchParams);

    if (!validation.valid) {
      return buildErrorResponse(
        `Missing required filters: ${validation.missing.join(", ")}`,
        400,
      );
    }

    const backendUrl = new URL(`${BACKEND_URL}/api/v1/result-pins/cards/print`);
    REQUIRED_PARAMS.forEach((param) => {
      const value = searchParams.get(param);
      if (value) {
        backendUrl.searchParams.set(param, value);
      }
    });

    ["school_class_id", "class_arm_id", "student_id", "autoprint"].forEach(
      (param) => {
        const value = searchParams.get(param);
        if (value) {
          backendUrl.searchParams.set(param, value);
        }
      },
    );

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
    });

    if (!response.ok) {
      let errorMessage = "Unable to load scratch cards.";
      const contentType = response.headers.get("content-type") || "";

      if (contentType.includes("application/json")) {
        try {
          const errorData = await response.json();
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch (error) {
          console.error("Failed to parse scratch card error response", error);
        }
      } else if (response.status === 403) {
        errorMessage = "You do not have permission to print scratch cards.";
      } else if (response.status === 401) {
        errorMessage = "Your session has expired. Please log in again.";
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
    const contentType = response.headers.get("content-type") ?? "text/html; charset=utf-8";

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": contentType,
      },
    });
  } catch (error) {
    console.error("Scratch card print route failed", error);
    const message =
      error instanceof Error
        ? error.message || "Unexpected error while generating scratch cards."
        : "Unexpected error while generating scratch cards.";
    return buildErrorResponse(message, 500);
  }
}
export const runtime = "nodejs";
