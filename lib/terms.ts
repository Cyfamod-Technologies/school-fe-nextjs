import { apiFetch } from "@/lib/apiClient";

export interface Term {
  id: number | string;
  name: string;
  term_number?: number | null;
  session?: number | string;
  session_id?: number | string;
  start_date?: string | null;
  end_date?: string | null;
  [key: string]: unknown;
}

type TermsResponse =
  | Term[]
  | {
      data?: Term[];
      [key: string]: unknown;
    };

function normalizeTerms(payload: TermsResponse): Term[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

export async function listTermsBySession(
  sessionId: number | string,
): Promise<Term[]> {
  const payload = await apiFetch<TermsResponse>(
    `/api/v1/sessions/${sessionId}/terms`,
  );
  return normalizeTerms(payload);
}

export async function getTerm(termId: number | string): Promise<Term | null> {
  try {
    return await apiFetch<Term>(`/api/v1/terms/${termId}`);
  } catch (error) {
    console.error("Unable to load term", error);
    return null;
  }
}

export interface TermPayload {
  name: string;
  term_number: number;
  start_date: string;
  end_date: string;
}

export async function createTerm(
  sessionId: number | string,
  payload: TermPayload,
): Promise<Term> {
  return apiFetch<Term>(`/api/v1/sessions/${sessionId}/terms`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface UpdateTermPayload extends TermPayload {
  session: number | string;
}

export async function updateTerm(
  termId: number | string,
  payload: UpdateTermPayload,
): Promise<Term> {
  const body = {
    ...payload,
    slug: `${payload.name.toLowerCase().replace(/\s+/g, "-")}-${payload.term_number}`,
  };

  return apiFetch<Term>(`/api/v1/terms/${termId}`, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function deleteTerm(termId: number | string): Promise<void> {
  await apiFetch(`/api/v1/terms/${termId}`, {
    method: "DELETE",
  });
}
