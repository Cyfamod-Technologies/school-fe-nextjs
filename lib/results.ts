import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface ResultRecord {
  id: number | string;
  student_id: number | string;
  subject_id: number | string;
  session_id: number | string;
  term_id: number | string;
  assessment_component_id?: number | string | null;
  total_score: number;
  remarks?: string | null;
  updated_at?: string | null;
  [key: string]: unknown;
}

export interface ResultListResponse {
  data: ResultRecord[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

export interface ResultFilters {
  page?: number;
  per_page?: number;
  student_id?: string | number;
  session_id: string | number;
  term_id: string | number;
  subject_id?: string | number;
  school_class_id?: string | number;
  class_arm_id?: string | number | null;
  class_section_id?: string | number | null;
  assessment_component_id?: string | number | "none" | null;
}

type ResultPayload =
  | ResultRecord[]
  | {
      data?: ResultRecord[] | ResultListResponse;
      [key: string]: unknown;
    };

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

function normalizeResultList(payload: ResultPayload): ResultListResponse {
  if (
    payload &&
    typeof payload === "object" &&
    "data" in payload &&
    Array.isArray((payload as ResultListResponse).data) &&
    ("current_page" in payload || "total" in payload)
  ) {
    return payload as ResultListResponse;
  }

  if (payload && typeof payload === "object" && "data" in payload) {
    const dataField = (payload as { data?: unknown }).data;
    if (Array.isArray(dataField)) {
      const array = dataField as ResultRecord[];
      return {
        data: array,
        current_page: 1,
        last_page: 1,
        per_page: array.length,
        total: array.length,
      };
    }
    if (
      dataField &&
      typeof dataField === "object" &&
      Array.isArray((dataField as ResultListResponse).data)
    ) {
      return dataField as ResultListResponse;
    }
  }

  if (Array.isArray(payload)) {
    return {
      data: payload,
      current_page: 1,
      last_page: 1,
      per_page: payload.length,
      total: payload.length,
    };
  }

  return {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 0,
    total: 0,
  };
}

export async function listResults(
  filters: ResultFilters,
): Promise<ResultListResponse> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    student_id: filters.student_id,
    session_id: filters.session_id,
    term_id: filters.term_id,
    subject_id: filters.subject_id,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id ?? undefined,
    class_section_id: filters.class_section_id ?? undefined,
    assessment_component_id: filters.assessment_component_id ?? undefined,
  });

  const payload = await apiFetch<ResultPayload>(
    `${API_ROUTES.results}${query}`,
  );
  return normalizeResultList(payload);
}

export interface ResultBatchEntry {
  student_id: number | string;
  subject_id: number | string;
  score: number;
  remarks?: string | null;
}

export interface SaveResultsPayload {
  session_id: string | number;
  term_id: string | number;
  assessment_component_id?: string | number | null;
  entries: ResultBatchEntry[];
}

interface ResultBatchResponse {
  data?: ResultRecord[] | { data?: ResultRecord[] };
  message?: string;
  meta?: Record<string, unknown>;
  [key: string]: unknown;
}

export interface SaveResultsResult {
  results: ResultRecord[];
  message?: string;
  meta?: Record<string, unknown>;
}

export async function saveResultsBatch(
  payload: SaveResultsPayload,
): Promise<SaveResultsResult> {
  const raw = await apiFetch<ResultBatchResponse>(API_ROUTES.resultBatch, {
    method: "POST",
    body: JSON.stringify(payload),
  });

  let results: ResultRecord[] = [];

  if (raw) {
    if (Array.isArray(raw.data)) {
      results = raw.data as ResultRecord[];
    } else if (
      raw.data &&
      typeof raw.data === "object" &&
      Array.isArray((raw.data as { data?: ResultRecord[] }).data)
    ) {
      results = (raw.data as { data?: ResultRecord[] }).data ?? [];
    }
  }

  return {
    results,
    message:
      typeof raw?.message === "string" ? (raw.message as string) : undefined,
    meta: raw?.meta,
  };
}
