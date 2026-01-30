"use client";

import Link from "next/link";
import {
  ChangeEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchTeacherDashboard,
  type TeacherDashboardResponse,
} from "@/lib/staff";
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
import { AssessmentComponentStructureService } from "@/lib/assessmentComponentStructure";
import { apiFetch } from "@/lib/apiClient";
import { API_ROUTES } from "@/lib/config";
import {
  listResults,
  saveResultsBatch,
  type ResultRecord,
} from "@/lib/results";
import {
  listStudents,
  type StudentSummary,
} from "@/lib/students";
import {
  listSubjectTeacherAssignments,
} from "@/lib/subjectTeacherAssignments";
import { fetchSchoolContext } from "@/lib/schoolContext";
import { isTeacherUser } from "@/lib/roleChecks";

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
  cells: Record<string, ResultEntryCell>;
}

interface ResultEntryCell {
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
  const [teacherDashboard, setTeacherDashboard] = useState<TeacherDashboardResponse | null>(null);

  const isTeacher = isTeacherUser(user);

  const [filters, setFilters] = useState<FiltersState>(emptyFilters);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [termsCache, setTermsCache] = useState<Record<string, Term[]>>({});
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [armsCache, setArmsCache] = useState<Record<string, ClassArm[]>>({});
  const [sectionsCache, setSectionsCache] =
    useState<Record<string, ClassArmSection[]>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [subjectAssignments, setSubjectAssignments] = useState<Array<{subject_id: string}>>([]);

