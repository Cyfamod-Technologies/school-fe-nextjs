import { API_ROUTES, BACKEND_URL } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface PromotionRequest {
  target_session_id: string | number;
  target_school_class_id: string | number;
  target_class_arm_id: string | number;
  target_class_section_id?: string | number | null;
  retain_subjects?: boolean;
  student_ids: Array<string | number>;
}

export interface PromotionResponse {
  message?: string;
  promoted?: number;
  skipped?: number;
  [key: string]: unknown;
}

export interface PromotionHistoryRow {
  id?: number;
  promoted_at?: string;
  created_at?: string;
  student_name?: string;
  from_class?: string;
  to_class?: string;
  performed_by?: string;
  [key: string]: unknown;
}

export interface PromotionHistoryResponse {
  data: PromotionHistoryRow[];
  current_page?: number;
  last_page?: number;
  per_page?: number;
  total?: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

export interface PromotionHistoryFilters {
  session_id?: string;
  term_id?: string;
  school_class_id?: string;
  class_arm_id?: string;
  class_section_id?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

export async function bulkPromoteStudents(
  payload: PromotionRequest,
): Promise<PromotionResponse> {
  const basePayload = { ...payload };
  delete basePayload.target_class_section_id;
  delete basePayload.target_class_arm_id;
  return apiFetch<PromotionResponse>(API_ROUTES.promotionsBulk, {
    method: "POST",
    body: JSON.stringify({
      target_session_id: basePayload.target_session_id,
      target_class_id: basePayload.target_school_class_id,
      retain_subjects: Boolean(basePayload.retain_subjects),
      student_ids: basePayload.student_ids,
    }),
  });
}

export async function listPromotionHistory(
  filters: PromotionHistoryFilters = {},
): Promise<PromotionHistoryResponse> {
  const query = buildQuery({
    session_id: filters.session_id,
    term_id: filters.term_id,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id,
  });

  const payload = await apiFetch<PromotionHistoryResponse>(
    `${API_ROUTES.promotionsHistory}${query}`,
  );

  if (!Array.isArray(payload.data)) {
    return {
      ...payload,
      data: Array.isArray((payload as unknown as { data?: unknown }).data)
        ? (payload as { data: PromotionHistoryRow[] }).data
        : [],
    };
  }

  return payload;
}

export function promotionHistoryExportUrl(
  filters: PromotionHistoryFilters = {},
  format: "csv" | "pdf" = "csv",
): string {
  const query = buildQuery({
    session_id: filters.session_id,
    term_id: filters.term_id,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id,
  });
  const base = `${BACKEND_URL}${API_ROUTES.promotionsHistory}`;
  return `${base}/export.${format}${query}`;
}

export interface RolloverPayload {
  source_session_id: string | number;
  new_session_name: string;
  new_session_start?: string | null;
  new_session_end?: string | null;
  notes?: string | null;
}

export interface RolloverResponse {
  message?: string;
  [key: string]: unknown;
}

export async function processAcademicRollover(
  payload: RolloverPayload,
): Promise<RolloverResponse> {
  return apiFetch<RolloverResponse>(API_ROUTES.sessionsRollover, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
