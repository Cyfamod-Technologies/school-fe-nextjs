"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import {
  listClassArmSections,
  type ClassArmSection,
} from "@/lib/classArmSections";
import {
  listStudents,
  type StudentSummary,
} from "@/lib/students";
import {
  buildStudentAttendanceExportUrl,
  deleteStudentAttendance,
  listStudentAttendance,
  saveStudentAttendance,
  type StudentAttendanceRecord,
  type StudentAttendanceExportFilters,
} from "@/lib/attendance";
import { isTeacherUser } from "@/lib/roleChecks";

type FeedbackKind = "success" | "danger" | "warning" | "info";

interface FeedbackState {
  type: FeedbackKind;
  message: string;
}

type StudentAttendanceStatus =
  | ""
  | "present"
  | "absent"
  | "late"
  | "excused";

interface AttendanceState {
  status: StudentAttendanceStatus;
  recordId?: string;
  comment?: string;
}

const STATUS_OPTIONS: Array<{ value: StudentAttendanceStatus; label: string }> = [
  { value: "", label: "Select status" },
  { value: "present", label: "Present" },
  { value: "absent", label: "Absent" },
  { value: "late", label: "Late" },
  { value: "excused", label: "Excused" },
];

interface StudentFilters {
  sessionId: string;
  termId: string;
  classId: string;
  armId: string;
  sectionId: string;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

export default function StudentAttendancePage() {
  const { user, schoolContext } = useAuth();

  const isTeacher = isTeacherUser(user);

  const lockSessionAndTerm = isTeacher;

  const [date, setDate] = useState<string>(todayIso);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [termsCache, setTermsCache] = useState<Record<string, Term[]>>({});
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [armsCache, setArmsCache] = useState<Record<string, ClassArm[]>>({});
  const [sectionsCache, setSectionsCache] = useState<
    Record<string, ClassArmSection[]>
  >({});

  const [filters, setFilters] = useState<StudentFilters>(() => ({
    sessionId: schoolContext.current_session_id
      ? String(schoolContext.current_session_id)
      : "",
    termId: schoolContext.current_term_id
      ? String(schoolContext.current_term_id)
      : "",
    classId: "",
    armId: "",
    sectionId: "",
  }));

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<
    Record<string, AttendanceState>
  >({});
  const [history, setHistory] = useState<StudentAttendanceRecord[]>([]);
  const [currentRecords, setCurrentRecords] = useState<
    Record<string, StudentAttendanceRecord>
  >({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((error) =>
        console.error("Unable to load sessions", error),
      );
    listClasses()
      .then(setClasses)
      .catch((error) => console.error("Unable to load classes", error));
  }, []);

  useEffect(() => {
    if (!isTeacher) {
      return;
    }
    if (!filters.sessionId && sessions.length > 0) {
      setFilters((prev) => ({
        ...prev,
        sessionId: prev.sessionId || String(sessions[0].id),
      }));
    }
  }, [isTeacher, filters.sessionId, sessions]);

  useEffect(() => {
    if (
      schoolContext.current_session_id &&
      !filters.sessionId
    ) {
      setFilters((prev) => ({
        ...prev,
        sessionId: String(schoolContext.current_session_id),
      }));
    }
    if (
      schoolContext.current_term_id &&
      !filters.termId
    ) {
      setFilters((prev) => ({
        ...prev,
        termId: String(schoolContext.current_term_id),
      }));
    }
  }, [schoolContext.current_session_id, schoolContext.current_term_id, filters.sessionId, filters.termId]);

  const ensureTerms = useCallback(
    async (sessionId: string) => {
      if (!sessionId || termsCache[sessionId]) {
        return;
      }
      try {
        const data = await listTermsBySession(sessionId);
        setTermsCache((prev) => ({
          ...prev,
          [sessionId]: data,
        }));
      } catch (error) {
        console.error("Unable to load terms", error);
      }
    },
    [termsCache],
  );

  const ensureArms = useCallback(
    async (classId: string) => {
      if (!classId || armsCache[classId]) {
        return;
      }
      try {
        const data = await listClassArms(classId);
        setArmsCache((prev) => ({
          ...prev,
          [classId]: data,
        }));
      } catch (error) {
        console.error("Unable to load class arms", error);
      }
    },
    [armsCache],
  );

  const ensureSections = useCallback(
    async (classId: string, armId: string) => {
      if (!classId || !armId) {
        return;
      }
      const key = `${classId}:${armId}`;
      if (sectionsCache[key]) {
        return;
      }
      try {
        const data = await listClassArmSections(classId, armId);
        setSectionsCache((prev) => ({
          ...prev,
          [key]: data,
        }));
      } catch (error) {
        console.error("Unable to load class sections", error);
      }
    },
    [sectionsCache],
  );

  useEffect(() => {
    if (filters.sessionId) {
      ensureTerms(filters.sessionId).catch((error) =>
        console.error(error),
      );
    }
  }, [filters.sessionId, ensureTerms]);

  useEffect(() => {
    if (filters.classId) {
      ensureArms(filters.classId).catch((error) =>
        console.error(error),
      );
    }
  }, [filters.classId, ensureArms]);

  useEffect(() => {
    if (filters.classId && filters.armId) {
      ensureSections(filters.classId, filters.armId).catch((error) =>
        console.error(error),
      );
    }
  }, [filters.classId, filters.armId, ensureSections]);

  const terms = useMemo(
    () => termsCache[filters.sessionId] ?? [],
    [termsCache, filters.sessionId],
  );
  const arms = useMemo(
    () => (filters.classId ? armsCache[filters.classId] ?? [] : []),
    [armsCache, filters.classId],
  );
  const sections = useMemo(() => {
    if (!filters.classId || !filters.armId) {
      return [];
    }
    const key = `${filters.classId}:${filters.armId}`;
    return sectionsCache[key] ?? [];
  }, [filters.classId, filters.armId, sectionsCache]);

  const studentCountSummary = useMemo(() => {
    const counts = {
      present: 0,
      absent: 0,
      late: 0,
      excused: 0,
    };
    students.forEach((student) => {
      const state = attendanceMap[String(student.id)];
      if (state && state.status && counts.hasOwnProperty(state.status)) {
        counts[state.status as keyof typeof counts] += 1;
      }
    });
    return counts;
  }, [attendanceMap, students]);

  const loadRecentAttendance = useCallback(async () => {
    try {
      const recent = await listStudentAttendance({ per_page: 5 });
      setHistory(recent.data ?? []);
    } catch (error) {
      console.warn("Unable to load recent attendance", error);
    }
  }, []);

  useEffect(() => {
    loadRecentAttendance().catch((error) =>
      console.error(error),
    );
  }, [loadRecentAttendance]);

  const resetFeedback = () => setFeedback(null);

  const loadStudents = useCallback(async () => {
    resetFeedback();
    if (!date) {
      setFeedback({
        type: "warning",
        message: "Select a date before loading students.",
      });
      return;
    }
    if (!filters.classId) {
      setFeedback({
        type: "warning",
        message: "Select a class to load students.",
      });
      return;
    }
    if (!filters.sessionId) {
      setFeedback({
        type: "warning",
        message: "Select an academic session.",
      });
      return;
    }

    setLoading(true);
    try {
      const studentResponse = await listStudents({
        per_page: 500,
        school_class_id: filters.classId,
        class_arm_id: filters.armId || undefined,
        class_section_id: filters.sectionId || undefined,
        current_session_id: filters.sessionId,
        current_term_id: filters.termId || undefined,
        sortBy: "first_name",
      });
      const studentList = studentResponse.data ?? [];
      setStudents(studentList);

      const attendanceResponse = await listStudentAttendance({
        per_page: 500,
        date,
        school_class_id: filters.classId,
        class_arm_id: filters.armId || undefined,
        class_section_id: filters.sectionId || undefined,
      });

      const recordMap = new Map<string, StudentAttendanceRecord>();
      const recordsArray = attendanceResponse.data ?? [];
      recordsArray.forEach((record) => {
        const studentId =
          record.student?.id ?? record.student_id;
        if (studentId !== undefined && studentId !== null) {
          recordMap.set(String(studentId), record);
        }
      });

      const recordObject: Record<string, StudentAttendanceRecord> = {};
      recordMap.forEach((value, key) => {
        recordObject[key] = value;
      });
      setCurrentRecords(recordObject);

      const nextMap: Record<string, AttendanceState> = {};
      studentList.forEach((student) => {
        const key = String(student.id);
        const existing = recordMap.get(key);
        const existingMetadata =
          (existing as StudentAttendanceRecord | undefined)?.metadata ?? null;
        const existingComment =
          existingMetadata && typeof (existingMetadata as any).comment === "string"
            ? String((existingMetadata as any).comment)
            : "";
        nextMap[key] = {
          status: (existing?.status as StudentAttendanceStatus) ?? "",
          recordId: existing?.id ? String(existing.id) : undefined,
          comment: existingComment,
        };
      });
      setAttendanceMap(nextMap);
    } catch (error) {
      console.error("Unable to load students", error);
      setStudents([]);
      setCurrentRecords({});
      setFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load students.",
      });
    } finally {
      setLoading(false);
    }
  }, [date, filters.classId, filters.armId, filters.sectionId, filters.sessionId, filters.termId]);

  const handleStatusChange = (
    studentId: number | string,
    status: StudentAttendanceStatus,
  ) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [String(studentId)]: {
        ...prev[String(studentId)],
        status,
      },
    }));
  };

  const handleCommentChange = (
    studentId: number | string,
    comment: string,
  ) => {
    setAttendanceMap((prev) => ({
      ...prev,
      [String(studentId)]: {
        ...prev[String(studentId)],
        comment,
      },
    }));
  };

  const handleClearStatus = async (studentId: number | string) => {
    const key = String(studentId);
    const state = attendanceMap[key];
    if (!state) {
      return;
    }
    if (state.recordId) {
      try {
        await deleteStudentAttendance(state.recordId);
        setFeedback({
          type: "success",
          message: "Attendance record removed.",
        });
        setCurrentRecords((prev) => {
          const next = { ...prev };
          delete next[key];
          return next;
        });
        await loadStudents();
        await loadRecentAttendance();
        return;
      } catch (error) {
        setFeedback({
          type: "danger",
          message:
            error instanceof Error
              ? error.message
              : "Unable to remove attendance record.",
        });
      }
    }
    setAttendanceMap((prev) => ({
      ...prev,
      [key]: {
        status: "",
        comment: "",
      },
    }));
    setCurrentRecords((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const handleBulkUpdate = (status: StudentAttendanceStatus) => {
    setAttendanceMap((prev) => {
      const next: Record<string, AttendanceState> = {};
      Object.entries(prev).forEach(([key, value]) => {
        next[key] = {
          ...value,
          status,
        };
      });
      return next;
    });
  };

  const handleSave = async () => {
    resetFeedback();
    if (!date) {
      setFeedback({
        type: "warning",
        message: "Select a date before saving attendance.",
      });
      return;
    }
    const entries = Object.entries(attendanceMap)
      .filter(([, value]) => Boolean(value.status))
      .map(([studentId, value]) => {
        const trimmedComment = (value.comment ?? "").trim();
        const metadata =
          trimmedComment.length > 0 ? { comment: trimmedComment } : undefined;
        return {
          student_id: studentId,
          status: value.status,
          ...(metadata ? { metadata } : {}),
        };
      });

    if (!entries.length) {
      setFeedback({
        type: "info",
        message: "Set at least one student status before saving.",
      });
      return;
    }

    setSaving(true);
    try {
      const { message } = await saveStudentAttendance({
        date,
        session_id: filters.sessionId || null,
        term_id: filters.termId || null,
        school_class_id: filters.classId || null,
        class_arm_id: filters.armId || null,
        class_section_id: filters.sectionId || null,
        entries,
      });
      setFeedback({
        type: "success",
        message: message ?? "Attendance saved successfully.",
      });
      await loadStudents();
      await loadRecentAttendance();
    } catch (error) {
      setFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save attendance.",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleExport = (type: "csv" | "pdf") => {
    if (typeof window === "undefined") {
      return;
    }
    const url = buildStudentAttendanceExportUrl(type, {
      date,
      school_class_id: filters.classId || null,
      class_arm_id: filters.armId || null,
      class_section_id: filters.sectionId || null,
      session_id: filters.sessionId || null,
      term_id: filters.termId || null,
    } as StudentAttendanceExportFilters);
    window.open(url, "_blank");
  };

  const summaryLabel = useMemo(() => {
    if (!students.length || !date) {
      return "No students loaded.";
    }
    return `Loaded ${students.length} students for ${formatDate(date)}.`;
  }, [students.length, date]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Student Attendance</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Student Attendance</li>
        </ul>
      </div>

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Attendance Filters</h3>
            </div>
            <div>
              <button
                id="student-attendance-refresh"
                type="button"
                className="btn btn-outline-secondary btn-sm"
                onClick={() => {
                  loadStudents().catch((error) =>
                    console.error(error),
                  );
                  loadRecentAttendance().catch((error) =>
                    console.error(error),
                  );
                }}
                disabled={loading}
              >
                <i className="fas fa-sync-alt mr-1" />
                Refresh
              </button>
            </div>
          </div>

          <div className="row gutters-8">
            <div className="col-lg-3 col-md-6 col-12 form-group">
              <label htmlFor="attendance-date">Date</label>
              <input
                id="attendance-date"
                type="date"
                className="form-control"
                value={date}
                onChange={(event) => setDate(event.target.value)}
              />
            </div>
            <div className="col-lg-3 col-md-6 col-12 form-group">
              <label htmlFor="attendance-session">Session</label>
              <select
                id="attendance-session"
                className="form-control"
                value={filters.sessionId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    sessionId: event.target.value,
                    termId: "",
                  }))
                }
                disabled={lockSessionAndTerm}
              >
                <option value="">Select session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={String(session.id)}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-3 col-md-6 col-12 form-group">
              <label htmlFor="attendance-term">Term</label>
              <select
                id="attendance-term"
                className="form-control"
                value={filters.termId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    termId: event.target.value,
                  }))
                }
                disabled={lockSessionAndTerm}
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={String(term.id)}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-3 col-md-6 col-12 form-group">
              <label htmlFor="attendance-class">Class</label>
              <select
                id="attendance-class"
                className="form-control"
                value={filters.classId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    classId: event.target.value,
                    armId: "",
                    sectionId: "",
                  }))
                }
              >
                <option value="">Select class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={String(schoolClass.id)}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-3 col-md-6 col-12 form-group">
              <label htmlFor="attendance-class-arm">Class Arm</label>
              <select
                id="attendance-class-arm"
                className="form-control"
                value={filters.armId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    armId: event.target.value,
                    sectionId: "",
                  }))
                }
              >
                <option value="">All arms</option>
                {arms.map((arm) => (
                  <option key={arm.id} value={String(arm.id)}>
                    {arm.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="d-flex align-items-center flex-wrap">
            <button
              id="attendance-load-students"
              type="button"
              className="btn btn-outline-primary mr-3 mb-2"
              onClick={() => loadStudents().catch((error) => console.error(error))}
              disabled={loading}
            >
              {loading ? "Loading..." : "Load Students"}
            </button>
            <div className="btn-group mb-2 mr-3" role="group" aria-label="Bulk attendance status">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                data-bulk-status="present"
                onClick={() => handleBulkUpdate("present")}
              >
                All Present
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                data-bulk-status="absent"
                onClick={() => handleBulkUpdate("absent")}
              >
                All Absent
              </button>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                data-bulk-status="late"
                onClick={() => handleBulkUpdate("late")}
              >
                All Late
              </button>
            </div>
            <div className="btn-group mb-2">
              <button
                id="student-attendance-export-csv"
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={() => handleExport("csv")}
              >
                Export CSV
              </button>
              <button
                id="student-attendance-export-pdf"
                type="button"
                className="btn btn-sm btn-outline-success"
                onClick={() => handleExport("pdf")}
              >
                Export PDF
              </button>
            </div>
          </div>

          {feedback ? (
            <div
              id="student-attendance-feedback"
              className={`alert alert-${feedback.type} mt-3`}
            >
              {feedback.message}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-center flex-wrap mb-3">
            <div>
              <strong id="student-attendance-summary">{summaryLabel}</strong>
            </div>
            <div className="d-flex flex-wrap" id="student-attendance-summary-badges">
              <span className="badge badge-success mr-2 mb-2" id="summary-present">
                Present: {studentCountSummary.present}
              </span>
              <span className="badge badge-danger mr-2 mb-2" id="summary-absent">
                Absent: {studentCountSummary.absent}
              </span>
              <span className="badge badge-warning mr-2 mb-2" id="summary-late">
                Late: {studentCountSummary.late}
              </span>
              <span className="badge badge-info mb-2" id="summary-excused">
                Excused: {studentCountSummary.excused}
              </span>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Admission No</th>
                  <th>Status</th>
                  <th>Comment</th>
                  <th>Last Updated</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="student-attendance-table-body">
                {students.length ? (
                  students.map((student, index) => {
                    const key = String(student.id);
                    const state = attendanceMap[key] ?? { status: "" };
                    const record = currentRecords[key];
                    return (
                      <tr key={key}>
                        <td>{index + 1}</td>
                        <td>
                          <strong>{formatStudentName(student)}</strong>
                        </td>
                        <td>{student.admission_no ?? "—"}</td>
                        <td>
                          <select
                            className="form-control student-attendance-select"
                            value={state.status}
                            onChange={(event) =>
                              handleStatusChange(
                                student.id,
                                event.target.value as StudentAttendanceStatus,
                              )
                            }
                          >
                            {STATUS_OPTIONS.map((option) => (
                              <option key={option.value || "empty"} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm"
                            value={state.comment ?? ""}
                            onChange={(event) =>
                              handleCommentChange(student.id, event.target.value)
                            }
                            placeholder="Add comment"
                          />
                        </td>
                        <td>
                          {record?.updated_at
                            ? formatDate(String(record.updated_at))
                            : "—"}
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary"
                            onClick={() => handleClearStatus(student.id)}
                          >
                            {state.recordId ? "Clear Record" : "Reset"}
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center">
                      {loading
                        ? "Loading students..."
                        : "No students loaded. Adjust filters and click “Load Students”."
                      }
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="text-right mt-3">
            <button
              id="attendance-save"
              type="button"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              onClick={() => handleSave().catch((error) => console.error(error))}
              disabled={saving}
            >
              {saving ? "Saving..." : "Save Attendance"}
            </button>
          </div>
        </div>
      </div>

      <div className="card mt-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Recent Attendance Records</h3>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table table-sm table-striped">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Student</th>
                  <th>Status</th>
                  <th>Class</th>
                  <th>Comment</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody id="student-attendance-history">
                {history.length ? (
                  history.map((record) => (
                    <tr key={record.id}>
                      <td>{record.date ? formatDate(record.date) : "—"}</td>
                      <td>{record.student?.name ?? "Unknown"}</td>
                      <td>{record.status?.toUpperCase() ?? "—"}</td>
                      <td>{record.class?.name ?? "—"}</td>
                      <td>
                        {record.metadata &&
                        typeof record.metadata === "object" &&
                        (record.metadata as any).comment
                          ? String((record.metadata as any).comment)
                          : "—"}
                      </td>
                      <td>{record.recorded_by?.name ?? "—"}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No recent attendance records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}

function formatStudentName(student: StudentSummary): string {
  return [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ") || "Unnamed Student";
}

function formatDate(value: string): string {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return value;
  }
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
