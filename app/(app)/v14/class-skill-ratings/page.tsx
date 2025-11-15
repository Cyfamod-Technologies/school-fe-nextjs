"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
} from "react";
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
  createStudentSkillRating,
  listStudentSkillRatings,
  updateStudentSkillRating,
  type StudentSkillRating,
  type StudentSkillType,
} from "@/lib/studentSkillRatings";
import { listSkillTypes } from "@/lib/skills";
import {
  fetchTeacherDashboard,
  type TeacherDashboardResponse,
} from "@/lib/staff";
import { fetchSchoolContext } from "@/lib/schoolContext";

interface FiltersState {
  sessionId: string;
  termId: string;
  classId: string;
  armId: string;
  sectionId: string;
  skillTypeId: string;
}

const emptyFilters: FiltersState = {
  sessionId: "",
  termId: "",
  classId: "",
  armId: "",
  sectionId: "",
  skillTypeId: "",
};

const ratingOptions = ["1", "2", "3", "4", "5"];

type RatingCell = {
  ratingId?: string;
  value: string;
};

type RatingsGrid = Record<string, Record<string, RatingCell>>;

type TermsCache = Record<string, Term[]>;
type ArmsCache = Record<string, ClassArm[]>;
type SectionsCache = Record<string, ClassArmSection[]>;

