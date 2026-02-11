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
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { getStudent, type StudentDetail } from "@/lib/students";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listAllSubjects, type Subject } from "@/lib/subjects";
import {
  listAssessmentComponents,
  type AssessmentComponent,
} from "@/lib/assessmentComponents";
import { AssessmentComponentStructureService } from "@/lib/assessmentComponentStructure";
import {
  listResults,
  saveResultsBatch,
  type ResultRecord,
} from "@/lib/results";
import { listSubjectAssignments } from "@/lib/subjectAssignments";
import {
  fetchTeacherDashboard,
  type TeacherDashboardResponse,
} from "@/lib/staff";
import { isTeacherUser } from "@/lib/roleChecks";

type ResultRowStatus = "saved" | "pending" | "none";

interface FiltersState {
  sessionId: string;
  termId: string;
  subjectId: string;
  componentId: string;
}

interface ResultEntryCell {
  score: string;
  originalScore: string;
  hasResult: boolean;
  status: ResultRowStatus;
  rowError: string | null;
}

interface SubjectResultRow {
  subject: Subject;
  cells: Record<string, ResultEntryCell | null>;
}

const emptyFilters: FiltersState = {
  sessionId: "",
  termId: "",
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

const buildStudentName = (student: StudentDetail): string => {
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

const buildClassLabel = (student: StudentDetail): string => {
  const className = student.school_class?.name ?? "—";
  const armName = student.class_arm?.name ?? "";
  const sectionName = student.class_section?.name ?? "";
  return [className, armName, sectionName].filter(Boolean).join(" / ") || "—";
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

export default function StudentResultEntryPage() {
  const searchParams = useSearchParams();
  const studentId = searchParams.get("id");
  const querySessionId = searchParams.get("session_id") ?? "";
  const queryTermId = searchParams.get("term_id") ?? "";

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

  const studentDetailsHref = useMemo(() => {
    if (!studentId) {
      return allStudentsHref;
    }
    return filterQuery
      ? `/v14/student-details?id=${studentId}&${filterQuery}`
      : `/v14/student-details?id=${studentId}`;
  }, [allStudentsHref, filterQuery, studentId]);

  const { schoolContext, user } = useAuth();
  const isTeacher = isTeacherUser(user);

  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [studentLoading, setStudentLoading] = useState(true);
  const [studentError, setStudentError] = useState<string | null>(null);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [termsCache, setTermsCache] = useState<Record<string, Term[]>>({});
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teacherDashboard, setTeacherDashboard] =
    useState<TeacherDashboardResponse | null>(null);
  const [subjectFilterIds, setSubjectFilterIds] = useState<Set<string> | null>(
    null,
  );

  const [filters, setFilters] = useState<FiltersState>(emptyFilters);
  const [componentsBySubject, setComponentsBySubject] =
    useState<Record<string, AssessmentComponent[]>>({});
  const [allComponents, setAllComponents] = useState<AssessmentComponent[]>([]);
  const [componentLoading, setComponentLoading] = useState(false);
  const [tableLoading, setTableLoading] = useState(false);

  const [rows, setRows] = useState<SubjectResultRow[]>([]);
  const [componentMaxScores, setComponentMaxScores] = useState<
    Record<string, number>
  >({});

  const [feedback, setFeedback] = useState<{
    type: "success" | "info" | "warning" | "danger";
    message: string;
  } | null>(null);
  const [statusMessage, setStatusMessage] = useState<string>("");

  const autoSaveTimersRef = useRef<Record<string, number>>({});
  const lastAutoSaveKeyRef = useRef<Record<string, string>>({});

  const selectedSession = filters.sessionId;
  const selectedTerm = filters.termId;
  const selectedSubject = filters.subjectId;
  const selectedComponent = filters.componentId;

  const updateFilters = useCallback(
    (updater: (current: FiltersState) => FiltersState) => {
      setFilters((prev) => {
        const next = updater(prev);
        if (
          prev.sessionId === next.sessionId &&
          prev.termId === next.termId &&
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

  const terms = useMemo(() => {
    if (!selectedSession) {
      return [];
    }
    return termsCache[selectedSession] ?? [];
  }, [selectedSession, termsCache]);

  const filteredSubjects = useMemo(() => {
    if (!subjects.length) {
      return [];
    }

    if (isTeacher) {
      if (!student?.school_class_id || !teacherDashboard) {
        return [];
      }

      const classId = String(student.school_class_id);
      const studentArmId =
        student.class_arm_id != null ? String(student.class_arm_id) : "";
      const studentSectionId =
        student.class_section_id != null ? String(student.class_section_id) : "";
      const subjectIds = new Set<string>();
      teacherDashboard.assignments.forEach((assignment) => {
        if (String(assignment.class?.id ?? "") !== classId) {
          return;
        }
        const assignmentArmId = assignment.class_arm?.id
          ? String(assignment.class_arm.id)
          : "";
        const assignmentSectionId = assignment.class_section?.id
          ? String(assignment.class_section.id)
          : "";

        if (assignmentArmId && assignmentArmId !== studentArmId) {
          return;
        }
        if (assignmentSectionId && assignmentSectionId !== studentSectionId) {
          return;
        }
        assignment.subjects.forEach((subject) => {
          subjectIds.add(String(subject.id));
        });
      });

      return subjects.filter((subject) => subjectIds.has(String(subject.id)));
    }

    if (!student?.school_class_id) {
      return [];
    }

    if (subjectFilterIds === null) {
      return [];
    }

    return subjects.filter((subject) => subjectFilterIds.has(String(subject.id)));
  }, [
    isTeacher,
    student?.school_class_id,
    student?.class_arm_id,
    student?.class_section_id,
    subjectFilterIds,
    subjects,
    teacherDashboard,
  ]);

  const getComponentMaxScore = useCallback(
    (componentId: string) => {
      const dynamicScore = componentMaxScores[String(componentId)];
      if (Number.isFinite(dynamicScore) && dynamicScore > 0) {
        return dynamicScore;
      }
      const component = allComponents.find(
        (item) => String(item.id) === String(componentId),
      );
      const weightValue = Number(component?.weight);
      if (Number.isFinite(weightValue) && weightValue > 0) {
        return weightValue;
      }
      return 100;
    },
    [allComponents, componentMaxScores],
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

  const componentOptions = useMemo(() => {
    if (!selectedSubject) {
      return allComponents;
    }
    return componentsBySubject[selectedSubject] ?? [];
  }, [allComponents, componentsBySubject, selectedSubject]);

  const visibleComponents = useMemo(() => {
    if (!selectedComponent) {
      return componentOptions;
    }
    return componentOptions.filter(
      (component) => String(component.id) === selectedComponent,
    );
  }, [componentOptions, selectedComponent]);

  const visibleRows = useMemo(() => {
    if (!selectedSubject) {
      return rows;
    }
    return rows.filter(
      (row) => String(row.subject.id) === selectedSubject,
    );
  }, [rows, selectedSubject]);

  useEffect(() => {
    if (!studentId) {
      setStudentLoading(false);
      setStudentError("Student not found.");
      return;
    }

    let active = true;

    const bootstrap = async () => {
      setStudentLoading(true);
      setStudentError(null);
      setFeedback({
        type: "info",
        message: "Loading student and result context...",
      });

      try {
        const [studentData, sessionList, subjectList, dashboard] = await Promise.all([
          getStudent(studentId),
          listSessions(),
          listAllSubjects(),
          isTeacher ? fetchTeacherDashboard() : Promise.resolve(null),
        ]);

        if (!active) {
          return;
        }

        if (!studentData) {
          setStudentError("Student not found.");
          setStudent(null);
          setFeedback(null);
          return;
        }

        setStudent(studentData);
        setSessions(sessionList);
        setSubjects(subjectList);
        if (dashboard) {
          setTeacherDashboard(dashboard);
        }

        const contextSessionId =
          querySessionId ||
          (schoolContext.current_session_id != null
            ? String(schoolContext.current_session_id)
            : "") ||
          (studentData.current_session_id != null
            ? String(studentData.current_session_id)
            : "") ||
          (sessionList.length > 0 ? String(sessionList[0].id) : "");

        let contextTermId =
          queryTermId ||
          (schoolContext.current_term_id != null
            ? String(schoolContext.current_term_id)
            : "") ||
          (studentData.current_term_id != null
            ? String(studentData.current_term_id)
            : "");

        if (contextSessionId) {
          const sessionTerms = await ensureTerms(contextSessionId);
          const hasTerm = sessionTerms.some(
            (term) => String(term.id) === contextTermId,
          );
          if (!hasTerm) {
            contextTermId = sessionTerms.length > 0 ? String(sessionTerms[0].id) : "";
          }
        }

        updateFilters((prev) => ({
          ...prev,
          sessionId: contextSessionId,
          termId: contextTermId,
        }));
        setFeedback(null);
      } catch (error) {
        console.error("Unable to initialize student result entry", error);
        if (!active) {
          return;
        }
        setStudentError(
          error instanceof Error
            ? error.message
            : "Unable to load student result entry context.",
        );
        setFeedback(null);
      } finally {
        if (active) {
          setStudentLoading(false);
        }
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, [
    ensureTerms,
    isTeacher,
    querySessionId,
    queryTermId,
    schoolContext.current_session_id,
    schoolContext.current_term_id,
    studentId,
    updateFilters,
  ]);

  useEffect(() => {
    if (isTeacher || !student?.school_class_id) {
      setSubjectFilterIds(new Set());
      return;
    }

    let cancelled = false;

    listSubjectAssignments({
      per_page: 500,
      school_class_id: String(student.school_class_id),
      class_arm_id:
        student.class_arm_id != null ? String(student.class_arm_id) : undefined,
      class_section_id:
        student.class_section_id != null
          ? String(student.class_section_id)
          : undefined,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const ids = new Set<string>();
        (response.data ?? []).forEach((assignment) => {
          if (assignment.subject_id != null) {
            ids.add(String(assignment.subject_id));
          }
        });
        setSubjectFilterIds(ids);
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Unable to load subject assignments", error);
        setSubjectFilterIds(new Set());
      });

    return () => {
      cancelled = true;
    };
  }, [
    isTeacher,
    student?.school_class_id,
    student?.class_arm_id,
    student?.class_section_id,
  ]);

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
          updateFilters((prev) => ({
            ...prev,
            termId: defaultTermId,
          }));
        }
      })
      .catch((error) =>
        console.error("Unable to load terms for selected session", error),
      );

    return () => {
      cancelled = true;
    };
  }, [ensureTerms, selectedSession, selectedTerm, updateFilters]);

  useEffect(() => {
    if (!selectedSession || !selectedTerm || filteredSubjects.length === 0) {
      setComponentsBySubject({});
      setAllComponents([]);
      return;
    }

    let active = true;
    setComponentLoading(true);

    Promise.all(
      filteredSubjects.map(async (subject) => {
        const response = await listAssessmentComponents({
          per_page: 200,
          session_id: selectedSession,
          term_id: selectedTerm,
          subject_id: String(subject.id),
        });
        return {
          subjectId: String(subject.id),
          components: response.data ?? [],
        };
      }),
    )
      .then((subjectComponents) => {
        if (!active) {
          return;
        }

        const nextMap: Record<string, AssessmentComponent[]> = {};
        const merged = new Map<string, AssessmentComponent>();

        subjectComponents.forEach(({ subjectId, components }) => {
          const sorted = [...components].sort((a, b) => {
            const orderA = Number(a.order ?? Number.MAX_SAFE_INTEGER);
            const orderB = Number(b.order ?? Number.MAX_SAFE_INTEGER);
            if (orderA !== orderB) {
              return orderA - orderB;
            }
            return String(a.name ?? "").localeCompare(String(b.name ?? ""));
          });

          nextMap[subjectId] = sorted;

          sorted.forEach((component) => {
            const key = String(component.id);
            if (!merged.has(key)) {
              merged.set(key, component);
            }
          });
        });

        const sortedMerged = Array.from(merged.values()).sort((a, b) => {
          const orderA = Number(a.order ?? Number.MAX_SAFE_INTEGER);
          const orderB = Number(b.order ?? Number.MAX_SAFE_INTEGER);
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          return String(a.name ?? "").localeCompare(String(b.name ?? ""));
        });

        setComponentsBySubject(nextMap);
        setAllComponents(sortedMerged);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        console.error("Unable to load assessment components", error);
        setComponentsBySubject({});
        setAllComponents([]);
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
  }, [filteredSubjects, selectedSession, selectedTerm]);

  useEffect(() => {
    if (!student?.school_class_id || !selectedTerm || allComponents.length === 0) {
      setComponentMaxScores({});
      return;
    }

    let active = true;

    Promise.all(
      allComponents.map((component) =>
        AssessmentComponentStructureService.getMaxScore({
          assessment_component_id: String(component.id),
          class_id: String(student.school_class_id),
          term_id: selectedTerm,
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
            nextScores[String(allComponents[index].id)] = maxScore;
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
  }, [allComponents, selectedTerm, student?.school_class_id]);

  useEffect(() => {
    setRows([]);
    setStatusMessage("");
  }, [selectedSession, selectedTerm, allComponents.length]);

  useEffect(() => {
    if (!selectedSubject) {
      return;
    }
    const exists = filteredSubjects.some(
      (subject) => String(subject.id) === selectedSubject,
    );
    if (exists) {
      return;
    }
    updateFilters((prev) => ({
      ...prev,
      subjectId: "",
      componentId: "",
    }));
  }, [filteredSubjects, selectedSubject, updateFilters]);

  useEffect(() => {
    if (!selectedComponent) {
      return;
    }
    const exists = componentOptions.some(
      (component) => String(component.id) === selectedComponent,
    );
    if (exists) {
      return;
    }
    updateFilters((prev) => ({
      ...prev,
      componentId: "",
    }));
  }, [componentOptions, selectedComponent, updateFilters]);

  const handleSessionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      sessionId: value,
      termId: "",
      subjectId: "",
      componentId: "",
    }));
  };

  const handleTermChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value;
    updateFilters((prev) => ({
      ...prev,
      termId: value,
      subjectId: "",
      componentId: "",
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
    (subjectId: string, componentId: string, nextScore: string) => {
      setRows((prev) => {
        return prev.map((row) => {
          if (String(row.subject.id) !== String(subjectId)) {
            return row;
          }
          const cell = row.cells[componentId];
          if (!cell) {
            return row;
          }

          const changed = nextScore.trim() !== cell.originalScore.trim();
          const updatedCell: ResultEntryCell = {
            ...cell,
            score: nextScore,
            rowError: null,
            status: changed ? "pending" : cell.hasResult ? "saved" : "none",
          };

          return {
            ...row,
            cells: {
              ...row.cells,
              [componentId]: updatedCell,
            },
          };
        });
      });
    },
    [],
  );

  const autoSaveCell = useCallback(
    async (
      subjectId: string,
      componentId: string,
      scoreInput: string,
    ) => {
      if (!studentId || !selectedSession || !selectedTerm) {
        return;
      }

      const trimmedScore = scoreInput.trim();
      if (!trimmedScore) {
        return;
      }

      const scoreValue = Number(trimmedScore);
      const maxScore = getComponentMaxScore(componentId);
      const maxScoreLabel = getComponentMaxScoreLabel(componentId);

      if (
        Number.isNaN(scoreValue) ||
        scoreValue < 0 ||
        scoreValue > maxScore
      ) {
        setRows((prev) =>
          prev.map((row) => {
            if (String(row.subject.id) !== String(subjectId)) {
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

      const cellKey = `${subjectId}-${componentId}`;
      const saveKey = `${selectedSession}|${selectedTerm}|${studentId}|${subjectId}|${componentId}|${trimmedScore}`;
      lastAutoSaveKeyRef.current[cellKey] = saveKey;

      setRows((prev) =>
        prev.map((row) => {
          if (String(row.subject.id) !== String(subjectId)) {
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
              student_id: String(studentId),
              subject_id: String(subjectId),
              score: Number.parseFloat(scoreValue.toFixed(2)),
              remarks: null,
            },
          ],
        });

        const saved = response.results.find(
          (result) =>
            String(result.student_id) === String(studentId) &&
            String(result.subject_id) === String(subjectId),
        );

        setRows((prev) =>
          prev.map((row) => {
            if (String(row.subject.id) !== String(subjectId)) {
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
            return {
              ...row,
              cells: {
                ...row.cells,
                [componentId]: {
                  ...cell,
                  score: savedScore,
                  originalScore: savedScore,
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
            if (String(row.subject.id) !== String(subjectId)) {
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
      selectedTerm,
      studentId,
    ],
  );

  const scheduleAutoSave = useCallback(
    (
      row: SubjectResultRow,
      componentId: string,
      nextScore: string,
    ) => {
      if (!studentId || !selectedSession || !selectedTerm) {
        return;
      }

      const cell = row.cells[componentId];
      if (!cell) {
        return;
      }

      const subjectId = String(row.subject.id);
      const trimmedScore = nextScore.trim();
      const changed = trimmedScore !== cell.originalScore.trim();

      if (!changed) {
        return;
      }

      const cellKey = `${subjectId}-${componentId}`;
      const key = `${selectedSession}|${selectedTerm}|${studentId}|${subjectId}|${componentId}|${trimmedScore}`;
      if (lastAutoSaveKeyRef.current[cellKey] === key) {
        return;
      }

      if (autoSaveTimersRef.current[cellKey]) {
        window.clearTimeout(autoSaveTimersRef.current[cellKey]);
      }

      autoSaveTimersRef.current[cellKey] = window.setTimeout(() => {
        void autoSaveCell(subjectId, componentId, trimmedScore);
      }, 600);
    },
    [autoSaveCell, selectedSession, selectedTerm, studentId],
  );

  useEffect(() => {
    Object.values(autoSaveTimersRef.current).forEach((timer) => {
      window.clearTimeout(timer);
    });
    autoSaveTimersRef.current = {};
    lastAutoSaveKeyRef.current = {};
  }, [selectedSession, selectedTerm, allComponents.length]);

  useEffect(() => {
    return () => {
      Object.values(autoSaveTimersRef.current).forEach((timer) => {
        window.clearTimeout(timer);
      });
    };
  }, []);

  const handleLoadScores = useCallback(async () => {
    if (!student || !studentId) {
      return;
    }

    setFeedback(null);
    setStatusMessage("");

    const missing: string[] = [];
    if (!selectedSession) missing.push("session");
    if (!selectedTerm) missing.push("term");

    if (missing.length) {
      setFeedback({
        type: "warning",
        message: `Please select ${missing.join(", ")} before loading scores.`,
      });
      setRows([]);
      return;
    }

    if (!filteredSubjects.length) {
      setFeedback({
        type: "info",
        message:
          "No subjects are assigned to this student's class/arm for the selected term.",
      });
      setRows([]);
      return;
    }

    if (!allComponents.length) {
      setFeedback({
        type: "info",
        message: "No assessment components found for the selected term.",
      });
      setRows([]);
      return;
    }

    setTableLoading(true);
    setStatusMessage("Loading scores...");

    try {
      const resultResponse = await listResults({
        per_page: 1000,
        student_id: studentId,
        session_id: selectedSession,
        term_id: selectedTerm,
        school_class_id:
          student.school_class_id != null ? String(student.school_class_id) : undefined,
      });

      const resultMap = new Map<string, ResultRecord>();
      (resultResponse.data ?? []).forEach((result) => {
        if (!result.assessment_component_id) {
          return;
        }
        const key = `${String(result.subject_id)}-${String(result.assessment_component_id)}`;
        resultMap.set(key, result);
      });

      const nextRows: SubjectResultRow[] = filteredSubjects.map((subject) => {
        const subjectId = String(subject.id);
        const subjectComponents = componentsBySubject[subjectId] ?? [];
        const subjectComponentIds = new Set(
          subjectComponents.map((component) => String(component.id)),
        );

        const cells: Record<string, ResultEntryCell | null> = {};

        allComponents.forEach((component) => {
          const componentId = String(component.id);
          if (!subjectComponentIds.has(componentId)) {
            cells[componentId] = null;
            return;
          }

          const result = resultMap.get(`${subjectId}-${componentId}`);
          const scoreValue = result ? formatScore(result.total_score) : "";

          cells[componentId] = {
            score: scoreValue,
            originalScore: scoreValue,
            hasResult: Boolean(result),
            status: result ? "saved" : "none",
            rowError: null,
          };
        });

        return {
          subject,
          cells,
        };
      });

      setRows(nextRows);
      setStatusMessage(`${nextRows.length} subjects loaded.`);
    } catch (error) {
      console.error("Unable to load student results", error);
      setFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load student scores for selected filters.",
      });
      setRows([]);
      setStatusMessage("");
    } finally {
      setTableLoading(false);
    }
  }, [
    allComponents,
    componentsBySubject,
    filteredSubjects,
    selectedSession,
    selectedTerm,
    student,
    studentId,
  ]);

  if (!studentId) {
    return (
      <div className="alert alert-danger" role="alert">
        Missing student identifier.
      </div>
    );
  }

  if (studentLoading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (studentError || !student) {
    return (
      <div className="alert alert-danger" role="alert">
        {studentError ?? "Unable to load student details."}
      </div>
    );
  }

  const studentName = buildStudentName(student);
  const classLabel = buildClassLabel(student);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Result Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href={allStudentsHref}>All Students</Link>
          </li>
          <li>
            <Link href={studentDetailsHref}>Student Details</Link>
          </li>
          <li>Student Result Entry</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Student Result Entry</h3>
              <p className="mb-0 text-muted small">
                All subjects and assessment components are shown below. Scores
                auto-save after you stop typing.
              </p>
            </div>
            <div>
              <Link href={studentDetailsHref} className="btn btn-outline-secondary">
                Back to Student
              </Link>
            </div>
          </div>

          <div className="alert alert-light border mb-4" role="status">
            <div className="font-weight-bold">{studentName}</div>
            <div className="text-muted small">
              Admission No: {student.admission_no ?? "—"} | Class: {classLabel}
            </div>
          </div>

          <div className="row">
            <div className="col-xl-3 col-lg-6 col-12 form-group">
              <label htmlFor="single-filter-session">Session</label>
              <select
                id="single-filter-session"
                className="form-control"
                value={selectedSession}
                onChange={handleSessionChange}
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
              <label htmlFor="single-filter-term">Term</label>
              <select
                id="single-filter-term"
                className="form-control"
                value={selectedTerm}
                onChange={handleTermChange}
                disabled={!selectedSession}
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
              <label htmlFor="single-filter-subject">Subject</label>
              <select
                id="single-filter-subject"
                className="form-control"
                value={selectedSubject}
                onChange={handleSubjectChange}
                disabled={!selectedSession || !selectedTerm}
              >
                <option value="">All subjects</option>
                {filteredSubjects.map((subject) => {
                  const label = subject.code
                    ? `${subject.name} (${subject.code})`
                    : subject.name;
                  return (
                    <option key={subject.id} value={String(subject.id)}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
            <div className="col-xl-3 col-lg-6 col-12 form-group">
              <label htmlFor="single-filter-component">Assessment Component</label>
              <select
                id="single-filter-component"
                className="form-control"
                value={selectedComponent}
                onChange={handleComponentChange}
                disabled={!selectedSession || !selectedTerm || componentLoading}
              >
                <option value="">All components</option>
                {componentOptions.map((component) => {
                  const label = component.label
                    ? `${component.name} (${component.label})`
                    : component.name;
                  return (
                    <option key={component.id} value={String(component.id)}>
                      {label}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center mb-3">
            <button
              type="button"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark mr-3 mb-2"
              onClick={() => {
                void handleLoadScores();
              }}
              disabled={tableLoading || componentLoading}
            >
              {tableLoading ? "Loading..." : "Load Subjects & Scores"}
            </button>
            <span className="ml-auto text-muted small">{statusMessage}</span>
          </div>

          {feedback ? (
            <div className={`alert alert-${feedback.type}`} role="alert">
              {feedback.message}
            </div>
          ) : null}

          <div className="table-responsive">
            <table
              className="table display text-nowrap results-entry-table"
              style={{ minWidth: Math.max(900, 320 + visibleComponents.length * 160) }}
            >
              <thead>
                <tr>
                  <th>#</th>
                  <th>Subject</th>
                  {visibleComponents.map((component) => {
                    const label = component.label
                      ? `${component.name} (${component.label})`
                      : component.name;
                    const componentId = String(component.id);
                    return (
                      <th key={componentId} style={{ width: "160px" }}>
                        <div className="text-muted small font-weight-bold">{label}</div>
                        <div className="text-muted small">
                          Max {getComponentMaxScoreLabel(componentId)}
                        </div>
                      </th>
                    );
                  })}
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {tableLoading ? (
                  <tr>
                    <td colSpan={3 + visibleComponents.length}>Loading scores...</td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={3 + visibleComponents.length} className="text-center text-muted">
                      Select session/term and click &ldquo;Load Subjects &amp; Scores&rdquo; to begin.
                    </td>
                  </tr>
                ) : visibleComponents.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="text-center text-muted">
                      No assessment components for the selected filters.
                    </td>
                  </tr>
                ) : visibleRows.length === 0 ? (
                  <tr>
                    <td colSpan={3 + visibleComponents.length} className="text-center text-muted">
                      No subjects match the selected filters.
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((row, rowIndex) => {
                    const hasError = visibleComponents.some((component) => {
                      const cell = row.cells[String(component.id)];
                      return Boolean(cell?.rowError);
                    });
                    const hasPending = visibleComponents.some((component) => {
                      const cell = row.cells[String(component.id)];
                      return cell?.status === "pending";
                    });
                    const hasSaved = visibleComponents.some((component) => {
                      const cell = row.cells[String(component.id)];
                      return cell?.status === "saved";
                    });
                    const rowStatus: ResultRowStatus = hasPending
                      ? "pending"
                      : hasSaved
                        ? "saved"
                        : "none";

                    const subjectLabel = row.subject.code
                      ? `${row.subject.name} (${row.subject.code})`
                      : row.subject.name;

                    return (
                      <tr
                        key={String(row.subject.id)}
                        className={hasError ? "table-danger" : undefined}
                      >
                        <td>{rowIndex + 1}</td>
                        <td>{subjectLabel}</td>
                        {visibleComponents.map((component) => {
                          const componentId = String(component.id);
                          const cell = row.cells[componentId];

                          if (!cell) {
                            return (
                              <td key={`${row.subject.id}-${componentId}`} className="text-muted">
                                —
                              </td>
                            );
                          }

                          return (
                            <td key={`${row.subject.id}-${componentId}`}>
                              <input
                                type="number"
                                className="form-control"
                                min={0}
                                max={getComponentMaxScore(componentId)}
                                step={0.01}
                                value={cell.score}
                                onChange={(event) => {
                                  const nextScore = event.target.value;
                                  updateCell(String(row.subject.id), componentId, nextScore);
                                  scheduleAutoSave(row, componentId, nextScore);
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

    </>
  );
}
