"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  listStudentAttendance,
  saveStudentAttendance,
  type StudentAttendanceRecord,
} from "@/lib/attendance";
import { fetchSchoolContext, type SchoolContext } from "@/lib/schoolContext";
import {
  fetchTeacherDashboard,
  type TeacherDashboardResponse,
} from "@/lib/staff";
import { listStudents, type StudentSummary } from "@/lib/students";
import { isTeacherUser } from "@/lib/roleChecks";

type RegisterStatus = "" | "present" | "absent" | "late" | "excused";

interface AttendanceRow {
  student: StudentSummary;
  status: RegisterStatus;
  savedStatus: RegisterStatus;
  saving: boolean;
  error: string | null;
}

const todayLocal = () => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
};

const earlierDate = (first: string, second: string) =>
  first < second ? first : second;

const studentName = (student: StudentSummary) =>
  [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ");

export default function ClassTeacherAttendancePage() {
  const { user } = useAuth();
  const [dashboard, setDashboard] = useState<TeacherDashboardResponse | null>(null);
  const [schoolContext, setSchoolContext] = useState<SchoolContext | null>(null);
  const [date, setDate] = useState(todayLocal);
  const [selectedContextKey, setSelectedContextKey] = useState("");
  const [rows, setRows] = useState<AttendanceRow[]>([]);
  const [step, setStep] = useState<"setup" | "register">("setup");
  const [loading, setLoading] = useState(true);
  const [loadingRoster, setLoadingRoster] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTeacher = isTeacherUser(user);

  useEffect(() => {
    if (!isTeacher) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    void Promise.all([fetchTeacherDashboard(), fetchSchoolContext()])
      .then(([teacherDashboard, context]) => {
        if (cancelled) return;
        setDashboard(teacherDashboard);
        setSchoolContext(context);
      })
      .catch((loadError) => {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load attendance options.",
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isTeacher]);

  const classTeacherAssignments = useMemo(() => {
    const currentSessionId = schoolContext?.current_session_id
      ? String(schoolContext.current_session_id)
      : "";

    return (dashboard?.assignments ?? []).filter(
      (assignment) =>
        assignment.is_class_teacher &&
        (!currentSessionId || String(assignment.session?.id) === currentSessionId),
    );
  }, [dashboard, schoolContext?.current_session_id]);

  const selectedAssignment = useMemo(
    () =>
      classTeacherAssignments.find(
        (assignment) => assignment.context_key === selectedContextKey,
      ) ?? null,
    [classTeacherAssignments, selectedContextKey],
  );

  const termStartDate = schoolContext?.current_term?.start_date ?? "";
  const termEndDate = schoolContext?.current_term?.end_date ?? "";
  const latestAttendanceDate = termEndDate
    ? earlierDate(termEndDate, todayLocal())
    : todayLocal();

  const termDateError = useCallback(
    (candidateDate: string) => {
      if (termStartDate && candidateDate < termStartDate) {
        return `Attendance date cannot be before the current term starts on ${termStartDate}.`;
      }
      if (termEndDate && candidateDate > termEndDate) {
        return `Attendance date cannot be after the current term ends on ${termEndDate}.`;
      }
      if (candidateDate > todayLocal()) {
        return "Attendance cannot be recorded for a future date.";
      }
      return null;
    },
    [termEndDate, termStartDate],
  );

  const changeAttendanceDate = useCallback(
    (candidateDate: string) => {
      const validationError = termDateError(candidateDate);
      if (validationError) {
        window.alert(validationError);
        setError(validationError);
        return;
      }

      setError(null);
      setDate(candidateDate);
    },
    [termDateError],
  );

  useEffect(() => {
    if (!termStartDate && !termEndDate) return;

    const validationError = termDateError(date);
    if (!validationError) return;

    if (termEndDate && date > termEndDate) {
      setDate(latestAttendanceDate);
    } else if (termStartDate && date < termStartDate && termStartDate <= todayLocal()) {
      setDate(termStartDate);
    }
  }, [date, latestAttendanceDate, termDateError, termEndDate, termStartDate]);

  const counts = useMemo(
    () => ({
      total: rows.length,
      marked: rows.filter((row) => row.status !== "").length,
      present: rows.filter((row) => row.status === "present").length,
      absent: rows.filter((row) => row.status === "absent").length,
      saving: rows.filter((row) => row.saving).length,
      failed: rows.filter((row) => row.error).length,
    }),
    [rows],
  );

  const saveErrors = useMemo(
    () => Array.from(new Set(rows.map((row) => row.error).filter(Boolean))),
    [rows],
  );

  const loadRoster = useCallback(async () => {
    if (!selectedAssignment?.class?.id) {
      setError("Select an assigned class before continuing.");
      return;
    }
    if (!schoolContext?.current_session_id || !schoolContext.current_term_id) {
      setError("The school must set a current session and term before attendance can be taken.");
      return;
    }
    if (!date) {
      setError("Choose an attendance date.");
      return;
    }
    const validationError = termDateError(date);
    if (validationError) {
      window.alert(validationError);
      setError(validationError);
      return;
    }

    setLoadingRoster(true);
    setError(null);

    try {
      const [studentResponse, attendanceResponse] = await Promise.all([
        listStudents({
          per_page: 500,
          current_session_id: String(schoolContext.current_session_id),
          current_term_id: String(schoolContext.current_term_id),
          school_class_id: String(selectedAssignment.class.id),
          class_arm_id: selectedAssignment.class_arm?.id
            ? String(selectedAssignment.class_arm.id)
            : undefined,
          class_section_id: selectedAssignment.class_section?.id
            ? String(selectedAssignment.class_section.id)
            : undefined,
          status: "active",
          sortBy: "first_name",
        }),
        listStudentAttendance({
          per_page: 500,
          date,
          session_id: String(schoolContext.current_session_id),
          term_id: String(schoolContext.current_term_id),
          school_class_id: String(selectedAssignment.class.id),
          class_arm_id: selectedAssignment.class_arm?.id
            ? String(selectedAssignment.class_arm.id)
            : undefined,
          class_section_id: selectedAssignment.class_section?.id
            ? String(selectedAssignment.class_section.id)
            : undefined,
        }),
      ]);

      const records = new Map<string, StudentAttendanceRecord>();
      attendanceResponse.data.forEach((record) => {
        const studentId = record.student?.id ?? record.student_id;
        if (studentId !== undefined && studentId !== null) {
          records.set(String(studentId), record);
        }
      });

      setRows(
        studentResponse.data.map((student) => {
          const status = (records.get(String(student.id))?.status ?? "") as RegisterStatus;
          return {
            student,
            status,
            savedStatus: status,
            saving: false,
            error: null,
          };
        }),
      );
      setStep("register");
    } catch (rosterError) {
      setRows([]);
      setError(
        rosterError instanceof Error
          ? rosterError.message
          : "Unable to load the class roster.",
      );
    } finally {
      setLoadingRoster(false);
    }
  }, [date, schoolContext, selectedAssignment, termDateError]);

  const saveStatus = async (studentId: number | string, status: "present" | "absent") => {
    const key = String(studentId);
    const current = rows.find((row) => String(row.student.id) === key);
    if (!current || current.saving || current.savedStatus === status) return;
    if (!selectedAssignment?.class?.id || !schoolContext?.current_session_id || !schoolContext.current_term_id) return;

    setRows((currentRows) =>
      currentRows.map((row) =>
        String(row.student.id) === key
          ? { ...row, status, saving: true, error: null }
          : row,
      ),
    );

    try {
      await saveStudentAttendance({
        date,
        session_id: String(schoolContext.current_session_id),
        term_id: String(schoolContext.current_term_id),
        school_class_id: String(selectedAssignment.class.id),
        class_arm_id: selectedAssignment.class_arm?.id
          ? String(selectedAssignment.class_arm.id)
          : null,
        class_section_id: selectedAssignment.class_section?.id
          ? String(selectedAssignment.class_section.id)
          : null,
        entries: [{ student_id: studentId, status }],
      });

      setRows((currentRows) =>
        currentRows.map((row) =>
          String(row.student.id) === key
            ? { ...row, status, savedStatus: status, saving: false, error: null }
            : row,
        ),
      );
    } catch (saveError) {
      setRows((currentRows) =>
        currentRows.map((row) =>
          String(row.student.id) === key
            ? {
                ...row,
                status: row.savedStatus,
                saving: false,
                error:
                  saveError instanceof Error
                    ? saveError.message
                    : "Unable to save attendance.",
              }
            : row,
        ),
      );
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Daily Student Attendance</h3>
        <ul>
          <li><Link href="/v25/staff-dashboard">Staff Dashboard</Link></li>
          <li>Attendance</li>
        </ul>
      </div>

      {!isTeacher ? (
        <div className="alert alert-warning">Only teachers can access this page.</div>
      ) : null}
      {error ? <div className="alert alert-danger" role="alert">{error}</div> : null}

      {loading ? (
        <div className="card"><div className="card-body text-center py-5">
          <div className="spinner-border text-primary" role="status" />
          <p className="text-muted mt-3 mb-0">Loading attendance options…</p>
        </div></div>
      ) : null}

      {!loading && isTeacher && classTeacherAssignments.length === 0 ? (
        <div className="alert alert-info">
          Attendance is available only to assigned class teachers. No current class-teacher assignment was found for your account.
        </div>
      ) : null}

      {!loading && step === "setup" && classTeacherAssignments.length > 0 ? (
        <div className="card height-auto">
          <div className="card-body">
            <div className="heading-layout1 mb-4"><div className="item-title">
              <h3>Select Attendance Details</h3>
              <p className="text-muted mb-0">Choose a date and one of your assigned classes.</p>
            </div></div>

            <div className="row mb-4">
              <div className="col-md-4 mb-3">
                <label>Current Session</label>
                <input className="form-control" readOnly value={schoolContext?.current_session?.name ?? "Not set"} />
              </div>
              <div className="col-md-4 mb-3">
                <label>Current Term</label>
                <input className="form-control" readOnly value={schoolContext?.current_term?.name ?? "Not set"} />
              </div>
              <div className="col-md-4 mb-3">
                <label htmlFor="attendance-date">Date</label>
                <input
                  id="attendance-date"
                  type="date"
                  className="form-control"
                  value={date}
                  min={termStartDate || undefined}
                  max={latestAttendanceDate}
                  onChange={(event) => changeAttendanceDate(event.target.value)}
                />
                {termStartDate && termEndDate ? (
                  <small className="form-text text-muted">
                    Allowed dates: {termStartDate} to {termEndDate}
                  </small>
                ) : null}
              </div>
            </div>

            <h4 className="mb-3">Your Classes</h4>
            <div className="row">
              {classTeacherAssignments.map((assignment) => {
                const selected = assignment.context_key === selectedContextKey;
                return (
                  <div className="col-lg-4 col-md-6 mb-3" key={assignment.context_key}>
                    <button
                      type="button"
                      className={`class-choice ${selected ? "is-selected" : ""}`}
                      onClick={() => setSelectedContextKey(assignment.context_key)}
                      aria-pressed={selected}
                    >
                      <strong>{assignment.class?.name ?? "Unnamed class"}</strong>
                      <span>{assignment.class_arm?.name ?? "General"}</span>
                      {assignment.class_section?.name ? <small>{assignment.class_section.name}</small> : null}
                    </button>
                  </div>
                );
              })}
            </div>

            <div className="text-right mt-3">
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                disabled={!selectedAssignment || loadingRoster}
                onClick={() => void loadRoster()}
              >
                {loadingRoster ? "Loading Students…" : "Continue"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!loading && step === "register" && selectedAssignment ? (
        <div className="card height-auto">
          <div className="card-body">
            <div className="d-flex flex-wrap justify-content-between align-items-center mb-4">
              <div>
                <h3 className="mb-1">{selectedAssignment.class?.name} {selectedAssignment.class_arm?.name ?? ""}</h3>
                <p className="text-muted mb-0">{date} · Tap Present or Absent to save immediately.</p>
              </div>
              <button type="button" className="btn btn-outline-secondary mt-2" onClick={() => setStep("setup")}>Change Details</button>
            </div>

            <div className="row gutters-20 mb-3">
              {[
                ["Students", counts.total], ["Marked", counts.marked],
                ["Present", counts.present], ["Absent", counts.absent],
              ].map(([label, value]) => (
                <div className="col-lg-3 col-6 mb-3" key={String(label)}>
                  <div className="border rounded p-3 text-center">
                    <div className="text-muted small">{label}</div>
                    <strong className="h4 mb-0">{value}</strong>
                  </div>
                </div>
              ))}
            </div>

            {counts.saving > 0 ? <div className="alert alert-info">Saving {counts.saving} attendance record…</div> : null}
            {counts.failed > 0 ? (
              <div className="alert alert-danger" role="alert">
                <strong>
                  {counts.failed} {counts.failed === 1 ? "row" : "rows"} could not be saved.
                </strong>{" "}
                {saveErrors[0] ?? "Try the affected rows again."}
              </div>
            ) : null}

            {rows.length === 0 ? (
              <div className="alert alert-info">No active students were found in this class.</div>
            ) : (
              <div className="table-responsive">
                <table className="table display data-table text-nowrap">
                  <thead><tr><th>Student</th><th>Admission No.</th><th className="text-center">Attendance</th><th>Save Status</th></tr></thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={String(row.student.id)}>
                        <td><strong>{studentName(row.student) || "Unnamed student"}</strong></td>
                        <td>{row.student.admission_no ?? "—"}</td>
                        <td className="text-center">
                          <div className="btn-group" role="group" aria-label={`Attendance for ${studentName(row.student)}`}>
                            <button
                              type="button"
                              className={`btn ${row.status === "present" ? "btn-success" : "btn-outline-success"}`}
                              disabled={row.saving}
                              aria-pressed={row.status === "present"}
                              onClick={() => void saveStatus(row.student.id, "present")}
                            >Present</button>
                            <button
                              type="button"
                              className={`btn ${row.status === "absent" ? "btn-danger" : "btn-outline-danger"}`}
                              disabled={row.saving}
                              aria-pressed={row.status === "absent"}
                              onClick={() => void saveStatus(row.student.id, "absent")}
                            >Absent</button>
                          </div>
                          {row.status === "late" || row.status === "excused" ? (
                            <div className="small text-warning mt-1">Previously marked {row.status}. Choose a new status to change it.</div>
                          ) : null}
                        </td>
                        <td>
                          {row.saving ? (
                            <span className="text-info">Saving…</span>
                          ) : row.error ? (
                            <span className="text-danger" title={row.error}>Save failed</span>
                          ) : row.savedStatus ? (
                            <span className="text-success">Saved</span>
                          ) : (
                            <span className="text-muted">Not marked</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .class-choice {
          width: 100%; min-height: 125px; padding: 1.25rem; border-radius: 10px;
          border: 2px solid #e2e8f0; background: #fff; text-align: left;
          display: flex; flex-direction: column; gap: 0.35rem; color: #334155;
        }
        .class-choice strong { font-size: 1.15rem; color: #0f172a; }
        .class-choice.is-selected { border-color: #16a34a; background: #f0fdf4; box-shadow: 0 0 0 3px rgba(22, 163, 74, 0.12); }
        .class-choice:focus-visible { outline: 3px solid rgba(37, 99, 235, 0.35); outline-offset: 2px; }
      `}</style>
    </>
  );
}
