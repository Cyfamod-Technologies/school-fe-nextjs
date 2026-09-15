import { apiFetch } from "@/lib/apiClient";
import { API_ROUTES, BACKEND_URL } from "@/lib/config";
import { getCookie } from "@/lib/cookies";
import type { BillStatus } from "@/lib/studentBills";

export interface FinanceOverview {
  expected: string;
  verified: string;
  pending: string;
  outstanding: string;
  students_billed: number;
}

export interface ClassCollection {
  school_class_id: string | null;
  class_name: string;
  expected: string;
  verified: string;
  students: number;
}

export interface OutstandingStudentRow {
  student_bill_id: string;
  student_id: string;
  student_name: string;
  admission_no: string;
  class_name: string | null;
  class_arm_name: string | null;
  total: string;
  verified_paid: string;
  outstanding: string;
  status: BillStatus;
}

export interface FinanceReportFilters {
  session_id?: string;
  term_id?: string;
  school_class_id?: string;
  class_arm_id?: string;
  [key: string]: string | number | undefined;
}

export interface FinanceAuditLogEntry {
  id: string;
  actor_type: "user" | "student" | "system";
  actor_id: string | null;
  actor_name: string | null;
  action: string;
  subject_type: string;
  subject_id: string | null;
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AuditLogPage {
  data: FinanceAuditLogEntry[];
  current_page: number;
  last_page: number;
  total: number;
}

function buildQuery(params: Record<string, string | number | undefined | null>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

export async function getFinanceOverview(
  filters: FinanceReportFilters,
): Promise<FinanceOverview> {
  const payload = await apiFetch<{ data: FinanceOverview }>(
    `${API_ROUTES.financeOverview}${buildQuery(filters)}`,
    { treatForbiddenAsEmpty: false },
  );
  return payload.data;
}

export async function getCollectionsByClass(
  filters: FinanceReportFilters,
): Promise<ClassCollection[]> {
  const payload = await apiFetch<{ data: ClassCollection[] }>(
    `${API_ROUTES.financeCollections}${buildQuery(filters)}`,
  );
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function getOutstandingStudents(
  filters: FinanceReportFilters,
): Promise<OutstandingStudentRow[]> {
  const payload = await apiFetch<{ data: OutstandingStudentRow[] }>(
    `${API_ROUTES.financeOutstanding}${buildQuery(filters)}`,
  );
  return Array.isArray(payload?.data) ? payload.data : [];
}

export function outstandingCsvUrl(filters: FinanceReportFilters): string {
  return `${BACKEND_URL}${API_ROUTES.financeOutstandingCsv}${buildQuery(filters)}`;
}

export async function listAuditLogs(
  filters: FinanceReportFilters & { page?: number; subject_type?: string; subject_id?: string },
): Promise<AuditLogPage> {
  const payload = await apiFetch<Partial<AuditLogPage>>(
    `${API_ROUTES.financeAuditLogs}${buildQuery(filters)}`,
  );
  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    current_page: payload?.current_page ?? 1,
    last_page: payload?.last_page ?? 1,
    total: payload?.total ?? 0,
  };
}

export interface FeeAdjustmentPayload {
  type: "discount" | "surcharge" | "waiver";
  amount?: string;
  reason: string;
}

export async function applyFeeAdjustment(
  billItemId: string,
  payload: FeeAdjustmentPayload,
): Promise<{ net_amount: string }> {
  const response = await apiFetch<{ data: { bill_item: { net_amount: string } } }>(
    API_ROUTES.feeBillItemAdjustments(billItemId),
    { method: "POST", body: JSON.stringify(payload), treatForbiddenAsEmpty: false },
  );
  return { net_amount: response.data.bill_item.net_amount };
}

export async function reverseFeeAdjustment(adjustmentId: string): Promise<void> {
  await apiFetch(API_ROUTES.feeAdjustment(adjustmentId), {
    method: "DELETE",
    treatForbiddenAsEmpty: false,
  });
}

/**
 * Receipts, like evidence, live behind auth -- fetch as a blob and hand the
 * browser a download rather than linking a public URL.
 */
export async function downloadReceipt(
  paymentId: string,
  filename: string,
  scope: "staff" | "student" = "staff",
): Promise<void> {
  const token = getCookie(scope === "student" ? "student_token" : "token");
  const path =
    scope === "student"
      ? API_ROUTES.studentFeesReceipt(paymentId)
      : API_ROUTES.paymentReceipt(paymentId);

  const response = await fetch(`${BACKEND_URL}${path}`, {
    credentials: "include",
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });

  if (!response.ok) {
    throw new Error("Unable to download this receipt.");
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
