"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import {
  ChangeEvent,
  FormEvent,
  MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  deleteStudent,
  getStudent,
  type StudentDetail,
} from "@/lib/students";
import { resolveBackendUrl } from "@/lib/config";
import { getCookie } from "@/lib/cookies";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import {
  listStudentSkillRatings,
  listStudentSkillTypes,
  createStudentSkillRating,
  updateStudentSkillRating,
  deleteStudentSkillRating,
  type StudentSkillRating,
  type StudentSkillType,
} from "@/lib/studentSkillRatings";
import {
  getStudentTermSummary,
  updateStudentTermSummary,
  type StudentTermSummary,
} from "@/lib/studentTermSummaries";
import {
  listStudentResultPins,
  generateResultPinForStudent,
  invalidateResultPin,
  type ResultPin,
} from "@/lib/resultPins";

const passthroughLoader: ImageLoader = ({ src }) => src;

export default function StudentDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("id");

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [termsCache, setTermsCache] = useState<Record<string, Term[]>>({});
  const [selectedSession, setSelectedSession] = useState<string>("");
  const [selectedTerm, setSelectedTerm] = useState<string>("");

  const [skillTypes, setSkillTypes] = useState<StudentSkillType[]>([]);
  const [skillRatings, setSkillRatings] = useState<StudentSkillRating[]>([]);
  const [skillLoading, setSkillLoading] = useState(false);
  const [skillFeedback, setSkillFeedback] = useState<string | null>(null);
  const [skillFeedbackType, setSkillFeedbackType] = useState<"success" | "warning">("success");
  const [skillError, setSkillError] = useState<string | null>(null);
  const [skillSubmitting, setSkillSubmitting] = useState(false);
  const [skillForm, setSkillForm] = useState<{
    id: string | null;
    skill_type_id: string;
    rating_value: string;
  }>({
    id: null,
    skill_type_id: "",
    rating_value: "3",
  });

  const defaultTeacherComment = "This student is good.";
  const defaultPrincipalComment = "This student is hardworking.";
  const [termSummary, setTermSummary] = useState<StudentTermSummary>({
    class_teacher_comment: defaultTeacherComment,
    principal_comment: defaultPrincipalComment,
  });
  const [termSummaryFeedback, setTermSummaryFeedback] = useState<string | null>(null);
  const [termSummaryFeedbackType, setTermSummaryFeedbackType] =
    useState<"success" | "warning" | "danger">("success");
  const [termSummarySaving, setTermSummarySaving] = useState(false);

  const [pins, setPins] = useState<ResultPin[]>([]);
  const [pinLoading, setPinLoading] = useState(false);
  const [pinFeedback, setPinFeedback] = useState<string | null>(null);
  const [pinFeedbackType, setPinFeedbackType] = useState<"success" | "warning">("success");
  const [pinError, setPinError] = useState<string | null>(null);
  const [pinProcessing, setPinProcessing] = useState(false);
  const [printProcessing, setPrintProcessing] = useState(false);

  const ratingOptions = ["1", "2", "3", "4", "5"];

  const terms = useMemo(() => {
    if (!selectedSession) {
      return [];
    }
    return termsCache[selectedSession] ?? [];
  }, [selectedSession, termsCache]);

  const resetSkillForm = useCallback(() => {
    setSkillForm({
      id: null,
      skill_type_id: "",
      rating_value: "3",
    });
  }, []);

  const loadSkillRatings = useCallback(async () => {
    if (!student?.id || !selectedSession || !selectedTerm) {
      setSkillRatings([]);
      return;
    }
    setSkillLoading(true);
    setSkillError(null);
    try {
      const ratings = await listStudentSkillRatings(student.id, {
        session_id: selectedSession,
        term_id: selectedTerm,
      });
      setSkillRatings(ratings);
    } catch (err) {
      console.error("Unable to load skill ratings", err);
      setSkillError(
        err instanceof Error
          ? err.message
          : "Unable to load skill ratings.",
      );
      setSkillRatings([]);
    } finally {
      setSkillLoading(false);
    }
  }, [student?.id, selectedSession, selectedTerm]);

  const loadTermSummary = useCallback(async () => {
    if (!student?.id || !selectedSession || !selectedTerm) {
      setTermSummary({
        class_teacher_comment: "",
        principal_comment: "",
      });
      return;
    }
    try {
      const summary = await getStudentTermSummary(student.id, {
        session_id: selectedSession,
        term_id: selectedTerm,
      });
      setTermSummary({
        class_teacher_comment:
          summary.class_teacher_comment?.trim() || defaultTeacherComment,
        principal_comment:
          summary.principal_comment?.trim() || defaultPrincipalComment,
      });
      setTermSummaryFeedback(null);
      setTermSummaryFeedbackType("success");
    } catch (err) {
      console.error("Unable to load term comments", err);
      setTermSummary({
        class_teacher_comment: "",
        principal_comment: "",
      });
      setTermSummaryFeedback(
        err instanceof Error
          ? err.message
          : "Unable to load term comments for the selected session and term.",
      );
      setTermSummaryFeedbackType("warning");
    }
  }, [student?.id, selectedSession, selectedTerm]);

  const loadResultPins = useCallback(async () => {
    if (!student?.id || !selectedSession || !selectedTerm) {
      setPins([]);
      return;
    }
    setPinLoading(true);
    setPinError(null);
    try {
      const result = await listStudentResultPins(student.id, {
        session_id: selectedSession,
        term_id: selectedTerm,
      });
      setPins(result);
    } catch (err) {
      console.error("Unable to load result PINs", err);
      setPinError(
        err instanceof Error
          ? err.message
          : "Unable to load result PINs for the selected term.",
      );
      setPins([]);
    } finally {
      setPinLoading(false);
    }
  }, [student?.id, selectedSession, selectedTerm]);

  useEffect(() => {
    void loadSkillRatings();
  }, [loadSkillRatings]);

  useEffect(() => {
    void loadTermSummary();
  }, [loadTermSummary]);

  useEffect(() => {
    void loadResultPins();
  }, [loadResultPins]);

  const handleSessionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const newSession = event.target.value;
    setSelectedSession(newSession);
    setSelectedTerm("");
  };

  const handleTermChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedTerm(event.target.value);
  };

  const handleSkillTypeChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSkillForm((prev) => ({
      ...prev,
      skill_type_id: value,
    }));
  };

  const handleSkillRatingChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    setSkillForm((prev) => ({
      ...prev,
      rating_value: value,
    }));
  };

  const beginEditSkillRating = useCallback(
    (rating: StudentSkillRating) => {
      setSkillForm({
        id: rating?.id != null ? String(rating.id) : null,
        skill_type_id:
          rating?.skill_type_id != null ? String(rating.skill_type_id) : "",
        rating_value:
          rating?.rating_value != null ? String(rating.rating_value) : "3",
      });
      setSkillFeedback(null);
      setSkillError(null);
    },
    [],
  );

  const handleCancelSkillEdit = (event: MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    resetSkillForm();
  };

  const handleDeleteSkillRating = useCallback(
    async (rating: StudentSkillRating) => {
      if (!student?.id || rating?.id == null) {
        return;
      }
      if (
        !window.confirm(
          "Delete this skill rating? This action cannot be undone.",
        )
      ) {
        return;
      }
      setSkillError(null);
      setSkillFeedback(null);
      try {
        await deleteStudentSkillRating(student.id, rating.id);
        if (skillForm.id && String(rating.id) === skillForm.id) {
          resetSkillForm();
        }
        setSkillFeedback("Skill rating deleted.");
        setSkillFeedbackType("success");
        await loadSkillRatings();
      } catch (err) {
        console.error("Unable to delete skill rating", err);
        setSkillError(
          err instanceof Error
            ? err.message
            : "Unable to delete skill rating.",
        );
      }
    },
    [student?.id, skillForm.id, loadSkillRatings, resetSkillForm],
  );

  const handleSkillFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!student?.id) {
      return;
    }
    if (!selectedSession || !selectedTerm) {
      setSkillFeedback("Select a session and term before saving a rating.");
      setSkillFeedbackType("warning");
      return;
    }
    if (!skillForm.skill_type_id || !skillForm.rating_value) {
      setSkillError("Skill and rating are required.");
      return;
    }

    const ratingValue = Number(skillForm.rating_value);
    if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
      setSkillError("Select a valid rating between 1 and 5.");
      return;
    }

    setSkillSubmitting(true);
    setSkillError(null);
    try {
      const payload = {
        session_id: selectedSession,
        term_id: selectedTerm,
        skill_type_id: skillForm.skill_type_id,
        rating_value: ratingValue,
      };
      if (skillForm.id) {
        await updateStudentSkillRating(student.id, skillForm.id, payload);
        setSkillFeedback("Skill rating updated successfully.");
      } else {
        await createStudentSkillRating(student.id, payload);
        setSkillFeedback("Skill rating saved successfully.");
      }
      setSkillFeedbackType("success");
      resetSkillForm();
      await loadSkillRatings();
    } catch (err) {
      console.error("Unable to save skill rating", err);
      setSkillError(
        err instanceof Error
          ? err.message
          : "Unable to save skill rating at this time.",
      );
    } finally {
      setSkillSubmitting(false);
    }
  };

  const handleTermSummaryChange = (
    field: "class_teacher_comment" | "principal_comment",
    value: string,
  ) => {
    setTermSummary((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleTermSummarySubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!student?.id) {
      return;
    }
    if (!selectedSession || !selectedTerm) {
      setTermSummaryFeedback(
        "Select a session and term before saving comments.",
      );
      setTermSummaryFeedbackType("warning");
      return;
    }
    setTermSummarySaving(true);
    setTermSummaryFeedback(null);
    try {
      const payload = {
        session_id: selectedSession,
        term_id: selectedTerm,
        class_teacher_comment:
          termSummary.class_teacher_comment?.trim() || null,
        principal_comment: termSummary.principal_comment?.trim() || null,
      };
      const updated = await updateStudentTermSummary(student.id, payload);
      setTermSummary({
        class_teacher_comment: updated.class_teacher_comment ?? "",
        principal_comment: updated.principal_comment ?? "",
      });
      setTermSummaryFeedback("Comments saved successfully.");
      setTermSummaryFeedbackType("success");
    } catch (err) {
      console.error("Unable to save term comments", err);
      setTermSummaryFeedback(
        err instanceof Error
          ? err.message
          : "Unable to save comments for the selected session and term.",
      );
      setTermSummaryFeedbackType("danger");
    } finally {
      setTermSummarySaving(false);
    }
  };

  const handleGeneratePin = async (regenerate: boolean) => {
    if (!student?.id) {
      return;
    }
    if (!selectedSession || !selectedTerm) {
      setPinFeedback("Select the session and term before generating a PIN.");
      setPinFeedbackType("warning");
      return;
    }
    setPinProcessing(true);
    setPinFeedback(null);
    setPinError(null);
    try {
      await generateResultPinForStudent(student.id, {
        session_id: selectedSession,
        term_id: selectedTerm,
        regenerate,
      });
      setPinFeedback(
        regenerate
          ? "Result PIN regenerated successfully."
          : "Result PIN generated successfully.",
      );
      setPinFeedbackType("success");
      await loadResultPins();
    } catch (err) {
      console.error("Unable to generate result PIN", err);
      setPinError(
        err instanceof Error
          ? err.message
          : "Unable to generate result PIN at this time.",
      );
    } finally {
      setPinProcessing(false);
    }
  };

  const handleInvalidatePin = async (pinId: string | number) => {
    if (!pinId) {
      return;
    }
    if (!window.confirm("Invalidate this result PIN?")) {
      return;
    }
    setPinProcessing(true);
    setPinError(null);
    setPinFeedback(null);
    try {
      await invalidateResultPin(pinId);
      setPinFeedback("Result PIN invalidated.");
      setPinFeedbackType("success");
      await loadResultPins();
    } catch (err) {
      console.error("Unable to invalidate result PIN", err);
      setPinError(
        err instanceof Error
          ? err.message
          : "Unable to invalidate result PIN at this time.",
      );
    } finally {
      setPinProcessing(false);
    }
  };

  const handleShowPin = (pinCode?: string | null) => {
    if (!pinCode) {
      window.alert("PIN not available.");
      return;
    }
    window.alert(`Result PIN: ${pinCode}`);
  };

  const buildPrintParams = useCallback(() => {
    const params = new URLSearchParams();
    if (!studentId) {
      return params;
    }
    params.set("student_id", studentId);
    const sessionCandidate =
      selectedSession ||
      (student?.current_session_id != null
        ? String(student.current_session_id)
        : "");
    const termCandidate =
      selectedTerm ||
      (student?.current_term_id != null
        ? String(student.current_term_id)
        : "");
    if (sessionCandidate) {
      params.set("session_id", sessionCandidate);
    }
    if (termCandidate) {
      params.set("term_id", termCandidate);
    }
    return params;
  }, [
    selectedSession,
    selectedTerm,
    student?.current_session_id,
    student?.current_term_id,
    studentId,
  ]);

  const handlePrintResult = useCallback(async () => {
    if (!studentId) {
      return;
    }
    const params = buildPrintParams();
    const endpoint = `${resolveBackendUrl(
      `/api/v1/students/${studentId}/results/print`,
    )}?${params.toString()}`;
    const token = getCookie("token");
    if (!token) {
      window.alert(
        "Your session token is missing. Please log in again before printing the result.",
      );
      return;
    }

    setPrintProcessing(true);
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "text/html",
          "X-Requested-With": "XMLHttpRequest",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        credentials: "include",
      });

      if (!response.ok) {
        // Try to parse as JSON first (for API error responses)
        let errorMessage = "Unable to load printable result.";
        const contentType = response.headers.get("content-type") || "";
        
        if (contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorData.error || errorMessage;
          } catch {
            // If JSON parsing fails, fall back to text
            const text = await response.text().catch(() => "");
            errorMessage = text.trim() || errorMessage;
          }
        } else {
          // For HTML responses, extract a user-friendly message
          if (response.status === 403) {
            errorMessage = "You do not have permission to print student results.";
          } else if (response.status === 401) {
            errorMessage = "Your session has expired. Please log in again.";
          } else {
            const text = await response.text().catch(() => "");
            const trimmed = text.trim();
            if (trimmed.length > 0 && /^<\s*(!DOCTYPE|html)/i.test(trimmed)) {
              errorMessage =
                response.status === 422
                  ? "Results have not been added for this student in the selected session/term."
                  : "Unable to load printable result. Please try again.";
            } else {
              errorMessage = trimmed || `Unable to load printable result (${response.status}).`;
            }
          }
        }
        
        console.error("Printable result request failed", {
          endpoint,
          status: response.status,
          message: errorMessage,
        });
        throw new Error(errorMessage);
      }

      const html = await response.text();
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        window.alert(
          "Unable to open result window. Please allow pop-ups for this site.",
        );
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      console.error("Unable to load printable result", error);
      window.alert(
        error instanceof Error
          ? error.message
          : "Unable to load printable result.",
      );
    } finally {
      setPrintProcessing(false);
    }
  }, [buildPrintParams, studentId]);

  const formatDate = (value?: string | null) => {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }).format(date);
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) {
      return "—";
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString();
  };

  const maskPin = (pin?: string | null) => {
    if (!pin || pin.length < 4) {
      return "********";
    }
    return `${pin.slice(0, 2)}****${pin.slice(-2)}`;
  };

  const pinStatusClass = (status?: string | null) => {
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

  useEffect(() => {
    if (!studentId) {
      router.replace("/v14/all-students");
      return;
    }
    getStudent(studentId)
      .then((detail) => {
        if (!detail) {
          throw new Error("Student not found.");
        }
        setStudent(detail);
        setError(null);
      })
      .catch((err) => {
        console.error("Unable to load student details", err);
        setError(
          err instanceof Error ? err.message : "Unable to load student.",
        );
      })
      .finally(() => setLoading(false));
  }, [studentId, router]);

  useEffect(() => {
    if (!student?.id) {
      return;
    }
    listStudentSkillTypes(student.id)
      .then(setSkillTypes)
      .catch((err) => console.error("Unable to load skill types", err));
  }, [student?.id]);

  useEffect(() => {
    if (!student) {
      return;
    }
    setSelectedSession((prev) => {
      if (prev) {
        return prev;
      }
      if (student.current_session_id) {
        return String(student.current_session_id);
      }
      return "";
    });
    setSelectedTerm((prev) => {
      if (prev) {
        return prev;
      }
      if (student.current_term_id) {
        return String(student.current_term_id);
      }
      return "";
    });
  }, [student]);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => console.error("Unable to load sessions", err));
  }, []);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }
    if (termsCache[selectedSession]) {
      return;
    }
    listTermsBySession(selectedSession)
      .then((terms) => {
        setTermsCache((prev) => ({
          ...prev,
          [selectedSession]: terms,
        }));
      })
      .catch((err) => console.error("Unable to load terms", err));
  }, [selectedSession, termsCache]);

  useEffect(() => {
    if (!selectedSession) {
      return;
    }
    const terms = termsCache[selectedSession];
    if (!terms || terms.length === 0) {
      setSelectedTerm("");
      return;
    }
    if (!selectedTerm || !terms.find((term) => String(term.id) === selectedTerm)) {
      setSelectedTerm(String(terms[0].id));
    }
  }, [selectedSession, selectedTerm, termsCache]);

  useEffect(() => {
    setSkillFeedback(null);
    setSkillError(null);
    resetSkillForm();
  }, [selectedSession, selectedTerm, resetSkillForm]);

  useEffect(() => {
    setTermSummaryFeedback(null);
    setTermSummaryFeedbackType("success");
  }, [selectedSession, selectedTerm]);

  useEffect(() => {
    setPinFeedback(null);
    setPinError(null);
    setPinFeedbackType("success");
  }, [selectedSession, selectedTerm]);

  const fullName = useMemo(() => {
    if (!student) return "";
    return [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ");
  }, [student]);

  const photoUrl = useMemo(() => {
    if (!student?.photo_url) {
      return "/assets/img/figure/student.png";
    }
    return resolveBackendUrl(student.photo_url);
  }, [student?.photo_url]);

  const handleDelete = async () => {
    if (!studentId || removing) {
      return;
    }
    if (
      !window.confirm(
        "Are you sure you want to delete this student? This action cannot be undone.",
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      await deleteStudent(studentId);
      router.push("/v14/all-students");
    } catch (err) {
      console.error("Unable to delete student", err);
      alert(
        err instanceof Error ? err.message : "Unable to delete student.",
      );
    } finally {
      setRemoving(false);
    }
  };

  if (!studentId) {
    return null;
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="alert alert-danger" role="alert">
        {error ?? "Student not found."}
      </div>
    );
  }

  const houseLabel = student.house && `${student.house}`.trim().length > 0
    ? `${student.house}`
    : "N/A";
  const clubLabel = student.club && `${student.club}`.trim().length > 0
    ? `${student.club}`
    : "N/A";

  const className = student.school_class?.name ?? "N/A";
  const armName =
    student.class_arm?.name ?? student.school_class?.class_arm?.name ?? "";
  const sectionName = student.class_section?.name ?? "N/A";
  const parentName = student.parent
    ? `${student.parent.first_name ?? ""} ${student.parent.last_name ?? ""}`.trim() ||
      student.parent.phone ||
      "N/A"
    : "N/A";

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Student Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href="/v14/all-students">All Students</Link>
          </li>
          <li>Student Details</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="d-flex justify-content-between align-items-start mb-4">
            <div className="d-flex align-items-center">
              <Image
                src={photoUrl}
                alt={fullName || "Student photo"}
                width={96}
                height={96}
                loader={passthroughLoader}
                unoptimized
                style={{
                  borderRadius: "50%",
                  objectFit: "cover",
                  marginRight: "1rem",
                }}
              />
              <div>
                <h3 className="mb-1">{fullName || "Unnamed Student"}</h3>
                <p className="mb-0 text-muted">
                  Admission No: {student.admission_no ?? "N/A"}
                </p>
                <p className="mb-0 text-muted text-capitalize">
                  Status: {student.status ?? "active"}
                </p>
              </div>
            </div>
            <div className="btn-group">
              <Link
                href={`/v14/edit-student?id=${studentId}`}
                className="btn btn-outline-primary"
              >
                Edit
              </Link>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={handlePrintResult}
                disabled={printProcessing}
              >
                {printProcessing ? "Loading…" : "Print Result"}
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                onClick={handleDelete}
                disabled={removing}
              >
                {removing ? "Deleting…" : "Delete"}
              </button>
            </div>
          </div>

          <div className="row">
            <div className="col-lg-6 col-12">
              <div className="mb-4">
                <h5 className="mb-3">Personal Information</h5>
                <ul className="list-unstyled">
                  <li>
                    <strong>Gender:</strong> {student.gender ?? "N/A"}
                  </li>
                  <li>
                    <strong>Date of Birth:</strong>{" "}
                    {formatDate(student.date_of_birth)}
                  </li>
                  <li>
                    <strong>Nationality:</strong>{" "}
                    {student.nationality ?? "N/A"}
                  </li>
                  <li>
                    <strong>State of Origin:</strong>{" "}
                    {student.state_of_origin ?? "N/A"}
                  </li>
                  <li>
                    <strong>LGA of Origin:</strong>{" "}
                    {student.lga_of_origin ?? "N/A"}
                  </li>
                  <li>
                    <strong>Blood Group:</strong>{" "}
                    {student.blood_group?.name ?? "N/A"}
                  </li>
                </ul>
              </div>

              <div className="mb-4">
                <h5 className="mb-3">Contact</h5>
                <ul className="list-unstyled">
                  <li>
                    <strong>Parent:</strong> {parentName}
                  </li>
                  <li>
                    <strong>Parent Phone:</strong>{" "}
                    {student.parent?.phone ?? "N/A"}
                  </li>
                  <li>
                    <strong>Address:</strong> {student.address ?? "N/A"}
                  </li>
                  <li>
                    <strong>Medical Info:</strong>{" "}
                    {student.medical_information ?? "N/A"}
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-lg-6 col-12">
              <div className="mb-4">
                <h5 className="mb-3">Academic Information</h5>
                <ul className="list-unstyled">
                  <li>
                    <strong>Admission Date:</strong>{" "}
                    {formatDate(student.admission_date)}
                  </li>
                  <li>
                    <strong>Current Session:</strong>{" "}
                    {student.session?.name ??
                      student.current_session_id ??
                      "N/A"}
                  </li>
                  <li>
                    <strong>Current Term:</strong>{" "}
                    {student.term?.name ?? student.current_term_id ?? "N/A"}
                  </li>
                  <li>
                    <strong>Class:</strong> {className}
                    {armName ? ` - ${armName}` : ""}
                  </li>
                  <li>
                    <strong>Section:</strong> {sectionName}
                  </li>
                  <li>
                    <strong>House:</strong> {houseLabel}
                  </li>
                  <li>
                    <strong>Club:</strong> {clubLabel}
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card height-auto mt-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Skills &amp; Behaviour Tracker</h3>
              <p className="mb-0 text-muted small">
                Select a session and term to manage this student&rsquo;s soft-skill ratings.
              </p>
            </div>
          </div>
          <form className="mb-3" onSubmit={handleSkillFormSubmit}>
            <div className="row">
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Session</label>
                <select
                  className="form-control"
                  value={selectedSession}
                  onChange={handleSessionChange}
                >
                  <option value="">Select session</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={session.id}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Term</label>
                <select
                  className="form-control"
                  value={selectedTerm}
                  onChange={handleTermChange}
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
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Skill</label>
                <select
                  className="form-control"
                  value={skillForm.skill_type_id}
                  onChange={handleSkillTypeChange}
                  disabled={!selectedSession || !selectedTerm}
                  required
                >
                  <option value="">Select skill</option>
                  {skillTypes.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.category ? `${type.category} - ${type.name}` : type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label>Rating (1 - 5)</label>
                <select
                  className="form-control"
                  value={skillForm.rating_value}
                  onChange={handleSkillRatingChange}
                  disabled={!selectedSession || !selectedTerm}
                  required
                >
                  <option value="">Select rating</option>
                  {ratingOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="d-flex align-items-center">
              <button
                type="submit"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                disabled={skillSubmitting || !selectedSession || !selectedTerm}
              >
                {skillForm.id ? "Update Skill Rating" : "Save Skill Rating"}
              </button>
              {skillForm.id ? (
                <button
                  type="button"
                  className="btn-fill-lg btn-light ml-3"
                  onClick={handleCancelSkillEdit}
                  disabled={skillSubmitting}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>
          {skillFeedback ? (
            <div className={`alert alert-${skillFeedbackType}`} role="alert">
              {skillFeedback}
            </div>
          ) : null}
          {skillError ? (
            <div className="alert alert-danger" role="alert">
              {skillError}
            </div>
          ) : null}
          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>Skill</th>
                  <th>Rating</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {skillLoading ? (
                  <tr>
                    <td colSpan={4}>Loading skill ratings…</td>
                  </tr>
                ) : skillRatings.length === 0 ? (
                  <tr>
                    <td colSpan={4}>
                      {selectedSession && selectedTerm
                        ? "No skill ratings recorded for this term."
                        : "Select a session and term to view recorded skill ratings."}
                    </td>
                  </tr>
                ) : (
                  skillRatings.map((rating) => (
                    <tr key={String(rating.id ?? rating.skill_type_id)}>
                      <td>
                        {rating.skill_type?.name ??
                          rating.skill_type_id ??
                          "—"}
                      </td>
                      <td>{rating.rating_value ?? "—"}</td>
                      <td>{formatDateTime(rating.updated_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-link p-0 mr-3"
                          onClick={() => beginEditSkillRating(rating)}
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          className="btn btn-link text-danger p-0"
                          onClick={() => {
                            void handleDeleteSkillRating(rating);
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card height-auto mt-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Term Comments</h3>
              <p className="mb-0 text-muted small">
                Applies to the selected session and term above.
              </p>
            </div>
          </div>
          <form className="mb-3" onSubmit={handleTermSummarySubmit}>
            <div className="row">
              <div className="col-md-6 col-12 form-group">
                <label className="text-dark-medium">Class Teacher Comment</label>
                <textarea
                  className="form-control"
                  style={{ backgroundColor: "#f8f8f8" }}
                  rows={4}
                  maxLength={2000}
                  value={termSummary.class_teacher_comment ?? ""}
                  onChange={(event) =>
                    handleTermSummaryChange(
                      "class_teacher_comment",
                      event.target.value,
                    )
                  }
                  disabled={!selectedSession || !selectedTerm}
                />
              </div>
              <div className="col-md-6 col-12 form-group">
                <label className="text-dark-medium">Principal Comment</label>
                <textarea
                  className="form-control"
                  style={{ backgroundColor: "#f8f8f8" }}
                  rows={4}
                  maxLength={2000}
                  value={termSummary.principal_comment ?? ""}
                  onChange={(event) =>
                    handleTermSummaryChange(
                      "principal_comment",
                      event.target.value,
                    )
                  }
                  disabled={!selectedSession || !selectedTerm}
                />
              </div>
            </div>
            <button
              type="submit"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              disabled={termSummarySaving || !selectedSession || !selectedTerm}
            >
              {termSummarySaving ? "Saving…" : "Save Comments"}
            </button>
          </form>
          {termSummaryFeedback ? (
            <div
              className={`alert alert-${termSummaryFeedbackType}`}
              role="alert"
            >
              {termSummaryFeedback}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card height-auto mt-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Result PIN</h3>
              <p className="mb-0 text-muted small">
                Linked to the selected session and term.
              </p>
            </div>
          </div>
          {pinFeedback ? (
            <div className={`alert alert-${pinFeedbackType}`} role="alert">
              {pinFeedback}
            </div>
          ) : null}
          {pinError ? (
            <div className="alert alert-danger" role="alert">
              {pinError}
            </div>
          ) : null}
          <div className="mb-3">
            <button
              type="button"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark mr-3"
              onClick={() => {
                void handleGeneratePin(false);
              }}
              disabled={pinProcessing || !selectedSession || !selectedTerm}
            >
              Generate PIN
            </button>
            <button
              type="button"
              className="btn-fill-lg btn-outline-secondary"
              onClick={() => {
                void handleGeneratePin(true);
              }}
              disabled={pinProcessing || !selectedSession || !selectedTerm}
            >
              Regenerate PIN
            </button>
          </div>
          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>Session</th>
                  <th>Term</th>
                  <th>PIN</th>
                  <th>Status</th>
                  <th>Expires</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pinLoading ? (
                  <tr>
                    <td colSpan={7}>Loading result PINs…</td>
                  </tr>
                ) : pins.length === 0 ? (
                  <tr>
                    <td colSpan={7}>
                      {selectedSession && selectedTerm
                        ? "No result PIN generated for this term."
                        : "Select a session and term to view the PIN."}
                    </td>
                  </tr>
                ) : (
                  pins.map((pin) => (
                    <tr key={String(pin.id)}>
                      <td>{pin.session?.name ?? "—"}</td>
                      <td>{pin.term?.name ?? "—"}</td>
                      <td>
                        <code>{maskPin(pin.pin_code)}</code>
                      </td>
                      <td>
                        <span className={pinStatusClass(pin.status)}>
                          {(pin.status ?? "unknown").toLowerCase()}
                        </span>
                      </td>
                      <td>{formatDate(pin.expires_at)}</td>
                      <td>{formatDateTime(pin.updated_at)}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-link p-0 mr-3"
                          onClick={() => handleShowPin(pin.pin_code)}
                        >
                          Show
                        </button>
                        {pin.status === "active" ? (
                          <button
                            type="button"
                            className="btn btn-link text-danger p-0"
                            onClick={() => {
                              void handleInvalidatePin(pin.id);
                            }}
                            disabled={pinProcessing}
                          >
                            Invalidate
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
