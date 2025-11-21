import { apiFetch } from "@/lib/apiClient";

export interface Session {
  id: string;
  name: string;
  start_date?: string | null;
  end_date?: string | null;
  [key: string]: unknown;
}

type SessionsResponse =
  | Session[]
  | {
      data?: Session[];
      [key: string]: unknown;
    };

function normalizeSessions(payload: SessionsResponse): Session[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

export async function listSessions(): Promise<Session[]> {
  const payload = await apiFetch<SessionsResponse>("/api/v1/sessions");
  return normalizeSessions(payload);
}

export interface SessionPayload {
  name: string;
  start_date: string;
  end_date: string;
}

export async function createSession(payload: SessionPayload): Promise<Session> {
  const response = await apiFetch<Session | { data?: Session; message?: string }>(
    "/api/v1/sessions",
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  
  // Handle response format: either direct Session or {data: Session, message: ...}
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: Session }).data;
  }
  
  return response as Session;
}

export async function updateSession(
  id: string,
  payload: SessionPayload,
): Promise<Session> {
  const response = await apiFetch<Session | { data?: Session; message?: string }>(
    `/api/v1/sessions/${id}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  
  // Handle response format: either direct Session or {data: Session, message: ...}
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data: Session }).data;
  }
  
  return response as Session;
}

export async function removeSession(id: string): Promise<void> {
  await apiFetch<void>(`/api/v1/sessions/${id}`, {
    method: "DELETE",
  });
}

export async function getSession(id: string): Promise<Session> {
  return apiFetch<Session>(`/api/v1/sessions/${id}`);
}
