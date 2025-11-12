"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  getCurrentTeacherAssignments,
  type TeacherAssignments,
} from "@/lib/teacherAssignments";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import {
  listClassArmSections,
  type ClassArmSection,
} from "@/lib/classArmSections";
import { listAllSubjects, type Subject } from "@/lib/subjects";
import {
  listAssessmentComponents,
  type AssessmentComponent,
} from "@/lib/assessmentComponents";
import {
  listResults,
  saveResultsBatch,
  type ResultRecord,
} from "@/lib/results";
import {
  listStudents,
  type StudentSummary,
} from "@/lib/students";
import { fetchSchoolContext } from "@/lib/schoolContext";

type ResultRowStatus = "saved" | "pending" | "none";

interface FiltersState {
  sessionId: string;
  termId: string;
  classId: string;
  armId: string;
  sectionId: string;
  subjectId: string;
  componentId: string;
}

interface ResultEntryRow {
  student: StudentSummary;
  score: string;
  remark: string;
  originalScore: string;
  originalRemark: string;
  hasResult: boolean;
  status: ResultRowStatus;
  rowError: string | null;
}

const emptyFilters: FiltersState = {
  sessionId: "",
  termId: "",
  classId: "",
  armId: "",
  sectionId: "",
  subjectId: "",
  componentId: "",
};

const formatScore = (value: unknown): string => {
  if (value == null) {
    return "";
  }
  const numeric = Number(value);
  if (Number.isNaN(numeric)) {
    return "";
  }
  return numeric.toFixed(2);
};

const buildClassLabel = (student: StudentSummary): string => {
  const className = student.school_class?.name ?? "—";
  const armName = student.class_arm?.name ?? "";
  const sectionName = student.class_section?.name ?? "";
  return [className, armName, sectionName].filter(Boolean).join(" / ") || "—";
};

