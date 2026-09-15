"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/PermissionGate";
import {
  allocatePayment,
  approvePayment,
  fetchEvidenceObjectUrl,
  getPayment,
  listPayments,
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_BADGES,
  PAYMENT_STATUS_LABELS,
  rejectPayment,
  reversePayment,
  type Payment,
  type PaymentEvidenceFile,
  type PaymentStatus,
} from "@/lib/payments";
import { formatNaira, getStudentBill, type StudentBillItem } from "@/lib/studentBills";
import { downloadReceipt } from "@/lib/financeReports";

type FeedbackKind = "success" | "info" | "warning" | "danger";

interface FeedbackState {
  type: FeedbackKind;
  message: string;
}

interface EvidencePreview {
  url: string;
  file: PaymentEvidenceFile;
}

const STATUS_TABS: { value: PaymentStatus; label: string }[] = [
  { value: "pending_verification", label: "Awaiting Verification" },
  { value: "verified", label: "Verified" },
  { value: "rejected", label: "Rejected" },
  { value: "reversed", label: "Reversed" },
];

export default function PaymentSubmissionsPage() {
  const [status, setStatus] = useState<PaymentStatus>("pending_verification");
  const [search, setSearch] = useState("");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [preview, setPreview] = useState<EvidencePreview | null>(null);
  const [rejecting, setRejecting] = useState<Payment | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  /** Guards against a double-click crediting a student twice. */
  const [busyId, setBusyId] = useState<string | null>(null);
  const [allocating, setAllocating] = useState<Payment | null>(null);
  const [allocationItems, setAllocationItems] = useState<StudentBillItem[]>([]);
  const [allocationRows, setAllocationRows] = useState<Record<string, string>>({});
  const [savingAllocation, setSavingAllocation] = useState(false);
  const [downloadingReceiptId, setDownloadingReceiptId] = useState<string | null>(null);

  const fail = useCallback((error: unknown, fallback: string) => {
    setFeedback({
      type: "danger",
      message: error instanceof Error ? error.message : fallback,
    });
  }, []);

  const load = useCallback(
    async (currentStatus: PaymentStatus, currentSearch: string) => {
      setLoading(true);
      try {
        const page = await listPayments({
          status: currentStatus,
          search: currentSearch || undefined,
        });
        setPayments(page.data);
        setTotal(page.total);
      } catch (error) {
        fail(error, "Unable to load payments.");
      } finally {
        setLoading(false);
      }
    },
    [fail],
  );

  useEffect(() => {
    void load(status, search);
  }, [status, search, load]);

  // An object URL held past its preview leaks the blob.
  useEffect(() => {
    return () => {
      if (preview) {
        URL.revokeObjectURL(preview.url);
      }
    };
  }, [preview]);

  const handleViewEvidence = async (payment: Payment, file: PaymentEvidenceFile) => {
    try {
      const url = await fetchEvidenceObjectUrl(payment.id, file.id);
      setPreview((current) => {
        if (current) {
          URL.revokeObjectURL(current.url);
        }
        return { url, file };
      });
    } catch (error) {
      fail(error, "Unable to open this evidence file.");
    }
  };

  const handleApprove = async (payment: Payment) => {
    if (
      !window.confirm(
        `Verify ${formatNaira(payment.amount)} from ${payment.student?.name ?? "this student"}? This credits their account and issues a receipt.`,
      )
    ) {
      return;
    }
    setBusyId(payment.id);
    try {
      const verified = await approvePayment(payment.id);
      setFeedback({
        type: "success",
        message: `Verified. Receipt ${verified.receipt_number ?? ""} issued.`,
      });
      await load(status, search);
    } catch (error) {
      fail(error, "Unable to verify this payment.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async () => {
    if (!rejecting) {
      return;
    }
    if (rejectReason.trim().length < 5) {
      setFeedback({
        type: "warning",
        message: "Give a reason the parent can act on — it is shown to them.",
      });
      return;
    }
    setBusyId(rejecting.id);
    try {
      await rejectPayment(rejecting.id, rejectReason.trim());
      setFeedback({ type: "success", message: "Payment rejected." });
      setRejecting(null);
      setRejectReason("");
      await load(status, search);
    } catch (error) {
      fail(error, "Unable to reject this payment.");
    } finally {
      setBusyId(null);
    }
  };

  const openAllocation = async (payment: Payment) => {
    try {
      const full = await getPayment(payment.id);
      setAllocating(full);

      const rows: Record<string, string> = {};
      (full.allocations ?? []).forEach((row) => {
        rows[row.student_bill_item_id] = row.amount;
      });
      setAllocationRows(rows);

      if (full.student_bill_id) {
        const bill = await getStudentBill(full.student_bill_id);
        setAllocationItems((bill.items ?? []).filter((item) => !item.is_removed));
      } else {
        setAllocationItems([]);
      }
    } catch (error) {
      fail(error, "Unable to load this payment's allocation.");
    }
  };

  const handleSaveAllocation = async () => {
    if (!allocating) {
      return;
    }
    const rows = Object.entries(allocationRows)
      .filter(([, amount]) => amount.trim() !== "" && Number(amount) > 0)
      .map(([student_bill_item_id, amount]) => ({ student_bill_item_id, amount }));

    setSavingAllocation(true);
    try {
      await allocatePayment(allocating.id, rows);
      setFeedback({ type: "success", message: "Allocation saved." });
      setAllocating(null);
      await load(status, search);
    } catch (error) {
      fail(error, "Unable to save this allocation.");
    } finally {
      setSavingAllocation(false);
    }
  };

  const handleDownloadReceipt = async (payment: Payment) => {
    setDownloadingReceiptId(payment.id);
    try {
      await downloadReceipt(payment.id, `${payment.receipt_number ?? payment.reference}.pdf`);
    } catch (error) {
      fail(error, "Unable to download this receipt.");
    } finally {
      setDownloadingReceiptId(null);
    }
  };

  const handleReverse = async (payment: Payment) => {
    const reason = window.prompt(
      "Why is this verified payment being reversed? The record is kept either way.",
    );
    if (reason === null) {
      return;
    }
    if (reason.trim().length < 5) {
      setFeedback({ type: "warning", message: "A reversal needs a reason." });
      return;
    }
    setBusyId(payment.id);
    try {
      await reversePayment(payment.id, reason.trim());
      setFeedback({ type: "success", message: "Payment reversed." });
      await load(status, search);
    } catch (error) {
      fail(error, "Unable to reverse this payment.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Payment Submissions</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Finance</li>
          <li>Payment Submissions</li>
        </ul>
      </div>

      {feedback ? (
        <div className={`alert alert-${feedback.type}`} role="alert">
          {feedback.message}
        </div>
      ) : null}

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>{total} Payment(s)</h3>
            </div>
            <input
              type="search"
              className="form-control"
              style={{ maxWidth: "260px" }}
              placeholder="Student, reference or receipt"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              aria-label="Search payments"
            />
          </div>

          <ul className="nav nav-tabs mb-3">
            {STATUS_TABS.map((tab) => (
              <li className="nav-item" key={tab.value}>
                <button
                  type="button"
                  className={`nav-link ${status === tab.value ? "active" : ""}`}
                  onClick={() => setStatus(tab.value)}
                >
                  {tab.label}
                </button>
              </li>
            ))}
          </ul>

          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Paid On</th>
                  <th>Reference</th>
                  <th>Evidence</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center">
                      Loading...
                    </td>
                  </tr>
                ) : payments.length ? (
                  payments.map((payment) => (
                    <tr key={payment.id}>
                      <td>
                        {payment.student?.name ?? "—"}
                        <div className="text-muted small">
                          {payment.student?.admission_no ?? ""}
                        </div>
                      </td>
                      <td>
                        <strong>{formatNaira(payment.amount)}</strong>
                      </td>
                      <td>{PAYMENT_METHOD_LABELS[payment.method] ?? payment.method}</td>
                      <td>{payment.paid_at ?? "—"}</td>
                      <td>
                        <div>{payment.reference}</div>
                        {payment.payer_reference ? (
                          <div className="text-muted small">
                            Bank: {payment.payer_reference}
                          </div>
                        ) : null}
                        {payment.receipt_number ? (
                          <div className="text-muted small">
                            Receipt: {payment.receipt_number}
                          </div>
                        ) : null}
                      </td>
                      <td>
                        {(payment.evidence ?? []).length ? (
                          (payment.evidence ?? []).map((file) => (
                            <button
                              key={file.id}
                              type="button"
                              className="btn btn-sm btn-link p-0 d-block text-left"
                              onClick={() => handleViewEvidence(payment, file)}
                            >
                              {file.original_name}
                            </button>
                          ))
                        ) : (
                          <span className="text-muted">
                            {payment.source === "admin_manual" ? "Recorded by staff" : "None"}
                          </span>
                        )}
                      </td>
                      <td>
                        <span className={`badge badge-${PAYMENT_STATUS_BADGES[payment.status]}`}>
                          {PAYMENT_STATUS_LABELS[payment.status]}
                        </span>
                        {payment.rejection_reason ? (
                          <div className="text-muted small">{payment.rejection_reason}</div>
                        ) : null}
                        {payment.reversal_reason ? (
                          <div className="text-muted small">{payment.reversal_reason}</div>
                        ) : null}
                      </td>
                      <td>
                        {payment.status === "pending_verification" ? (
                          <>
                            <PermissionGate permission="finance.payments.verify">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-success mr-2"
                                onClick={() => handleApprove(payment)}
                                disabled={busyId === payment.id}
                              >
                                {busyId === payment.id ? "Working..." : "Approve"}
                              </button>
                            </PermissionGate>
                            <PermissionGate permission="finance.payments.reject">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => {
                                  setRejecting(payment);
                                  setRejectReason("");
                                }}
                                disabled={busyId === payment.id}
                              >
                                Reject
                              </button>
                            </PermissionGate>
                          </>
                        ) : payment.status === "verified" ? (
                          <>
                            <PermissionGate permission="finance.payments.allocate">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary mr-2"
                                onClick={() => openAllocation(payment)}
                              >
                                Allocate
                              </button>
                            </PermissionGate>
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-secondary mr-2"
                              onClick={() => handleDownloadReceipt(payment)}
                              disabled={downloadingReceiptId === payment.id}
                            >
                              {downloadingReceiptId === payment.id ? "..." : "Receipt"}
                            </button>
                            <PermissionGate permission="finance.payments.reverse">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-secondary"
                                onClick={() => handleReverse(payment)}
                                disabled={busyId === payment.id}
                              >
                                Reverse
                              </button>
                            </PermissionGate>
                          </>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center">
                      Nothing here.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {allocating ? (
        <div className="card height-auto mb-4">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>
                  Allocate {formatNaira(allocating.amount)} from{" "}
                  {allocating.student?.name ?? "this student"}
                </h3>
              </div>
              <button type="button" className="btn btn-link" onClick={() => setAllocating(null)}>
                Close
              </button>
            </div>
            <p className="text-muted">
              This decides which fees the payment is recorded against. It does
              not change the student&apos;s balance — that already follows the
              verified payment amount.
            </p>
            {allocationItems.length ? (
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Fee</th>
                    <th>Payable</th>
                    <th>Already Paid</th>
                    <th>Allocate</th>
                  </tr>
                </thead>
                <tbody>
                  {allocationItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.name}</td>
                      <td>{formatNaira(item.net_amount)}</td>
                      <td>{formatNaira(item.paid_amount)}</td>
                      <td>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className="form-control form-control-sm"
                          style={{ maxWidth: "140px" }}
                          value={allocationRows[item.id] ?? ""}
                          onChange={(event) =>
                            setAllocationRows((prev) => ({
                              ...prev,
                              [item.id]: event.target.value,
                            }))
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-muted">
                This student has no bill for the payment&apos;s session and
                term to allocate against.
              </p>
            )}
            <div className="text-right">
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                onClick={handleSaveAllocation}
                disabled={savingAllocation}
              >
                {savingAllocation ? "Saving..." : "Save Allocation"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {rejecting ? (
        <div className="card height-auto mb-4">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>
                  Reject {formatNaira(rejecting.amount)} from{" "}
                  {rejecting.student?.name ?? "this student"}
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setRejecting(null)}
              >
                Cancel
              </button>
            </div>
            <div className="form-group">
              <label htmlFor="reject-reason">
                Reason (shown to the student or parent)
              </label>
              <textarea
                id="reject-reason"
                className="form-control"
                rows={3}
                value={rejectReason}
                onChange={(event) => setRejectReason(event.target.value)}
              />
            </div>
            <div className="text-right">
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={handleReject}
                disabled={busyId === rejecting.id}
              >
                {busyId === rejecting.id ? "Rejecting..." : "Reject Payment"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {preview ? (
        <div className="card height-auto">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>{preview.file.original_name}</h3>
              </div>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => {
                  URL.revokeObjectURL(preview.url);
                  setPreview(null);
                }}
              >
                Close
              </button>
            </div>
            {preview.file.mime_type === "application/pdf" ? (
              <iframe
                src={preview.url}
                title={preview.file.original_name}
                style={{ width: "100%", height: "600px", border: 0 }}
              />
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={preview.url}
                alt={preview.file.original_name}
                style={{ maxWidth: "100%" }}
              />
            )}
          </div>
        </div>
      ) : null}
    </>
  );
}
