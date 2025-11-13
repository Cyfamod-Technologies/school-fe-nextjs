import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { BACKEND_URL } from "@/lib/config";
import { decryptCookieValue } from "@/lib/cookieCipher";

const normalizeErrorMessage = (message: string, status?: number) => {
  const trimmed = (message ?? "").trim();
  if (!trimmed || /^<\s*(!DOCTYPE|html)/i.test(trimmed)) {
    if (status === 422) {
      return "Results have not been added for the selected session/term.";
    }
    if (status === 404) {
      return "The requested student result could not be found.";
    }
    return "Unable to load printable result. Please try again.";
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
  <title>Result Printing</title>
  <style>
    body { font-family: Arial, sans-serif; padding: 2rem; background: #f8fafc; color: #0f172a; }
    .card { max-width: 600px; margin: 0 auto; background: #fff; border-radius: 12px; padding: 1.5rem; box-shadow: 0 10px 30px rgba(15,23,42,0.12); text-align: center; }
    h1 { font-size: 1.4rem; margin-bottom: 0.5rem; }
    p { margin-bottom: 1rem; }
  </style>
</head>
<body>
  <div class="card">
    <h1>Unable to Print Result</h1>
    <p>${safeMessage}</p>
    <button onclick="window.close()" style="padding:0.6rem 1.2rem;border:none;border-radius:6px;background:#0f172a;color:#fff;cursor:pointer;">Close</button>
  </div>
  <script>
    (function () {
      try {
        alert(${jsMessage});
      } catch (error) {
        console.error(error);
      }
    })();
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
  const searchParams = request.nextUrl.searchParams;
  const studentId = searchParams.get("student_id");

  if (!studentId) {
    return buildErrorResponse("student_id is required.", 400);
  }

  const backendUrl = new URL(
    `${BACKEND_URL}/api/v1/students/${studentId}/results/print`,
  );

  const sessionId = searchParams.get("session_id");
  const termId = searchParams.get("term_id");

  if (sessionId) {
    backendUrl.searchParams.set("session_id", sessionId);
  }
  if (termId) {
    backendUrl.searchParams.set("term_id", termId);
  }

  const cookieStore = await cookies();
  const rawToken = cookieStore.get("token")?.value ?? null;
  const token = decryptCookieValue(rawToken);

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
    let errorMessage = "Unable to load printable result.";
    const contentType = response.headers.get("content-type") || "";

    if (contentType.includes("application/json")) {
      try {
        const errorData = await response.json();
        errorMessage = errorData.message || errorData.error || errorMessage;
      } catch {
        const text = await response.text().catch(() => "");
        errorMessage = text.trim() || errorMessage;
      }
    } else if (response.status === 403) {
      errorMessage = "You do not have permission to print student results.";
    } else if (response.status === 401) {
      errorMessage = "Your session has expired. Please log in again.";
    } else {
      const text = await response.text().catch(() => "");
      errorMessage = text.trim() || `Unable to load printable result (${response.status}).`;
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
}
export const runtime = "nodejs";
