"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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
  bulkPromoteStudents,
  type PromotionResponse,
} from "@/lib/promotions";

interface Filters {
  session_id: string;
  term_id: string;
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
}

interface TargetPlacement {
  session_id: string;
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
}

const initialFilters: Filters = {
  session_id: "",
  term_id: "",
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
};

const initialTarget: TargetPlacement = {
  session_id: "",
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
};

export default function StudentPromotionPage() {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [termsCache, setTermsCache] = useState<Record<string, Term[]>>({});
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [armsCache, setArmsCache] = useState<Record<string, ClassArm[]>>({});
  const [sectionsCache, setSectionsCache] = useState<Record<string, ClassArmSection[]>>({});

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [target, setTarget] = useState<TargetPlacement>(initialTarget);
  const [retainSubjects, setRetainSubjects] = useState(false);

  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  const [loadingStudents, setLoadingStudents] = useState(false);
  const [feedback, setFeedback] = useState<{ type: "success" | "info" | "warning" | "danger"; message: string } | null>(null);
  const [promotionResult, setPromotionResult] = useState<PromotionResponse | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => console.error("Unable to load sessions", err));
    listClasses()
      .then(setClasses)
      .catch((err) => console.error("Unable to load classes", err));
  }, []);

  useEffect(() => {
    if (!filters.session_id) {
      return;
    }
    if (termsCache[filters.session_id]) {
      return;
    }
    listTermsBySession(filters.session_id)
      .then((data) =>
        setTermsCache((prev) => ({
          ...prev,
          [filters.session_id]: data,
        })),
      )
      .catch((err) => console.error("Unable to load terms", err));
  }, [filters.session_id, termsCache]);

  useEffect(() => {
    if (!filters.school_class_id) {
      return;
    }
    if (armsCache[filters.school_class_id]) {
      return;
    }
    listClassArms(filters.school_class_id)
      .then((data) =>
        setArmsCache((prev) => ({
          ...prev,
          [filters.school_class_id]: data,
        })),
      )
      .catch((err) => console.error("Unable to load class arms", err));
  }, [filters.school_class_id, armsCache]);

  useEffect(() => {
    if (!filters.school_class_id || !filters.class_arm_id) {
      return;
    }
    const key = `${filters.school_class_id}:${filters.class_arm_id}`;
    if (sectionsCache[key]) {
      return;
    }
    listClassArmSections(filters.school_class_id, filters.class_arm_id)
      .then((data) =>
        setSectionsCache((prev) => ({
          ...prev,
          [key]: data,
        })),
      )
      .catch((err) => console.error("Unable to load sections", err));
  }, [filters.school_class_id, filters.class_arm_id, sectionsCache]);

  useEffect(() => {
    if (!target.session_id || termsCache[target.session_id]) {
      return;
    }
    listTermsBySession(target.session_id)
      .then((data) =>
        setTermsCache((prev) => ({
          ...prev,
          [target.session_id]: data,
        })),
      )
      .catch((err) => console.error("Unable to load target terms", err));
  }, [target.session_id, termsCache]);

  useEffect(() => {
    if (!target.school_class_id) {
      return;
    }
    if (armsCache[target.school_class_id]) {
      return;
    }
    listClassArms(target.school_class_id)
      .then((data) =>
        setArmsCache((prev) => ({
          ...prev,
          [target.school_class_id]: data,
        })),
      )
      .catch((err) => console.error("Unable to load target arms", err));
  }, [target.school_class_id, armsCache]);

  useEffect(() => {
    if (!target.school_class_id || !target.class_arm_id) {
      return;
    }
    const key = `${target.school_class_id}:${target.class_arm_id}`;
    if (sectionsCache[key]) {
      return;
    }
    listClassArmSections(target.school_class_id, target.class_arm_id)
      .then((data) =>
        setSectionsCache((prev) => ({
          ...prev,
          [key]: data,
        })),
      )
      .catch((err) => console.error("Unable to load target sections", err));
  }, [target.school_class_id, target.class_arm_id, sectionsCache]);

  useEffect(() => {
    const load = async () => {
      if (!filters.session_id) {
        setStudents([]);
        setSelectedIds(new Set());
        return;
      }
      setLoadingStudents(true);
      try {
        const response = await listStudents({
          page: 1,
          per_page: 200,
          session_id: filters.session_id,
          term_id: filters.term_id || undefined,
          school_class_id: filters.school_class_id || undefined,
          class_arm_id: filters.class_arm_id || undefined,
          class_section_id: filters.class_section_id || undefined,
        });
        const list = response.data ?? [];
        setStudents(list);
        setSelectedIds(new Set());
      } catch (err) {
        console.error("Unable to load students", err);
        setFeedback({
          type: "danger",
          message:
            err instanceof Error ? err.message : "Unable to load students.",
        });
        setStudents([]);
        setSelectedIds(new Set());
      } finally {
        setLoadingStudents(false);
      }
    };
    load().catch((err) => console.error(err));
  }, [filters]);

  const termsForFilter = useMemo(() => {
    if (!filters.session_id) {
      return [];
    }
    return termsCache[filters.session_id] ?? [];
  }, [filters.session_id, termsCache]);

  const armsForFilter = useMemo(() => {
    if (!filters.school_class_id) {
      return [];
    }
    return armsCache[filters.school_class_id] ?? [];
  }, [filters.school_class_id, armsCache]);

  const sectionsForFilter = useMemo(() => {
    if (!filters.school_class_id || !filters.class_arm_id) {
      return [];
    }
    const key = `${filters.school_class_id}:${filters.class_arm_id}`;
    return sectionsCache[key] ?? [];
  }, [filters.school_class_id, filters.class_arm_id, sectionsCache]);

  const targetArms = useMemo(() => {
    if (!target.school_class_id) {
      return [];
    }
    return armsCache[target.school_class_id] ?? [];
  }, [target.school_class_id, armsCache]);

  const targetSections = useMemo(() => {
    if (!target.school_class_id || !target.class_arm_id) {
      return [];
    }
    const key = `${target.school_class_id}:${target.class_arm_id}`;
    return sectionsCache[key] ?? [];
  }, [target.school_class_id, target.class_arm_id, sectionsCache]);

  const toggleStudentSelection = (studentId: number, checked: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(studentId);
      } else {
        next.delete(studentId);
      }
      return next;
    });
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedIds(new Set(students.map((student) => student.id)));
    } else {
      setSelectedIds(new Set());
    }
  };

  const handlePromotion = async () => {
    setPromotionResult(null);
    setFeedback(null);

    if (selectedIds.size === 0) {
      setFeedback({
        type: "warning",
        message: "Select at least one student to promote.",
      });
      return;
    }

    if (!target.session_id || !target.school_class_id || !target.class_arm_id) {
      setFeedback({
        type: "warning",
        message: "Select the target session, class, and class arm.",
      });
      return;
    }

    try {
      setSubmitting(true);
      const response = await bulkPromoteStudents({
        target_session_id: target.session_id,
        target_school_class_id: target.school_class_id,
        target_class_arm_id: target.class_arm_id,
        target_class_section_id: target.class_section_id || null,
        retain_subjects: retainSubjects,
        student_ids: Array.from(selectedIds),
      });
      setPromotionResult(response);
      setFeedback({
        type: "success",
        message: response.message ?? "Promotion completed successfully.",
      });
      await listStudents({
        page: 1,
        per_page: 200,
        session_id: filters.session_id,
        term_id: filters.term_id || undefined,
        school_class_id: filters.school_class_id || undefined,
        class_arm_id: filters.class_arm_id || undefined,
        class_section_id: filters.class_section_id || undefined,
      }).then((res) => {
        setStudents(res.data ?? []);
        setSelectedIds(new Set());
      });
    } catch (err) {
      console.error("Promotion error", err);
      setFeedback({
        type: "danger",
        message:
          err instanceof Error ? err.message : "Promotion failed. Please try again.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const selectedStudents = useMemo(() => {
    if (selectedIds.size === 0) {
      return [];
    }
    return students.filter((student) => selectedIds.has(student.id));
  }, [students, selectedIds]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Student Promotion</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Student Promotion</li>
        </ul>
      </div>

      <div className="row">
        <div className="col-lg-5">
          <div className="card height-auto">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Promotion Filters</h3>
                </div>
              </div>

              <div className="row gutters-8">
                <div className="col-md-6 col-12 form-group">
                  <label htmlFor="promotion-session">Source Session *</label>
                  <select
                    id="promotion-session"
                    className="form-control"
                    value={filters.session_id}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        session_id: event.target.value,
                        term_id: "",
                      }))
                    }
                    required
                  >
                    <option value="">Select session</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 col-12 form-group">
                  <label htmlFor="promotion-term">Term</label>
                  <select
                    id="promotion-term"
                    className="form-control"
                    value={filters.term_id}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        term_id: event.target.value,
                      }))
                    }
                    disabled={!filters.session_id}
                  >
                    <option value="">All terms</option>
                    {termsForFilter.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 col-12 form-group">
                  <label htmlFor="promotion-class">Class</label>
                  <select
                    id="promotion-class"
                    className="form-control"
                    value={filters.school_class_id}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        school_class_id: event.target.value,
                        class_arm_id: "",
                        class_section_id: "",
                      }))
                    }
                  >
                    <option value="">All classes</option>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 col-12 form-group">
                  <label htmlFor="promotion-class-arm">Class Arm</label>
                  <select
                    id="promotion-class-arm"
                    className="form-control"
                    value={filters.class_arm_id}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        class_arm_id: event.target.value,
                        class_section_id: "",
                      }))
                    }
                    disabled={!filters.school_class_id || armsForFilter.length === 0}
                  >
                    <option value="">All arms</option>
                    {armsForFilter.map((arm) => (
                      <option key={arm.id} value={arm.id}>
                        {arm.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/*
                  Class section filter hidden per request
                  <div className="col-md-6 col-12 form-group">
                    <label htmlFor="promotion-section">Class Section</label>
                    <select
                      id="promotion-section"
                      className="form-control"
                      value={filters.class_section_id}
                      onChange={(event) =>
                        setFilters((prev) => ({
                          ...prev,
                          class_section_id: event.target.value,
                        }))
                      }
                      disabled={!filters.class_arm_id || sectionsForFilter.length === 0}
                    >
                      <option value="">All sections</option>
                      {sectionsForFilter.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>
                */}
              </div>

              <div className="mt-3">
                <h5 className="mb-3">Promotion Target</h5>
                <div className="row gutters-8">
                  <div className="col-md-6 col-12 form-group">
                    <label htmlFor="target-session">Target Session *</label>
                    <select
                      id="target-session"
                      className="form-control"
                      value={target.session_id}
                      onChange={(event) =>
                        setTarget((prev) => ({
                          ...prev,
                          session_id: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select session</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6 col-12 form-group">
                    <label htmlFor="target-class">Target Class *</label>
                    <select
                      id="target-class"
                      className="form-control"
                      value={target.school_class_id}
                      onChange={(event) =>
                        setTarget((prev) => ({
                          ...prev,
                          school_class_id: event.target.value,
                          class_arm_id: "",
                          class_section_id: "",
                        }))
                      }
                      required
                    >
                      <option value="">Select class</option>
                      {classes.map((schoolClass) => (
                        <option key={schoolClass.id} value={schoolClass.id}>
                          {schoolClass.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-md-6 col-12 form-group">
                    <label htmlFor="target-arm">Target Arm *</label>
                    <select
                      id="target-arm"
                      className="form-control"
                      value={target.class_arm_id}
                      onChange={(event) =>
                        setTarget((prev) => ({
                          ...prev,
                          class_arm_id: event.target.value,
                          class_section_id: "",
                        }))
                      }
                      disabled={!target.school_class_id || targetArms.length === 0}
                      required
                    >
                      <option value="">Select class arm</option>
                      {targetArms.map((arm) => (
                        <option key={arm.id} value={arm.id}>
                          {arm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/*
                    Target class section selection hidden per request
                    <div className="col-md-6 col-12 form-group">
                      <label htmlFor="target-section">Target Section</label>
                      <select
                        id="target-section"
                        className="form-control"
                        value={target.class_section_id}
                        onChange={(event) =>
                          setTarget((prev) => ({
                            ...prev,
                            class_section_id: event.target.value,
                          }))
                        }
                        disabled={!target.class_arm_id || targetSections.length === 0}
                      >
                        <option value="">All sections</option>
                        {targetSections.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  */}
                  <div className="col-12 form-group">
                    <div className="form-check">
                      <input
                        id="retain-subjects"
                        type="checkbox"
                        className="form-check-input"
                        checked={retainSubjects}
                        onChange={(event) => setRetainSubjects(event.target.checked)}
                      />
                      <label className="form-check-label" htmlFor="retain-subjects">
                        Retain subject allocations during promotion
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card height-auto">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Eligible Students</h3>
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
                      <th>
                        <input
                          type="checkbox"
                          onChange={(event) => handleSelectAll(event.target.checked)}
                          checked={selectedIds.size > 0 && selectedIds.size === students.length}
                          aria-label="Select all students"
                        />
                      </th>
                      <th>Name</th>
                      <th>Admission No</th>
                      <th>Class</th>
                      <th>Session</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingStudents ? (
                      <tr>
                        <td colSpan={5} className="text-center">
                          Loading students…
                        </td>
                      </tr>
                    ) : students.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center">
                          No students found for the selected filters.
                        </td>
                      </tr>
                    ) : (
                      students.map((student) => {
                        const fullName = [
                          student.first_name,
                          student.middle_name,
                          student.last_name,
                        ]
                          .filter(Boolean)
                          .join(" ");
                        return (
                          <tr key={student.id}>
                            <td>
                              <input
                                type="checkbox"
                                checked={selectedIds.has(student.id)}
                                onChange={(event) =>
                                  toggleStudentSelection(student.id, event.target.checked)
                                }
                              />
                            </td>
                            <td>{fullName || "Student"}</td>
                            <td>{student.admission_no ?? ""}</td>
                            <td>
                              {student.school_class?.name ?? ""}
                              {student.class_arm?.name
                                ? ` - ${student.class_arm.name}`
                                : ""}
                            </td>
                            <td>{student.session?.name ?? ""}</td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-3">
                <p className="font-weight-bold">
                  Selected students: {selectedIds.size}
                </p>
                {promotionResult ? (
                  <div className="alert alert-info" role="alert">
                    Promoted: {promotionResult.promoted ?? 0}, Skipped: {promotionResult.skipped ?? 0}
                  </div>
                ) : null}
                {selectedStudents.length > 0 ? (
                  <div className="card">
                    <div className="card-body">
                      <h5 className="card-title">Promotion Preview</h5>
                      <ul className="mb-2">
                        {selectedStudents.slice(0, 5).map((student) => {
                          const name = [
                            student.first_name,
                            student.middle_name,
                            student.last_name,
                          ]
                            .filter(Boolean)
                            .join(" ");
                          return <li key={student.id}>{name || `Student #${student.id}`}</li>;
                        })}
                      </ul>
                      {selectedStudents.length > 5 ? (
                        <p className="text-muted">
                          … plus {selectedStudents.length - 5} more student(s)
                        </p>
                      ) : null}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="mt-3 d-flex justify-content-between">
                <button
                  type="button"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  onClick={handlePromotion}
                  disabled={submitting}
                >
                  {submitting ? "Processing…" : "Promote Selected"}
                </button>
                <button
                  type="button"
                  className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                  onClick={() => {
                    setFilters(initialFilters);
                    setTarget(initialTarget);
                    setSelectedIds(new Set());
                  }}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
