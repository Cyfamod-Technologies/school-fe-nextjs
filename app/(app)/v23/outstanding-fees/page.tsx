"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import {
  getOutstandingStudents,
  outstandingCsvUrl,
  type OutstandingStudentRow,
} from "@/lib/financeReports";
import { listSessions, type Session } from "@/lib/sessions";
import {
  BILL_STATUS_BADGES,
  BILL_STATUS_LABELS,
  formatNaira,
  type BillStatus,
} from "@/lib/studentBills";
import { listTermsBySession, type Term } from "@/lib/terms";

interface Filters {
  sessionId: string;
  termId: string;
  schoolClassId: string;
  classArmId: string;
  status: BillStatus | "";
}

interface FeedbackState {
  type: "danger" | "warning";
  message: string;
}

export default function OutstandingFeesPage() {
  const { schoolContext } = useAuth();
  const [filters, setFilters] = useState<Filters>({
    sessionId: "",
    termId: "",
    schoolClassId: "",
    classArmId: "",
    status: "",
  });
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [rows, setRows] = useState<OutstandingStudentRow[]>([]);
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

  const loadOutstanding = useCallback(
    async (current: Filters) => {
      if (!current.sessionId || !current.termId) {
        return;
      }
      setLoading(true);
      try {
        setRows(
          await getOutstandingStudents({
            session_id: current.sessionId,
            term_id: current.termId,
            school_class_id: current.schoolClassId || undefined,
            class_arm_id: current.classArmId || undefined,
            status: current.status || undefined,
          }),
        );
      } catch (error) {
        fail(error, "Unable to load outstanding fees.");
      } finally {
        setLoading(false);
      }
    },
    [fail],
  );

  useEffect(() => {
    void loadOutstanding(filters);
  }, [filters, loadOutstanding]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Outstanding Fees</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Finance</li>
          <li>Outstanding Fees</li>
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
              <label htmlFor="of-session">Session</label>
              <select
                id="of-session"
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
              <label htmlFor="of-term">Term</label>
              <select
                id="of-term"
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
            <div className="col-md-2 form-group">
              <label htmlFor="of-class">Class</label>
              <select
                id="of-class"
                className="form-control"
                value={filters.schoolClassId}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, schoolClassId: event.target.value, classArmId: "" }))
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
              <label htmlFor="of-arm">Class Arm</label>
              <select
                id="of-arm"
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
            <div className="col-md-2 form-group">
              <label htmlFor="of-status">Status</label>
              <select
                id="of-status"
                className="form-control"
                value={filters.status}
                onChange={(event) =>
                  setFilters((prev) => ({ ...prev, status: event.target.value as BillStatus | "" }))
                }
              >
                <option value="">All statuses</option>
                {(Object.keys(BILL_STATUS_LABELS) as BillStatus[]).map((status) => (
                  <option key={status} value={status}>
                    {BILL_STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>{rows.length} Student(s)</h3>
            </div>
            <a
              className="btn btn-outline-primary"
              href={outstandingCsvUrl({
                session_id: filters.sessionId,
                term_id: filters.termId,
                school_class_id: filters.schoolClassId || undefined,
                class_arm_id: filters.classArmId || undefined,
                status: filters.status || undefined,
              })}
              target="_blank"
              rel="noreferrer"
            >
              Export CSV
            </a>
          </div>
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>Student</th>
                <th>Class</th>
                <th>Total</th>
                <th>Paid</th>
                <th>Outstanding</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="text-center">
                    Loading...
                  </td>
                </tr>
              ) : rows.length ? (
                rows.map((row) => (
                  <tr key={row.student_bill_id}>
                    <td>
                      {row.student_name}
                      <div className="text-muted small">{row.admission_no}</div>
                    </td>
                    <td>
                      {row.class_name ?? "—"} {row.class_arm_name ?? ""}
                    </td>
                    <td>{formatNaira(row.total)}</td>
                    <td>{formatNaira(row.verified_paid)}</td>
                    <td>
                      <strong>{formatNaira(row.outstanding)}</strong>
                    </td>
                    <td>
                      <span className={`badge badge-${BILL_STATUS_BADGES[row.status]}`}>
                        {BILL_STATUS_LABELS[row.status]}
                      </span>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="text-center">
                    Nobody owes anything for these filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
