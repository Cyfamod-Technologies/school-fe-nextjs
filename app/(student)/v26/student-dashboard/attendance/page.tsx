"use client";

import { useEffect, useMemo, useState } from "react";
import { useStudentAuth } from "@/contexts/StudentAuthContext";
import {
  getStudentAttendance,
  type StudentAttendanceDay,
  type StudentAttendanceHistory,
  type StudentAttendanceStatus,
} from "@/lib/studentAttendance";
import {
  listStudentSessions,
  type StudentSessionOption,
} from "@/lib/studentResults";

const currentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
};

const statusMeta: Record<
  StudentAttendanceStatus,
  { label: string; symbol: string; className: string }
> = {
  present: { label: "Present", symbol: "✓", className: "attendance-present" },
  absent: { label: "Absent", symbol: "×", className: "attendance-absent" },
  late: { label: "Late", symbol: "L", className: "attendance-late" },
  excused: { label: "Excused", symbol: "E", className: "attendance-excused" },
};

function shiftMonth(value: string, amount: number): string {
  const [year, month] = value.split("-").map(Number);
  const date = new Date(year, month - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function dateMonth(value?: string | null): string | null {
  const match = value?.match(/^(\d{4}-\d{2})/);
  return match?.[1] ?? null;
}

function clampMonthToTerm(
  value: string,
  term?: { start_date?: string | null; end_date?: string | null },
): string {
  const firstMonth = dateMonth(term?.start_date);
  const lastMonth = dateMonth(term?.end_date);

  if (firstMonth && value < firstMonth) return firstMonth;
  if (lastMonth && value > lastMonth) return lastMonth;
  return value;
}

export default function StudentAttendancePage() {
  const { student } = useStudentAuth();
  const [sessions, setSessions] = useState<StudentSessionOption[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [termId, setTermId] = useState("");
  const [month, setMonth] = useState(currentMonth);
  const [attendance, setAttendance] =
    useState<StudentAttendanceHistory | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [loadingAttendance, setLoadingAttendance] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    void listStudentSessions()
      .then(({ sessions: options }) => {
        if (cancelled) return;
        setSessions(options);

        const preferredSession =
          options.find(
            (option) => String(option.id) === String(student?.current_session?.id),
          ) ?? options[0];
        const preferredTerm =
          preferredSession?.terms?.find(
            (term) => String(term.id) === String(student?.current_term?.id),
          ) ?? preferredSession?.terms?.[0];

        setSessionId(preferredSession ? String(preferredSession.id) : "");
        setTermId(preferredTerm ? String(preferredTerm.id) : "");
        if (preferredTerm) {
          setMonth((value) => clampMonthToTerm(value, preferredTerm));
        }
      })
      .catch((optionsError) => {
        if (cancelled) return;
        setError(
          optionsError instanceof Error
            ? optionsError.message
            : "Unable to load academic sessions.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingOptions(false);
      });

    return () => {
      cancelled = true;
    };
  }, [student?.current_session?.id, student?.current_term?.id]);

  useEffect(() => {
    if (!sessionId || !termId || !month) {
      return;
    }

    let cancelled = false;

    void getStudentAttendance({ sessionId, termId, month })
      .then((data) => {
        if (!cancelled) {
          setAttendance(data);
          setError(null);
        }
      })
      .catch((attendanceError) => {
        if (cancelled) return;
        setAttendance(null);
        setError(
          attendanceError instanceof Error
            ? attendanceError.message
            : "Unable to load attendance.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoadingAttendance(false);
      });

    return () => {
      cancelled = true;
    };
  }, [sessionId, termId, month]);

  const selectedSession = useMemo(
    () => sessions.find((session) => String(session.id) === sessionId),
    [sessions, sessionId],
  );
  const terms = useMemo(() => selectedSession?.terms ?? [], [selectedSession]);
  const selectedTerm = useMemo(
    () => terms.find((term) => String(term.id) === termId),
    [terms, termId],
  );
  const firstTermMonth = dateMonth(selectedTerm?.start_date);
  const lastTermMonth = dateMonth(selectedTerm?.end_date);

  const showMonthRangeError = (direction: "before" | "after") => {
    const boundary = direction === "before" ? selectedTerm?.start_date : selectedTerm?.end_date;
    const message = direction === "before"
      ? `You cannot move before ${selectedTerm?.name ?? "this term"} starts${boundary ? ` (${boundary})` : ""}.`
      : `You cannot move past ${selectedTerm?.name ?? "this term"} ends${boundary ? ` (${boundary})` : ""}.`;

    setError(message);
    window.alert(message);
  };

  const changeCalendarMonth = (candidate: string) => {
    if (firstTermMonth && candidate < firstTermMonth) {
      showMonthRangeError("before");
      return;
    }
    if (lastTermMonth && candidate > lastTermMonth) {
      showMonthRangeError("after");
      return;
    }

    setError(null);
    setLoadingAttendance(true);
    setMonth(candidate);
  };

  const daysByDate = useMemo(() => {
    const map = new Map<string, StudentAttendanceDay>();
    attendance?.days.forEach((day) => map.set(day.date, day));
    return map;
  }, [attendance]);

  const calendarCells = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    const firstWeekday = new Date(year, monthNumber - 1, 1).getDay();
    const daysInMonth = new Date(year, monthNumber, 0).getDate();
    const cells: Array<number | null> = Array.from(
      { length: firstWeekday },
      () => null,
    );
    for (let day = 1; day <= daysInMonth; day += 1) cells.push(day);
    while (cells.length % 7 !== 0) cells.push(null);
    return cells;
  }, [month]);

  const monthLabel = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    return new Intl.DateTimeFormat("en", {
      month: "long",
      year: "numeric",
    }).format(new Date(year, monthNumber - 1, 1));
  }, [month]);

  const summary = attendance?.summary;

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>My Attendance</h3>
        <ul>
          <li>Student Dashboard</li>
          <li>Attendance</li>
        </ul>
      </div>

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="heading-layout1 mb-3">
            <div className="item-title">
              <h3>Attendance Filters</h3>
              <p className="text-muted mb-0">
                Choose a session, term, and month to view your daily record.
              </p>
            </div>
          </div>

          {error ? <div className="alert alert-danger">{error}</div> : null}

          <div className="row">
            <div className="col-md-4 mb-3">
              <label htmlFor="attendance-session">Session</label>
              <select
                id="attendance-session"
                className="form-control"
                value={sessionId}
                disabled={loadingOptions}
                onChange={(event) => {
                  const nextSessionId = event.target.value;
                  const nextSession = sessions.find(
                    (session) => String(session.id) === nextSessionId,
                  );
                  setSessionId(nextSessionId);
                  setLoadingAttendance(true);
                  const nextTerm = nextSession?.terms?.[0];
                  setTermId(nextTerm ? String(nextTerm.id) : "");
                  if (nextTerm) {
                    setMonth((value) => clampMonthToTerm(value, nextTerm));
                  }
                }}
              >
                <option value="">Select session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={String(session.id)}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="attendance-term">Term</label>
              <select
                id="attendance-term"
                className="form-control"
                value={termId}
                disabled={!sessionId || loadingOptions}
                onChange={(event) => {
                  const nextTerm = terms.find(
                    (term) => String(term.id) === event.target.value,
                  );
                  setLoadingAttendance(true);
                  setTermId(event.target.value);
                  if (nextTerm) {
                    setMonth((value) => clampMonthToTerm(value, nextTerm));
                  }
                }}
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={String(term.id)}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-4 mb-3">
              <label htmlFor="attendance-month">Month</label>
              <input
                id="attendance-month"
                type="month"
                className="form-control"
                value={month}
                min={firstTermMonth ?? undefined}
                max={lastTermMonth ?? undefined}
                onChange={(event) => changeCalendarMonth(event.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {summary ? (
        <div className="row gutters-20">
          {[
            ["Present", summary.present, "bg-light-green"],
            ["Absent", summary.absent, "bg-light-red"],
            ["Recorded Days", summary.recorded_days, "bg-skyblue"],
            ["Attendance", `${summary.percentage}%`, "bg-yellow"],
          ].map(([label, value, accent]) => (
            <div className="col-xl-3 col-sm-6 col-12" key={String(label)}>
              <div className={`dashboard-summery-one ${accent} mg-b-20`}>
                <div className="item-content text-center">
                  <div className="item-title">{label}</div>
                  <div className="item-number">{value}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="card height-auto">
        <div className="card-body">
          <div className="attendance-calendar-header">
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => changeCalendarMonth(shiftMonth(month, -1))}
            >
              Previous
            </button>
            <h3 className="mb-0">{monthLabel}</h3>
            <button
              type="button"
              className="btn btn-outline-secondary btn-sm"
              onClick={() => changeCalendarMonth(shiftMonth(month, 1))}
            >
              Next
            </button>
          </div>

          {loadingAttendance ? (
            <div className="text-center py-5">
              <div className="spinner-border text-primary" role="status" />
              <p className="text-muted mt-3 mb-0">Loading attendance…</p>
            </div>
          ) : (
            <div className="attendance-calendar" aria-label={monthLabel}>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div className="attendance-weekday" key={day}>{day}</div>
              ))}
              {calendarCells.map((day, index) => {
                if (day === null) {
                  return <div className="attendance-cell is-empty" key={`empty-${index}`} />;
                }
                const date = `${month}-${String(day).padStart(2, "0")}`;
                const record = daysByDate.get(date);
                const meta = record ? statusMeta[record.status] : null;
                return (
                  <div
                    className={`attendance-cell ${meta?.className ?? "attendance-unmarked"}`}
                    key={date}
                    aria-label={`${date}: ${meta?.label ?? "No attendance recorded"}`}
                  >
                    <span className="attendance-day-number">{day}</span>
                    <span className="attendance-status-symbol">
                      {meta?.symbol ?? "·"}
                    </span>
                    <small>{meta?.label ?? "Not recorded"}</small>
                  </div>
                );
              })}
            </div>
          )}

          <div className="attendance-legend mt-4">
            {Object.values(statusMeta).map((meta) => (
              <span key={meta.label} className={`attendance-legend-item ${meta.className}`}>
                {meta.symbol} {meta.label}
              </span>
            ))}
            <span className="attendance-legend-item attendance-unmarked">· Not recorded</span>
          </div>
        </div>
      </div>

      <style jsx>{`
        .attendance-calendar-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .attendance-calendar {
          display: grid;
          grid-template-columns: repeat(7, minmax(0, 1fr));
          gap: 0.6rem;
        }
        .attendance-weekday {
          text-align: center;
          color: #64748b;
          font-weight: 700;
          padding: 0.5rem 0;
        }
        .attendance-cell {
          min-height: 96px;
          border-radius: 10px;
          padding: 0.65rem;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          border: 1px solid #e2e8f0;
          text-align: center;
        }
        .attendance-cell.is-empty {
          border-color: transparent;
          background: transparent;
        }
        .attendance-day-number {
          align-self: flex-start;
          font-weight: 700;
        }
        .attendance-status-symbol {
          font-size: 1.5rem;
          font-weight: 800;
          line-height: 1;
          margin: 0.15rem 0;
        }
        .attendance-present { background: #dcfce7; color: #166534; border-color: #86efac; }
        .attendance-absent { background: #fee2e2; color: #991b1b; border-color: #fca5a5; }
        .attendance-late { background: #fef3c7; color: #92400e; border-color: #fcd34d; }
        .attendance-excused { background: #dbeafe; color: #1e40af; border-color: #93c5fd; }
        .attendance-unmarked { background: #f8fafc; color: #64748b; }
        .attendance-legend { display: flex; flex-wrap: wrap; gap: 0.75rem; }
        .attendance-legend-item { border-radius: 999px; padding: 0.35rem 0.75rem; border: 1px solid; font-weight: 600; }
        @media (max-width: 767px) {
          .attendance-calendar { gap: 0.25rem; }
          .attendance-cell { min-height: 70px; padding: 0.3rem; }
          .attendance-cell small { display: none; }
          .attendance-calendar-header h3 { font-size: 1.1rem; }
        }
      `}</style>
    </>
  );
}
