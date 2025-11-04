"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import {
  bulkGenerateResultPins,
  generateResultPinForStudent,
  invalidateResultPin,
  listResultPins,
  type ResultPin,
  type GenerateStudentPinPayload,
  type BulkGeneratePinsPayload,
} from "@/lib/resultPins";
import { listStudents, type StudentSummary } from "@/lib/students";

type FeedbackType = "success" | "warning" | "danger";

const maskPin = (pin: string | null | undefined): string => {
  if (!pin || pin.length < 4) {
    return "**********";
  }
  const start = pin.slice(0, 2);
  const end = pin.slice(-2);
  return `${start}****${end}`;
};

const formatDate = (value: string | null | undefined): string => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toISOString().slice(0, 10);
};

const formatDateTime = (value: string | null | undefined): string => {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
};

const statusBadgeClass = (status: string | null | undefined): string => {
  const normalized = (status ?? "").toLowerCase();
  if (normalized === "active") {
    return "badge badge-success";
  }
  if (normalized === "revoked") {
    return "badge badge-danger";
  }
  if (normalized === "expired") {
    return "badge badge-warning";
  }
  return "badge badge-secondary";
};

const formatUsage = (pin: ResultPin): string => {
  const used = typeof pin.use_count === "number" ? pin.use_count : 0;
  const limit =
    typeof pin.max_usage === "number" && pin.max_usage > 0
      ? pin.max_usage
      : null;

  if (limit !== null) {
    return `${used} / ${limit}`;
  }

  return `${used} / Unlimited`;
};

const buildStudentLabel = (student: StudentSummary): string => {
  const admission = student.admission_no ?? "";
  const firstName = student.first_name ?? "";
  const lastName = student.last_name ?? "";
  const combined = `${firstName} ${lastName}`.trim();
  const fallback =
    typeof student.name === "string" ? student.name : undefined;
  const displayName = combined || fallback || "Student";
  return admission ? `${admission} - ${displayName}` : displayName;
};

const buildResultPinStudentLabel = (pin: ResultPin): string => {
  const details = pin.student;
  if (!details) {
    return `Student #${String(pin.student_id ?? "") || "—"}`;
  }
  const admission =
    typeof details.admission_no === "string" ? details.admission_no : "";
  const first =
    typeof details.first_name === "string" ? details.first_name : "";
  const last =
    typeof details.last_name === "string" ? details.last_name : "";
  const explicitName =
    typeof details.name === "string" ? details.name : "";
  const fallbackName = `${first} ${last}`.trim();
  const displayName = explicitName || fallbackName || "Student";
  return admission ? `${admission} - ${displayName}` : displayName;
};

