"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import { listStudents, type StudentSummary } from "@/lib/students";
import { resolveBackendUrl } from "@/lib/config";
import { getCookie } from "@/lib/cookies";

export default function EarlyYearsReportPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [termsCache, setTermsCache] = useState<Record<string, Term[]>>({});
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [armsCache, setArmsCache] = useState<Record<string, ClassArm[]>>({});

  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");
  const [selectedClass, setSelectedClass] = useState<string>("");
  const [selectedArm, setSelectedArm] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackType, setFeedbackType] = useState<
    "success" | "info" | "warning" | "danger"
  >("info");

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((error) =>
        console.error("Unable to load sessions for early years report", error),
      );
    listClasses()
      .then(setClasses)
      .catch((error) =>
        console.error("Unable to load classes for early years report", error),
      );
  }, []);

  const terms = useMemo(() => {
    if (!selectedSession) {
      return [];
    }
    return termsCache[selectedSession] ?? [];
  }, [selectedSession, termsCache]);

  const arms = useMemo(() => {
    if (!selectedClass) {
      return [];
    }
    return armsCache[selectedClass] ?? [];
  }, [selectedClass, armsCache]);

  useEffect(() => {
    if (!selectedSession || termsCache[selectedSession]) {
      return;
    }
    listTermsBySession(selectedSession)
      .then((list) =>
        setTermsCache((prev) => ({
          ...prev,
          [selectedSession]: list,
        })),
      )
      .catch((error) =>
        console.error("Unable to load terms for early years report", error),
      );
  }, [selectedSession, termsCache]);

  useEffect(() => {
    if (!selectedClass || armsCache[selectedClass]) {
      return;
    }
    listClassArms(selectedClass)
      .then((list) =>
        setArmsCache((prev) => ({
          ...prev,
          [selectedClass]: list,
        })),
      )
      .catch((error) =>
        console.error("Unable to load arms for early years report", error),
      );
  }, [selectedClass, armsCache]);

  const loadStudents = useCallback(async () => {
    if (!selectedClass) {
      setStudents([]);
      setSelectedStudent("");
      return;
    }

    setLoadingStudents(true);
    setFeedback(null);
    try {
      const response = await listStudents({
        per_page: 200,
        school_class_id: selectedClass,
        class_arm_id: selectedArm || undefined,
      });
      const list = response.data ?? [];
      setStudents(list);
      const exists = list.some(
        (student) => String(student.id) === selectedStudent,
      );
      if (!exists) {
        setSelectedStudent("");
      }
      if (!list.length) {
        setFeedback("No students found for the selected class/arm.");
        setFeedbackType("info");
      }
    } catch (error) {
      console.error("Unable to load students for early years report", error);
      setStudents([]);
      setSelectedStudent("");
      setFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load students for the selected filters.",
      );
      setFeedbackType("danger");
    } finally {
      setLoadingStudents(false);
    }
  }, [selectedArm, selectedClass, selectedStudent]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  const selectedStudentLabel = useMemo(() => {
    if (!selectedStudent) {
      return "";
    }
    const match = students.find(
      (student) => String(student.id) === String(selectedStudent),
    );
    if (!match) {
      return "";
    }
    const nameParts = [
      match.first_name,
      match.middle_name,
      match.last_name,
    ].filter(Boolean);
    const fullName =
      nameParts.join(" ").trim() ||
      (typeof match.name === "string" ? match.name : "") ||
      "Student";
    return match.admission_no
      ? `${match.admission_no} - ${fullName}`
      : fullName;
  }, [selectedStudent, students]);

  const handleViewReport = useCallback(async () => {
    setFeedback(null);

    if (!selectedStudent || !selectedSession || !selectedTerm) {
      setFeedback(
        "Select session, term, class, and student before viewing the report.",
      );
      setFeedbackType("warning");
      return;
    }

    const token = getCookie("token");
    if (!token) {
      setFeedback(
        "Your session token is missing. Please log in again before printing the report.",
      );
      setFeedbackType("warning");
      return;
    }

    const params = new URLSearchParams();
    params.set("session_id", selectedSession);
    params.set("term_id", selectedTerm);

    const endpoint = `${resolveBackendUrl(
      `/api/v1/students/${selectedStudent}/early-years-report/print`,
    )}?${params.toString()}`;

    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "text/html",
          "X-Requested-With": "XMLHttpRequest",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        let errorMessage = "Unable to load the early years report.";
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            const text = await response.text().catch(() => "");
            errorMessage = text.trim() || errorMessage;
          }
        } else if (response.status === 403) {
          errorMessage = "You do not have permission to print this report.";
        } else if (response.status === 401) {
          errorMessage = "Your session has expired. Please log in again.";
        } else {
          const text = await response.text().catch(() => "");
          const trimmed = text.trim();
          if (trimmed.length > 0 && /^<\s*(!DOCTYPE|html)/i.test(trimmed)) {
            errorMessage =
              response.status === 422
                ? "No skill ratings were found for the selected term."
                : "Unable to load the report. Please try again.";
          } else {
            errorMessage = trimmed || `Unable to load the report (${response.status}).`;
          }
        }

        setFeedback(errorMessage);
        setFeedbackType("danger");
        return;
      }

      const html = await response.text();
      const win = window.open("", "_blank");
      if (!win) {
        setFeedback(
          "Unable to open report window. Please allow pop-ups for this site.",
        );
        setFeedbackType("warning");
        return;
      }

      win.document.open();
      win.document.write(html);
      win.document.close();
    } catch (error) {
      console.error("Unable to load early years report", error);
      setFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load the early years report. Please try again.",
      );
      setFeedbackType("danger");
    }
  }, [selectedSession, selectedStudent, selectedTerm]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Early Years Report</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Early Years Report</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Print Early Years Report</h3>
              <p className="mb-0 text-muted small">
                This report is based on recorded skill ratings for the selected term.
              </p>
            </div>
          </div>

          {feedback ? (
            <div className={`alert alert-${feedbackType}`} role="alert">
              {feedback}
            </div>
          ) : null}

          <div className="row gutters-8 mb-3">
            <div className="col-lg-4 col-12 form-group">
              <label htmlFor="early-years-session">Session</label>
              <select
                id="early-years-session"
                className="form-control"
                value={selectedSession}
                onChange={(event) => {
                  setSelectedSession(event.target.value);
                  setSelectedTerm("");
                }}
              >
                <option value="">Select session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-4 col-12 form-group">
              <label htmlFor="early-years-term">Term</label>
              <select
                id="early-years-term"
                className="form-control"
                value={selectedTerm}
                onChange={(event) => setSelectedTerm(event.target.value)}
                disabled={!selectedSession}
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-4 col-12 form-group">
              <label htmlFor="early-years-class">Class</label>
              <select
                id="early-years-class"
                className="form-control"
                value={selectedClass}
                onChange={(event) => {
                  setSelectedClass(event.target.value);
                  setSelectedArm("");
                }}
              >
                <option value="">Select class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-4 col-12 form-group">
              <label htmlFor="early-years-arm">Class Arm</label>
              <select
                id="early-years-arm"
                className="form-control"
                value={selectedArm}
                onChange={(event) => setSelectedArm(event.target.value)}
                disabled={!selectedClass}
              >
                <option value="">None</option>
                {arms.map((arm) => (
                  <option key={arm.id} value={arm.id}>
                    {arm.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-8 col-12 form-group">
              <label htmlFor="early-years-student">Student</label>
              <select
                id="early-years-student"
                className="form-control"
                value={selectedStudent}
                onChange={(event) => setSelectedStudent(event.target.value)}
                disabled={!selectedClass || loadingStudents}
              >
                <option value="">
                  {loadingStudents
                    ? "Loading students..."
                    : "Select student"}
                </option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.admission_no
                      ? `${student.admission_no} - ${student.first_name ?? ""} ${student.last_name ?? ""}`
                      : `${student.first_name ?? ""} ${student.last_name ?? ""}`}
                  </option>
                ))}
              </select>
              {selectedStudentLabel ? (
                <small className="text-muted">
                  Selected: {selectedStudentLabel}
                </small>
              ) : null}
            </div>
            <div className="col-12 form-group d-flex justify-content-end">
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                onClick={handleViewReport}
              >
                Print Early Years Report
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
