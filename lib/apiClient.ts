import { BACKEND_URL } from "@/lib/config";
import { getCookie } from "@/lib/cookies";

type FetchOptions = RequestInit & {
  skipAuth?: boolean;
  authScope?: "staff" | "student";
  /**
   * By default, a 403 on a read-only staff request returns `[]` instead of
   * throwing, since most callers are list endpoints. Set to `false` for
   * single-object endpoints where `[]` would be a type-unsafe, misleading
   * stand-in for "forbidden" (see ApiError below for the correct signal).
   */
  treatForbiddenAsEmpty?: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  /** Laravel's per-field validation errors on a 422 response, if present. */
  readonly errors?: Record<string, string[]>;
  /** The full parsed JSON body, for endpoints that return extra fields
   * beyond `message`/`errors` on a non-2xx response (e.g. a 429's
   * `hours_until_resend_available`). */
  readonly body?: unknown;

  constructor(
    message: string,
    status: number,
    errors?: Record<string, string[]>,
    body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.errors = errors;
    this.body = body;
  }
}

export async function apiFetch<T = unknown>(
  path: string,
  options: FetchOptions = {},
): Promise<T> {
  const {
    skipAuth = false,
    authScope = "staff",
    treatForbiddenAsEmpty = true,
    headers,
    ...rest
  } = options;
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
    if (response.status === 401 && authScope === "staff") {
      if (typeof window !== "undefined") {
        window.dispatchEvent(
          new CustomEvent("app:auth-unauthorized", {
            detail: { path, status: response.status },
          }),
        );
      }

      throw new ApiError(
        "Session expired. Re-checking authentication.",
        response.status,
      );
    }

    // For 403 (Forbidden) errors on read-only staff requests, return empty data
    // instead of throwing. For mutations (POST/PUT/DELETE), always throw so
    // the UI can surface proper error feedback.
    const method = (rest.method ?? "GET").toString().toUpperCase();
    const isReadOnlyMethod = method === "GET" || method === "HEAD";
    if (
      response.status === 403 &&
      authScope === "staff" &&
      isReadOnlyMethod &&
      treatForbiddenAsEmpty
    ) {
      return [] as T;
    }

    let message = response.statusText;
    let validationErrors: Record<string, string[]> | undefined;
    let body: unknown;
    try {
      const data = await response.json();
      body = data;
      message = data.message ?? JSON.stringify(data);
      if (data.errors && typeof data.errors === "object") {
        validationErrors = data.errors;
      }
    } catch {
      // ignore parse errors, fall back to status text
    }
    throw new ApiError(
      message || `Request failed (${response.status})`,
      response.status,
      validationErrors,
      body,
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