export default function PinsPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [selectedSession, setSelectedSession] = useState<string>("");

  const [termsCache, setTermsCache] = useState<Record<string, Term[]>>({});
  const [termsLoading, setTermsLoading] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string>("");

  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [selectedClass, setSelectedClass] = useState<string>("");

  const [armsCache, setArmsCache] = useState<Record<string, ClassArm[]>>({});
  const [armsLoading, setArmsLoading] = useState(false);
  const [selectedArm, setSelectedArm] = useState<string>("");

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [selectedStudent, setSelectedStudent] = useState<string>("");

  const [pins, setPins] = useState<ResultPin[]>([]);
  const [pinsLoading, setPinsLoading] = useState(false);
  const [pinsError, setPinsError] = useState<string | null>(null);

  const [feedback, setFeedback] = useState<{
    type: FeedbackType;
    message: string;
  } | null>(null);

  const [expiryDate, setExpiryDate] = useState<string>("");
  const [maxUsage, setMaxUsage] = useState<string>("");
  const [regenerateExisting, setRegenerateExisting] = useState<boolean>(false);

  const [generatingSingle, setGeneratingSingle] = useState(false);
  const [generatingBulk, setGeneratingBulk] = useState(false);
  const [pinActionKey, setPinActionKey] = useState<string | null>(null);

  const availableTerms = useMemo(() => {
    if (!selectedSession) {
      return [];
    }
    return termsCache[selectedSession] ?? [];
  }, [selectedSession, termsCache]);

  const availableArms = useMemo(() => {
    if (!selectedClass) {
      return [];
    }
    return armsCache[selectedClass] ?? [];
  }, [selectedClass, armsCache]);

  const showFeedback = useCallback((message: string, type: FeedbackType) => {
    setFeedback({ type, message });
  }, []);

  const resetFeedback = useCallback(() => {
    setFeedback(null);
  }, []);

  const loadSessions = useCallback(async () => {
    setSessionsLoading(true);
    try {
      const data = await listSessions();
      setSessions(data);
      if (!selectedSession && data.length > 0) {
        setSelectedSession(String(data[0].id));
      }
    } catch (error) {
      console.error("Unable to load sessions", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load sessions. Please try again.",
        "danger",
      );
    } finally {
      setSessionsLoading(false);
    }
  }, [selectedSession, showFeedback]);

  const loadClasses = useCallback(async () => {
    setClassesLoading(true);
    try {
      const data = await listClasses();
      setClasses(data);
    } catch (error) {
      console.error("Unable to load classes", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load classes. Please try again.",
        "danger",
      );
    } finally {
      setClassesLoading(false);
    }
  }, [showFeedback]);

  const loadClassArms = useCallback(
    async (classId: string) => {
      if (!classId) {
        setSelectedArm("");
        return;
      }
      if (armsCache[classId]) {
        const cachedArms = armsCache[classId];
        const exists = cachedArms.some(
          (arm) => String(arm.id) === selectedArm,
        );
        if (!exists) {
          setSelectedArm("");
        }
        return;
      }

      setArmsLoading(true);
      try {
        const data = await listClassArms(classId);
        setArmsCache((previous) => ({
          ...previous,
          [classId]: data,
        }));
        const found = data.some((arm) => String(arm.id) === selectedArm);
        if (!found) {
          setSelectedArm("");
        }
      } catch (error) {
        console.error("Unable to load class arms", error);
        showFeedback(
          error instanceof Error
            ? error.message
            : "Unable to load class arms. Please try again.",
          "danger",
        );
      } finally {
        setArmsLoading(false);
      }
    },
    [armsCache, selectedArm, showFeedback],
  );

  const loadTerms = useCallback(
    async (sessionId: string) => {
      if (!sessionId) {
        setSelectedTerm("");
        return;
      }
      if (termsCache[sessionId]) {
        const cachedTerms = termsCache[sessionId];
        if (
          cachedTerms.length &&
          !cachedTerms.some((term) => String(term.id) === selectedTerm)
        ) {
          setSelectedTerm(String(cachedTerms[0].id));
        }
        return;
      }

      setTermsLoading(true);
      try {
        const data = await listTermsBySession(sessionId);
        setTermsCache((previous) => ({
          ...previous,
          [sessionId]: data,
        }));
        if (!data.some((term) => String(term.id) === selectedTerm)) {
          setSelectedTerm(data.length ? String(data[0].id) : "");
        }
      } catch (error) {
        console.error("Unable to load terms", error);
        showFeedback(
          error instanceof Error
            ? error.message
            : "Unable to load terms. Please try again.",
          "danger",
        );
      } finally {
        setTermsLoading(false);
      }
    },
    [selectedTerm, showFeedback, termsCache],
  );

  const loadStudents = useCallback(async () => {
    if (!selectedSession || !selectedTerm || !selectedClass) {
      setStudents([]);
      setSelectedStudent("");
      return;
    }

    setStudentsLoading(true);
    try {
      const response = await listStudents({
        per_page: 200,
        session_id: selectedSession,
        school_class_id: selectedClass,
        class_arm_id: selectedArm || undefined,
      });
      const data = Array.isArray(response.data) ? response.data : [];
      setStudents(data);
      const exists = data.some(
        (student) => String(student.id) === selectedStudent,
      );
      if (!exists) {
        setSelectedStudent("");
      }
    } catch (error) {
      console.error("Unable to load students", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load students for the selected class.",
        "danger",
      );
      setStudents([]);
      setSelectedStudent("");
    } finally {
      setStudentsLoading(false);
    }
  }, [
    selectedArm,
    selectedClass,
    selectedSession,
    selectedStudent,
    selectedTerm,
    showFeedback,
  ]);

  const loadPins = useCallback(async () => {
    if (!selectedSession || !selectedTerm) {
      setPins([]);
      setPinsError(null);
      return;
    }

    setPinsLoading(true);
    setPinsError(null);
    try {
      const data = await listResultPins({
        session_id: selectedSession,
        term_id: selectedTerm,
        school_class_id: selectedClass || undefined,
        class_arm_id: selectedArm || undefined,
        student_id: selectedStudent || undefined,
      });
      setPins(data);
    } catch (error) {
      console.error("Unable to load result PINs", error);
      setPinsError(
        error instanceof Error
          ? error.message
          : "Unable to load result PINs. Please try again.",
      );
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load result PINs. Please try again.",
        "danger",
      );
    } finally {
      setPinsLoading(false);
    }
  }, [
    selectedArm,
    selectedClass,
    selectedSession,
    selectedStudent,
    selectedTerm,
    showFeedback,
  ]);

  useEffect(() => {
    void loadSessions();
    void loadClasses();
  }, [loadClasses, loadSessions]);

  useEffect(() => {
    void loadTerms(selectedSession);
  }, [loadTerms, selectedSession]);

  useEffect(() => {
    void loadClassArms(selectedClass);
  }, [loadClassArms, selectedClass]);

  useEffect(() => {
    void loadStudents();
  }, [loadStudents]);

  useEffect(() => {
    void loadPins();
  }, [loadPins]);

  const handleGenerateSingle = async () => {
    if (!selectedStudent) {
      showFeedback(
        "Select a student from the list, or use “Generate PINs for Class”.",
        "warning",
      );
      return;
    }
    if (!selectedSession || !selectedTerm) {
      showFeedback(
        "Select a session and term before generating PINs.",
        "warning",
      );
      return;
    }

    const trimmedMaxUsage = maxUsage.trim();
    let maxUsageValue: number | undefined;
    if (trimmedMaxUsage) {
      const parsed = Number.parseInt(trimmedMaxUsage, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        showFeedback("Enter a valid max usage (minimum 1).", "warning");
        return;
      }
      maxUsageValue = parsed;
    }

    setGeneratingSingle(true);
    resetFeedback();
    try {
      const payload: GenerateStudentPinPayload = {
        session_id: selectedSession,
        term_id: selectedTerm,
        regenerate: regenerateExisting,
        expires_at: expiryDate || null,
      };

      if (maxUsageValue !== undefined) {
        payload.max_usage = maxUsageValue;
      }

      await generateResultPinForStudent(selectedStudent, payload);
      showFeedback("Result PIN generated successfully.", "success");
      await loadPins();
    } catch (error) {
      console.error("Unable to generate result PIN", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to generate result PIN.",
        "danger",
      );
    } finally {
      setGeneratingSingle(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!selectedSession || !selectedTerm) {
      showFeedback(
        "Select a session and term before generating PINs.",
        "warning",
      );
      return;
    }

    if (!selectedClass) {
      showFeedback(
        "Select a class before generating PINs for the whole class.",
        "warning",
      );
      return;
    }

    const trimmedMaxUsage = maxUsage.trim();
    let maxUsageValue: number | undefined;
    if (trimmedMaxUsage) {
      const parsed = Number.parseInt(trimmedMaxUsage, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        showFeedback("Enter a valid max usage (minimum 1).", "warning");
        return;
      }
      maxUsageValue = parsed;
    }

    setGeneratingBulk(true);
    resetFeedback();
    try {
      const payload: BulkGeneratePinsPayload = {
        session_id: selectedSession,
        term_id: selectedTerm,
        school_class_id: selectedClass,
        class_arm_id: selectedArm || undefined,
        regenerate: regenerateExisting,
        expires_at: expiryDate || null,
      };

      if (maxUsageValue !== undefined) {
        payload.max_usage = maxUsageValue;
      }

      await bulkGenerateResultPins(payload);
      showFeedback("Result PINs generated successfully.", "success");
      await loadPins();
    } catch (error) {
      console.error("Unable to bulk generate result PINs", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to generate result PINs.",
        "danger",
      );
    } finally {
      setGeneratingBulk(false);
    }
  };

  const handleRegeneratePin = async (studentId: number | string) => {
    if (!selectedSession || !selectedTerm) {
      showFeedback(
        "Select a session and term before generating PINs.",
        "warning",
      );
      return;
    }

    const trimmedMaxUsage = maxUsage.trim();
    let maxUsageValue: number | undefined;
    if (trimmedMaxUsage) {
      const parsed = Number.parseInt(trimmedMaxUsage, 10);
      if (Number.isNaN(parsed) || parsed < 1) {
        showFeedback("Enter a valid max usage (minimum 1).", "warning");
        return;
      }
      maxUsageValue = parsed;
    }

    const actionKey = `regen-${studentId}`;
    setPinActionKey(actionKey);
    resetFeedback();
    try {
      const payload: GenerateStudentPinPayload = {
        session_id: selectedSession,
        term_id: selectedTerm,
        regenerate: true,
        expires_at: expiryDate || null,
      };

      if (maxUsageValue !== undefined) {
        payload.max_usage = maxUsageValue;
      }

      await generateResultPinForStudent(studentId, payload);
      showFeedback("Result PIN regenerated successfully.", "success");
      await loadPins();
    } catch (error) {
      console.error("Unable to regenerate result PIN", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to regenerate result PIN.",
        "danger",
      );
    } finally {
      setPinActionKey(null);
    }
  };

  const handleInvalidatePin = async (pinId: number | string) => {
    if (!window.confirm("Invalidate this result PIN?")) {
      return;
    }

    const actionKey = `invalidate-${pinId}`;
    setPinActionKey(actionKey);
    resetFeedback();
    try {
      await invalidateResultPin(pinId);
      showFeedback("Result PIN invalidated.", "success");
      await loadPins();
    } catch (error) {
      console.error("Unable to invalidate result PIN", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to invalidate result PIN.",
        "danger",
      );
    } finally {
      setPinActionKey(null);
    }
  };

  const tableMessage = useMemo(() => {
    if (!selectedSession || !selectedTerm) {
      return "Select a session and term to view PINs.";
    }
    if (pinsLoading) {
      return "Loading…";
    }
    if (pinsError) {
      return "Unable to load result PINs.";
    }
    if (pins.length === 0) {
      return "No result PINs found for the selected filters.";
    }
    return null;
  }, [pins.length, pinsError, pinsLoading, selectedSession, selectedTerm]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Result PIN Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Result PINs</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Generate Result PINs</h3>
            </div>
            <div className="dropdown">
              <button
                className="dropdown-toggle"
                type="button"
                data-toggle="dropdown"
                aria-expanded="false"
              >
                ...
              </button>
              <div className="dropdown-menu dropdown-menu-right">
                <button
                  className="dropdown-item"
                  type="button"
                  onClick={() => {
                    void loadPins();
                  }}
                  disabled={pinsLoading}
                >
                  <i className="fas fa-redo-alt text-orange-peel" />
                  <span className="ml-2">Refresh</span>
                </button>
              </div>
            </div>
          </div>

          <div
            id="pin-feedback"
            className={`alert${
              feedback ? ` alert-${feedback.type}` : ""
            }`}
            style={{ display: feedback ? "block" : "none" }}
            role="alert"
          >
            {feedback?.message}
          </div>

          <form id="pin-filter-form" className="mb-3">
            <div className="form-row">
              <div className="form-group col-md-3">
                <label htmlFor="pin-session" className="text-dark-medium">
                  Session
                </label>
                <select
                  id="pin-session"
                  className="form-control"
                  value={selectedSession}
                  onChange={(event) => {
                    setSelectedSession(event.target.value);
                    setSelectedTerm("");
                  }}
                  required
                  disabled={sessionsLoading}
                >
                  <option value="">Select session</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={String(session.id)}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group col-md-3">
                <label htmlFor="pin-term" className="text-dark-medium">
                  Term
                </label>
                <select
                  id="pin-term"
                  className="form-control"
                  value={selectedTerm}
                  onChange={(event) => {
                    setSelectedTerm(event.target.value);
                  }}
                  required
                  disabled={termsLoading || !selectedSession}
                >
                  <option value="">Select term</option>
                  {availableTerms.map((term) => (
                    <option key={term.id} value={String(term.id)}>
                      {term.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group col-md-3">
                <label htmlFor="pin-class" className="text-dark-medium">
                  Class
                </label>
                <select
                  id="pin-class"
                  className="form-control"
                  value={selectedClass}
                  onChange={(event) => {
                    setSelectedClass(event.target.value);
                    setSelectedArm("");
                    setSelectedStudent("");
                  }}
                  disabled={classesLoading}
                >
                  <option value="">Select class</option>
                  {classes.map((item) => (
                    <option key={item.id} value={String(item.id)}>
                      {item.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group col-md-3">
                <label htmlFor="pin-class-arm" className="text-dark-medium">
                  Class Arm
                </label>
                <select
                  id="pin-class-arm"
                  className="form-control"
                  value={selectedArm}
                  onChange={(event) => {
                    setSelectedArm(event.target.value);
                    setSelectedStudent("");
                  }}
                  disabled={armsLoading || !selectedClass}
                >
                  <option value="">All arms</option>
                  {availableArms.map((arm) => (
                    <option key={arm.id} value={String(arm.id)}>
                      {arm.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group col-md-4 col-12">
                <label htmlFor="pin-student" className="text-dark-medium">
                  Student (single PIN)
                </label>
                <select
                  id="pin-student"
                  className="form-control"
                  value={selectedStudent}
                  onChange={(event) => {
                    setSelectedStudent(event.target.value);
                  }}
                  disabled={
                    studentsLoading ||
                    !selectedSession ||
                    !selectedTerm ||
                    !selectedClass
                  }
                >
                  <option value="">Select student</option>
                  {students.map((student) => (
                    <option key={student.id} value={String(student.id)}>
                      {buildStudentLabel(student)}
                    </option>
                  ))}
                </select>
                <small className="form-text text-muted">
                  Leave blank to generate PINs for the whole class.
                </small>
              </div>
              <div className="form-group col-md-3 col-12">
                <label htmlFor="pin-expiry" className="text-dark-medium">
                  Expiry Date
                </label>
                <input
                  type="date"
                  id="pin-expiry"
                  className="form-control"
                  value={expiryDate}
                  onChange={(event) => {
                    setExpiryDate(event.target.value);
                  }}
                />
              </div>
              <div className="form-group col-md-3 col-12">
                <label htmlFor="pin-max-usage" className="text-dark-medium">
                  Max Uses
                </label>
                <input
                  type="number"
                  min={1}
                  id="pin-max-usage"
                  className="form-control"
                  placeholder="Leave blank for unlimited"
                  value={maxUsage}
                  onChange={(event) => {
                    setMaxUsage(event.target.value);
                  }}
                />
              </div>
              <div className="form-group col-md-2 col-12 d-flex align-items-end">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="pin-regenerate"
                    checked={regenerateExisting}
                    onChange={(event) => {
                      setRegenerateExisting(event.target.checked);
                    }}
                  />
                  <label className="form-check-label" htmlFor="pin-regenerate">
                    Regenerate existing PINs
                  </label>
                </div>
              </div>
            </div>
            <div className="form-row">
              <div className="form-group col-12">
                <div className="d-flex flex-column flex-md-row justify-content-md-end align-items-md-center">
                  <button
                    type="button"
                    id="pin-generate-single"
                    className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark mb-2 mb-md-0 mr-md-3"
                    onClick={() => {
                      void handleGenerateSingle();
                    }}
                    disabled={generatingSingle || !selectedStudent}
                    title={
                      selectedStudent
                        ? undefined
                        : "Pick a student to enable this action."
                    }
                  >
                    {generatingSingle
                      ? "Generating…"
                      : "Generate PIN for Student"}
                  </button>
                  <div className="d-flex flex-column">
                    <button
                      type="button"
                      id="pin-generate-bulk"
                      className="btn-fill-lg btn-dark btn-hover-yellow"
                      onClick={() => {
                        void handleBulkGenerate();
                      }}
                      disabled={generatingBulk}
                    >
                      {generatingBulk
                        ? "Generating…"
                        : "Generate PINs for Class"}
                    </button>
                    <small className="text-muted mt-1">
                      Select a class above and click once to create PINs for every student.
                    </small>
                  </div>
                </div>
              </div>
            </div>
          </form>

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Session</th>
                  <th>Term</th>
                  <th>PIN</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="pin-table-body">
                {tableMessage ? (
                  <tr>
                    <td colSpan={9}>{tableMessage}</td>
                  </tr>
                ) : (
                  pins.map((pin) => {
                    const studentName = buildResultPinStudentLabel(pin);
                    return (
                      <tr key={String(pin.id)}>
                        <td>{studentName}</td>
                        <td>{pin.session?.name ?? "—"}</td>
                        <td>{pin.term?.name ?? "—"}</td>
                        <td>
                          <code>{maskPin(pin.pin_code)}</code>
                        </td>
                        <td>{formatUsage(pin)}</td>
                        <td>
                          <span className={statusBadgeClass(pin.status)}>
                            {(pin.status ?? "unknown").toLowerCase()}
                          </span>
                        </td>
                        <td>{formatDate(pin.expires_at)}</td>
                        <td>{formatDateTime(pin.updated_at)}</td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-link p-0 mr-3 text-primary"
                            onClick={() => {
                              if (pin.pin_code) {
                                window.alert(`Result PIN: ${pin.pin_code}`);
                              }
                            }}
                          >
                            Show
                          </button>
                          <button
                            type="button"
                            className="btn btn-link p-0 mr-3"
                            onClick={() => {
                              void handleRegeneratePin(pin.student_id);
                            }}
                            disabled={pinActionKey === `regen-${pin.student_id}`}
                          >
                            Regenerate
                          </button>
                          <button
                            type="button"
                            className="btn btn-link text-danger p-0"
                            onClick={() => {
                              void handleInvalidatePin(pin.id);
                            }}
                            disabled={pinActionKey === `invalidate-${pin.id}`}
                          >
                            Invalidate
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