  const [componentLoading, setComponentLoading] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [tableLoading, setTableLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const autoSaveTimersRef = useRef<Record<string, number>>({});
  const lastAutoSaveKeyRef = useRef<Record<string, string>>({});

  const [rows, setRows] = useState<ResultEntryRow[]>([]);

  const [componentMaxScores, setComponentMaxScores] = useState<Record<string, number>>({});

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

  const lockSessionAndTerm = true;

  const displayComponents = useMemo(() => {
    if (selectedComponent) {
      return components.filter(
        (component) => String(component.id) === selectedComponent,
      );
    }
    return components;
  }, [components, selectedComponent]);

  const getComponentMaxScore = useCallback(
    (componentId: string) => {
      const dynamicScore = componentMaxScores[String(componentId)];
      if (Number.isFinite(dynamicScore) && dynamicScore > 0) {
        return dynamicScore;
      }
      const component = components.find(
        (item) => String(item.id) === String(componentId),
      );
      const weightValue = Number(component?.weight);
      if (Number.isFinite(weightValue) && weightValue > 0) {
        return weightValue;
      }
      return 100;
    },
    [componentMaxScores, components],
  );

  const getComponentMaxScoreLabel = useCallback(
    (componentId: string) => {
      const maxScore = getComponentMaxScore(componentId);
      if (!Number.isFinite(maxScore)) {
        return "100";
      }
      return Number.isInteger(maxScore)
        ? maxScore.toString()
        : maxScore.toFixed(2).replace(/\.?0+$/, "");
    },
    [getComponentMaxScore],
  );

  useEffect(() => {
    if (!selectedClass || !selectedTerm || displayComponents.length === 0) {
      setComponentMaxScores({});
      return;
    }

    let active = true;
    Promise.all(
      displayComponents.map((component) =>
        AssessmentComponentStructureService.getMaxScore({
          assessment_component_id: String(component.id),
          class_id: selectedClass,
          term_id: selectedTerm || null,
        }) as Promise<{ max_score: number }>,
      ),
    )
      .then((responses) => {
        if (!active) {
          return;
        }
        const nextScores: Record<string, number> = {};
        responses.forEach((response, index) => {
          const maxScore = Number((response as { max_score?: number }).max_score);
          if (Number.isFinite(maxScore) && maxScore > 0) {
            nextScores[String(displayComponents[index].id)] = maxScore;
          }
        });
        setComponentMaxScores(nextScores);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        console.error("Failed to fetch component max scores", error);
        setComponentMaxScores({});
      });

    return () => {
      active = false;
    };
  }, [displayComponents, selectedClass, selectedTerm]);

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

  // Filter subjects based on the selected class
  const filteredSubjects = useMemo(() => {
    // If no class is selected, show all available subjects
    if (!selectedClass) {
      return subjects;
    }

    // For teachers: use dashboard data which includes processed assignments
    if (isTeacher) {
      // If dashboard hasn't loaded yet, show all subjects (will be filtered by backend anyway)
      if (!teacherDashboard) {
        return subjects;
      }

      const subjectIdsForClass = new Set<string>();

      teacherDashboard.assignments.forEach((assignment) => {
        if (assignment.class && String(assignment.class.id) === selectedClass) {
          assignment.subjects.forEach((subject) => {
            subjectIdsForClass.add(String(subject.id));
          });
        }
      });

      return subjects.filter((subject) => subjectIdsForClass.has(String(subject.id)));
    }

    // For non-teachers (admins): filter based on subject assignments for the selected class
    // If class is selected, only show subjects that have been assigned to that class
    const assignedSubjectIds = new Set(
      subjectAssignments.map((assignment) => String(assignment.subject_id))
    );
    return subjects.filter((subject) => assignedSubjectIds.has(String(subject.id)));
  }, [subjects, selectedClass, isTeacher, teacherDashboard, subjectAssignments]);

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

        const contextSessionIdRaw = context.current_session_id
          ? String(context.current_session_id)
          : "";
        const fallbackSessionId =
          !contextSessionIdRaw && sessionList.length > 0
            ? String(sessionList[0].id)
            : "";
        const contextSessionId = contextSessionIdRaw || fallbackSessionId;
        const contextTermId = context.current_term_id
          ? String(context.current_term_id)
          : "";

        // Fetch teacher dashboard if user is a teacher
        // The dashboard includes processed assignments with all subjects for class teachers
        if (isTeacher) {
          try {
            const dashboard = await fetchTeacherDashboard();
            setTeacherDashboard(dashboard);
          } catch (error) {
            console.error("Failed to load teacher dashboard", error);
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

  // Fetch subject assignments when class changes (for admins)
  useEffect(() => {
    // Only fetch for non-teachers (admins)
    if (isTeacher || !selectedClass) {
      setSubjectAssignments([]);
      return;
    }

    let cancelled = false;

    apiFetch<{ data: Array<{subject_id: string}> }>(
      `${API_ROUTES.subjectAssignments}?school_class_id=${selectedClass}&per_page=500`
    )
      .then((response) => {
        if (cancelled) return;
        const assignments = Array.isArray(response.data) ? response.data : [];
        setSubjectAssignments(assignments);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('Error fetching subject assignments:', error);
        setSubjectAssignments([]);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedClass, isTeacher]);

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
    if (lockSessionAndTerm) {
      return;
    }
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      sessionId: value,
      termId: "",
      componentId: "",
    }));
  };

  const handleTermChange = (event: ChangeEvent<HTMLSelectElement>) => {
    if (lockSessionAndTerm) {
      return;
    }
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

  const updateCell = useCallback(
    (
      rowIndex: number,
      componentId: string,
      updates: Partial<ResultEntryCell>,
    ) => {
      setRows((prev) => {
        if (rowIndex < 0 || rowIndex >= prev.length) {
          return prev;
        }
        const next = [...prev];
        const row = next[rowIndex];
        const existingCell = row.cells[componentId];
        if (!existingCell) {
          return prev;
        }
        const updatedCell: ResultEntryCell = {
          ...existingCell,
          ...updates,
        };
        const currentScore = updatedCell.score.trim();
        const originalScore = updatedCell.originalScore.trim();
        const currentRemark = updatedCell.remark.trim();
        const originalRemark = updatedCell.originalRemark.trim();
        const changed =
          currentScore !== originalScore ||
          currentRemark !== originalRemark;
        updatedCell.status = changed
          ? "pending"
          : updatedCell.hasResult
            ? "saved"
            : "none";
        if (
          Object.prototype.hasOwnProperty.call(updates, "score") ||
          Object.prototype.hasOwnProperty.call(updates, "remark")
        ) {
          updatedCell.rowError = null;
        }
        next[rowIndex] = {
          ...row,
          cells: {
            ...row.cells,
            [componentId]: updatedCell,
          },
        };
        return next;
      });
    },
    [],
  );

  const autoSaveRow = useCallback(
    async (
      studentId: string,
      componentId: string,
      scoreInput: string,
      remarkInput: string,
    ) => {
      if (!selectedSession || !selectedTerm || !selectedSubject) {
        return;
      }
      const trimmedScore = scoreInput.trim();
      const trimmedRemark = remarkInput.trim();

      if (!trimmedScore) {
        return;
      }

      const maxScore = getComponentMaxScore(componentId);
      const maxScoreLabel = getComponentMaxScoreLabel(componentId);
      const scoreValue = Number(trimmedScore);
      if (
        Number.isNaN(scoreValue) ||
        scoreValue < 0 ||
        scoreValue > maxScore
      ) {
        setRows((prev) =>
          prev.map((row) => {
            if (String(row.student.id) !== String(studentId)) {
              return row;
            }
            const cell = row.cells[componentId];
            if (!cell) {
              return row;
            }
            return {
              ...row,
              cells: {
                ...row.cells,
                [componentId]: {
                  ...cell,
                  rowError: `Score must be a number between 0 and ${maxScoreLabel}.`,
                  status: "pending",
                },
              },
            };
          }),
        );
        return;
      }

      const cellKey = `${studentId}-${componentId}`;
      const saveKey = `${selectedSession}|${selectedTerm}|${selectedSubject}|${componentId}|${studentId}|${trimmedScore}|${trimmedRemark}`;
      lastAutoSaveKeyRef.current[cellKey] = saveKey;

      setRows((prev) =>
        prev.map((row) => {
          if (String(row.student.id) !== String(studentId)) {
            return row;
          }
          const cell = row.cells[componentId];
          if (!cell) {
            return row;
          }
          return {
            ...row,
            cells: {
              ...row.cells,
              [componentId]: {
                ...cell,
                rowError: null,
                status: "pending",
              },
            },
          };
        }),
      );

      try {
        const response = await saveResultsBatch({
          session_id: selectedSession,
          term_id: selectedTerm,
          assessment_component_id: componentId,
          entries: [
            {
              student_id: studentId,
              subject_id: selectedSubject,
              score: Number.parseFloat(scoreValue.toFixed(2)),
              remarks: trimmedRemark ? trimmedRemark : null,
            },
          ],
        });

        const saved = response.results.find(
          (result) => String(result.student_id) === String(studentId),
        );

        setRows((prev) =>
          prev.map((row) => {
            if (String(row.student.id) !== String(studentId)) {
              return row;
            }
            const cell = row.cells[componentId];
            if (!cell) {
              return row;
            }
            if (!saved) {
              return {
                ...row,
                cells: {
                  ...row.cells,
                  [componentId]: {
                    ...cell,
                    rowError: null,
                    status: cell.hasResult ? "saved" : "none",
                  },
                },
              };
            }
            const savedScore = formatScore(saved.total_score);
            const savedRemark = (saved.remarks ?? "").trim();
            return {
              ...row,
              cells: {
                ...row.cells,
                [componentId]: {
                  ...cell,
                  score: savedScore,
                  remark: saved.remarks ?? "",
                  originalScore: savedScore,
                  originalRemark: savedRemark,
                  hasResult: true,
                  status: "saved",
                  rowError: null,
                },
              },
            };
          }),
        );
      } catch (error) {
        console.error("Unable to auto-save score", error);
        lastAutoSaveKeyRef.current[cellKey] = "";
        setRows((prev) =>
          prev.map((row) => {
            if (String(row.student.id) !== String(studentId)) {
              return row;
            }
            const cell = row.cells[componentId];
            if (!cell) {
              return row;
            }
            return {
              ...row,
              cells: {
                ...row.cells,
                [componentId]: {
                  ...cell,
                  rowError:
                    error instanceof Error
                      ? error.message
                      : "Unable to auto-save score.",
                  status: "pending",
                },
              },
            };
          }),
        );
      }
    },
    [
      getComponentMaxScore,
      getComponentMaxScoreLabel,
      selectedSession,
      selectedSubject,
      selectedTerm,
    ],
  );

  const scheduleAutoSave = useCallback(
    (
      row: ResultEntryRow,
      componentId: string,
      nextScore: string,
      nextRemark: string,
    ) => {
      if (!selectedSession || !selectedTerm || !selectedSubject) {
        return;
      }
      const cell = row.cells[componentId];
      if (!cell) {
        return;
      }
      const studentKey = String(row.student.id);
      const trimmedScore = nextScore.trim();
      const trimmedRemark = nextRemark.trim();
      const changed =
        trimmedScore !== cell.originalScore.trim() ||
        trimmedRemark !== cell.originalRemark.trim();

      if (!changed) {
        return;
      }

      const cellKey = `${studentKey}-${componentId}`;
      const key = `${selectedSession}|${selectedTerm}|${selectedSubject}|${componentId}|${studentKey}|${trimmedScore}|${trimmedRemark}`;
      if (lastAutoSaveKeyRef.current[cellKey] === key) {
        return;
      }

      if (autoSaveTimersRef.current[cellKey]) {
        window.clearTimeout(autoSaveTimersRef.current[cellKey]);
      }
      autoSaveTimersRef.current[cellKey] = window.setTimeout(() => {
        void autoSaveRow(studentKey, componentId, trimmedScore, trimmedRemark);
      }, 600);
    },
    [autoSaveRow, selectedSession, selectedSubject, selectedTerm],
  );

  useEffect(() => {
    Object.values(autoSaveTimersRef.current).forEach((timer) => {
      window.clearTimeout(timer);
    });
    autoSaveTimersRef.current = {};
    lastAutoSaveKeyRef.current = {};
  }, [selectedSession, selectedTerm, selectedSubject, selectedComponent]);

  useEffect(() => {
    return () => {
      Object.values(autoSaveTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  const getAssignedStudentIds = useCallback(async (): Promise<Set<string> | null> => {
    if (!isTeacher) {
      return null;
    }
    const teacherId = teacherDashboard?.teacher?.id;
    if (!teacherId || !selectedSession || !selectedTerm || !selectedSubject || !selectedClass) {
      return null;
    }
    try {
      const response = await listSubjectTeacherAssignments({
        per_page: 500,
        staff_id: String(teacherId),
        subject_id: selectedSubject,
        session_id: selectedSession,
        term_id: selectedTerm,
        school_class_id: selectedClass,
        class_arm_id: selectedArm || undefined,
        class_section_id: selectedSection || undefined,
      });
      const ids = new Set<string>();
      let hasOpenAssignment = false;
      (response.data ?? []).forEach((assignment) => {
        const studentIds = Array.isArray(assignment.student_ids)
          ? assignment.student_ids
          : Array.isArray(assignment.students)
            ? assignment.students
                .map((student) => student?.id)
                .filter(Boolean)
            : [];
        if (studentIds.length) {
          studentIds.forEach((id) => ids.add(String(id)));
        } else {
          hasOpenAssignment = true;
        }
      });
      if (hasOpenAssignment) {
        return null;
      }
      return ids.size ? ids : null;
    } catch (error) {
      console.error("Unable to load assigned students", error);
      return null;
    }
  }, [
    isTeacher,
    selectedArm,
    selectedClass,
    selectedSection,
    selectedSession,
    selectedSubject,
    selectedTerm,
    teacherDashboard?.teacher?.id,
  ]);

  const handleLoadStudents = useCallback(async () => {
    resetMessages();
    setStatusMessage("");

    const missing: string[] = [];
    if (!selectedSession) missing.push("session");
    if (!selectedTerm) missing.push("term");
    if (!selectedClass) missing.push("class");
    if (!selectedSubject) missing.push("subject");

    if (missing.length) {
      setFeedback({
        type: "warning",
        message: `Please select ${missing.join(", ")} before loading students.`,
      });
      setRows([]);
      return;
    }

    if (!displayComponents.length) {
      setFeedback({
        type: "info",
        message: "No assessment components found for the selected subject.",
      });
      setRows([]);
      return;
    }

    setTableLoading(true);
    setStatusMessage("Loading students...");

    try {
      const studentPromise = listStudents({
        per_page: 500,
        school_class_id: selectedClass,
        class_arm_id: selectedArm || undefined,
        class_section_id: selectedSection || undefined,
        current_session_id: selectedSession,
        current_term_id: selectedTerm,
        sortBy: "first_name",
        sortDirection: "asc",
      });

      const resultPromises = displayComponents.map((component) =>
        listResults({
          per_page: 500,
          session_id: selectedSession,
          term_id: selectedTerm,
          subject_id: selectedSubject,
          school_class_id: selectedClass,
          class_arm_id: selectedArm || undefined,
          class_section_id: selectedSection || undefined,
          assessment_component_id: String(component.id),
        }),
      );

      const assignedStudentIdsPromise = getAssignedStudentIds();
      const responses = await Promise.all([
        studentPromise,
        ...resultPromises,
        assignedStudentIdsPromise,
      ]);
      const studentResponse = responses[0] as Awaited<
        ReturnType<typeof listStudents>
      >;
      const assignedStudentIds = responses[responses.length - 1] as Set<string> | null;
      const resultsResponses = responses.slice(1, -1) as Array<
        Awaited<ReturnType<typeof listResults>>
      >;

      let students = studentResponse.data ?? [];
      if (assignedStudentIds && assignedStudentIds.size > 0) {
        students = students.filter((student) =>
          assignedStudentIds.has(String(student.id)),
        );
      }
      const resultMap = new Map<string, ResultRecord>();
      resultsResponses.forEach((response, index) => {
        const componentId = String(displayComponents[index].id);
        const results = response.data ?? [];
        results.forEach((result) => {
          const key = `${result.student_id}-${componentId}`;
          resultMap.set(key, result);
        });
      });

      const nextRows: ResultEntryRow[] = students.map((student) => {
        const cells: Record<string, ResultEntryCell> = {};
        displayComponents.forEach((component) => {
          const componentId = String(component.id);
          const result = resultMap.get(`${student.id}-${componentId}`);
          const scoreValue = result ? formatScore(result.total_score) : "";
          const remarkValue = result?.remarks ?? "";
          const normalizedRemark = remarkValue.trim();
          cells[componentId] = {
            score: scoreValue,
            remark: remarkValue,
            originalScore: scoreValue,
            originalRemark: normalizedRemark,
            hasResult: Boolean(result),
            status: result ? "saved" : "none",
            rowError: null,
          };
        });
        return {
          student,
          cells,
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
    displayComponents,
    getAssignedStudentIds,
    resetMessages,
    selectedSession,
    selectedTerm,
    selectedClass,
    selectedArm,
    selectedSection,
    selectedSubject,
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

    if (!displayComponents.length) {
      setFeedback({
        type: "info",
        message: "No assessment components available to save.",
      });
      return;
    }

    const nextRows = rows.map((row) => ({
      ...row,
      cells: { ...row.cells },
    }));
    const entriesByComponent: Record<string, Array<{
      student_id: number | string;
      subject_id: string;
      score: number;
      remarks: string | null;
    }>> = {};
    let hasErrors = false;

    nextRows.forEach((row) => {
      displayComponents.forEach((component) => {
        const componentId = String(component.id);
        const cell = row.cells[componentId];
        if (!cell) {
          return;
        }
        const scoreInput = cell.score.trim();
        const remarkInput = cell.remark.trim();
        const originalRemark = cell.originalRemark.trim();
        const originalScore = cell.originalScore.trim();

        const changed =
          scoreInput !== originalScore || remarkInput !== originalRemark;

        if (!changed) {
          row.cells[componentId] = {
            ...cell,
            rowError: null,
            status: cell.hasResult ? "saved" : "none",
          };
          return;
        }

        if (!scoreInput) {
          row.cells[componentId] = {
            ...cell,
            rowError:
              "Score is required when updating a result or providing a remark.",
            status: "pending",
          };
          hasErrors = true;
          return;
        }

        const scoreValue = Number(scoreInput);
        const maxScore = getComponentMaxScore(componentId);
        if (
          Number.isNaN(scoreValue) ||
          scoreValue < 0 ||
          scoreValue > maxScore
        ) {
          row.cells[componentId] = {
            ...cell,
            rowError: `Score must be a number between 0 and ${getComponentMaxScoreLabel(componentId)}.`,
            status: "pending",
          };
          hasErrors = true;
          return;
        }

        row.cells[componentId] = {
          ...cell,
          rowError: null,
          status: "pending",
        };

        if (!entriesByComponent[componentId]) {
          entriesByComponent[componentId] = [];
        }
        entriesByComponent[componentId].push({
          student_id: row.student.id,
          subject_id: selectedSubject,
          score: Number.parseFloat(scoreValue.toFixed(2)),
          remarks: remarkInput ? remarkInput : null,
        });
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

    const totalEntries = Object.values(entriesByComponent).reduce(
      (sum, entries) => sum + entries.length,
      0,
    );

    if (!totalEntries) {
      setFeedback({
        type: "info",
        message: "No changes to save.",
      });
      return;
    }

    setSaving(true);
    setStatusMessage("Saving scores...");

    try {
      const saveTasks = Object.entries(entriesByComponent).map(
        ([componentId, entries]) => ({
          componentId,
          promise: saveResultsBatch({
            session_id: selectedSession,
            term_id: selectedTerm,
            assessment_component_id: componentId,
            entries,
          }),
        }),
      );

      const results = await Promise.allSettled(
        saveTasks.map((task) => task.promise),
      );

      const updatedMap = new Map<string, ResultRecord>();
      const failedComponentIds = new Set<string>();
      let savedCount = 0;

      results.forEach((result, index) => {
        const componentId = saveTasks[index].componentId;
        if (result.status === "fulfilled") {
          result.value.results.forEach((item) => {
            const key = `${item.student_id}-${String(item.assessment_component_id ?? componentId)}`;
            updatedMap.set(key, item);
          });
          savedCount += result.value.results.length;
        } else {
          failedComponentIds.add(componentId);
        }
      });

      setRows((prev) =>
        prev.map((row) => {
          const nextCells = { ...row.cells };
          displayComponents.forEach((component) => {
            const componentId = String(component.id);
            if (failedComponentIds.has(componentId)) {
              return;
            }
            const saved = updatedMap.get(
              `${row.student.id}-${componentId}`,
            );
            const cell = nextCells[componentId];
            if (!cell) {
              return;
            }
            if (!saved) {
              nextCells[componentId] = {
                ...cell,
                rowError: null,
                status: cell.hasResult ? "saved" : "none",
              };
              return;
            }
            const savedScore = formatScore(saved.total_score);
            const savedRemark = (saved.remarks ?? "").trim();
            nextCells[componentId] = {
              ...cell,
              score: savedScore,
              remark: saved.remarks ?? "",
              originalScore: savedScore,
              originalRemark: savedRemark,
              hasResult: true,
              status: "saved",
              rowError: null,
            };
          });
          return {
            ...row,
            cells: nextCells,
          };
        }),
      );

      if (failedComponentIds.size) {
        setFeedback({
          type: "danger",
          message: `Scores saved for ${savedCount} entries, but ${failedComponentIds.size} component batch${failedComponentIds.size === 1 ? "" : "es"} failed.`,
        });
      } else {
        setFeedback({
          type: "success",
          message: "Scores saved successfully.",
        });
      }

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
    displayComponents,
    getComponentMaxScore,
    getComponentMaxScoreLabel,
    resetMessages,
    rows,
    selectedSession,
    selectedTerm,
    selectedSubject,
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
                  disabled={initializing || lockSessionAndTerm}
                >
                  <option value="">Select session</option>
                  {sessions.map((session) => (
                    <option key={session.id} value={String(session.id)}>
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
                  disabled={initializing || !selectedSession || lockSessionAndTerm}
                >
                  <option value="">Select term</option>
                  {terms.map((term) => (
                    <option key={term.id} value={String(term.id)}>
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

              {/* Section selector commented out per request - UI hidden but logic preserved for future use
              <div className="col-xl-3 col-lg-6 col-12 form-group">
                <label htmlFor="filter-section">Section</label>
                <select
                  id="filter-section"
                  className="form-control"
                  value={selectedSection}
                  onChange={handleSectionChange}
                  disabled={!selectedClass}
                >
                  <option value="">All sections</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
              </div>
              */}

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
                  Assessment Component
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
                  <option value="">All components</option>
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
              <span className="ml-auto text-muted small">{statusMessage}</span>
            </div>
          </div>

          {feedback ? (
            <div className={`alert alert-${feedback.type}`} role="alert">
              {feedback.message}
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table display text-nowrap results-entry-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Student</th>
                  <th>Admission No</th>
                  <th>Class</th>
                  {displayComponents.map((component) => {
                    const label = component.label
                      ? `${component.name} (${component.label})`
                      : component.name;
                    const componentId = String(component.id);
                    return (
                      <th key={component.id} style={{ width: "140px" }}>
                        <div className="text-muted small font-weight-bold">
                          {label}
                        </div>
                        <div className="text-muted small">
                          Max {getComponentMaxScoreLabel(componentId)}
                        </div>
                      </th>
                    );
                  })}
                  {/* Remark column commented out per request - UI hidden but data preserved
                  <th style={{ width: "280px" }}>Remark</th>
                  */}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tableLoading ? (
                  <tr>
                    <td colSpan={5 + displayComponents.length}>
                      Loading students…
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5 + displayComponents.length}
                      className="text-center text-muted"
                    >
                      Select filters and click “Load Students” to begin.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => {
                    const studentName = buildStudentName(row.student);
                    const classLabel = buildClassLabel(row.student);
                    const visibleCells = displayComponents
                      .map((component) => row.cells[String(component.id)])
                      .filter(Boolean) as ResultEntryCell[];
                    const hasError = visibleCells.some((cell) => cell.rowError);
                    const hasPending = visibleCells.some(
                      (cell) => cell.status === "pending",
                    );
                    const hasSaved = visibleCells.some(
                      (cell) => cell.status === "saved",
                    );
                    const rowStatus: ResultRowStatus = hasPending
                      ? "pending"
                      : hasSaved
                        ? "saved"
                        : "none";
                    return (
                      <tr
                        key={String(row.student.id)}
                        className={hasError ? "table-danger" : undefined}
                      >
                        <td>{index + 1}</td>
                        <td>{studentName}</td>
                        <td>{row.student.admission_no ?? "—"}</td>
                        <td>{classLabel}</td>
                        {displayComponents.map((component) => {
                          const componentId = String(component.id);
                          const cell = row.cells[componentId];
                          if (!cell) {
                            return <td key={componentId}>—</td>;
                          }
                          return (
                            <td key={componentId}>
                              <input
                                type="number"
                                className="form-control"
                                min={0}
                                max={getComponentMaxScore(componentId)}
                                step={0.01}
                                value={cell.score}
                                onChange={(event) => {
                                  const nextScore = event.target.value;
                                  updateCell(index, componentId, {
                                    score: nextScore,
                                  });
                                  scheduleAutoSave(
                                    row,
                                    componentId,
                                    nextScore,
                                    cell.remark,
                                  );
                                }}
                              />
                              {cell.rowError ? (
                                <p className="text-danger small mb-0 mt-1">
                                  {cell.rowError}
                                </p>
                              ) : null}
                            </td>
                          );
                        })}

                        {/* Remark UI is hidden for now (remarks are per component). */}

                        <td>
                          <span className={statusBadgeClass(rowStatus)}>
                            {statusLabel(rowStatus)}
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

      <style jsx global>{`
        @media (max-width: 768px) {
          .results-entry-table th:nth-child(3),
          .results-entry-table td:nth-child(3),
          .results-entry-table th:nth-child(4),
          .results-entry-table td:nth-child(4) {
            display: none;
          }
        }
      `}</style>
    </>
  );
}
