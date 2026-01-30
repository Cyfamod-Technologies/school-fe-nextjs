"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import {
  ChangeEvent,
  FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
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
import { isTeacherUser } from "@/lib/roleChecks";

const passthroughLoader: ImageLoader = ({ src }) => src;

export default function StudentDetailsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const studentId = searchParams.get("id");
  const filterQuery = useMemo(() => {
    const params = new URLSearchParams();
    const search = searchParams.get("search");
    const currentSessionId = searchParams.get("current_session_id");
    const schoolClassId = searchParams.get("school_class_id");
    const classArmId = searchParams.get("class_arm_id");
    const classSectionId = searchParams.get("class_section_id");
    const page = searchParams.get("page");
    const perPage = searchParams.get("per_page");
    const sortBy = searchParams.get("sortBy");
    const sortDirection = searchParams.get("sortDirection");

    if (search) {
      params.set("search", search);
    }
    if (currentSessionId) {
      params.set("current_session_id", currentSessionId);
    }
    if (schoolClassId) {
      params.set("school_class_id", schoolClassId);
    }
    if (classArmId) {
      params.set("class_arm_id", classArmId);
    }
    if (classSectionId) {
      params.set("class_section_id", classSectionId);
    }
    if (page) {
      params.set("page", page);
    }
    if (perPage) {
      params.set("per_page", perPage);
    }
    if (sortBy) {
      params.set("sortBy", sortBy);
    }
    if (sortDirection) {
      params.set("sortDirection", sortDirection);
    }

    return params.toString();
  }, [searchParams]);

  const allStudentsHref = useMemo(() => {
    return filterQuery ? `/v14/all-students?${filterQuery}` : "/v14/all-students";
  }, [filterQuery]);
  const { schoolContext, user } = useAuth();

  const isTeacher = isTeacherUser(user);
  const hidePrintResult =
    studentId === "4cc05231-689a-4c36-9ba5-8fb4d8b6c51e";

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
  const [skillValues, setSkillValues] = useState<Record<string, string>>({});
  const [skillsModalOpen, setSkillsModalOpen] = useState(false);

  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

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

  const ratingOptions = ["0", "1", "2", "3", "4", "5"];
  const skillAutoSaveTimersRef = useRef<Record<string, number>>({});
  const lastSkillSaveKeyRef = useRef<Record<string, string>>({});
  const skillsScrollRangeRef = useRef<HTMLInputElement | null>(null);
  const skillsScrollBodyRef = useRef<HTMLDivElement | null>(null);

  const pinTableColspan = isTeacher ? 6 : 7;

  const terms = useMemo(() => {
    if (!selectedSession) {
      return [];
    }
    return termsCache[selectedSession] ?? [];
  }, [selectedSession, termsCache]);

  const skillRatingsMap = useMemo(() => {
    const map = new Map<string, StudentSkillRating>();
    skillRatings.forEach((rating) => {
      if (rating?.skill_type_id) {
        map.set(String(rating.skill_type_id), rating);
      }
    });
    return map;
  }, [skillRatings]);

  const orderedSkillTypes = useMemo(() => {
    return [...skillTypes].sort((a, b) => {
      const categoryA = (a.category ?? "").toLowerCase();
      const categoryB = (b.category ?? "").toLowerCase();
      if (categoryA !== categoryB) {
        return categoryA.localeCompare(categoryB);
      }
      return String(a.name ?? "").localeCompare(String(b.name ?? ""));
    });
  }, [skillTypes]);

  useEffect(() => {
    if (!selectedSession || !selectedTerm || !orderedSkillTypes.length) {
      setSkillValues({});
      return;
    }
    const nextValues: Record<string, string> = {};
    orderedSkillTypes.forEach((type) => {
      const rating = skillRatingsMap.get(String(type.id));
      nextValues[String(type.id)] =
        rating?.rating_value != null ? String(rating.rating_value) : "0";
    });
    setSkillValues(nextValues);
  }, [selectedSession, selectedTerm, orderedSkillTypes, skillRatingsMap]);

  useEffect(() => {
    Object.values(skillAutoSaveTimersRef.current).forEach((timer) => {
      window.clearTimeout(timer);
    });
    skillAutoSaveTimersRef.current = {};
    lastSkillSaveKeyRef.current = {};
  }, [selectedSession, selectedTerm, student?.id]);

  useEffect(() => {
    return () => {
      Object.values(skillAutoSaveTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  useEffect(() => {
    if (!skillsModalOpen) {
      return;
    }
    const bodyScroller = skillsScrollBodyRef.current;
    const rangeScroller = skillsScrollRangeRef.current;
    if (!bodyScroller || !rangeScroller) {
      return;
    }

    const updateRange = () => {
      const max = Math.max(0, bodyScroller.scrollWidth - bodyScroller.clientWidth);
      rangeScroller.max = String(max);
      rangeScroller.value = String(bodyScroller.scrollLeft);
      rangeScroller.disabled = max <= 0;
    };

    const scheduleUpdate = () => {
      window.requestAnimationFrame(() => {
        updateRange();
        window.requestAnimationFrame(updateRange);
      });
    };

    const syncFromRange = () => {
      bodyScroller.scrollLeft = Number(rangeScroller.value);
    };

    const syncFromBody = () => {
      const nextValue = String(bodyScroller.scrollLeft);
      if (rangeScroller.value !== nextValue) {
        rangeScroller.value = nextValue;
      }
    };

    scheduleUpdate();
    rangeScroller.addEventListener("input", syncFromRange);
    bodyScroller.addEventListener("scroll", syncFromBody);
    window.addEventListener("resize", scheduleUpdate);

    return () => {
      rangeScroller.removeEventListener("input", syncFromRange);
      bodyScroller.removeEventListener("scroll", syncFromBody);
      window.removeEventListener("resize", scheduleUpdate);
    };
  }, [skillsModalOpen, orderedSkillTypes.length, skillLoading]);

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
    setSkillValues({});
    setSkillFeedback(null);
    setSkillError(null);
  };

  const handleTermChange = (event: ChangeEvent<HTMLSelectElement>) => {
    setSelectedTerm(event.target.value);
    setSkillValues({});
    setSkillFeedback(null);
    setSkillError(null);
  };

  const saveSkillRating = useCallback(
    async (skillTypeId: string, value: string) => {
      if (!student?.id || !selectedSession || !selectedTerm) {
        return;
      }
      const trimmedValue = value.trim();
      const ratingValue = Number(trimmedValue);
      if (!Number.isFinite(ratingValue) || ratingValue < 0 || ratingValue > 5) {
        return;
      }

      const key = `${selectedSession}|${selectedTerm}|${skillTypeId}|${ratingValue}`;
      if (lastSkillSaveKeyRef.current[skillTypeId] === key) {
        return;
      }
      lastSkillSaveKeyRef.current[skillTypeId] = key;

      setSkillError(null);
      try {
        const existing = skillRatings.find(
          (rating) => String(rating.skill_type_id) === String(skillTypeId),
        );
        const payload = {
          session_id: selectedSession,
          term_id: selectedTerm,
          skill_type_id: skillTypeId,
          rating_value: ratingValue,
        };
        const saved = existing?.id
          ? await updateStudentSkillRating(student.id, existing.id, payload)
          : await createStudentSkillRating(student.id, payload);
        setSkillRatings((prev) => {
          const next = prev.filter(
            (rating) => String(rating.skill_type_id) !== String(skillTypeId),
          );
          return [...next, saved];
        });
        setSkillFeedback("Skill rating saved.");
        setSkillFeedbackType("success");
      } catch (err) {
        console.error("Unable to save skill rating", err);
        setSkillError(
          err instanceof Error
            ? err.message
            : "Unable to save skill rating.",
        );
      }
    },
    [student?.id, selectedSession, selectedTerm, skillRatings],
  );

  const scheduleSkillSave = useCallback(
    (skillTypeId: string, value: string) => {
      if (!selectedSession || !selectedTerm) {
        return;
      }
      const trimmedValue = value.trim();
      if (!trimmedValue) {
        return;
      }
      if (skillAutoSaveTimersRef.current[skillTypeId]) {
        window.clearTimeout(skillAutoSaveTimersRef.current[skillTypeId]);
      }
      skillAutoSaveTimersRef.current[skillTypeId] = window.setTimeout(() => {
        void saveSkillRating(skillTypeId, trimmedValue);
      }, 400);
    },
    [saveSkillRating, selectedSession, selectedTerm],
  );

  const handleSkillValueChange = useCallback(
    (skillTypeId: string) => (event: ChangeEvent<HTMLSelectElement>) => {
      const value = event.target.value;
      setSkillValues((prev) => ({
        ...prev,
        [skillTypeId]: value,
      }));
      scheduleSkillSave(skillTypeId, value);
    },
    [scheduleSkillSave, skillRatingsMap],
  );

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
      (schoolContext.current_session_id != null
        ? String(schoolContext.current_session_id)
        : selectedSession ||
          (student?.current_session_id != null
            ? String(student.current_session_id)
            : ""));
    const termCandidate =
      (schoolContext.current_term_id != null
        ? String(schoolContext.current_term_id)
        : selectedTerm ||
          (student?.current_term_id != null
            ? String(student.current_term_id)
            : ""));
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
    schoolContext.current_session_id,
    schoolContext.current_term_id,
    studentId,
  ]);

  const fetchPrintableResultHtml = useCallback(async () => {
    if (!studentId) {
      throw new Error("Student not found.");
    }
    const params = buildPrintParams();
    const endpoint = `${resolveBackendUrl(
      `/api/v1/students/${studentId}/results/print`,
    )}?${params.toString()}`;
    const token = getCookie("token");
    if (!token) {
      throw new Error(
        "Your session token is missing. Please log in again before printing the result.",
      );
    }

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

    return response.text();
  }, [buildPrintParams, studentId]);

  const handlePrintResult = useCallback(async () => {
    setPrintProcessing(true);
    try {
      const html = await fetchPrintableResultHtml();
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
  }, [fetchPrintableResultHtml]);

  const handlePreviewResult = useCallback(async () => {
    setPreviewOpen(true);
    setPreviewLoading(true);
    setPreviewHtml("");
    setPreviewError(null);

    try {
      const html = await fetchPrintableResultHtml();
      setPreviewHtml(html);
    } catch (error) {
      console.error("Unable to load preview result", error);
      setPreviewError(
        error instanceof Error ? error.message : "Unable to load preview result.",
      );
    } finally {
      setPreviewLoading(false);
    }
  }, [fetchPrintableResultHtml]);

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
      router.replace(allStudentsHref);
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
  }, [studentId, router, allStudentsHref]);

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
    if (schoolContext.current_session_id != null) {
      setSelectedSession(String(schoolContext.current_session_id));
    } else if (!selectedSession && student.current_session_id != null) {
      setSelectedSession(String(student.current_session_id));
    }
    if (schoolContext.current_term_id != null) {
      setSelectedTerm(String(schoolContext.current_term_id));
    } else if (!selectedTerm && student.current_term_id != null) {
      setSelectedTerm(String(student.current_term_id));
    }
  }, [
    student,
    selectedSession,
    selectedTerm,
    schoolContext.current_session_id,
    schoolContext.current_term_id,
  ]);

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
  }, [selectedSession, selectedTerm]);

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
        "Delete this student and all related records? This action cannot be undone.",
      )
    ) {
      return;
    }
    setRemoving(true);
    try {
      await deleteStudent(studentId);
      router.push(allStudentsHref);
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
            <Link href={allStudentsHref}>All Students</Link>
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
                href={
                  filterQuery
                    ? `/v14/edit-student?id=${studentId}&${filterQuery}`
                    : `/v14/edit-student?id=${studentId}`
                }
                className="btn btn-outline-primary"
              >
                Edit
              </Link>
              {!isTeacher && !hidePrintResult ? (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={handlePrintResult}
                  disabled={printProcessing}
                >
                  {printProcessing ? "Loading…" : "Print Result"}
                </button>
              ) : null}
              {!isTeacher ? (
                <button
                  type="button"
                  className="btn btn-outline-danger"
                  onClick={handleDelete}
                  disabled={removing}
                >
                  {removing ? "Deleting…" : "Delete"}
                </button>
              ) : null}
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
                Select a session and term, then choose ratings for each skill.
              </p>
            </div>
          </div>
          <div className="row mb-3">
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
          </div>
          <div className="d-flex justify-content-end">
            <button
              type="button"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              onClick={() => setSkillsModalOpen(true)}
            >
              Open Skill Ratings
            </button>
          </div>
        </div>
      </div>

      {skillsModalOpen ? (
        <div className="skills-modal-backdrop" role="dialog" aria-modal="true">
          <div className="skills-modal">
            <div className="skills-modal-header">
              <div>
                <h4 className="mb-0">Skill Ratings</h4>
                <p className="mb-0 text-muted small">
                  {selectedSession && selectedTerm
                    ? "Select ratings for each skill."
                    : "Select a session and term to begin."}
                </p>
              </div>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setSkillsModalOpen(false)}
              >
                Close
              </button>
            </div>
            {skillFeedback ? (
              <div className={`alert alert-${skillFeedbackType} m-3`} role="alert">
                {skillFeedback}
              </div>
            ) : null}
            {skillError ? (
              <div className="alert alert-danger m-3" role="alert">
                {skillError}
              </div>
            ) : null}
            <div className="skills-modal-body">
              <input
                ref={skillsScrollRangeRef}
                type="range"
                className="skills-scrollbar-range"
                min="0"
                defaultValue="0"
                aria-label="Scroll skills table horizontally"
              />
              <div className="skills-table-scroll" ref={skillsScrollBodyRef}>
                <table className="table display text-nowrap skills-table">
                  <thead>
                    <tr>
                      <th>Category</th>
                      <th>Skill</th>
                      <th>Rating</th>
                    </tr>
                  </thead>
                  <tbody>
                    {!selectedSession || !selectedTerm ? (
                      <tr>
                        <td colSpan={3}>
                          Select a session and term to rate this student&rsquo;s skills.
                        </td>
                      </tr>
                    ) : skillLoading ? (
                      <tr>
                        <td colSpan={3}>Loading skills…</td>
                      </tr>
                    ) : orderedSkillTypes.length === 0 ? (
                      <tr>
                        <td colSpan={3}>No skills configured for this school.</td>
                      </tr>
                    ) : (
                      orderedSkillTypes.map((type) => {
                        const skillId = String(type.id);
                        const ratingValue = skillValues[skillId] ?? "";
                        return (
                          <tr key={skillId}>
                            <td data-label="Category">{type.category ?? "—"}</td>
                            <td data-label="Skill">{type.name ?? "—"}</td>
                            <td data-label="Rating">
                              <select
                                className="form-control form-control-sm"
                                value={ratingValue}
                                onChange={handleSkillValueChange(skillId)}
                                disabled={!selectedSession || !selectedTerm}
                              >
                                {ratingOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option === "0" ? "-----" : option}
                                  </option>
                                ))}
                              </select>
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
        </div>
      ) : null}

      <div className="card height-auto mt-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Term Comments</h3>
              <p className="mb-0 text-muted small">
                Applies to the selected session and term above.
              </p>
            </div>
            <div>
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                onClick={() => void handlePreviewResult()}
                disabled={previewLoading || !selectedSession || !selectedTerm}
              >
                {previewLoading ? "Preparing…" : "Preview Result"}
              </button>
            </div>
          </div>
          <form className="mb-3" onSubmit={handleTermSummarySubmit}>
            <div className="row">
              <div className="col-md-6 col-12 form-group">
                <label className="text-dark-medium">Class Teacher&apos;s Comment</label>
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
                <label className="text-dark-medium">Principal&apos;s Comment</label>
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

      {previewOpen ? (
        <div className="result-preview-backdrop" role="dialog" aria-modal="true">
          <div className="result-preview-modal">
            <div className="result-preview-header">
              <h4 className="mb-0">Result Preview</h4>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => {
                  setPreviewOpen(false);
                  setPreviewHtml("");
                  setPreviewError(null);
                }}
              >
                Close
              </button>
            </div>
            <div className="result-preview-body">
              {previewLoading ? (
                <div className="p-3">Loading preview…</div>
              ) : previewError ? (
                <div className="alert alert-danger m-3" role="alert">
                  {previewError}
                </div>
              ) : previewHtml ? (
                <iframe
                  className="result-preview-frame"
                  title="Student result preview"
                  srcDoc={previewHtml}
                />
              ) : (
                <div className="p-3">No preview available.</div>
              )}
            </div>
          </div>
        </div>
      ) : null}

      <style jsx>{`
        .result-preview-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          z-index: 1050;
        }

        .result-preview-modal {
          background: #ffffff;
          border-radius: 0;
          width: 100%;
          height: 100%;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }

        .result-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0.75rem 1rem;
          border-bottom: 1px solid #e5e5e5;
        }

        .result-preview-body {
          flex: 1;
          overflow: auto;
          -webkit-overflow-scrolling: touch;
        }

        .result-preview-frame {
          width: 100%;
          min-width: 980px;
          height: 100%;
          border: 0;
        }

        .skills-modal-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0;
          z-index: 1050;
        }

        .skills-modal {
          background: #ffffff;
          width: 100%;
          max-width: none;
          max-height: none;
          height: 100%;
          display: flex;
          flex-direction: column;
          border-radius: 0;
          overflow: hidden;
        }

        .skills-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          border-bottom: 1px solid #e2e8f0;
        }

        .skills-modal-body {
          padding: 0 1.25rem 1.25rem;
          flex: 1;
          display: flex;
          flex-direction: column;
          min-height: 0;
        }

        .skills-scrollbar-range {
          width: 100%;
          margin: 0 0 0.75rem;
          height: 16px;
          accent-color: #94a3b8;
        }

        .skills-table-scroll {
          flex: 1;
          min-height: 0;
          width: 100%;
          overflow-x: auto;
          overflow-y: scroll;
          scrollbar-gutter: stable;
        }

        .skills-table th,
        .skills-table td {
          white-space: nowrap;
        }

        @media (max-width: 768px) {
          .skills-scrollbar-range {
            display: none;
          }

          .skills-table-scroll {
            overflow-x: hidden;
          }

          .skills-table {
            width: 100%;
          }

          .skills-table thead {
            display: none;
          }

          .skills-table,
          .skills-table tbody,
          .skills-table tr,
          .skills-table td {
            display: block;
            width: 100%;
          }

          .skills-table tr {
            border: 1px solid #e2e8f0;
            border-radius: 6px;
            padding: 0.5rem 0.75rem;
            margin-bottom: 0.75rem;
          }

          .skills-table td {
            display: flex;
            justify-content: space-between;
            gap: 0.75rem;
            padding: 0.35rem 0;
            border: 0;
            white-space: normal;
            word-break: break-word;
          }

          .skills-table td::before {
            content: attr(data-label);
            font-weight: 600;
            color: #64748b;
            flex: 0 0 90px;
          }

          .skills-table td select {
            width: 100%;
            max-width: 160px;
          }

          .result-preview-frame {
            min-width: 1100px;
          }
        }
      `}</style>

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
          {!isTeacher ? (
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
          ) : null}
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
                  {!isTeacher ? <th>Actions</th> : null}
                </tr>
              </thead>
              <tbody>
                {pinLoading ? (
                  <tr>
                    <td colSpan={pinTableColspan}>Loading result PINs…</td>
                  </tr>
                ) : pins.length === 0 ? (
                  <tr>
                    <td colSpan={pinTableColspan}>
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
                      {!isTeacher ? (
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
                      ) : null}
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
