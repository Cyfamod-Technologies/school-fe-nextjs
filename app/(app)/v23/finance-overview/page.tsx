"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listFeeItems, type FeeItem } from "@/lib/fees";
import { getFinanceOverview, type FinanceOverview } from "@/lib/financeReports";
import { listSessions, type Session } from "@/lib/sessions";
import { formatNaira } from "@/lib/studentBills";
import { listTermsBySession, type Term } from "@/lib/terms";

interface Filters {
  sessionId: string;
  termId: string;
  schoolClassId: string;
  classArmId: string;
  feeItemId: string;
  from: string;
  to: string;
}

interface FeedbackState {
  type: "danger" | "warning";
  message: string;
}

export default function FinanceOverviewPage() {
  const { schoolContext } = useAuth();
  const [filters, setFilters] = useState<Filters>({
    sessionId: "",
    termId: "",
    schoolClassId: "",
    classArmId: "",
    feeItemId: "",
    from: "",
    to: "",
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
  const [overview, setOverview] = useState<FinanceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  const fail = useCallback((error: unknown, fallback: string) => {
    setFeedback({
      type: "danger",
      message: error instanceof Error ? error.message : fallback,
    });
  }, []);

  useEffect(() => {
    listClasses().then(setClasses).catch((error) => fail(error, "Unable to load classes."));
    listFeeItems().then(setFeeItems).catch((error) => fail(error, "Unable to load fee items."));
    listSessions()
      .then((loaded) => {
        setSessions(loaded);
        const preferred = schoolContext.current_session_id ?? loaded[0]?.id ?? null;
        if (preferred !== null) {
          setFilters((prev) => ({ ...prev, sessionId: prev.sessionId || String(preferred) }));
        }
      })
      .catch((error) => fail(error, "Unable to load sessions."));
  }, [fail, schoolContext.current_session_id]);

  const loadTerms = useCallback(
    async (sessionId: string) => {
      if (!sessionId) {
        setTerms([]);
        return;
      }
      try {
        const loaded = await listTermsBySession(sessionId);
        setTerms(loaded);
        const preferred =
          loaded.find((term) => String(term.id) === String(schoolContext.current_term_id)) ??
          loaded[0];
        setFilters((prev) => ({
          ...prev,
          termId: prev.termId || (preferred ? String(preferred.id) : ""),
        }));
      } catch (error) {
        fail(error, "Unable to load terms.");
      }
    },
    [fail, schoolContext.current_term_id],
  );

  useEffect(() => {
    void loadTerms(filters.sessionId);
  }, [filters.sessionId, loadTerms]);

  const loadArms = useCallback(
    async (schoolClassId: string) => {
      if (!schoolClassId) {
        setArms([]);
        return;
      }
      try {
        setArms(await listClassArms(schoolClassId));
      } catch (error) {
        fail(error, "Unable to load class arms.");
      }
    },
    [fail],
  );

  useEffect(() => {
    void loadArms(filters.schoolClassId);
  }, [filters.schoolClassId, loadArms]);

  const loadOverview = useCallback(
    async (current: Filters) => {
      if (!current.sessionId || !current.termId) {
        return;
      }
      setLoading(true);
      try {
        setOverview(
          await getFinanceOverview({
            session_id: current.sessionId,
            term_id: current.termId,
            school_class_id: current.schoolClassId || undefined,
            class_arm_id: current.classArmId || undefined,
            fee_item_id: current.feeItemId || undefined,
            from: current.from || undefined,
            to: current.to || undefined,
          }),
        );
      } catch (error) {
        fail(error, "Unable to load finance data.");
      } finally {
        setLoading(false);
      }
    },
    [fail],
  );

  useEffect(() => {
    void loadOverview(filters);
  }, [filters, loadOverview]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Finance Overview</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Finance</li>
          <li>Overview</li>
        </ul>
      </div>

      {feedback ? (
        <div className={`alert alert-${feedback.type}`} role="alert">
          {feedback.message}
        </div>
      ) : null}

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="form-row">
            <div className="col-md-3 form-group">
              <label htmlFor="fo-session">Session</label>
              <select
                id="fo-session"
                className="form-control"
                value={filters.sessionId}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, sessionId: event.target.value, termId: "" }))
                }
              >
                <option value="">Select session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 form-group">
              <label htmlFor="fo-term">Term</label>
              <select
                id="fo-term"
                className="form-control"
                value={filters.termId}
                onChange={(event) => setFilters((prev) => ({ ...prev, termId: event.target.value }))}
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 form-group">
              <label htmlFor="fo-class">Class</label>
              <select
                id="fo-class"
                className="form-control"
                value={filters.schoolClassId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    schoolClassId: event.target.value,
                    classArmId: "",
                  }))
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
            <div className="col-md-3 form-group">
              <label htmlFor="fo-arm">Class Arm</label>
              <select
                id="fo-arm"
                className="form-control"
                value={filters.classArmId}
                onChange={(event) => setFilters((prev) => ({ ...prev, classArmId: event.target.value }))}
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
          </div>

          <div className="form-row">
            <div className="col-md-4 form-group">
              <label htmlFor="fo-fee-item">Fee Type</label>
              <select
                id="fo-fee-item"
                className="form-control"
                value={filters.feeItemId}
                onChange={(event) => setFilters((prev) => ({ ...prev, feeItemId: event.target.value }))}
              >
                <option value="">All fees</option>
                {feeItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4 form-group">
              <label htmlFor="fo-from">Paid From</label>
              <input
                id="fo-from"
                type="date"
                className="form-control"
                value={filters.from}
                onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
              />
            </div>
            <div className="col-md-4 form-group">
              <label htmlFor="fo-to">Paid To</label>
              <input
                id="fo-to"
                type="date"
                className="form-control"
                value={filters.to}
                onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
              />
            </div>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="card height-auto">
          <div className="card-body">Loading...</div>
        </div>
      ) : (
        <div className="row">
          <div className="col-md-3">
            <div className="border rounded p-3 mb-3">
              <div className="text-muted small">Total Expected Fees</div>
              <h3 className="mb-0">{formatNaira(overview?.expected)}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="border rounded p-3 mb-3">
              <div className="text-muted small">Total Verified Payments</div>
              <h3 className="mb-0 text-success">{formatNaira(overview?.verified)}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="border rounded p-3 mb-3">
              <div className="text-muted small">Pending Verification</div>
              <h3 className="mb-0 text-warning">{formatNaira(overview?.pending)}</h3>
            </div>
          </div>
          <div className="col-md-3">
            <div className="border rounded p-3 mb-3">
              <div className="text-muted small">Outstanding</div>
              <h3 className="mb-0 text-danger">{formatNaira(overview?.outstanding)}</h3>
            </div>
          </div>
        </div>
      )}

      <div className="row mt-2">
        <div className="col-md-6">
          <Link href="/v23/outstanding-fees" className="btn btn-outline-secondary btn-block">
            View Outstanding Fees
          </Link>
        </div>
        <div className="col-md-6">
          <Link href="/v23/reports" className="btn btn-outline-secondary btn-block">
            View Reports
          </Link>
        </div>
      </div>
    </>
  );
}