const buildStudentName = (student: StudentSummary): string => {
  const name = [
    student.first_name,
    student.middle_name,
    student.last_name,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();
  return name || "Unnamed Student";
};

const statusBadgeClass = (status: ResultRowStatus): string => {
  if (status === "saved") {
    return "badge badge-success";
  }
  if (status === "pending") {
    return "badge badge-warning";
  }
  return "badge badge-secondary";
};

const statusLabel = (status: ResultRowStatus): string => {
  if (status === "saved") {
    return "Saved";
  }
  if (status === "pending") {
    return "Pending";
  }
  return "Not recorded";
};

export default function ResultsEntryPage() {
  const { user } = useAuth();
  const [teacherAssignments, setTeacherAssignments] = useState<TeacherAssignments | null>(null);

  const normalizedRole = String(user?.role ?? "").toLowerCase();
  const isTeacher =
    normalizedRole.includes("teacher") ||
    (Array.isArray(user?.roles)
      ? user?.roles?.some((role) =>
          String(role?.name ?? "").toLowerCase().includes("teacher"),
        )
      : false);

  const [filters, setFilters] = useState<FiltersState>(emptyFilters);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [termsCache, setTermsCache] = useState<Record<string, Term[]>>({});
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [armsCache, setArmsCache] = useState<Record<string, ClassArm[]>>({});
  const [sectionsCache, setSectionsCache] =
    useState<Record<string, ClassArmSection[]>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [components, setComponents] = useState<AssessmentComponent[]>([]);

  const [componentLoading, setComponentLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const [rows, setRows] = useState<ResultEntryRow[]>([]);

  const [feedback, setFeedback] = useState<{
    type: "success" | "info" | "warning" | "danger";
    message: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const selectedSession = filters.sessionId;
  const selectedTerm = filters.termId;
  const selectedClass = filters.classId;
  const selectedArm = filters.armId;
  const selectedSection = filters.sectionId;
  const selectedSubject = filters.subjectId;
  const selectedComponent = filters.componentId;

  const updateFilters = useCallback(
    (updater: (current: FiltersState) => FiltersState) => {
      setFilters((prev) => {
        const next = updater(prev);
        if (
          prev.sessionId === next.sessionId &&
          prev.termId === next.termId &&
          prev.classId === next.classId &&
          prev.armId === next.armId &&
          prev.sectionId === next.sectionId &&
          prev.subjectId === next.subjectId &&
          prev.componentId === next.componentId
        ) {
          return prev;
        }
        return next;
      });
    },
    [],
  );

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

  const sections = useMemo(() => {
    if (!selectedClass || !selectedArm) {
      return [];
    }
    const key = `${selectedClass}:${selectedArm}`;
    return sectionsCache[key] ?? [];
  }, [selectedClass, selectedArm, sectionsCache]);

  // Filter subjects based on the selected class and teacher assignments
  const filteredSubjects = useMemo(() => {
    // If user is not a teacher, show all available subjects
    if (!isTeacher || !teacherAssignments) {
      return subjects;
    }

    // If no class is selected, don't filter - show all subjects the teacher has access to
    if (!selectedClass) {
      return subjects;
    }

    // Get subject IDs for the selected class from teacher's subject assignments
    // Note: The backend TeacherAccessService already handles the logic:
    // - If teacher is class teacher for this class: subject_assignments includes ALL subjects for the class
    // - If teacher is only subject teacher: subject_assignments includes ONLY assigned subjects
    const subjectIdsForClass = new Set(
      teacherAssignments.subject_assignments
        .filter((assignment) => String(assignment.school_class_id) === selectedClass)
        .map((assignment) => String(assignment.subject_id))
        .filter(Boolean)
    );

    // Filter to show only subjects that are linked to the selected class
    return subjects.filter((subject) => subjectIdsForClass.has(String(subject.id)));
  }, [subjects, selectedClass, isTeacher, teacherAssignments]);

  const ensureTerms = useCallback(
    async (sessionId: string): Promise<Term[]> => {
      if (!sessionId) {
        return [];
      }
      if (termsCache[sessionId]) {
        return termsCache[sessionId];
      }
      const data = await listTermsBySession(sessionId);
      setTermsCache((prev) => {
        if (prev[sessionId]) {
          return prev;
        }
        return {
          ...prev,
          [sessionId]: data,
        };
      });
      return data;
    },
    [termsCache],
  );

  const ensureArms = useCallback(
    async (classId: string): Promise<ClassArm[]> => {
      if (!classId) {
        return [];
      }
      if (armsCache[classId]) {
        return armsCache[classId];
      }
      const data = await listClassArms(classId);
      setArmsCache((prev) => {
        if (prev[classId]) {
          return prev;
        }
        return {
          ...prev,
          [classId]: data,
        };
      });
      return data;
    },
    [armsCache],
  );

  const ensureSections = useCallback(
    async (classId: string, armId: string): Promise<ClassArmSection[]> => {
      if (!classId || !armId) {
        return [];
      }
      const key = `${classId}:${armId}`;
      if (sectionsCache[key]) {
        return sectionsCache[key];
      }
      const data = await listClassArmSections(classId, armId);
      setSectionsCache((prev) => {
        if (prev[key]) {
          return prev;
        }
        return {
          ...prev,
          [key]: data,
        };
      });
      return data;
    },
    [sectionsCache],
  );

  const resetMessages = useCallback(() => {
    setFeedback(null);
  }, []);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        setInitializing(true);
        setFeedback({
          type: "info",
          message: "Loading context...",
        });
        const [sessionList, classList, subjectList, context] = await Promise.all(
          [
            listSessions(),
            listClasses(),
            listAllSubjects(),
            fetchSchoolContext(),
          ],
        );
        if (!active) {
          return;
        }
        setSessions(sessionList);
        setClasses(classList);
        setSubjects(subjectList);

        const contextSessionId = context.current_session_id
          ? String(context.current_session_id)
          : "";
        const contextTermId = context.current_term_id
          ? String(context.current_term_id)
          : "";

        // Fetch teacher assignments if user is a teacher
        if (isTeacher && contextSessionId && contextTermId) {
          try {
            const assignments = await getCurrentTeacherAssignments(contextSessionId, contextTermId);
            setTeacherAssignments(assignments);
          } catch (error) {
            console.error("Failed to load teacher assignments", error);
          }
        }

        if (contextSessionId) {
          await ensureTerms(contextSessionId);
        }

        updateFilters((prev) => ({
          ...prev,
          sessionId: contextSessionId || prev.sessionId,
          termId: contextTermId || prev.termId,
        }));

        setFeedback(null);
      } catch (error) {
        console.error("Unable to load initial context", error);
        if (!active) {
          return;
        }
        setFeedback({
          type: "danger",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load initial context.",
        });
      } finally {
        if (active) {
          setInitializing(false);
        }
      }
    };

    bootstrap().catch((error) =>
      console.error("Unexpected initialization error", error),
    );

    return () => {
      active = false;
    };
  }, [isTeacher, ensureTerms, updateFilters]);

  useEffect(() => {
    if (!selectedSession) {
      updateFilters((prev) => {
        if (prev.termId === "") {
          return prev;
        }
        return {
          ...prev,
          termId: "",
        };
      });
      return;
    }

    let cancelled = false;

    ensureTerms(selectedSession)
      .then((termList) => {
        if (cancelled) {
          return;
        }
        if (!termList.length) {
          updateFilters((prev) => {
            if (prev.termId === "") {
              return prev;
            }
            return {
              ...prev,
              termId: "",
            };
          });
          return;
        }
        const hasSelected = termList.some(
          (term) => String(term.id) === selectedTerm,
        );
        if (!hasSelected) {
          const defaultTermId = String(termList[0].id);
          updateFilters((prev) => {
            if (prev.termId === defaultTermId) {
              return prev;
            }
            return {
              ...prev,
              termId: defaultTermId,
            };
          });
        }
      })
      .catch((error) =>
        console.error("Unable to ensure terms for session", error),
      );

    return () => {
      cancelled = true;
    };
  }, [selectedSession, selectedTerm, ensureTerms, updateFilters]);

  useEffect(() => {
    if (!selectedClass) {
      updateFilters((prev) => {
        if (prev.armId === "" && prev.sectionId === "") {
          return prev;
        }
        return {
          ...prev,
          armId: "",
          sectionId: "",
        };
      });
      return;
    }

    let cancelled = false;

    ensureArms(selectedClass)
      .then((armList) => {
        if (cancelled) {
          return;
        }
        const hasSelected = armList.some(
          (arm) => String(arm.id) === selectedArm,
        );
        if (!hasSelected) {
          updateFilters((prev) => {
            if (prev.armId === "" && prev.sectionId === "") {
              return prev;
            }
            return {
              ...prev,
              armId: "",
              sectionId: "",
            };
          });
        }
      })
      .catch((error) =>
        console.error("Unable to ensure class arms", error),
      );

    return () => {
      cancelled = true;
    };
  }, [selectedClass, selectedArm, ensureArms, updateFilters]);

  useEffect(() => {
    if (!selectedClass || !selectedArm) {
      updateFilters((prev) => {
        if (prev.sectionId === "") {
          return prev;
        }
        return {
          ...prev,
          sectionId: "",
        };
      });
      return;
    }

    let cancelled = false;

    ensureSections(selectedClass, selectedArm)
      .then((sectionList) => {
        if (cancelled) {
          return;
        }
        const hasSelected = sectionList.some(
          (section) => String(section.id) === selectedSection,
        );
        if (!hasSelected) {
          updateFilters((prev) => {
            if (prev.sectionId === "") {
              return prev;
            }
            return {
              ...prev,
              sectionId: "",
            };
          });
        }
      })
      .catch((error) =>
        console.error("Unable to ensure class sections", error),
      );

    return () => {
      cancelled = true;
    };
  }, [selectedClass, selectedArm, selectedSection, ensureSections, updateFilters]);

  useEffect(() => {
    if (!selectedSession || !selectedTerm || !selectedSubject) {
      setComponents([]);
      updateFilters((prev) => {
        if (!prev.componentId) {
          return prev;
        }
        return {
          ...prev,
          componentId: "",
        };
      });
      return;
    }

    let active = true;
    setComponentLoading(true);

    listAssessmentComponents({
      per_page: 200,
      session_id: selectedSession,
      term_id: selectedTerm,
      subject_id: selectedSubject,
    })
      .then((response) => {
        if (!active) {
          return;
        }
        const data = response.data ?? [];
        setComponents(data);
        updateFilters((prev) => {
          if (!prev.componentId) {
            return prev;
          }
          const exists = data.some(
            (component) => String(component.id) === prev.componentId,
          );
          if (exists) {
            return prev;
          }
          return {
            ...prev,
            componentId: "",
          };
        });
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        console.error("Unable to load assessment components", error);
        setFeedback({
          type: "danger",
          message:
            error instanceof Error
              ? error.message
              : "Unable to load assessment components.",
        });
      })
      .finally(() => {
        if (active) {
          setComponentLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [selectedSession, selectedTerm, selectedSubject, updateFilters]);

  useEffect(() => {
    setRows([]);
    setStatusMessage("");
  }, [
    selectedSession,
    selectedTerm,
    selectedClass,
    selectedArm,
    selectedSection,
    selectedSubject,
    selectedComponent,
  ]);

  const handleSessionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      sessionId: value,
      termId: "",
      componentId: "",
    }));
  };

  const handleTermChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      termId: value,
      componentId: "",
    }));
  };

  const handleClassChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      classId: value,
      armId: "",
      sectionId: "",
    }));
  };

  const handleArmChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      armId: value,
      sectionId: "",
    }));
  };

  const handleSectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      sectionId: value,
    }));
  };

  const handleSubjectChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      subjectId: value,
      componentId: "",
    }));
  };

  const handleComponentChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      componentId: value,
    }));
  };

  const updateRow = useCallback(
    (index: number, updates: Partial<ResultEntryRow>) => {
      setRows((prev) => {
        if (index < 0 || index >= prev.length) {
          return prev;
        }
        const next = [...prev];
        const current = {
          ...next[index],
          ...updates,
        };
        const currentScore = current.score.trim();
        const originalScore = current.originalScore.trim();
        const currentRemark = current.remark.trim();
        const originalRemark = current.originalRemark.trim();
        const changed =
          currentScore !== originalScore ||
          currentRemark !== originalRemark;
        current.status = changed
          ? "pending"
          : current.hasResult
            ? "saved"
            : "none";
        if (
          Object.prototype.hasOwnProperty.call(updates, "score") ||
          Object.prototype.hasOwnProperty.call(updates, "remark")
        ) {
          current.rowError = null;
        }
        next[index] = current;
        return next;
      });
    },
    [],
  );

  const handleLoadStudents = useCallback(async () => {
    resetMessages();
    setStatusMessage("");

    const missing: string[] = [];
    if (!selectedSession) missing.push("session");
    if (!selectedTerm) missing.push("term");
    if (!selectedClass) missing.push("class");
    if (!selectedSubject) missing.push("subject");

    // For teachers, assessment component is required
    if (isTeacher && !selectedComponent) {
      missing.push("assessment component");
    }

    if (missing.length) {
      setFeedback({
        type: "warning",
        message: `Please select ${missing.join(", ")} before loading students.`,
      });
      setRows([]);
      return;
    }

    setTableLoading(true);
    setStatusMessage("Loading students...");

    try {
      const [
        studentResponse,
        resultsResponse,
      ] = await Promise.all([
        listStudents({
          per_page: 500,
          school_class_id: selectedClass,
          class_arm_id: selectedArm || undefined,
          class_section_id: selectedSection || undefined,
          current_session_id: selectedSession,
          current_term_id: selectedTerm,
          sortBy: "first_name",
          sortDirection: "asc",
        }),
        listResults({
          per_page: 500,
          session_id: selectedSession,
          term_id: selectedTerm,
          subject_id: selectedSubject,
          school_class_id: selectedClass,
          class_arm_id: selectedArm || undefined,
          class_section_id: selectedSection || undefined,
          assessment_component_id: selectedComponent || "none",
        }),
      ]);

      const students = studentResponse.data ?? [];
      const results = resultsResponse.data ?? [];

      const resultMap = new Map<string, ResultRecord>();
      results.forEach((result) => {
        resultMap.set(String(result.student_id), result);
      });

      const nextRows: ResultEntryRow[] = students.map((student) => {
        const result = resultMap.get(String(student.id));
        const scoreValue = result ? formatScore(result.total_score) : "";
        const remarkValue = result?.remarks ?? "";
        const normalizedRemark = remarkValue.trim();
        return {
          student,
          score: scoreValue,
          remark: remarkValue,
          originalScore: scoreValue,
          originalRemark: normalizedRemark,
          hasResult: Boolean(result),
          status: result ? "saved" : "none",
          rowError: null,
        };
      });

      setRows(nextRows);
      setStatusMessage(`${students.length} students loaded.`);

      if (!students.length) {
        setFeedback({
          type: "info",
          message: "No students were found for the selected class.",
        });
      }
    } catch (error) {
      console.error("Unable to load students or results", error);
      setFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load students for the selected filters.",
      });
      setRows([]);
      setStatusMessage("");
    } finally {
      setTableLoading(false);
    }
  }, [
    isTeacher,
    resetMessages,
    selectedSession,
    selectedTerm,
    selectedClass,
    selectedArm,
    selectedSection,
    selectedSubject,
    selectedComponent,
  ]);

  const handleSaveResults = useCallback(async () => {
    resetMessages();

    if (!rows.length) {
      setFeedback({
        type: "info",
        message: "Load students before attempting to save.",
      });
      return;
    }

    if (!selectedSession || !selectedTerm || !selectedSubject) {
      setFeedback({
        type: "warning",
        message: "Select session, term, and subject before saving scores.",
      });
      return;
    }

    const nextRows = [...rows];
    const entries: Array<{
      student_id: number | string;
      subject_id: string;
      score: number;
      remarks: string | null;
    }> = [];
    let hasErrors = false;

    nextRows.forEach((row, index) => {
      const scoreInput = row.score.trim();
      const remarkInput = row.remark.trim();
      const originalRemark = row.originalRemark.trim();
      const originalScore = row.originalScore.trim();

      const changed =
        scoreInput !== originalScore || remarkInput !== originalRemark;

      if (!changed) {
        nextRows[index] = {
          ...row,
          rowError: null,
          status: row.hasResult ? "saved" : "none",
        };
        return;
      }

      if (!scoreInput) {
        nextRows[index] = {
          ...row,
          rowError:
            "Score is required when updating a result or providing a remark.",
          status: "pending",
        };
        hasErrors = true;
        return;
      }

      const scoreValue = Number(scoreInput);
      if (Number.isNaN(scoreValue) || scoreValue < 0 || scoreValue > 100) {
        nextRows[index] = {
          ...row,
          rowError: "Score must be a number between 0 and 100.",
          status: "pending",
        };
        hasErrors = true;
        return;
      }

      nextRows[index] = {
        ...row,
        rowError: null,
        status: "pending",
      };

      entries.push({
        student_id: row.student.id,
        subject_id: selectedSubject,
        score: Number.parseFloat(scoreValue.toFixed(2)),
        remarks: remarkInput ? remarkInput : null,
      });
    });

    setRows(nextRows);

    if (hasErrors) {
      setFeedback({
        type: "danger",
        message: "Please fix the highlighted rows before saving.",
      });
      return;
    }

    if (!entries.length) {
      setFeedback({
        type: "info",
        message: "No changes to save.",
      });
      return;
    }

    setSaving(true);
    setStatusMessage("Saving scores...");

    try {
      const response = await saveResultsBatch({
        session_id: selectedSession,
        term_id: selectedTerm,
        // Use same sentinel value as listResults when no component is selected
        assessment_component_id: selectedComponent || "none",
        entries: entries.map((entry) => ({
          ...entry,
        })),
      });

      const updatedMap = new Map<string, ResultRecord>();
      response.results.forEach((result) => {
        updatedMap.set(String(result.student_id), result);
      });

      setRows((prev) =>
        prev.map((row) => {
          const saved = updatedMap.get(String(row.student.id));
          if (!saved) {
            return {
              ...row,
              rowError: null,
              status: row.hasResult ? "saved" : "none",
            };
          }
          const savedScore = formatScore(saved.total_score);
          const savedRemark = (saved.remarks ?? "").trim();
          return {
            ...row,
            score: savedScore,
            remark: saved.remarks ?? "",
            originalScore: savedScore,
            originalRemark: savedRemark,
            hasResult: true,
            status: "saved",
            rowError: null,
          };
        }),
      );

      setFeedback({
        type: "success",
        message: response.message ?? "Scores saved successfully.",
      });

      const savedCount =
        typeof response.meta?.total === "number"
          ? response.meta.total
          : response.results.length;
      setStatusMessage(`Saved ${savedCount} entries.`);
    } catch (error) {
      console.error("Unable to save scores", error);
      setFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save scores at this time.",
      });
      setStatusMessage("");
    } finally {
      setSaving(false);
    }
  }, [
    resetMessages,
    rows,
    selectedSession,
    selectedTerm,
    selectedSubject,
    selectedComponent,
  ]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Result Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href="/v19/assessment-components">Assessment Settings</Link>
          </li>
          <li>Result Entry</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Result Entry</h3>
              <p className="mb-0 text-muted small">
                Load students for the selected context, enter scores, and save
                in bulk.
              </p>
            </div>
          </div>

          <div className="results-entry mb-4">
            <div className="row">
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label htmlFor="filter-session">Session</label>
                <select
                  id="filter-session"
                  className="form-control"
                  value={selectedSession}
                  onChange={handleSessionChange}
                  disabled={initializing}
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
                <label htmlFor="filter-term">Term</label>
                <select
                  id="filter-term"
                  className="form-control"
                  value={selectedTerm}
                  onChange={handleTermChange}
                  disabled={initializing || !selectedSession}
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
                <label htmlFor="filter-class">Class</label>
                <select
                  id="filter-class"
                  className="form-control"
                  value={selectedClass}
                  onChange={handleClassChange}
                  disabled={initializing}
                >
                  <option value="">Select class</option>
                  {classes.map((schoolClass) => (
                    <option key={schoolClass.id} value={schoolClass.id}>
                      {schoolClass.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label htmlFor="filter-arm">Class Arm</label>
                <select
                  id="filter-arm"
                  className="form-control"
                  value={selectedArm}
                  onChange={handleArmChange}
                  disabled={!selectedClass}
                >
                  <option value="">All arms</option>
                  {arms.map((arm) => (
                    <option key={arm.id} value={arm.id}>
                      {arm.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label htmlFor="filter-section">Section</label>
                <select
                  id="filter-section"
                  className="form-control"
                  value={selectedSection}
                  onChange={handleSectionChange}
                  disabled={!selectedClass || !selectedArm}
                >
                  <option value="">All sections</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label htmlFor="filter-subject">Subject</label>
                <select
                  id="filter-subject"
                  className="form-control"
                  value={selectedSubject}
                  onChange={handleSubjectChange}
                  disabled={initializing}
                >
                  <option value="">Select subject</option>
                  {filteredSubjects.map((subject) => {
                    const label = subject.code
                      ? `${subject.name} (${subject.code})`
                      : subject.name;
                    return (
                      <option key={subject.id} value={subject.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label htmlFor="filter-component">
                  Assessment Component{" "}
                  <span className="text-muted small">(optional)</span>
                </label>
                <select
                  id="filter-component"
                  className="form-control"
                  value={selectedComponent}
                  onChange={handleComponentChange}
                  disabled={
                    componentLoading ||
                    !selectedSession ||
                    !selectedTerm ||
                    !selectedSubject
                  }
                >
                  <option value="">Overall (no component)</option>
                  {components.map((component) => {
                    const label = component.label
                      ? `${component.name} (${component.label})`
                      : component.name;
                    return (
                      <option key={component.id} value={component.id}>
                        {label}
                      </option>
                    );
                  })}
                </select>
              </div>
            </div>
            <div className="d-flex flex-wrap align-items-center">
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark mr-3 mb-2"
                onClick={() => {
                  void handleLoadStudents();
                }}
                disabled={tableLoading || saving || initializing}
              >
                {tableLoading ? "Loading…" : "Load Students"}
              </button>
              <button
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                type="button"
                onClick={() => {
                  void handleSaveResults();
                }}
                disabled={saving || !rows.length}
              >
                {saving ? "Saving…" : "Save Results Entry"}
              </button>
              <span className="ml-auto text-muted small">{statusMessage}</span>
            </div>
          </div>

          {feedback ? (
            <div className={`alert alert-${feedback.type}`} role="alert">
              {feedback.message}
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Admission No</th>
                  <th>Class</th>
                  <th style={{ width: "120px" }}>Score (0 - 100)</th>
                  <th style={{ width: "280px" }}>Remark</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tableLoading ? (
                  <tr>
                    <td colSpan={7}>Loading students…</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-muted">
                      Select filters and click “Load Students” to begin.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const studentName = buildStudentName(row.student);
                    const classLabel = buildClassLabel(row.student);
                    return (
                      <tr
                        key={String(row.student.id)}
                        className={row.rowError ? "table-danger" : undefined}
                      >
                        <td>{index + 1}</td>
                        <td>{studentName}</td>
                        <td>{row.student.admission_no ?? "—"}</td>
                        <td>{classLabel}</td>
                        <td>
                          <input
                            type="number"
                            className="form-control"
                            min={0}
                            max={100}
                            step={0.01}
                            value={row.score}
                            onChange={(event) =>
                              updateRow(index, { score: event.target.value })
                            }
                          />
                        </td>
                        <td>
                          <textarea
                            className="form-control"
                            rows={2}
                            maxLength={500}
                            value={row.remark}
                            onChange={(event) =>
                              updateRow(index, { remark: event.target.value })
                            }
                          />
                          {row.rowError ? (
                            <p className="text-danger small mb-0 mt-1">
                              {row.rowError}
                            </p>
                          ) : null}
                        </td>
                        <td>
                          <span className={statusBadgeClass(row.status)}>
                            {statusLabel(row.status)}
                          </span>
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
