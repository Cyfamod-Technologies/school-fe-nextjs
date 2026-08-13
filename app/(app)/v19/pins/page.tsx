"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import { resolveBackendUrl } from "@/lib/config";
import { getCookie } from "@/lib/cookies";
import { PERMISSIONS } from "@/lib/permissionKeys";
import {
  bulkGenerateResultPins,
  distributeResultPins,
  generateResultPinForStudent,
  invalidateResultPin,
  listResultPins,
  type ResultPin,
  type GenerateStudentPinPayload,
  type BulkGeneratePinsPayload,
} from "@/lib/resultPins";
import { listStudents, type StudentSummary } from "@/lib/students";
import {
  fetchResultPageSettings,
  updateResultPageSettings,
} from "@/lib/resultPageSettings";

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
  if (normalized === "active" || normalized === "sent") {
    return "badge badge-success";
  }
  if (normalized === "revoked" || normalized === "disabled") {
    return "badge badge-danger";
  }
  if (normalized === "expired" || normalized === "used") {
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

const isPinSendable = (pin: ResultPin): boolean => {
  const distributionStatus = pin.distribution_status ?? "not_sent";
  const effectiveStatus = pin.effective_status ?? pin.status ?? "active";
  return distributionStatus === "not_sent" && effectiveStatus === "active";
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
  const { hasPermission, user } = useAuth();
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
  const [selectedPinIds, setSelectedPinIds] = useState<Record<string, boolean>>({});
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
  const [sendingSelectedPins, setSendingSelectedPins] = useState(false);
  const [requirePinForResults, setRequirePinForResults] = useState(true);
  const [pinRequirementLoading, setPinRequirementLoading] = useState(true);
  const [pinRequirementSaving, setPinRequirementSaving] = useState(false);

  const isAdmin = useMemo(() => {
    const directRole = String(
      (user as { role?: string | null })?.role ?? "",
    ).toLowerCase();
    if (directRole === "admin") {
      return true;
    }
    const roles = (user as { roles?: Array<{ name?: string | null }> })?.roles;
    if (Array.isArray(roles)) {
      return roles.some(
        (role) => String(role?.name ?? "").toLowerCase() === "admin",
      );
    }
    return false;
  }, [user]);

  const canViewPins = isAdmin || hasPermission(PERMISSIONS.RESULT_PIN_VIEW);
  const canCreatePin = isAdmin || hasPermission(PERMISSIONS.RESULT_PIN_CREATE);
  const canBulkCreatePins =
    isAdmin || hasPermission(PERMISSIONS.RESULT_PIN_BULK_CREATE);
  const canInvalidatePins =
    isAdmin ||
    hasPermission(PERMISSIONS.RESULT_PIN_INVALIDATE) ||
    hasPermission("result.pin.delete");
  const canExportPins = isAdmin || hasPermission(PERMISSIONS.RESULT_PIN_EXPORT);
  const canViewPinRequirement =
    isAdmin || hasPermission(PERMISSIONS.SETTINGS_RESULT_PAGE_VIEW);
  const canUpdatePinRequirement =
    isAdmin || hasPermission(PERMISSIONS.SETTINGS_RESULT_PAGE_UPDATE);

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

  const loadPinRequirement = useCallback(async () => {
    if (!canViewPinRequirement) {
      setPinRequirementLoading(false);
      return;
    }

    setPinRequirementLoading(true);
    try {
      const settings = await fetchResultPageSettings();
      setRequirePinForResults(settings.require_pin_for_pdf_download);
    } catch (error) {
      console.error("Unable to load result PIN requirement", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to load the result PIN requirement.",
        "danger",
      );
    } finally {
      setPinRequirementLoading(false);
    }
  }, [canViewPinRequirement, showFeedback]);

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
      // Don't show errors for permission issues (403) - user just won't see classes
      const isPermissionError = error instanceof Error && (
        (error as Error & { status?: number }).status === 403 ||
        error.message.includes("403") ||
        error.message.includes("permission")
      );
      if (isPermissionError) {
        setClasses([]);
        return;
      }
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
    if (!canViewPins) {
      setPins([]);
      setPinsError("You do not have permission to view result PINs.");
      return;
    }

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
      setSelectedPinIds((previous) => {
        const sendableIds = new Set(
          data.filter(isPinSendable).map((pin) => String(pin.id)),
        );
        return Object.fromEntries(
          Object.entries(previous).filter(
            ([pinId, selected]) => selected && sendableIds.has(pinId),
          ),
        );
      });
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
    canViewPins,
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
    void loadPinRequirement();
  }, [loadPinRequirement]);

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
    if (!canCreatePin) {
      showFeedback("You do not have permission to generate result PINs.", "warning");
      return;
    }

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
      showFeedback("Result PIN generated successfully. Use Send to release it.", "success");
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

  const handleSavePinRequirement = async () => {
    if (!canUpdatePinRequirement) {
      showFeedback(
        "You do not have permission to update the result PIN requirement.",
        "warning",
      );
      return;
    }

    setPinRequirementSaving(true);
    resetFeedback();
    try {
      const saved = await updateResultPageSettings({
        require_pin_for_pdf_download: requirePinForResults,
      });
      setRequirePinForResults(saved.require_pin_for_pdf_download);
      showFeedback("Result PIN requirement updated successfully.", "success");
    } catch (error) {
      console.error("Unable to update result PIN requirement", error);
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to update the result PIN requirement.",
        "danger",
      );
    } finally {
      setPinRequirementSaving(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!canBulkCreatePins) {
      showFeedback("You do not have permission to bulk-generate result PINs.", "warning");
      return;
    }

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

  const handlePrintCards = useCallback(
    async (scope: "student" | "class") => {
      if (!canExportPins) {
        showFeedback("You do not have permission to print scratch cards.", "warning");
        return;
      }

      if (!selectedSession || !selectedTerm) {
        showFeedback(
          "Select a session and term before printing scratch cards.",
          "warning",
        );
        return;
      }

      const params = new URLSearchParams();
      params.set("session_id", selectedSession);
      params.set("term_id", selectedTerm);

      if (selectedArm) {
        params.set("class_arm_id", selectedArm);
      }

      if (scope === "student") {
        if (!selectedStudent) {
          showFeedback(
            "Pick a student or use the class option to print scratch cards.",
            "warning",
          );
          return;
        }
        params.set("student_id", selectedStudent);
      } else {
        if (!selectedClass) {
          showFeedback(
            "Select a class before printing scratch cards for everyone.",
            "warning",
          );
          return;
        }
        params.set("school_class_id", selectedClass);
      }

      const token = getCookie("token");
      if (!token) {
        showFeedback(
          "Your session token is missing. Please log in again before printing.",
          "warning",
        );
        return;
      }

      const endpoint = `${resolveBackendUrl(
        "/api/v1/result-pins/cards/print",
      )}?${params.toString()}`;
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        showFeedback(
          "Unable to open the preview window. Please enable pop-ups and try again.",
          "warning",
        );
        return;
      }

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
          let message = "Unable to load scratch cards.";
          const contentType = response.headers.get("content-type") || "";
          if (contentType.includes("application/json")) {
            try {
              const payload = await response.json();
              if (
                payload &&
                typeof payload === "object" &&
                "message" in payload &&
                typeof payload.message === "string"
              ) {
                message = payload.message;
              }
            } catch (error) {
              console.error("Unable to parse scratch card error", error);
            }
          } else if (response.status === 403) {
            message = "You do not have permission to print scratch cards.";
          } else if (response.status === 401) {
            message = "Your session has expired. Please log in again.";
          } else {
            const text = await response.text().catch(() => "");
            if (text.trim()) {
              message = text.trim();
            }
          }
          throw new Error(message);
        }

        const html = await response.text();
        printWindow.document.open();
        printWindow.document.write(html);
        printWindow.document.close();
      } catch (error) {
        const message =
          error instanceof Error
            ? error.message
            : "Unable to load scratch cards.";
        showFeedback(message, "danger");
        try {
          printWindow.close();
        } catch (closeError) {
          console.error("Unable to close preview window", closeError);
        }
      }
    },
    [
      canExportPins,
      selectedArm,
      selectedClass,
      selectedSession,
      selectedStudent,
      selectedTerm,
      showFeedback,
    ],
  );

  const handleRegeneratePin = async (studentId: number | string) => {
    if (!canCreatePin) {
      showFeedback("You do not have permission to regenerate result PINs.", "warning");
      return;
    }

    if (!selectedSession || !selectedTerm) {
      showFeedback(
        "Select a session and term before generating PINs.",
        "warning",
      );
      return;
    }

    const actionKey = `regen-${studentId}`;
    setPinActionKey(actionKey);
    resetFeedback();
    try {
      const payload: GenerateStudentPinPayload = {
        session_id: selectedSession,
        term_id: selectedTerm,
        regenerate: true,
        expires_at: null,
        max_usage: null,
      };

      await generateResultPinForStudent(studentId, payload);
      showFeedback("Result PIN regenerated successfully. Use Send to release it.", "success");
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
    if (!canInvalidatePins) {
      showFeedback("You do not have permission to invalidate result PINs.", "warning");
      return;
    }

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

  const handleSendPin = async (pin: ResultPin) => {
    const actionKey = `send-${pin.id}`;
    setPinActionKey(actionKey);
    resetFeedback();
    try {
      const response = await distributeResultPins({
        session_id: selectedSession,
        term_id: selectedTerm,
        pin_ids: [pin.id],
      });
      showFeedback(response.message, "success");
      await loadPins();
    } catch (error) {
      showFeedback(
        error instanceof Error ? error.message : "Unable to send result PIN.",
        "danger",
      );
    } finally {
      setPinActionKey(null);
    }
  };

  const handleCopyPin = async (pinCode: string | undefined) => {
    if (!pinCode) return;
    try {
      await navigator.clipboard.writeText(pinCode);
      showFeedback("PIN copied successfully.", "success");
    } catch {
      showFeedback("Unable to copy the PIN. Please copy it manually.", "warning");
    }
  };

  const selectedPinIdList = Object.keys(selectedPinIds).filter(
    (pinId) => selectedPinIds[pinId],
  );
  const sendablePins = pins.filter(isPinSendable);
  const allSendablePinsSelected =
    sendablePins.length > 0 &&
    sendablePins.every((pin) => selectedPinIds[String(pin.id)]);

  const handleSendSelectedPins = async () => {
    if (!selectedPinIdList.length) return;

    setSendingSelectedPins(true);
    resetFeedback();
    try {
      const response = await distributeResultPins({
        session_id: selectedSession,
        term_id: selectedTerm,
        pin_ids: selectedPinIdList,
      });
      showFeedback(response.message, "success");
      setSelectedPinIds({});
      await loadPins();
    } catch (error) {
      showFeedback(
        error instanceof Error
          ? error.message
          : "Unable to send the selected result PINs.",
        "danger",
      );
    } finally {
      setSendingSelectedPins(false);
    }
  };

  const tableMessage = useMemo(() => {
    if (!canViewPins) {
      return "You do not have permission to view result PINs.";
    }
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
  }, [canViewPins, pins.length, pinsError, pinsLoading, selectedSession, selectedTerm]);

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

      <div
        id="pin-feedback"
        className={`alert${feedback ? ` alert-${feedback.type}` : ""}`}
        style={{ display: feedback ? "block" : "none" }}
        role="alert"
      >
        {feedback?.message}
      </div>

      {canViewPinRequirement ? (
        <div className="card height-auto mb-4">
          <div className="card-body">
            <div className="heading-layout1 mb-3">
              <div className="item-title">
                <h3>Student Result PIN Requirement</h3>
              </div>
            </div>
            <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between">
              <div className="form-check mb-3 mb-md-0">
                <input
                  id="require-pin-for-results"
                  type="checkbox"
                  className="form-check-input"
                  checked={requirePinForResults}
                  onChange={(event) => {
                    setRequirePinForResults(event.target.checked);
                  }}
                  disabled={
                    pinRequirementLoading ||
                    pinRequirementSaving ||
                    !canUpdatePinRequirement
                  }
                />
                <label
                  className="form-check-label"
                  htmlFor="require-pin-for-results"
                >
                  Require PIN for student results
                </label>
                <small className="form-text text-muted">
                  When turned off, the PIN field is hidden on the student result
                  dashboard and Result PDF downloads do not require a PIN.
                </small>
              </div>
              {canUpdatePinRequirement ? (
                <button
                  type="button"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  onClick={() => {
                    void handleSavePinRequirement();
                  }}
                  disabled={pinRequirementLoading || pinRequirementSaving}
                >
                  {pinRequirementSaving ? "Saving…" : "Save PIN Setting"}
                </button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {requirePinForResults ? (
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
                  <option value="">None</option>
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
                  {canCreatePin ? (
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
                  ) : null}
                  <div className="d-flex flex-column">
                    {canBulkCreatePins ? (
                      <>
                        <button
                          type="button"
                          id="pin-generate-bulk"
                          className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
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
                      </>
                    ) : null}
                  </div>
                </div>
                {canExportPins ? (
                  <div className="d-flex flex-column flex-md-row justify-content-md-end align-items-md-center mt-3">
                    <button
                      type="button"
                      className="btn-fill-lg mb-2 mb-md-0 mr-md-3"
                      style={{
                        backgroundColor: "#1d4ed8",
                        color: "#fff",
                        borderColor: "#1d4ed8",
                      }}
                      onClick={() => {
                        handlePrintCards("student");
                      }}
                    >
                      Print Student Scratch Card
                    </button>
                    <button
                      type="button"
                      className="btn-fill-lg"
                      style={{
                        backgroundColor: "#1d4ed8",
                        color: "#fff",
                        borderColor: "#1d4ed8",
                      }}
                      onClick={() => {
                        handlePrintCards("class");
                      }}
                    >
                      Print Class Scratch Cards
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </form>

          {selectedPinIdList.length > 0 ? (
            <div className="d-flex justify-content-end mb-3">
              <button
                type="button"
                className="btn-fill-lg"
                style={{
                  backgroundColor: "#6f42c1",
                  borderColor: "#6f42c1",
                  color: "#ffffff",
                  minWidth: 220,
                  padding: "14px 28px",
                  fontSize: "16px",
                  fontWeight: 700,
                }}
                onClick={() => void handleSendSelectedPins()}
                disabled={sendingSelectedPins}
              >
                {sendingSelectedPins
                  ? "Sending…"
                  : `Send (${selectedPinIdList.length})`}
              </button>
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>
                    <input
                      type="checkbox"
                      checked={allSendablePinsSelected}
                      onChange={(event) => {
                        if (!event.target.checked) {
                          setSelectedPinIds({});
                          return;
                        }
                        setSelectedPinIds(
                          Object.fromEntries(
                            sendablePins.map((pin) => [String(pin.id), true]),
                          ),
                        );
                      }}
                      disabled={!sendablePins.length || sendingSelectedPins}
                      aria-label="Select all students with sendable PINs"
                    />
                  </th>
                  <th>#</th>
                  <th>Student</th>
                  <th>Session</th>
                  <th>Term</th>
                  <th>PIN</th>
                  <th>Usage</th>
                  <th>Status</th>
                  <th>Distribution</th>
                  <th>Expires</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody id="pin-table-body">
                {tableMessage ? (
                  <tr>
                    <td colSpan={12}>{tableMessage}</td>
                  </tr>
                ) : (
                  pins.map((pin, index) => {
                    const studentName = buildResultPinStudentLabel(pin);
                    const distributionStatus = pin.distribution_status ?? "not_sent";
                    const effectiveStatus = pin.effective_status ?? pin.status ?? "active";
                    const canSendPin = isPinSendable(pin);
                    return (
                      <tr key={String(pin.id)}>
                        <td>
                          <input
                            type="checkbox"
                            checked={Boolean(selectedPinIds[String(pin.id)])}
                            onChange={(event) =>
                              setSelectedPinIds((previous) => ({
                                ...previous,
                                [String(pin.id)]: event.target.checked,
                              }))
                            }
                            disabled={!canSendPin || sendingSelectedPins}
                            aria-label={`Select ${studentName}`}
                          />
                        </td>
                        <td>{index + 1}</td>
                        <td>{studentName}</td>
                        <td>{pin.session?.name ?? "—"}</td>
                        <td>{pin.term?.name ?? "—"}</td>
                        <td>
                          <code>{maskPin(pin.pin_code)}</code>
                        </td>
                        <td>{formatUsage(pin)}</td>
                        <td>
                          <span className={statusBadgeClass(effectiveStatus)}>
                            {effectiveStatus}
                          </span>
                        </td>
                        <td>
                          <span className={statusBadgeClass(distributionStatus)}>
                            {distributionStatus.replace("_", " ")}
                          </span>
                        </td>
                        <td>{formatDate(pin.expires_at)}</td>
                        <td>{formatDateTime(pin.updated_at)}</td>
                        <td>
                          {canSendPin ? (
                            <button
                              type="button"
                              className="btn btn-link p-0 mr-3 text-success"
                              onClick={() => void handleSendPin(pin)}
                              disabled={pinActionKey === `send-${pin.id}`}
                            >
                              {pinActionKey === `send-${pin.id}` ? "Sending…" : "Send"}
                            </button>
                          ) : null}
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
                            className="btn btn-link p-0 mr-3 text-primary"
                            onClick={() => void handleCopyPin(pin.pin_code)}
                          >
                            Copy
                          </button>
                          <button
                            type="button"
                            className="btn btn-link p-0 mr-3"
                            onClick={() => {
                              void handleRegeneratePin(pin.student_id);
                            }}
                            disabled={
                              pinActionKey === `regen-${pin.student_id}` || !canCreatePin
                            }
                          >
                            Regenerate
                          </button>
                          <button
                            type="button"
                            className="btn btn-link text-danger p-0"
                            onClick={() => {
                              void handleInvalidatePin(pin.id);
                            }}
                            disabled={
                              pinActionKey === `invalidate-${pin.id}` || !canInvalidatePins
                            }
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
      ) : null}
    </>
  );
}
