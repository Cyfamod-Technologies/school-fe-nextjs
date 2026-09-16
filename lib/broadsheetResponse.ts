export function getBroadsheetError(response: Response, body: string) {
  const challenge = response.headers.get("cf-mitigated") === "challenge" ||
    (/\/cdn-cgi\/challenge-platform\//i.test(body) && /just a moment|challenges\.cloudflare\.com/i.test(body));

  if (challenge) {
    return {
      status: 503,
      message: "The broadsheet service is blocked by a security verification. Please contact your administrator to allow the portal server to access the broadsheet API.",
    };
  }

  if (response.ok) return null;

  let message = "Unable to load broadsheet. Please try again or contact your administrator.";
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      const data = JSON.parse(body);
      const detail = data?.message || data?.error;
      if (typeof detail === "string" && detail.trim() && !/<[^>]+>/.test(detail)) {
        message = detail.trim().slice(0, 500);
      }
    } catch {
      // Keep the safe fallback for malformed upstream errors.
    }
  } else if (contentType.includes("text/plain") && body.trim() && !/<[^>]+>/.test(body)) {
    message = body.trim().slice(0, 500);
  }

  return { status: response.status, message };
}
