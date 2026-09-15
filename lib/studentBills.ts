import { apiFetch } from "@/lib/apiClient";
import { API_ROUTES } from "@/lib/config";

/**
 * Bills and balances as the backend computes them.
 *
 * Never derive a balance in the browser: every figure here comes from the
 * server's single calculator, so the admin screens and the student portal
 * always agree.
 */
export type BillStatus =
  | "unpaid"
  | "pending_verification"
  | "partially_paid"
  | "paid"
  | "overpaid";

export const BILL_STATUS_LABELS: Record<BillStatus, string> = {
  unpaid: "Unpaid",
  pending_verification: "Pending Verification",
  partially_paid: "Partially Paid",
  paid: "Paid",
  overpaid: "Overpaid",
};

export const BILL_STATUS_BADGES: Record<BillStatus, string> = {
  unpaid: "danger",
  pending_verification: "warning",
  partially_paid: "info",
  paid: "success",
  overpaid: "primary",
};

export interface BillTotals {
  total: string;
  verified_paid: string;
  /** Submitted but not yet verified. Never counted against the balance. */
  pending: string;
  outstanding: string;
  overpaid_amount: string;
  status: BillStatus;
}

export interface StudentBillItem {
  id: string;
  fee_structure_id: string | null;
  fee_item_id: string | null;
  name: string;
  description: string | null;
  source: "school" | "class" | "class_arm" | "student" | "manual";
  amount: string;
  discount_amount: string;
  surcharge_amount: string;
  net_amount: string;
  paid_amount: string;
  is_removed: boolean;
  removed_reason: string | null;
}

export interface StudentBill {
  id: string;
  school_id: string;
  student_id: string;
  session_id: string;
  term_id: string;
  school_class_id: string | null;
  class_arm_id: string | null;
  generated_at: string | null;
  totals: BillTotals | null;
  student?: { id: string; admission_no: string; name: string };
  school_class?: { id: string; name: string } | null;
  class_arm?: { id: string; name: string } | null;
  session?: { id: string; name: string };
  term?: { id: string; name: string };
  items?: StudentBillItem[];
}

export interface StudentBillFilters {
  session_id?: string;
  term_id?: string;
  school_class_id?: string;
  class_arm_id?: string;
  status?: BillStatus | "";
  search?: string;
  page?: number;
  per_page?: number;
}

export interface StudentBillPage {
  data: StudentBill[];
  current_page: number;
  last_page: number;
  total: number;
}

export interface BillGenerationSummary {
  students: number;
  items_created: number;
  items_updated: number;
  items_removed: number;
}

function buildQuery(
  params: Record<string, string | number | undefined>,
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

export async function listStudentBills(
  filters: StudentBillFilters = {},
): Promise<StudentBillPage> {
  const payload = await apiFetch<Partial<StudentBillPage>>(
    `${API_ROUTES.studentBills}${buildQuery({
      session_id: filters.session_id,
      term_id: filters.term_id,
      school_class_id: filters.school_class_id,
      class_arm_id: filters.class_arm_id,
      status: filters.status || undefined,
      search: filters.search,
      page: filters.page,
      per_page: filters.per_page ?? 25,
    })}`,
  );

  return {
    data: Array.isArray(payload?.data) ? payload.data : [],
    current_page: payload?.current_page ?? 1,
    last_page: payload?.last_page ?? 1,
    total: payload?.total ?? 0,
  };
}

export async function getStudentBill(billId: string): Promise<StudentBill> {
  const payload = await apiFetch<{ data: StudentBill }>(
    `${API_ROUTES.studentBills}/${billId}`,
    { treatForbiddenAsEmpty: false },
  );
  return payload.data;
}

export async function generateStudentBills(payload: {
  session_id: string;
  term_id: string;
  student_ids?: string[];
}): Promise<BillGenerationSummary> {
  const response = await apiFetch<{ data: BillGenerationSummary }>(
    API_ROUTES.studentBillsGenerate,
    { method: "POST", body: JSON.stringify(payload) },
  );
  return response.data;
}

export function formatNaira(value: string | number | null | undefined): string {
  return new Intl.NumberFormat("en-NG", {
    style: "currency",
    currency: "NGN",
    minimumFractionDigits: 2,
  }).format(Number(value ?? 0));
}
