"use client";

import Link from "next/link";
import { FormEvent, startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { listStaffForDropdown, type Staff } from "@/lib/staff";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import {
  listClassArmSections,
  type ClassArmSection,
} from "@/lib/classArmSections";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import {
  createClassTeacherAssignment,
  deleteClassTeacherAssignment,
  listClassTeacherAssignments,
  updateClassTeacherAssignment,
  type ClassTeacherAssignment,
  type ClassTeacherAssignmentListResponse,
} from "@/lib/classTeacherAssignments";

interface AssignmentForm {
  staff_id: string;
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
  session_id: string;
  term_id: string;
}

const initialForm: AssignmentForm = {
  staff_id: "",
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
  session_id: "",
  term_id: "",
};

interface AssignmentFilters {
  search: string;
  staff_id: string;
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
  session_id: string;
}

const initialFilters: AssignmentFilters = {
  search: "",
  staff_id: "",
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
  session_id: "",
};

type ArmsCache = Record<string, ClassArm[]>;
type SectionsCache = Record<string, ClassArmSection[]>;
type TermsCache = Record<string, Term[]>;

export default function AssignClassTeachersPage() {
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [armsCache, setArmsCache] = useState<ArmsCache>({});
  const [sectionsCache, setSectionsCache] = useState<SectionsCache>({});
  const [termsCache, setTermsCache] = useState<TermsCache>({});

  const [form, setForm] = useState<AssignmentForm>(initialForm);
  const [filters, setFilters] = useState<AssignmentFilters>(initialFilters);
  const [editingId, setEditingId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const perPage = 10;

  const [data, setData] =
    useState<ClassTeacherAssignmentListResponse | null>(null);
  const [assignments, setAssignments] = useState<ClassTeacherAssignment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listStaffForDropdown()
      .then(setTeachers)
      .catch((err) => console.error("Unable to load teachers", err));
    listClasses()
      .then(setClasses)
      .catch((err) => console.error("Unable to load classes", err));
    listSessions()
      .then(setSessions)
      .catch((err) => console.error("Unable to load sessions", err));
  }, []);

  const ensureArms = useCallback(
    async (classId: string) => {
      if (!classId || armsCache[classId]) {
        return;
      }
      try {
        const data = await listClassArms(classId);
        setArmsCache((prev) => ({
          ...prev,
          [classId]: data,
        }));
      } catch (error) {
        console.error("Unable to load class arms", error);
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
        const data = await listClassArmSections(classId, armId);
        setSectionsCache((prev) => ({
          ...prev,
          [key]: data,
        }));
      } catch (error) {
        console.error("Unable to load sections", error);
      }
    },
    [sectionsCache],
  );

  const ensureTerms = useCallback(
    async (sessionId: string): Promise<Term[]> => {
      if (!sessionId) {
        return [];
      }
      if (termsCache[sessionId]) {
        return termsCache[sessionId] ?? [];
      }
      try {
        const data = await listTermsBySession(sessionId);
        setTermsCache((prev) => ({
          ...prev,
          [sessionId]: data,
        }));
        return data;
      } catch (error) {
        console.error("Unable to load terms", error);
        return [];
      }
    },
    [termsCache],
  );

  useEffect(() => {
    if (form.school_class_id) {
      ensureArms(form.school_class_id).catch((err) => console.error(err));
    }
  }, [form.school_class_id, ensureArms]);

  useEffect(() => {
    if (form.school_class_id && form.class_arm_id) {
      ensureSections(form.school_class_id, form.class_arm_id).catch((err) =>
        console.error(err),
      );
    }
  }, [form.school_class_id, form.class_arm_id, ensureSections]);

  useEffect(() => {
    if (filters.school_class_id) {
      ensureArms(filters.school_class_id).catch((err) => console.error(err));
    }
  }, [filters.school_class_id, ensureArms]);

  useEffect(() => {
    if (filters.school_class_id && filters.class_arm_id) {
      ensureSections(filters.school_class_id, filters.class_arm_id).catch(
        (err) => console.error(err),
      );
    }
  }, [filters.school_class_id, filters.class_arm_id, ensureSections]);

  useEffect(() => {
    if (form.session_id) {
      ensureTerms(form.session_id).catch((err) => console.error(err));
    }
  }, [form.session_id, ensureTerms]);

  useEffect(() => {
    if (!form.session_id || form.term_id) {
      return;
    }
    const terms = termsCache[form.session_id];
    if (terms && terms.length > 0) {
      setForm((prev) => ({
        ...prev,
        term_id: `${terms[0].id}`,
      }));
    }
  }, [form.session_id, form.term_id, termsCache]);

  const armsForForm = useMemo(() => {
    if (!form.school_class_id) {
      return [];
    }
    return armsCache[form.school_class_id] ?? [];
  }, [armsCache, form.school_class_id]);

  const sectionsForForm = useMemo(() => {
    if (!form.school_class_id || !form.class_arm_id) {
      return [];
    }
    const key = `${form.school_class_id}:${form.class_arm_id}`;
    return sectionsCache[key] ?? [];
  }, [sectionsCache, form.school_class_id, form.class_arm_id]);

  const armsForFilter = useMemo(() => {
    if (!filters.school_class_id) {
      return [];
    }
    return armsCache[filters.school_class_id] ?? [];
  }, [armsCache, filters.school_class_id]);

  const sectionsForFilter = useMemo(() => {
    if (!filters.school_class_id || !filters.class_arm_id) {
      return [];
    }
    const key = `${filters.school_class_id}:${filters.class_arm_id}`;
    return sectionsCache[key] ?? [];
  }, [sectionsCache, filters.school_class_id, filters.class_arm_id]);

  const termsForForm = useMemo(() => {
    if (!form.session_id) {
      return [];
    }
    return termsCache[form.session_id] ?? [];
  }, [termsCache, form.session_id]);

  const fetchAssignments = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await listClassTeacherAssignments({
        page,
        per_page: perPage,
        search: filters.search || undefined,
        staff_id: filters.staff_id || undefined,
        school_class_id: filters.school_class_id || undefined,
        class_arm_id: filters.class_arm_id || undefined,
        class_section_id: filters.class_section_id || undefined,
        session_id: filters.session_id || undefined,
      });
      setData(response);
      setAssignments(response.data ?? []);
      setListError(null);
    } catch (err) {
      console.error("Unable to load class teachers", err);
      setListError(
        err instanceof Error ? err.message : "Unable to load assignments.",
      );
      setData(null);
      setAssignments([]);
    } finally {
      setLoadingList(false);
    }
  }, [filters, page, perPage]);

  useEffect(() => {
    fetchAssignments().catch((err) => console.error(err));
  }, [fetchAssignments]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (
      !form.staff_id ||
      !form.school_class_id ||
      !form.session_id
    ) {
      setFormError("Please complete all required fields.");
      return;
    }

    const resolvedTerms =
      termsForForm.length > 0 ? termsForForm : await ensureTerms(form.session_id);
    const derivedTermId =
      form.term_id || (resolvedTerms.length > 0 ? `${resolvedTerms[0].id}` : "");

    if (!derivedTermId) {
      setFormError("No terms found for the selected session. Please add a term.");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        staff_id: form.staff_id,
        school_class_id: form.school_class_id,
        class_arm_id: form.class_arm_id || null,
        class_section_id: form.class_section_id || null,
        session_id: form.session_id,
        term_id: derivedTermId,
      };

      if (editingId) {
        await updateClassTeacherAssignment(editingId, payload);
      } else {
        await createClassTeacherAssignment(payload);
      }

      setEditingId(null);
      setForm(initialForm);
      setPage(1);
      await fetchAssignments();
    } catch (err) {
      console.error("Unable to save assignment", err);
      setFormError(
        err instanceof Error ? err.message : "Unable to save assignment.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (assignment: ClassTeacherAssignment) => {
    setEditingId(assignment.id);
    setFormError(null);

    const classId = assignment.school_class_id
      ? `${assignment.school_class_id}`
      : "";
    const armId = assignment.class_arm_id ? `${assignment.class_arm_id}` : "";
    const sectionId = assignment.class_section_id
      ? `${assignment.class_section_id}`
      : "";
    const sessionId = `${assignment.session_id}`;
    const termId = `${assignment.term_id}`;

    await ensureArms(classId);
    if (classId && armId) {
      await ensureSections(classId, armId);
    }
    await ensureTerms(sessionId);

    startTransition(() => {
      setForm({
        staff_id: `${assignment.staff_id}`,
        school_class_id: classId,
        class_arm_id: armId,
        class_section_id: sectionId,
        session_id: sessionId,
        term_id: termId,
      });
    });
  };

  const handleDelete = async (assignment: ClassTeacherAssignment) => {
    if (
      !window.confirm(
        `Remove class teacher assignment for "${assignment.staff?.full_name ?? assignment.staff?.user?.name ?? "Teacher"}"?`,
      )
    ) {
      return;
    }
    try {
      await deleteClassTeacherAssignment(assignment.id);
      if (assignments.length === 1 && page > 1) {
        setPage((prev) => Math.max(1, prev - 1));
      }
      await fetchAssignments();
    } catch (err) {
      console.error("Unable to delete assignment", err);
      alert(
        err instanceof Error ? err.message : "Unable to delete assignment.",
      );
    }
  };

  const totalPages = data?.last_page ?? 1;

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Class Teacher Assignments</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Assign Class Teachers</li>
        </ul>
      </div>

      <div className="row">
        <div className="col-lg-5">
          <div className="card height-auto">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>{editingId ? "Edit Assignment" : "Assign Teacher"}</h3>
                </div>
              </div>

              {formError ? (
                <div className="alert alert-danger" role="alert">
                  {formError}
                </div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-12 form-group">
                    <label htmlFor="class-teacher-staff">Teacher *</label>
                    <select
                      id="class-teacher-staff"
                      className="form-control"
                      value={form.staff_id}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          staff_id: event.target.value,
                        }))
                      }
                      required
                    >
                      <option value="">Select teacher</option>
                      {teachers.map((teacher) => (
                        <option key={teacher.id} value={teacher.id}>
                          {teacher.full_name ??
                            teacher.user?.name ??
                            teacher.email ??
                            `Staff #${teacher.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 form-group">
                    <label htmlFor="class-teacher-class">Class *</label>
                    <select
                      id="class-teacher-class"
                      className="form-control"
                      value={form.school_class_id}
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((prev) => ({
                          ...prev,
                          school_class_id: value,
                          class_arm_id: "",
                          class_section_id: "",
                        }));
                      }}
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
                  <div className="col-12 form-group">
                    <label htmlFor="class-teacher-arm">Class Arm</label>
                    <select
                      id="class-teacher-arm"
                      className="form-control"
                      value={form.class_arm_id}
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((prev) => ({
                          ...prev,
                          class_arm_id: value,
                          class_section_id: "",
                        }));
                      }}
                      disabled={!form.school_class_id}
                    >
                      <option value="">Select class arm (optional)</option>
                      {armsForForm.map((arm) => (
                        <option key={arm.id} value={arm.id}>
                          {arm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/*
                    Class section selection hidden per request
                    <div className="col-12 form-group">
                      <label htmlFor="class-teacher-section">Class Section</label>
                      <select
                        id="class-teacher-section"
                        className="form-control"
                        value={form.class_section_id}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            class_section_id: event.target.value,
                          }))
                        }
                        disabled={!form.class_arm_id || sectionsForForm.length === 0}
                      >
                        <option value="">All sections</option>
                        {sectionsForForm.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  */}
                  <div className="col-12 form-group">
                    <label htmlFor="class-teacher-session">Session *</label>
                    <select
                      id="class-teacher-session"
                      className="form-control"
                      value={form.session_id}
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((prev) => ({
                          ...prev,
                          session_id: value,
                          term_id: "",
                        }));
                      }}
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
                  <div className="col-12 form-group d-flex justify-content-between">
                    <button
                      type="submit"
                      className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                      disabled={submitting}
                    >
                      {submitting
                        ? "Saving…"
                        : editingId
                        ? "Update Assignment"
                        : "Assign Teacher"}
                    </button>
                    <button
                      type="button"
                      className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                      onClick={() => {
                        setEditingId(null);
                        setForm(initialForm);
                      }}
                    >
                      Reset
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </div>

        <div className="col-lg-7">
          <div className="card height-auto">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Assignments</h3>
                </div>
              </div>

              <div className="row gutters-8 align-items-end mb-3">
                <div className="col-md-4 col-12 form-group">
                  <label htmlFor="class-teacher-filter-search">Search</label>
                  <input
                    id="class-teacher-filter-search"
                    type="text"
                    className="form-control"
                    placeholder="Teacher or class"
                    value={filters.search}
                    onChange={(event) =>
                      setFilters((prev) => ({
                        ...prev,
                        search: event.target.value,
                      }))
                    }
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        setPage(1);
                        fetchAssignments().catch(() => undefined);
                      }
                    }}
                  />
                </div>
                <div className="col-md-4 col-12 form-group">
                  <label htmlFor="class-teacher-filter-teacher">Teacher</label>
                  <select
                    id="class-teacher-filter-teacher"
                    className="form-control"
                    value={filters.staff_id}
                    onChange={(event) => {
                      setFilters((prev) => ({
                        ...prev,
                        staff_id: event.target.value,
                      }));
                      setPage(1);
                    }}
                  >
                    <option value="">All teachers</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.full_name ??
                          teacher.user?.name ??
                          teacher.email ??
                          `Staff #${teacher.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4 col-12 form-group">
                  <label htmlFor="class-teacher-filter-class">Class</label>
                  <select
                    id="class-teacher-filter-class"
                    className="form-control"
                    value={filters.school_class_id}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilters((prev) => ({
                        ...prev,
                        school_class_id: value,
                        class_arm_id: "",
                        class_section_id: "",
                      }));
                      setPage(1);
                    }}
                  >
                    <option value="">All classes</option>
                    {classes.map((schoolClass) => (
                      <option key={schoolClass.id} value={schoolClass.id}>
                        {schoolClass.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3 col-12 form-group">
                  <label htmlFor="class-teacher-filter-arm">Class Arm</label>
                  <select
                    id="class-teacher-filter-arm"
                    className="form-control"
                    value={filters.class_arm_id}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilters((prev) => ({
                        ...prev,
                        class_arm_id: value,
                        class_section_id: "",
                      }));
                      setPage(1);
                    }}
                    disabled={!filters.school_class_id || armsForFilter.length === 0}
                  >
                    <option value="">None</option>
                    {armsForFilter.map((arm) => (
                      <option key={arm.id} value={arm.id}>
                        {arm.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/*
                  Class section filter hidden per request
                  <div className="col-md-3 col-12 form-group">
                    <label htmlFor="class-teacher-filter-section">Section</label>
                    <select
                      id="class-teacher-filter-section"
                      className="form-control"
                      value={filters.class_section_id}
                      onChange={(event) => {
                        setFilters((prev) => ({
                          ...prev,
                          class_section_id: event.target.value,
                        }));
                        setPage(1);
                      }}
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
                <div className="col-md-3 col-12 form-group">
                  <label htmlFor="class-teacher-filter-session">Session</label>
                  <select
                    id="class-teacher-filter-session"
                    className="form-control"
                    value={filters.session_id}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilters((prev) => ({
                        ...prev,
                        session_id: value,
                      }));
                      setPage(1);
                    }}
                  >
                    <option value="">All sessions</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-12 d-flex justify-content-end mt-2">
                  <button
                    className="btn btn-outline-secondary mr-2"
                    type="button"
                    onClick={() => {
                      setFilters(initialFilters);
                      setPage(1);
                      fetchAssignments().catch(() => undefined);
                    }}
                  >
                    Reset Filters
                  </button>
                  <button
                    className="btn btn-gradient-yellow"
                    type="button"
                    onClick={() => {
                      setPage(1);
                      fetchAssignments().catch(() => undefined);
                    }}
                  >
                    Apply
                  </button>
                </div>
              </div>

              {listError ? (
                <div className="alert alert-danger" role="alert">
                  {listError}
                </div>
              ) : null}

              <div className="table-responsive">
                <table className="table display text-nowrap">
                  <thead>
                    <tr>
                      <th>Teacher</th>
                      <th>Class</th>
                      <th>Arm</th>
                      {/* <th>Section</th> */}
                      <th>Session</th>
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {loadingList ? (
                      <tr>
                        <td colSpan={7} className="text-center">
                          Loading assignments…
                        </td>
                      </tr>
                    ) : assignments.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="text-center">
                          No assignments found.
                        </td>
                      </tr>
                    ) : (
                      assignments.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>
                            {assignment.staff?.full_name ??
                              assignment.staff?.user?.name ??
                              "N/A"}
                          </td>
                          <td>{assignment.school_class?.name ?? "N/A"}</td>
                          <td>{assignment.class_arm?.name ?? "N/A"}</td>
                          {/* <td>{assignment.class_section?.name ?? "All"}</td> */}
                          <td>{assignment.session?.name ?? "N/A"}</td>
                          <td>{assignment.term?.name ?? "N/A"}</td>
                          <td>
                            {assignment.updated_at
                              ? new Date(
                                  assignment.updated_at,
                                ).toLocaleString()
                              : "—"}
                          </td>
                          <td>
                            <div className="d-flex gap-2">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary mr-2"
                                onClick={() => handleEdit(assignment)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(assignment)}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
                <div className="text-muted mb-2">
                  {data && data.total
                    ? `Showing ${data.from ?? 0}-${data.to ?? 0} of ${data.total} assignments`
                    : ""}
                </div>
                <nav className="mb-2">
                  <ul className="pagination pagination-sm mb-0">
                    <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
                      <button
                        type="button"
                        className="page-link"
                        onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                        disabled={page <= 1}
                      >
                        «
                      </button>
                    </li>
                    {Array.from({ length: totalPages }).map((_, index) => {
                      const pageNumber = index + 1;
                      return (
                        <li
                          key={pageNumber}
                          className={`page-item ${pageNumber === page ? "active" : ""}`}
                        >
                          <button
                            type="button"
                            className="page-link"
                            onClick={() => setPage(pageNumber)}
                          >
                            {pageNumber}
                          </button>
                        </li>
                      );
                    })}
                    <li
                      className={`page-item ${page >= totalPages ? "disabled" : ""}`}
                    >
                      <button
                        type="button"
                        className="page-link"
                        onClick={() =>
                          setPage((prev) => Math.min(totalPages, prev + 1))
                        }
                        disabled={page >= totalPages}
                      >
                        »
                      </button>
                    </li>
                  </ul>
                </nav>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
