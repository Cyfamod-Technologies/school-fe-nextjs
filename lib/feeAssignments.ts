import { apiFetch } from "@/lib/apiClient";
import { API_ROUTES } from "@/lib/config";

/**
 * A fee assigned to a scope for one session/term. The four scopes stack: a
 * JSS 2A student is billed the school-wide fees, plus the JSS 2 class fees,
 * plus the JSS 2A arm fees, plus anything assigned to them individually.
 */
export type FeeScope = "school" | "class" | "class_arm" | "student";

export const FEE_SCOPES: { value: FeeScope; label: string; hint: string }[] = [
  { value: "school", label: "All Students", hint: "Every student in the school" },
  { value: "class", label: "Class", hint: "Every arm of one class" },
  { value: "class_arm", label: "Class Arm", hint: "One arm only" },
  { value: "student", label: "Selected Students", hint: "Hand-picked students" },
];

export interface FeeAssignmentRef {
  id: string;
  name: string;
}

export interface FeeAssignmentStudent {
  id: string;
  admission_no: string;
  name: string;
}

export interface FeeAssignment {
  id: string;
  school_id: string;
  scope: FeeScope;
  scope_label: string;
  session_id: string;
  term_id: string;
  school_class_id: string | null;
  class_arm_id: string | null;
  fee_item_id: string;
  amount: string;
  description: string | null;
  due_date: string | null;
  is_mandatory: boolean;
  is_active: boolean;
  created_at: string | null;
  updated_at: string | null;
  fee_item?: { id: string; name: string; category: string | null };
  school_class?: FeeAssignmentRef | null;
  class_arm?: FeeAssignmentRef | null;
  session?: FeeAssignmentRef;
  term?: FeeAssignmentRef;
  students?: FeeAssignmentStudent[];
  student_count?: number;
  created_by?: { id: string; name: string } | null;
}

export interface FeeAssignmentPayload {
  scope: FeeScope;
  session_id: string;
  term_id: string;
  fee_item_id: string;
  amount: string;
  school_class_id?: string | null;
  class_arm_id?: string | null;
  student_ids?: string[];
  description?: string | null;
  due_date?: string | null;
  is_mandatory?: boolean;
  is_active?: boolean;
}

export interface FeeAssignmentUpdatePayload {
  amount?: string;
  description?: string | null;
  due_date?: string | null;
  is_mandatory?: boolean;
  is_active?: boolean;
}

export interface FeeAssignmentFilters {
  scope?: FeeScope | "";
  session_id?: string;
  term_id?: string;
  school_class_id?: string;
  class_arm_id?: string;
  fee_item_id?: string;
  is_active?: boolean;
  search?: string;
  page?: number;
  per_page?: number;
}

/** How many students an assignment would reach, and what that totals. */
export interface FeeAssignmentPreview {
  student_count: number;
  amount: string;
  total_amount: string;
}

/** What bill generation did in response to the change. */
export interface BillSyncSummary {
  students: number;
  items_created: number;
  items_updated: number;
  items_removed: number;
}

interface Paginated<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
  total?: number;
  [key: string]: unknown;
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined>,
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listFeeAssignments(
  filters: FeeAssignmentFilters = {},
): Promise<FeeAssignment[]> {
  const payload = await apiFetch<Paginated<FeeAssignment>>(
    `${API_ROUTES.feeAssignments}${buildQuery({
      scope: filters.scope || undefined,
      session_id: filters.session_id,
      term_id: filters.term_id,
      school_class_id: filters.school_class_id,
      class_arm_id: filters.class_arm_id,
      fee_item_id: filters.fee_item_id,
      is_active: filters.is_active,
      search: filters.search,
      page: filters.page,
      per_page: filters.per_page ?? 100,
    })}`,
  );
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function createFeeAssignment(
  payload: FeeAssignmentPayload,
): Promise<{ data: FeeAssignment; meta?: { bill_sync: BillSyncSummary } }> {
  return apiFetch(API_ROUTES.feeAssignments, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function previewFeeAssignment(
  payload: FeeAssignmentPayload,
): Promise<FeeAssignmentPreview> {
  const response = await apiFetch<{ data: FeeAssignmentPreview }>(
    API_ROUTES.feeAssignmentsPreview,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return response.data;
}

export async function updateFeeAssignment(
  assignmentId: string,
  payload: FeeAssignmentUpdatePayload,
): Promise<{ data: FeeAssignment; meta?: { bill_sync: BillSyncSummary } }> {
  return apiFetch(`${API_ROUTES.feeAssignments}/${assignmentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function syncFeeAssignmentStudents(
  assignmentId: string,
  studentIds: string[],
): Promise<{ data: FeeAssignment; meta?: { bill_sync: BillSyncSummary } }> {
  return apiFetch(`${API_ROUTES.feeAssignments}/${assignmentId}/students`, {
    method: "PUT",
    body: JSON.stringify({ student_ids: studentIds }),
  });
}

export async function deleteFeeAssignment(
  assignmentId: string,
): Promise<{ message: string; meta?: { bill_items_removed: number } }> {
  return apiFetch(`${API_ROUTES.feeAssignments}/${assignmentId}`, {
    method: "DELETE",
    treatForbiddenAsEmpty: false,
  });
}