export default function ClassSkillRatingsPage() {
  const { user } = useAuth();
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
  const [termsCache, setTermsCache] = useState<TermsCache>({});
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [armsCache, setArmsCache] = useState<ArmsCache>({});
  const [sectionsCache, setSectionsCache] = useState<SectionsCache>({});

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [skillTypes, setSkillTypes] = useState<StudentSkillType[]>([]);
  const [ratingsGrid, setRatingsGrid] = useState<RatingsGrid>({});

  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingGrid, setLoadingGrid] = useState(false);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [feedbackKind, setFeedbackKind] = useState<"success" | "info" | "warning" | "danger">("info");
  const [error, setError] = useState<string | null>(null);

  const [teacherDashboard, setTeacherDashboard] =
    useState<TeacherDashboardResponse | null>(null);

  const selectedSession = filters.sessionId;
  const selectedTerm = filters.termId;
  const selectedClass = filters.classId;
  const selectedArm = filters.armId;
  const selectedSection = filters.sectionId;
  const selectedSkillTypeId = filters.skillTypeId;

  // Load skill types once so the Skill dropdown is available without needing
  // to click "Load Students & Skills" first.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const types = await listSkillTypes();
        if (cancelled) return;
        const mapped: StudentSkillType[] = types.map((type) => ({
          id: String(type.id),
          name: String(type.name ?? ""),
          description: (type as any).description ?? null,
          skill_category_id: (type as any).skill_category_id ?? "",
          category: (type as any).category ?? null,
        }));
        setSkillTypes(mapped);
      } catch (err) {
        console.error("Unable to load skill types", err);
      }
    })();
    return () => {
      cancelled = true;
    };
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

  const teacherClassOptions = useMemo(() => {
    if (!isTeacher || !teacherDashboard) {
      return classes;
    }
    const allowedIds = new Set<string>();
    teacherDashboard.assignments.forEach((assignment) => {
      if (assignment.class?.id) {
        allowedIds.add(String(assignment.class.id));
      }
    });
    if (!allowedIds.size) {
      return classes;
    }
    return classes.filter((schoolClass) =>
      allowedIds.has(String(schoolClass.id)),
    );
  }, [classes, isTeacher, teacherDashboard]);

  const sections = useMemo(() => {
    if (!selectedClass || !selectedArm) {
      return [];
    }
    const key = `${selectedClass}:${selectedArm}`;
    return sectionsCache[key] ?? [];
  }, [selectedClass, selectedArm, sectionsCache]);

  const visibleSkillTypes = useMemo(() => {
    if (!selectedSkillTypeId) {
      return [];
    }
    return skillTypes.filter(
      (type) => String(type.id) === String(selectedSkillTypeId),
    );
  }, [skillTypes, selectedSkillTypeId]);

  const ensureTerms = useCallback(
    async (sessionId: string) => {
      if (!sessionId || termsCache[sessionId]) {
        return;
      }
      try {
        const list = await listTermsBySession(sessionId);
        setTermsCache((prev) => ({
          ...prev,
          [sessionId]: list,
        }));
      } catch (err) {
        console.error("Unable to load terms", err);
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
        const list = await listClassArms(classId);
        setArmsCache((prev) => ({
          ...prev,
          [classId]: list,
        }));
      } catch (err) {
        console.error("Unable to load class arms", err);
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
        const list = await listClassArmSections(classId, armId);
        setSectionsCache((prev) => ({
          ...prev,
          [key]: list,
        }));
      } catch (err) {
        console.error("Unable to load class sections", err);
      }
    },
    [sectionsCache],
  );

  useEffect(() => {
    setLoadingFilters(true);
    let cancelled = false;

    (async () => {
      try {
        const [sessionList, classList, context] = await Promise.all([
          listSessions(),
          listClasses(),
          fetchSchoolContext(),
        ]);

        if (cancelled) {
          return;
        }

        setSessions(sessionList);
        setClasses(classList);

        const contextSessionId = context.current_session_id
          ? String(context.current_session_id)
          : "";
        const contextTermId = context.current_term_id
          ? String(context.current_term_id)
          : "";

        if (contextSessionId) {
          await ensureTerms(contextSessionId);
        }

        setFilters((prev) => ({
          ...prev,
          sessionId: prev.sessionId || contextSessionId,
          termId: prev.termId || contextTermId,
        }));

        if (isTeacher) {
          try {
            const dashboard = await fetchTeacherDashboard();
            if (!cancelled) {
              setTeacherDashboard(dashboard);
              if (!filters.classId && dashboard.assignments.length > 0) {
                const firstClassId = dashboard.assignments[0].class?.id;
                if (firstClassId) {
                  setFilters((prev) => ({
                    ...prev,
                    classId: String(firstClassId),
                  }));
                }
              }
            }
          } catch (err) {
            console.error("Unable to load teacher dashboard", err);
          }
        }
      } catch (err) {
        console.error("Unable to load sessions, classes, or school context", err);
        if (!cancelled) {
          setError("Unable to load sessions or classes. Please try again.");
        }
      } finally {
        if (!cancelled) {
          setLoadingFilters(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [ensureTerms, filters.classId, isTeacher]);

  const handleFilterChange = useCallback(
    (field: keyof FiltersState) =>
      (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        setFeedback(null);
        setError(null);
        setRatingsGrid({});
        setStudents([]);

        setFilters((prev) => {
          const next: FiltersState = { ...prev };
          if (field === "sessionId") {
            next.sessionId = value;
            next.termId = "";
          } else if (field === "classId") {
            next.classId = value;
            next.armId = "";
            next.sectionId = "";
          } else if (field === "armId") {
            next.armId = value;
            next.sectionId = "";
          } else if (field === "skillTypeId") {
            next.skillTypeId = value;
          } else {
            (next as any)[field] = value;
          }
          return next;
        });

        if (field === "sessionId" && value) {
          ensureTerms(value).catch((err) => console.error(err));
        }
        if (field === "classId" && value) {
          ensureArms(value).catch((err) => console.error(err));
        }
        if (field === "armId" && value && selectedClass) {
          ensureSections(selectedClass, value).catch((err) =>
            console.error(err),
          );
        }
      },
    [ensureArms, ensureSections, ensureTerms, selectedClass],
  );

  const handleLoadGrid = useCallback(async () => {
    setFeedback(null);
    setError(null);
    setRatingsGrid({});
    setStudents([]);

    if (!selectedSession || !selectedTerm || !selectedClass) {
      setFeedbackKind("warning");
      setFeedback(
        "Select session, term, and class before loading student skill ratings.",
      );
      return;
    }

    setLoadingGrid(true);
    try {
      const [studentResponse] = await Promise.all([
        listStudents({
          per_page: 500,
          current_session_id: selectedSession,
          current_term_id: selectedTerm,
          school_class_id: selectedClass,
          class_arm_id: selectedArm || undefined,
          class_section_id: selectedSection || undefined,
          sortBy: "first_name",
          sortDirection: "asc",
        }),
      ]);

      const studentList = studentResponse.data ?? [];

      if (!studentList.length) {
        setFeedbackKind("info");
        setFeedback(
          "No students found for the selected class and context.",
        );
        setStudents([]);
        setSkillTypes([]);
        setRatingsGrid({});
        return;
      }

      const ratingLists = await Promise.all(
        studentList.map((student) =>
          listStudentSkillRatings(student.id, {
            session_id: selectedSession,
            term_id: selectedTerm,
          }),
        ),
      );

      const nextGrid: RatingsGrid = {};

      studentList.forEach((student, index) => {
        const studentRatings = ratingLists[index] ?? [];
        const bySkill = new Map<string, StudentSkillRating>();
        studentRatings.forEach((rating) => {
          bySkill.set(String(rating.skill_type_id), rating);
        });

        const studentRow: Record<string, RatingCell> = {};
        skillTypes.forEach((type) => {
          const rating = bySkill.get(String(type.id));
          studentRow[String(type.id)] = {
            ratingId: rating ? String(rating.id) : undefined,
            value: rating ? String(rating.rating_value ?? "") : "",
          };
        });

        nextGrid[String(student.id)] = studentRow;
      });

      setStudents(studentList);
      setRatingsGrid(nextGrid);
      setFeedbackKind("info");
      setFeedback(
        "Loaded students and skill ratings. Select a skill, update the values, and click Save to apply changes.",
      );
    } catch (err) {
      console.error("Unable to load class skill ratings", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load class skill ratings. Please try again.",
      );
    } finally {
      setLoadingGrid(false);
    }
  }, [
    selectedArm,
    selectedClass,
    selectedSection,
    selectedSession,
    selectedTerm,
  ]);

  const handleRatingChange = useCallback(
    (studentId: string | number, skillTypeId: string) =>
      (event: ChangeEvent<HTMLSelectElement>) => {
        const value = event.target.value;
        setRatingsGrid((prev) => {
          const studentKey = String(studentId);
          const existingRow = prev[studentKey] ?? {};
          const existingCell = existingRow[skillTypeId] ?? { value: "" };
          return {
            ...prev,
            [studentKey]: {
              ...existingRow,
              [skillTypeId]: {
                ...existingCell,
                value,
              },
            },
          };
        });
      },
    [],
  );

  const handleSaveAll = useCallback(async () => {
    setFeedback(null);
    setError(null);

    if (!selectedSession || !selectedTerm) {
      setFeedbackKind("warning");
      setFeedback("Select session and term before saving ratings.");
      return;
    }

    if (!students.length || !visibleSkillTypes.length) {
      setFeedbackKind("info");
      setFeedback("Load students and select a skill before saving.");
      return;
    }

    const tasks: Array<Promise<unknown>> = [];

    students.forEach((student) => {
      const studentRow = ratingsGrid[String(student.id)] ?? {};
      visibleSkillTypes.forEach((type) => {
        const cell = studentRow[String(type.id)];
        const value = cell?.value?.trim() ?? "";
        if (!value) {
          return;
        }
        const ratingValue = Number(value);
        if (!Number.isFinite(ratingValue) || ratingValue < 1 || ratingValue > 5) {
          return;
        }

        if (cell.ratingId) {
          tasks.push(
            updateStudentSkillRating(student.id, cell.ratingId, {
              session_id: selectedSession,
              term_id: selectedTerm,
              skill_type_id: String(type.id),
              rating_value: ratingValue,
            }),
          );
        } else {
          tasks.push(
            createStudentSkillRating(student.id, {
              session_id: selectedSession,
              term_id: selectedTerm,
              skill_type_id: String(type.id),
              rating_value: ratingValue,
            }),
          );
        }
      });
    });

    if (!tasks.length) {
      setFeedbackKind("info");
      setFeedback("No ratings to save for the selected skill.");
      return;
    }

    setSaving(true);
    try {
      await Promise.all(tasks);
      await handleLoadGrid();
      setFeedbackKind("success");
      setFeedback("Skill ratings saved successfully for the class.");
    } catch (err) {
      console.error("Unable to save class skill ratings", err);
      setFeedbackKind("danger");
      setFeedback(
        err instanceof Error
          ? err.message
          : "Unable to save skill ratings at this time.",
      );
    } finally {
      setSaving(false);
    }
  }, [
    handleLoadGrid,
    ratingsGrid,
    selectedSession,
    selectedTerm,
    skillTypes,
    students,
  ]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Class Skill Ratings</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Class Skill Ratings</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Rate Skills by Class</h3>
              <p className="mb-0 text-muted small">
                Select a session, term, and class to rate soft skills for all students at once.
              </p>
            </div>
          </div>

          <div className="row gutters-8 mb-3">
            <div className="col-xl-3 col-lg-6 col-12 form-group">
              <label htmlFor="skill-filter-session">Session</label>
              <select
                id="skill-filter-session"
                className="form-control"
                value={selectedSession}
                onChange={handleFilterChange("sessionId")}
                disabled={loadingFilters}
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
              <label htmlFor="skill-filter-term">Term</label>
              <select
                id="skill-filter-term"
                className="form-control"
                value={selectedTerm}
                onChange={handleFilterChange("termId")}
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
              <label htmlFor="skill-filter-class">Class</label>
              <select
                id="skill-filter-class"
                className="form-control"
                value={selectedClass}
                onChange={handleFilterChange("classId")}
              >
                <option value="">Select class</option>
                {teacherClassOptions.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-xl-3 col-lg-6 col-12 form-group">
              <label htmlFor="skill-filter-arm">Class Arm</label>
              <select
                id="skill-filter-arm"
                className="form-control"
                value={selectedArm}
                onChange={handleFilterChange("armId")}
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
              <label htmlFor="skill-filter-skill">Skill</label>
              <select
                id="skill-filter-skill"
                className="form-control"
                value={selectedSkillTypeId}
                onChange={handleFilterChange("skillTypeId")}
                disabled={!skillTypes.length}
              >
                <option value="">Select skill</option>
                {skillTypes.map((type) => (
                  <option key={type.id} value={type.id}>
                    {type.category
                      ? `${type.category} – ${type.name}`
                      : type.name}
                  </option>
                ))}
              </select>
            </div>
            {/* Class Section filter intentionally hidden for now */}
            <div className="col-xl-3 col-lg-6 col-12 form-group d-flex align-items-end">
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                onClick={handleLoadGrid}
                disabled={loadingGrid || !selectedSession || !selectedTerm || !selectedClass}
              >
                {loadingGrid ? "Loading…" : "Load Students & Skills"}
              </button>
            </div>
          </div>

          {feedback ? (
            <div className={`alert alert-${feedbackKind}`} role="alert">
              {feedback}
            </div>
          ) : null}
          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}

          <div className="table-responsive class-skill-table-wrapper">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th className="sticky-col sticky-col-0">#</th>
                  <th className="sticky-col sticky-col-1">Student</th>
                  {visibleSkillTypes.map((type) => (
                    <th key={type.id} style={{ width: "120px" }}>
                      {type.category ? (
                        <>
                          <div className="text-muted small font-weight-bold">
                            {type.category}
                          </div>
                          <div className="text-muted small">{type.name}</div>
                        </>
                      ) : (
                        <div className="text-muted small">{type.name}</div>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {loadingGrid ? (
                  <tr>
                    <td colSpan={2 + visibleSkillTypes.length}>
                      Loading students and skills…
                    </td>
                  </tr>
                ) : !students.length ? (
                  <tr>
                    <td colSpan={2 + visibleSkillTypes.length}>
                      Select filters and click &ldquo;Load Students &amp; Skills&rdquo; to begin.
                    </td>
                  </tr>
                ) : (
                  students.map((student, index) => {
                    const studentRow = ratingsGrid[String(student.id)] ?? {};
                    const fullName = [student.first_name, student.middle_name, student.last_name]
                      .filter(Boolean)
                      .join(" ")
                      .trim() || "Unnamed Student";
                    return (
                      <tr key={String(student.id)}>
                        <td className="sticky-col sticky-col-0">{index + 1}</td>
                        <td className="sticky-col sticky-col-1">{fullName}</td>
                        {visibleSkillTypes.map((type) => {
                          const cell = studentRow[String(type.id)] ?? { value: "" };
                          return (
                            <td key={type.id}>
                              <select
                                className="form-control form-control-sm"
                                value={cell.value}
                                onChange={handleRatingChange(student.id, String(type.id))}
                                style={{ maxWidth: "100px" }}
                              >
                                <option value="">—</option>
                                {ratingOptions.map((option) => (
                                  <option key={option} value={option}>
                                    {option}
                                  </option>
                                ))}
                              </select>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-end mt-3">
            <button
              type="button"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              onClick={handleSaveAll}
              disabled={
                saving || !students.length || !visibleSkillTypes.length
              }
            >
              {saving ? "Saving…" : "Save All Ratings"}
            </button>
          </div>
        </div>
      </div>
      <style jsx>{`
        .class-skill-table-wrapper {
          position: relative;
          overflow-x: auto;
        }
        .class-skill-table-wrapper .sticky-col {
          position: sticky;
          background: #ffffff;
          z-index: 2;
        }
        .class-skill-table-wrapper th.sticky-col-0,
        .class-skill-table-wrapper td.sticky-col-0 {
          left: 0;
          min-width: 50px;
        }
        .class-skill-table-wrapper th.sticky-col-1,
        .class-skill-table-wrapper td.sticky-col-1 {
          left: 80px;
          min-width: 220px;
        }
        .class-skill-table-wrapper thead th.sticky-col {
          z-index: 3;
        }
        @media (max-width: 767.98px) {
          .class-skill-table-wrapper .sticky-col {
            position: static;
          }
          .class-skill-table-wrapper th.sticky-col-0,
          .class-skill-table-wrapper td.sticky-col-0,
          .class-skill-table-wrapper th.sticky-col-1,
          .class-skill-table-wrapper td.sticky-col-1 {
            left: auto;
          }
        }
      `}</style>
    </>
  );
}
