"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PermissionGate } from "@/components/PermissionGate";
import { useAuth } from "@/contexts/AuthContext";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listSessions, type Session } from "@/lib/sessions";
import {
  BILL_STATUS_BADGES,
  BILL_STATUS_LABELS,
  formatNaira,
  generateStudentBills,
  getStudentBill,
  listStudentBills,
  type BillStatus,
  type StudentBill,
} from "@/lib/studentBills";
import { applyFeeAdjustment, type FeeAdjustmentPayload } from "@/lib/financeReports";
import { listTermsBySession, type Term } from "@/lib/terms";

type FeedbackKind = "success" | "info" | "warning" | "danger";

interface FeedbackState {
  type: FeedbackKind;
  message: string;
}

interface Filters {
  sessionId: string;
  termId: string;
  schoolClassId: string;
  classArmId: string;
  status: BillStatus | "";
  search: string;
  page: number;
}

const initialFilters: Filters = {
  sessionId: "",
  termId: "",
  schoolClassId: "",
  classArmId: "",
  status: "",
  search: "",
  page: 1,
};

const SOURCE_LABELS: Record<string, string> = {
  school: "School-wide",
  class: "Class",
  class_arm: "Class arm",
  student: "Individual",
  manual: "Manual",
};

export default function StudentBillsPage() {
  const { schoolContext } = useAuth();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [bills, setBills] = useState<StudentBill[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [expanded, setExpanded] = useState<StudentBill | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [adjustingItemId, setAdjustingItemId] = useState<string | null>(null);
  const [adjustmentType, setAdjustmentType] = useState<FeeAdjustmentPayload["type"]>("discount");
  const [adjustmentAmount, setAdjustmentAmount] = useState("");
  const [adjustmentReason, setAdjustmentReason] = useState("");
  const [savingAdjustment, setSavingAdjustment] = useState(false);

  const fail = useCallback((error: unknown, fallback: string) => {
    setFeedback({
      type: "danger",
      message: error instanceof Error ? error.message : fallback,
    });
  }, []);

  const loadBills = useCallback(
    async (current: Filters) => {
      if (!current.sessionId || !current.termId) {
        setBills([]);
        setTotal(0);
        return;
      }
      setLoading(true);
      try {
        const page = await listStudentBills({
          session_id: current.sessionId,
          term_id: current.termId,
          school_class_id: current.schoolClassId || undefined,
          class_arm_id: current.classArmId || undefined,
          status: current.status || undefined,
          search: current.search || undefined,
          page: current.page,
        });
        setBills(page.data);
        setLastPage(page.last_page);
        setTotal(page.total);
      } catch (error) {
        fail(error, "Unable to load student bills.");
      } finally {
        setLoading(false);
      }
    },
    [fail],
  );

  useEffect(() => {
    listClasses().then(setClasses).catch((error) => fail(error, "Unable to load classes."));
    listSessions()
      .then((loaded) => {
        setSessions(loaded);
        // Default to the period the school itself is currently in.
        const preferred =
          schoolContext.current_session_id ?? loaded[0]?.id ?? null;
        if (preferred !== null) {
          setFilters((prev) => ({
            ...prev,
            sessionId: prev.sessionId || String(preferred),
          }));
        }
      })
      .catch((error) => fail(error, "Unable to load sessions."));
  }, [fail, schoolContext.current_session_id]);

  useEffect(() => {
    if (!filters.sessionId) {
      setTerms([]);
      return;
    }
    listTermsBySession(filters.sessionId)
      .then((loaded) => {
        setTerms(loaded);
        const preferred =
          loaded.find((term) => String(term.id) === String(schoolContext.current_term_id)) ??
          loaded[0];
        setFilters((prev) => ({
          ...prev,
          termId: prev.termId || (preferred ? String(preferred.id) : ""),
        }));
      })
      .catch((error) => fail(error, "Unable to load terms."));
  }, [filters.sessionId, fail, schoolContext.current_term_id]);

  useEffect(() => {
    if (!filters.schoolClassId) {
      setArms([]);
      return;
    }
    listClassArms(filters.schoolClassId)
      .then(setArms)
      .catch((error) => fail(error, "Unable to load class arms."));
  }, [filters.schoolClassId, fail]);

  useEffect(() => {
    void loadBills(filters);
  }, [filters, loadBills]);

  const handleGenerate = async () => {
    if (!filters.sessionId || !filters.termId) {
      setFeedback({ type: "warning", message: "Choose a session and term first." });
      return;
    }
    setGenerating(true);
    try {
      const summary = await generateStudentBills({
        session_id: filters.sessionId,
        term_id: filters.termId,
      });
      setFeedback({
        type: "success",
        message: `${summary.students} bill(s) refreshed: ${summary.items_created} line(s) added, ${summary.items_updated} changed, ${summary.items_removed} removed.`,
      });
      await loadBills(filters);
    } catch (error) {
      fail(error, "Unable to generate bills.");
    } finally {
      setGenerating(false);
    }
  };

  const handleApplyAdjustment = async (billItemId: string) => {
    if (adjustmentReason.trim().length < 3) {
      setFeedback({ type: "warning", message: "Give a reason for this adjustment." });
      return;
    }
    if (adjustmentType !== "waiver" && !adjustmentAmount) {
      setFeedback({ type: "warning", message: "Enter an amount." });
      return;
    }
    setSavingAdjustment(true);
    try {
      await applyFeeAdjustment(billItemId, {
        type: adjustmentType,
        amount: adjustmentType === "waiver" ? undefined : adjustmentAmount,
        reason: adjustmentReason.trim(),
      });
      setFeedback({ type: "success", message: "Adjustment applied." });
      setAdjustingItemId(null);
      setAdjustmentAmount("");
      setAdjustmentReason("");
      if (expanded) {
        setExpanded(await import("@/lib/studentBills").then((m) => m.getStudentBill(expanded.id)));
      }
      await loadBills(filters);
    } catch (error) {
      fail(error, "Unable to apply this adjustment.");
    } finally {
      setSavingAdjustment(false);
    }
  };

  const handleExpand = async (bill: StudentBill) => {
    if (expanded?.id === bill.id) {
      setExpanded(null);
      return;
    }
    try {
      setExpanded(await getStudentBill(bill.id));
    } catch (error) {
      fail(error, "Unable to load this bill.");
    }
  };

  const patch = (changes: Partial<Filters>) =>
    setFilters((prev) => ({ ...prev, ...changes, page: changes.page ?? 1 }));

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Student Bills</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Finance</li>
          <li>Student Bills</li>
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
              <h3>Filters</h3>
            </div>
            <PermissionGate permission="finance.bills.generate">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={handleGenerate}
                disabled={generating}
              >
                {generating ? "Refreshing..." : "Refresh Bills"}
              </button>
            </PermissionGate>
          </div>

          <div className="form-row">
            <div className="col-md-2 form-group">
              <label htmlFor="bills-session">Session</label>
              <select
                id="bills-session"
                className="form-control"
                value={filters.sessionId}
                onChange={(event) => patch({ sessionId: event.target.value, termId: "" })}
              >
                <option value="">Select session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2 form-group">
              <label htmlFor="bills-term">Term</label>
              <select
                id="bills-term"
                className="form-control"
                value={filters.termId}
                onChange={(event) => patch({ termId: event.target.value })}
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2 form-group">
              <label htmlFor="bills-class">Class</label>
              <select
                id="bills-class"
                className="form-control"
                value={filters.schoolClassId}
                onChange={(event) =>
                  patch({ schoolClassId: event.target.value, classArmId: "" })
                }
              >
                <option value="">All classes</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2 form-group">
              <label htmlFor="bills-arm">Class Arm</label>
              <select
                id="bills-arm"
                className="form-control"
                value={filters.classArmId}
                onChange={(event) => patch({ classArmId: event.target.value })}
                disabled={!filters.schoolClassId}
              >
                <option value="">All arms</option>
                {arms.map((arm) => (
                  <option key={arm.id} value={arm.id}>
                    {arm.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2 form-group">
              <label htmlFor="bills-status">Status</label>
              <select
                id="bills-status"
                className="form-control"
                value={filters.status}
                onChange={(event) => patch({ status: event.target.value as BillStatus | "" })}
              >
                <option value="">All statuses</option>
                {(Object.keys(BILL_STATUS_LABELS) as BillStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {BILL_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2 form-group">
              <label htmlFor="bills-search">Student</label>
              <input
                id="bills-search"
                type="search"
                className="form-control"
                placeholder="Name or admission no."
                value={filters.search}
                onChange={(event) => patch({ search: event.target.value })}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>{total} Bill(s)</h3>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Class</th>
                  <th>Total Bill</th>
                  <th>Verified Paid</th>
                  <th>Pending</th>
                  <th>Outstanding</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center">
                      Loading...
                    </td>
                  </tr>
                ) : bills.length ? (
                  bills.map((bill) => {
                    const totals = bill.totals;
                    const status = totals?.status ?? "unpaid";
                    const isOpen = expanded?.id === bill.id;

                    return [
                      <tr key={bill.id}>
                        <td>
                          {bill.student?.name ?? "—"}
                          <div className="text-muted small">
                            {bill.student?.admission_no ?? ""}
                          </div>
                        </td>
                        <td>
                          {bill.school_class?.name ?? "—"}
                          {bill.class_arm?.name ? ` ${bill.class_arm.name}` : ""}
                        </td>
                        <td>{formatNaira(totals?.total)}</td>
                        <td>{formatNaira(totals?.verified_paid)}</td>
                        <td>
                          {/* Submitted evidence, not money -- it never reduces
                              the outstanding column beside it. */}
                          {formatNaira(totals?.pending)}
                        </td>
                        <td>
                          <strong>{formatNaira(totals?.outstanding)}</strong>
                        </td>
                        <td>
                          <span className={`badge badge-${BILL_STATUS_BADGES[status]}`}>
                            {BILL_STATUS_LABELS[status]}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary"
                            onClick={() => handleExpand(bill)}
                          >
                            {isOpen ? "Hide" : "Breakdown"}
                          </button>
                        </td>
                      </tr>,
                      isOpen && expanded ? (
                        <tr key={`${bill.id}-detail`}>
                          <td colSpan={8} className="bg-light">
                            <table className="table table-sm mb-0">
                              <thead>
                                <tr>
                                  <th>Fee</th>
                                  <th>From</th>
                                  <th>Amount</th>
                                  <th>Discount</th>
                                  <th>Surcharge</th>
                                  <th>Payable</th>
                                  <th>Paid</th>
                                  <PermissionGate permission="finance.bill-items.adjust">
                                    <th />
                                  </PermissionGate>
                                </tr>
                              </thead>
                              <tbody>
                                {(expanded.items ?? [])
                                  .filter((item) => !item.is_removed)
                                  .map((item) => (
                                    <>
                                      <tr key={item.id}>
                                        <td>{item.name}</td>
                                        <td>{SOURCE_LABELS[item.source] ?? item.source}</td>
                                        <td>{formatNaira(item.amount)}</td>
                                        <td>{formatNaira(item.discount_amount)}</td>
                                        <td>{formatNaira(item.surcharge_amount)}</td>
                                        <td>{formatNaira(item.net_amount)}</td>
                                        <td>{formatNaira(item.paid_amount)}</td>
                                        <PermissionGate permission="finance.bill-items.adjust">
                                          <td>
                                            <button
                                              type="button"
                                              className="btn btn-sm btn-link p-0"
                                              onClick={() =>
                                                setAdjustingItemId(
                                                  adjustingItemId === item.id ? null : item.id,
                                                )
                                              }
                                            >
                                              {adjustingItemId === item.id ? "Cancel" : "Adjust"}
                                            </button>
                                          </td>
                                        </PermissionGate>
                                      </tr>
                                      {adjustingItemId === item.id ? (
                                        <tr key={`${item.id}-adjust`}>
                                          <td colSpan={8} className="bg-light">
                                            <div className="form-row align-items-end">
                                              <div className="col-md-3 form-group mb-2">
                                                <label className="small mb-1">Type</label>
                                                <select
                                                  className="form-control form-control-sm"
                                                  value={adjustmentType}
                                                  onChange={(event) =>
                                                    setAdjustmentType(
                                                      event.target.value as FeeAdjustmentPayload["type"],
                                                    )
                                                  }
                                                >
                                                  <option value="discount">Discount</option>
                                                  <option value="surcharge">Surcharge</option>
                                                  <option value="waiver">Waive remaining balance</option>
                                                </select>
                                              </div>
                                              {adjustmentType !== "waiver" ? (
                                                <div className="col-md-2 form-group mb-2">
                                                  <label className="small mb-1">Amount</label>
                                                  <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    className="form-control form-control-sm"
                                                    value={adjustmentAmount}
                                                    onChange={(event) =>
                                                      setAdjustmentAmount(event.target.value)
                                                    }
                                                  />
                                                </div>
                                              ) : null}
                                              <div className="col-md-4 form-group mb-2">
                                                <label className="small mb-1">Reason</label>
                                                <input
                                                  type="text"
                                                  className="form-control form-control-sm"
                                                  value={adjustmentReason}
                                                  onChange={(event) =>
                                                    setAdjustmentReason(event.target.value)
                                                  }
                                                />
                                              </div>
                                              <div className="col-md-3 form-group mb-2">
                                                <button
                                                  type="button"
                                                  className="btn btn-sm btn-primary"
                                                  onClick={() => handleApplyAdjustment(item.id)}
                                                  disabled={savingAdjustment}
                                                >
                                                  {savingAdjustment ? "Saving..." : "Apply"}
                                                </button>
                                              </div>
                                            </div>
                                          </td>
                                        </tr>
                                      ) : null}
                                    </>
                                  ))}
                                {(expanded.items ?? []).some((item) => item.is_removed) ? (
                                  <tr>
                                    <td colSpan={8} className="text-muted small">
                                      Some lines were withdrawn after a payment was
                                      allocated to them; they are kept for the record
                                      but no longer payable.
                                    </td>
                                  </tr>
                                ) : null}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      ) : null,
                    ];
                  })
                ) : (
                  <tr>
                    <td colSpan={8} className="text-center">
                      {filters.sessionId && filters.termId
                        ? "No bills match these filters."
                        : "Choose a session and term to see bills."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {lastPage > 1 ? (
            <div className="d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
                disabled={filters.page <= 1}
              >
                Previous
              </button>
              <span className="text-muted small">
                Page {filters.page} of {lastPage}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
                disabled={filters.page >= lastPage}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
