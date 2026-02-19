import { BACKEND_URL } from "@/lib/config";
import { getCookie } from "@/lib/cookies";

type FetchOptions = RequestInit & {
  skipAuth?: boolean;
  authScope?: "staff" | "student";
};

function buildHeaders(
  headers?: HeadersInit,
  body?: BodyInit | null,
  forceJsonContentType = false,
): Headers {
  const resolvedHeaders = new Headers(headers || {});
  resolvedHeaders.set("Accept", "application/json");

  const isFormData =
    typeof FormData !== "undefined" && body instanceof FormData;

  if (!isFormData && (forceJsonContentType || body)) {
    if (!resolvedHeaders.has("Content-Type")) {
      resolvedHeaders.set("Content-Type", "application/json");
    }
  }

  return resolvedHeaders;
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const { skipAuth = false, authScope = "staff", headers, ...rest } = options;
  const tokenName = authScope === "student" ? "student_token" : "token";
  const token = getCookie(tokenName);
  const resolvedHeaders = buildHeaders(headers, rest.body);

  if (!skipAuth && token) {
    resolvedHeaders.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${BACKEND_URL}${path}`, {
    ...rest,
    credentials: "include",
    headers: resolvedHeaders,
  });

  if (!response.ok) {
    if (response.status === 401 && authScope === "staff") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("app:auth-unauthorized", {
            detail: { path, status: response.status },
          }),
        );
      }

      throw new Error("Session expired. Re-checking authentication.");
    }

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

export const apiClient = {
  get: async (
    path: string,
    options: FetchOptions = {}
  ): Promise<Response> => {
    const { headers, ...rest } = options;
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: "GET",
      credentials: "include",
      ...rest,
      headers: buildHeaders(headers),
    });
    return response;
  },

  post: async (
    path: string,
    data?: unknown,
    options: FetchOptions = {}
  ): Promise<Response> => {
    const { headers, ...rest } = options;
    const body = data ? JSON.stringify(data) : undefined;
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: "POST",
      body,
      credentials: "include",
      ...rest,
      headers: buildHeaders(headers, body, true),
    });
    return response;
  },

  put: async (
    path: string,
    data?: unknown,
    options: FetchOptions = {}
  ): Promise<Response> => {
    const { headers, ...rest } = options;
    const body = data ? JSON.stringify(data) : undefined;
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: "PUT",
      body,
      credentials: "include",
      ...rest,
      headers: buildHeaders(headers, body, true),
    });
    return response;
  },

  delete: async (
    path: string,
    options: FetchOptions = {}
  ): Promise<Response> => {
    const { headers, ...rest } = options;
    const response = await fetch(`${BACKEND_URL}${path}`, {
      method: "DELETE",
      credentials: "include",
      ...rest,
      headers: buildHeaders(headers),
    });
    return response;
  },
};
