"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  getCurrentBill,
  getStudentPayment,
  listBillHistory,
  listStudentPayments,
  submitPayment,
} from "@/lib/studentFees";
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_BADGES,
  PAYMENT_STATUS_LABELS,
  type Payment,
  type PaymentMethod,
} from "@/lib/payments";
import {
  BILL_STATUS_BADGES,
  BILL_STATUS_LABELS,
  formatNaira,
  type BillTotals,
  type StudentBill,
} from "@/lib/studentBills";
import { downloadReceipt } from "@/lib/financeReports";

type Tab = "current" | "history" | "payments" | "submit";

const TABS: { value: Tab; label: string }[] = [
  { value: "current", label: "Current Bill" },
  { value: "history", label: "Bill History" },
  { value: "payments", label: "Payment History" },
  { value: "submit", label: "Submit Payment" },
];

const METHODS: PaymentMethod[] = ["bank_transfer", "cash", "pos", "cheque", "other"];

interface FeedbackState {
  type: "success" | "warning" | "danger";
  message: string;
}

const SOURCE_LABELS: Record<string, string> = {
  school: "All students",
  class: "Your class",
  class_arm: "Your class arm",
  student: "Assigned to you",
  manual: "Added by the school",
};

export default function StudentFeesPage() {
  const [tab, setTab] = useState<Tab>("current");
  const [bill, setBill] = useState<StudentBill | null>(null);
  const [emptyTotals, setEmptyTotals] = useState<BillTotals | null>(null);
  const [history, setHistory] = useState<StudentBill[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [expandedBillId, setExpandedBillId] = useState<string | null>(null);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);
  const [detailPaymentId, setDetailPaymentId] = useState<string | null>(null);
  const [detailPayment, setDetailPayment] = useState<Payment | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("bank_transfer");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [payerReference, setPayerReference] = useState("");
  const [note, setNote] = useState("");
  const [files, setFiles] = useState<File[]>([]);

  const fail = useCallback((error: unknown, fallback: string) => {
    setFeedback({
      type: "danger",
      message: error instanceof Error ? error.message : fallback,
    });
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [current, bills, paymentList] = await Promise.all([
        getCurrentBill(),
        listBillHistory(),
        listStudentPayments(),
      ]);
      setBill(current.data);
      setEmptyTotals(current.totals ?? null);
      setHistory(bills);
      setPayments(paymentList);
    } catch (error) {
      fail(error, "Unable to load your fees.");
    } finally {
      setLoading(false);
    }
  }, [fail]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const totals = bill?.totals ?? emptyTotals;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!bill) {
      setFeedback({
        type: "warning",
        message: "There is no bill for this term yet, so there is nothing to pay against.",
      });
      return;
    }
    if (files.length === 0) {
      setFeedback({ type: "warning", message: "Attach your receipt or teller." });
      return;
    }

    setSubmitting(true);
    try {
      await submitPayment({
        amount,
        method,
        paid_at: paidAt,
        session_id: bill.session_id,
        term_id: bill.term_id,
        payer_reference: payerReference || undefined,
        note: note || undefined,
        evidence: files,
      });
      setFeedback({
        type: "success",
        message:
          "Submitted. It will show as paid once the school has checked it — your balance will not change until then.",
      });
      setAmount("");
      setPayerReference("");
      setNote("");
      setFiles([]);
      setTab("payments");
      await loadAll();
    } catch (error) {
      fail(error, "Unable to submit this payment.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDownloadReceipt = async (payment: Payment) => {
    setDownloadingReceiptId(payment.id);
    try {
      await downloadReceipt(
        payment.id,
        `${payment.receipt_number ?? payment.reference}.pdf`,
        "student",
      );
    } catch (error) {
      fail(error, "Unable to download this receipt.");
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const handleToggleDetail = async (payment: Payment) => {
    if (detailPaymentId === payment.id) {
      setDetailPaymentId(null);
      setDetailPayment(null);
      return;
    }
    setDetailPaymentId(payment.id);
    setLoadingDetail(true);
    try {
      setDetailPayment(await getStudentPayment(payment.id));
    } catch (error) {
      fail(error, "Unable to load this payment's details.");
    } finally {
      setLoadingDetail(false);
    }
  };

  if (loading) {
    return <div className="card height-auto"><div className="card-body">Loading your fees...</div></div>;
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Fees &amp; Payments</h3>
      </div>

      {feedback ? (
        <div className={`alert alert-${feedback.type}`} role="alert">
          {feedback.message}
        </div>
      ) : null}

      <ul className="nav nav-tabs mb-3">
        {TABS.map((item) => (
          <li className="nav-item" key={item.value}>
            <button
              type="button"
              className={`nav-link ${tab === item.value ? "active" : ""}`}
              onClick={() => setTab(item.value)}
            >
              {item.label}
            </button>
          </li>
        ))}
      </ul>

      {tab === "current" ? (
        <div className="card height-auto">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>
                  {bill?.session?.name ?? ""} {bill?.term?.name ?? "Current Term"}
                </h3>
              </div>
              {totals ? (
                <span className={`badge badge-${BILL_STATUS_BADGES[totals.status]}`}>
                  {BILL_STATUS_LABELS[totals.status]}
                </span>
              ) : null}
            </div>

            {bill ? (
              <table className="table table-bordered">
                <thead>
                  <tr>
                    <th>Fee</th>
                    <th>Why</th>
                    <th>Amount</th>
                    <th>Paid</th>
                  </tr>
                </thead>
                <tbody>
                  {(bill.items ?? [])
                    .filter((item) => !item.is_removed)
                    .map((item) => (
                      <tr key={item.id}>
                        <td>{item.name}</td>
                        <td className="text-muted">
                          {SOURCE_LABELS[item.source] ?? item.source}
                        </td>
                        <td>{formatNaira(item.net_amount)}</td>
                        <td>{formatNaira(item.paid_amount)}</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted">
                Your school has not published fees for this term yet.
              </p>
            )}

            {totals ? (
              <div className="row">
                <div className="col-md-3">
                  <div className="border rounded p-3 mb-2">
                    <div className="text-muted small">Total Bill</div>
                    <h4>{formatNaira(totals.total)}</h4>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-3 mb-2">
                    <div className="text-muted small">Paid</div>
                    <h4>{formatNaira(totals.verified_paid)}</h4>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-3 mb-2">
                    <div className="text-muted small">Pending Verification</div>
                    <h4>{formatNaira(totals.pending)}</h4>
                    {/* Kept visually distinct from "Paid" on purpose: money the
                        school has not confirmed is not money yet. */}
                    <small className="text-muted">Not yet confirmed</small>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="border rounded p-3 mb-2">
                    <div className="text-muted small">Outstanding</div>
                    <h4>{formatNaira(totals.outstanding)}</h4>
                  </div>
                </div>
              </div>
            ) : null}

            <div className="mt-3">
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                onClick={() => setTab("submit")}
              >
                Submit Payment Evidence
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="card height-auto">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>Bill History</h3>
              </div>
            </div>
            {history.length ? (
              history.map((entry) => (
                <div className="border rounded p-3 mb-2" key={entry.id}>
                  <div className="d-flex justify-content-between align-items-center">
                    <div>
                      <strong>
                        {entry.session?.name} &mdash; {entry.term?.name}
                      </strong>
                      <div className="text-muted small">
                        Total {formatNaira(entry.totals?.total)} &middot; Paid{" "}
                        {formatNaira(entry.totals?.verified_paid)} &middot; Outstanding{" "}
                        {formatNaira(entry.totals?.outstanding)}
                      </div>
                    </div>
                    <div>
                      {entry.totals ? (
                        <span
                          className={`badge badge-${BILL_STATUS_BADGES[entry.totals.status]} mr-2`}
                        >
                          {BILL_STATUS_LABELS[entry.totals.status]}
                        </span>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-primary"
                        onClick={() =>
                          setExpandedBillId(expandedBillId === entry.id ? null : entry.id)
                        }
                      >
                        {expandedBillId === entry.id ? "Hide" : "Details"}
                      </button>
                    </div>
                  </div>
                  {expandedBillId === entry.id ? (
                    <table className="table table-sm mt-2 mb-0">
                      <tbody>
                        {(entry.items ?? []).length ? (
                          (entry.items ?? []).map((item) => (
                            <tr key={item.id}>
                              <td>{item.name}</td>
                              <td className="text-right">{formatNaira(item.net_amount)}</td>
                            </tr>
                          ))
                        ) : (
                          <tr>
                            <td className="text-muted">
                              Open this term from Current Bill to see its fees.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  ) : null}
                </div>
              ))
            ) : (
              <p className="text-muted">No bills yet.</p>
            )}
          </div>
        </div>
      ) : null}

      {tab === "payments" ? (
        <div className="card height-auto">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>Payment History</h3>
              </div>
            </div>
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Reference</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {payments.length ? (
                  payments.map((payment) => (
                    <>
                      <tr key={payment.id}>
                        <td>{payment.paid_at ?? "—"}</td>
                        <td>{formatNaira(payment.amount)}</td>
                        <td>{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</td>
                        <td>
                          <div>{payment.reference}</div>
                          {payment.receipt_number ? (
                            <div className="text-muted small">
                              Receipt: {payment.receipt_number}
                            </div>
                          ) : null}
                        </td>
                        <td>
                          <span className={`badge badge-${PAYMENT_STATUS_BADGES[payment.status]}`}>
                            {PAYMENT_STATUS_LABELS[payment.status]}
                          </span>
                          {payment.rejection_reason ? (
                            <div className="text-danger small">{payment.rejection_reason}</div>
                          ) : null}
                          {payment.reversal_reason ? (
                            <div className="text-muted small">{payment.reversal_reason}</div>
                          ) : null}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary mr-2"
                            onClick={() => handleToggleDetail(payment)}
                          >
                            {detailPaymentId === payment.id ? "Hide" : "Details"}
                          </button>
                          {payment.status === "verified" ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary"
                              onClick={() => handleDownloadReceipt(payment)}
                              disabled={downloadingReceiptId === payment.id}
                            >
                              {downloadingReceiptId === payment.id ? "..." : "Receipt"}
                            </button>
                          ) : null}
                        </td>
                      </tr>
                      {detailPaymentId === payment.id ? (
                        <tr key={`${payment.id}-detail`}>
                          <td colSpan={6} className="bg-light">
                            {loadingDetail || !detailPayment ? (
                              <span className="text-muted">Loading...</span>
                            ) : (
                              <div className="row">
                                <div className="col-md-6">
                                  {detailPayment.payer_reference ? (
                                    <div className="mb-2">
                                      <strong className="small d-block">
                                        Transaction / Reference Number
                                      </strong>
                                      {detailPayment.payer_reference}
                                    </div>
                                  ) : null}
                                  {detailPayment.note ? (
                                    <div className="mb-2">
                                      <strong className="small d-block">Notes</strong>
                                      {detailPayment.note}
                                    </div>
                                  ) : null}
                                  <div className="mb-2">
                                    <strong className="small d-block">Evidence</strong>
                                    {(detailPayment.evidence ?? []).length ? (
                                      (detailPayment.evidence ?? []).map((file) => (
                                        <div key={file.id}>{file.original_name}</div>
                                      ))
                                    ) : (
                                      <span className="text-muted">None attached.</span>
                                    )}
                                  </div>
                                </div>
                                <div className="col-md-6">
                                  <strong className="small d-block mb-1">Applied To</strong>
                                  {(detailPayment.allocations ?? []).length ? (
                                    <>
                                      {(detailPayment.allocations ?? []).map((allocation) => (
                                        <div
                                          key={allocation.id}
                                          className="d-flex justify-content-between"
                                        >
                                          <span>{allocation.fee_name ?? "Fee"}</span>
                                          <span>{formatNaira(allocation.amount)}</span>
                                        </div>
                                      ))}
                                      {detailPayment.unallocated_amount &&
                                      Number(detailPayment.unallocated_amount) > 0 ? (
                                        <div className="d-flex justify-content-between text-muted">
                                          <span>Not yet applied to a fee</span>
                                          <span>
                                            {formatNaira(detailPayment.unallocated_amount)}
                                          </span>
                                        </div>
                                      ) : null}
                                    </>
                                  ) : (
                                    <span className="text-muted">
                                      {detailPayment.status === "verified"
                                        ? "Not yet allocated to a specific fee."
                                        : "Applied once the school verifies this payment."}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      ) : null}
                    </>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No payments recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {tab === "submit" ? (
        <div className="card height-auto">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>Submit Payment</h3>
              </div>
            </div>
            <p className="text-muted">
              Use this after you have paid into the school&apos;s account. Your
              balance stays the same until the school confirms the payment.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="col-md-3 form-group">
                  <label htmlFor="pay-amount">Amount Paid *</label>
                  <input
                    id="pay-amount"
                    type="number"
                    min="1"
                    step="0.01"
                    className="form-control"
                    value={amount}
                    onChange={(event) => setAmount(event.target.value)}
                    required
                  />
                </div>
                <div className="col-md-3 form-group">
                  <label htmlFor="pay-method">Payment Method *</label>
                  <select
                    id="pay-method"
                    className="form-control"
                    value={method}
                    onChange={(event) => setMethod(event.target.value as PaymentMethod)}
                  >
                    {METHODS.map((value) => (
                      <option key={value} value={value}>
                        {PAYMENT_METHOD_LABELS[value]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3 form-group">
                  <label htmlFor="pay-date">Date of Payment *</label>
                  <input
                    id="pay-date"
                    type="date"
                    className="form-control"
                    max={new Date().toISOString().slice(0, 10)}
                    value={paidAt}
                    onChange={(event) => setPaidAt(event.target.value)}
                    required
                  />
                </div>
                <div className="col-md-3 form-group">
                  <label htmlFor="pay-reference">Transaction / Teller Number</label>
                  <input
                    id="pay-reference"
                    type="text"
                    className="form-control"
                    value={payerReference}
                    onChange={(event) => setPayerReference(event.target.value)}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="col-md-6 form-group">
                  <label htmlFor="pay-evidence">Upload Evidence *</label>
                  <input
                    id="pay-evidence"
                    type="file"
                    className="form-control-file"
                    accept="image/jpeg,image/png,image/webp,application/pdf"
                    multiple
                    onChange={(event) =>
                      setFiles(Array.from(event.target.files ?? []).slice(0, 3))
                    }
                  />
                  <small className="text-muted">
                    Up to 3 files. JPG, PNG or PDF, 5MB each.
                  </small>
                </div>
                <div className="col-md-6 form-group">
                  <label htmlFor="pay-note">Notes</label>
                  <textarea
                    id="pay-note"
                    className="form-control"
                    rows={2}
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </div>
              </div>

              <div className="text-right">
                <button
                  type="submit"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  disabled={submitting}
                >
                  {submitting ? "Submitting..." : "Submit Payment"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
