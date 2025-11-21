import { BACKEND_URL } from "@/lib/config";
import { getCookie } from "@/lib/cookies";

type FetchOptions = RequestInit & {
  skipAuth?: boolean;
  authScope?: "staff" | "student";
};

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth = false, authScope = "staff", headers, ...rest } = options;
  const tokenName = authScope === "student" ? "student_token" : "token";
  const token = getCookie(tokenName);
  const resolvedHeaders = new Headers(headers);

  const isFormData =
    typeof FormData !== "undefined" && rest.body instanceof FormData;

  resolvedHeaders.set("Accept", "application/json");
  if (!resolvedHeaders.has("Content-Type") && rest.body && !isFormData) {
    resolvedHeaders.set("Content-Type", "application/json");
  }

  if (!skipAuth && token) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: resolvedHeaders,
  });

  if (!response.ok) {
    // For 403 (Forbidden) errors on read-only staff requests, return empty data
    // instead of throwing. For mutations (POST/PUT/DELETE), always throw so
    // the UI can surface proper error feedback.
    const method = (rest.method ?? "GET").toString().toUpperCase();
    const isReadOnlyMethod = method === "GET" || method === "HEAD";
    if (response.status === 403 && authScope === "staff" && isReadOnlyMethod) {
      return [] as T;
    }
    
    let message = response.statusText;
    try {
      const data = await response.json();
      message = data.message ?? JSON.stringify(data);
    } catch {
      // ignore parse errors, fall back to status text
    }
    throw new Error(message || `Request failed (${response.status})`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
