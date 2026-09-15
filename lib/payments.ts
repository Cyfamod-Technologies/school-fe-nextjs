import { apiFetch } from "@/lib/apiClient";
import { BACKEND_URL, API_ROUTES } from "@/lib/config";
import { getCookie } from "@/lib/cookies";

/**
 * Payments as the admin sees them.
 *
 * A row here is not money until `status` is "verified" -- that is the whole
 * point of the verification queue.
 */
export type PaymentStatus =
  | "pending_verification"
  | "verified"
  | "rejected"
  | "reversed";

export type PaymentMethod =
  | "bank_transfer"
  | "cash"
  | "pos"
  | "cheque"
  | "online"
  | "other";

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  bank_transfer: "Bank Transfer",
  cash: "Cash",
  pos: "POS",
  cheque: "Cheque",
  online: "Online",
  other: "Other",
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending_verification: "Pending Verification",
  verified: "Verified",
  rejected: "Rejected",
  reversed: "Reversed",
};

export const PAYMENT_STATUS_BADGES: Record<PaymentStatus, string> = {
  pending_verification: "warning",
  verified: "success",
  rejected: "danger",
  reversed: "secondary",
};

export interface PaymentEvidenceFile {
  id: string;
  original_name: string;
  mime_type: string;
  size_bytes: number;
}

export interface PaymentAllocationRow {
  id: string;
  student_bill_item_id: string;
  amount: string;
  fee_name: string | null;
}

export interface Payment {
  id: string;
  reference: string;
  receipt_number: string | null;
  payer_reference: string | null;
  amount: string;
  method: PaymentMethod;
  paid_at: string | null;
  note: string | null;
  source: "student_submission" | "admin_manual";
  status: PaymentStatus;
  session_id: string;
  term_id: string;
  student_bill_id: string | null;
  created_at: string | null;
  rejection_reason: string | null;
  reversal_reason: string | null;
  verified_at: string | null;
  rejected_at?: string | null;
  reversed_at?: string | null;
  bank_detail?: { id: string; bank_name: string; account_name: string } | null;
  session?: { id: string; name: string };
  term?: { id: string; name: string };
  evidence?: PaymentEvidenceFile[];
  student?: { id: string; admission_no: string; name: string };
  submitted_by_type?: string | null;
  verified_by?: { id: string; name: string } | null;
  rejected_by?: { id: string; name: string } | null;
  allocations?: PaymentAllocationRow[];
  unallocated_amount?: string;
}

export interface PaymentFilters {
  status?: PaymentStatus | "";
  session_id?: string;
  term_id?: string;
  student_id?: string;
  method?: PaymentMethod | "";
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface PaymentPage {
  data: Payment[];
  current_page: number;
  last_page: number;
  total: number;
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

export async function listPayments(
  filters: PaymentFilters = {},
): Promise<PaymentPage> {
  const payload = await apiFetch<Partial<PaymentPage>>(
    `${API_ROUTES.payments}${buildQuery({
      status: filters.status || undefined,
      session_id: filters.session_id,
      term_id: filters.term_id,
      student_id: filters.student_id,
      method: filters.method || undefined,
      from: filters.from,
      to: filters.to,
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

export async function getPayment(paymentId: string): Promise<Payment> {
  const payload = await apiFetch<{ data: Payment }>(
    `${API_ROUTES.payments}/${paymentId}`,
    { treatForbiddenAsEmpty: false },
  );
  return payload.data;
}

export async function approvePayment(paymentId: string): Promise<Payment> {
  const payload = await apiFetch<{ data: Payment }>(
    `${API_ROUTES.payments}/${paymentId}/approve`,
    { method: "POST", treatForbiddenAsEmpty: false },
  );
  return payload.data;
}

export async function rejectPayment(
  paymentId: string,
  reason: string,
): Promise<Payment> {
  const payload = await apiFetch<{ data: Payment }>(
    `${API_ROUTES.payments}/${paymentId}/reject`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
      treatForbiddenAsEmpty: false,
    },
  );
  return payload.data;
}

export async function reversePayment(
  paymentId: string,
  reason: string,
): Promise<Payment> {
  const payload = await apiFetch<{ data: Payment }>(
    `${API_ROUTES.payments}/${paymentId}/reverse`,
    {
      method: "POST",
      body: JSON.stringify({ reason }),
      treatForbiddenAsEmpty: false,
    },
  );
  return payload.data;
}

export async function allocatePayment(
  paymentId: string,
  allocations: { student_bill_item_id: string; amount: string }[],
): Promise<Payment> {
  const payload = await apiFetch<{ data: Payment }>(
    `${API_ROUTES.payments}/${paymentId}/allocations`,
    {
      method: "PUT",
      body: JSON.stringify({ allocations }),
      treatForbiddenAsEmpty: false,
    },
  );
  return payload.data;
}

export async function recordPayment(payload: {
  student_id: string;
  amount: string;
  method: PaymentMethod;
  paid_at: string;
  session_id: string;
  term_id: string;
  payer_reference?: string | null;
  note?: string | null;
}): Promise<Payment> {
  const response = await apiFetch<{ data: Payment }>(API_ROUTES.payments, {
    method: "POST",
    body: JSON.stringify(payload),
    treatForbiddenAsEmpty: false,
  });
  return response.data;
}

/**
 * Evidence lives on a private disk, so there is no URL to drop into an <img>.
 * Fetch it with the auth header and hand back an object URL the caller must
 * revoke when it is done.
 */
export async function fetchEvidenceObjectUrl(
  paymentId: string,
  evidenceId: string,
): Promise<string> {
  const token = getCookie("token");

  const response = await fetch(
    `${BACKEND_URL}${API_ROUTES.payments}/${paymentId}/evidence/${evidenceId}`,
    {
      credentials: "include",
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    },
  );

  if (!response.ok) {
    throw new Error("Unable to load this evidence file.");
  }

  return URL.createObjectURL(await response.blob());
}
