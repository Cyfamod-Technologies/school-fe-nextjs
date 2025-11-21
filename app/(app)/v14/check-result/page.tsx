"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import { listStudents, type StudentSummary } from "@/lib/students";
import { resolveBackendUrl } from "@/lib/config";

export default function CheckResultPage() {
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
        console.error("Unable to load sessions for result check", error),
      );
    listClasses()
      .then(setClasses)
      .catch((error) =>
        console.error("Unable to load classes for result check", error),
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
        console.error("Unable to load terms for result check", error),
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
        console.error("Unable to load arms for result check", error),
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
      console.error("Unable to load students for result check", error);
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

  const handleViewResult = () => {
    setFeedback(null);

    if (!selectedStudent || !selectedSession || !selectedTerm) {
      setFeedback(
        "Select session, term, class, and student before viewing the result.",
      );
      setFeedbackType("warning");
      return;
    }

    const params = new URLSearchParams();
    params.set("student_id", selectedStudent);
    params.set("session_id", selectedSession);
    params.set("term_id", selectedTerm);

    // Use the Next.js print proxy so auth and error handling
    // are consistent with other result-print flows.
    const url = `/v19/print-result?${params.toString()}`;
    const win = window.open(url, "_blank", "noopener,noreferrer");
    if (!win) {
      setFeedback(
        "Unable to open result window. Please allow pop-ups for this site.",
      );
      setFeedbackType("warning");
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Check Result</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Check Result</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1 mb-3">
            <div className="item-title">
              <h3>View Student Result</h3>
              <p className="mb-0 text-muted small">
                Select a session, term, class, and student to open the official
                printable result slip.
              </p>
            </div>
          </div>

          <div className="row gutters-8 mb-3">
            <div className="col-md-3 col-12 form-group">
              <label htmlFor="check-session">Session</label>
              <select
                id="check-session"
                className="form-control"
                value={selectedSession}
                onChange={(event) => {
                  setSelectedSession(event.target.value);
                  setSelectedTerm("");
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
            <div className="col-md-3 col-12 form-group">
              <label htmlFor="check-term">Term</label>
              <select
                id="check-term"
                className="form-control"
                value={selectedTerm}
                onChange={(event) => setSelectedTerm(event.target.value)}
                disabled={!selectedSession || !terms.length}
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={String(term.id)}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 col-12 form-group">
              <label htmlFor="check-class">Class</label>
              <select
                id="check-class"
                className="form-control"
                value={selectedClass}
                onChange={(event) => {
                  setSelectedClass(event.target.value);
                  setSelectedArm("");
                  setSelectedStudent("");
                }}
              >
                <option value="">Select class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={String(schoolClass.id)}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-3 col-12 form-group">
              <label htmlFor="check-arm">Class Arm</label>
              <select
                id="check-arm"
                className="form-control"
                value={selectedArm}
                onChange={(event) => {
                  setSelectedArm(event.target.value);
                  setSelectedStudent("");
                }}
                disabled={!selectedClass || !arms.length}
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

          <div className="row gutters-8 align-items-end mb-3">
            <div className="col-md-6 col-12 form-group">
              <label htmlFor="check-student">Student</label>
              <select
                id="check-student"
                className="form-control"
                value={selectedStudent}
                onChange={(event) => setSelectedStudent(event.target.value)}
                disabled={!selectedClass || loadingStudents}
              >
                <option value="">Select student</option>
                {students.map((student) => {
                  const fullName = [student.first_name, student.middle_name, student.last_name]
                    .filter(Boolean)
                    .join(" ")
                    .trim();
                  const label = student.admission_no
                    ? `${student.admission_no} - ${fullName || "Student"}`
                    : fullName || "Student";
                  return (
                    <option key={student.id} value={String(student.id)}>
                      {label}
                    </option>
                  );
                })}
              </select>
              {loadingStudents ? (
                <small className="form-text text-muted">Loading students…</small>
              ) : null}
            </div>
            <div className="col-md-3 col-12 form-group">
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark w-100"
                onClick={handleViewResult}
              >
                View Result
              </button>
            </div>
            <div className="col-md-3 col-12">
              {selectedStudentLabel ? (
                <p className="mb-0 text-muted small">
                  Selected: {selectedStudentLabel}
                </p>
              ) : null}
            </div>
          </div>

          {feedback ? (
            <div className={`alert alert-${feedbackType}`} role="alert">
              {feedback}
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
