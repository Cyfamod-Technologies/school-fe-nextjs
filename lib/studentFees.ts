import { apiFetch } from "@/lib/apiClient";
import { API_ROUTES, BACKEND_URL } from "@/lib/config";
import { getCookie } from "@/lib/cookies";
import type { BillTotals, StudentBill } from "@/lib/studentBills";
import type { Payment, PaymentMethod } from "@/lib/payments";

/**
 * The student/parent side of fees. Everything here goes out on the student
 * token, not the staff one.
 */

export interface CurrentBillResponse {
  data: StudentBill | null;
  /** Present only when there is no bill yet, so the portal can still show zeros. */
  totals?: BillTotals;
}

export interface PaymentAccount {
  id: string;
  bank_name: string;
  account_name: string;
  account_number: string;
  branch: string | null;
  is_default: boolean;
}

export interface PaymentAccountsResponse {
  data: PaymentAccount[];
  /** What the school asks payers to put in the transfer narration. */
  payment_reference: string;
}

export async function getCurrentBill(params?: {
  sessionId?: string;
  termId?: string;
}): Promise<CurrentBillResponse> {
  const search = new URLSearchParams();
  if (params?.sessionId) search.append("session_id", params.sessionId);
  if (params?.termId) search.append("term_id", params.termId);
  const query = search.toString() ? `?${search.toString()}` : "";

  return apiFetch<CurrentBillResponse>(
    `${API_ROUTES.studentFeesBill}${query}`,
    { authScope: "student", treatForbiddenAsEmpty: false },
  );
}

export async function listBillHistory(): Promise<StudentBill[]> {
  const payload = await apiFetch<{ data: StudentBill[] }>(
    API_ROUTES.studentFeesBills,
    { authScope: "student" },
  );
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function getBill(billId: string): Promise<StudentBill> {
  const payload = await apiFetch<{ data: StudentBill }>(
    `${API_ROUTES.studentFeesBills}/${billId}`,
    { authScope: "student", treatForbiddenAsEmpty: false },
  );
  return payload.data;
}

export async function listStudentPayments(): Promise<Payment[]> {
  const payload = await apiFetch<{ data: Payment[] }>(
    API_ROUTES.studentFeesPayments,
    { authScope: "student" },
  );
  return Array.isArray(payload?.data) ? payload.data : [];
}

export async function getPaymentAccounts(): Promise<PaymentAccountsResponse> {
  return apiFetch<PaymentAccountsResponse>(
    API_ROUTES.studentFeesPaymentAccounts,
    { authScope: "student", treatForbiddenAsEmpty: false },
  );
}

export interface SubmitPaymentPayload {
  amount: string;
  method: PaymentMethod;
  paid_at: string;
  session_id: string;
  term_id: string;
  payer_reference?: string;
  bank_detail_id?: string;
  note?: string;
  evidence: File[];
}

/**
 * Submitting evidence is multipart, so it bypasses apiFetch's JSON body
 * handling and sets the student token by hand.
 */
export async function submitPayment(
  payload: SubmitPaymentPayload,
): Promise<Payment> {
  const form = new FormData();
  form.append("amount", payload.amount);
  form.append("method", payload.method);
  form.append("paid_at", payload.paid_at);
  form.append("session_id", payload.session_id);
  form.append("term_id", payload.term_id);
  if (payload.payer_reference) {
    form.append("payer_reference", payload.payer_reference);
  }
  if (payload.bank_detail_id) {
    form.append("bank_detail_id", payload.bank_detail_id);
  }
  if (payload.note) {
    form.append("note", payload.note);
  }
  payload.evidence.forEach((file) => form.append("evidence[]", file));

  const token = getCookie("student_token");

  const response = await fetch(
    `${BACKEND_URL}${API_ROUTES.studentFeesPayments}`,
    {
      method: "POST",
      credentials: "include",
      headers: {
        Accept: "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: form,
    },
  );

  const body = await response.json().catch(() => null);

  if (!response.ok) {
    const errors = (body as { errors?: Record<string, string[]> })?.errors;
    const firstError = errors ? Object.values(errors)[0]?.[0] : undefined;
    throw new Error(
      firstError ??
        (body as { message?: string })?.message ??
        "Unable to submit this payment.",
    );
  }

  return (body as { data: Payment }).data;
}
