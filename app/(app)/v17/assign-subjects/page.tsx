"use client";

import Link from "next/link";
import { FormEvent, startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { listAllSubjects, type Subject } from "@/lib/subjects";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import {
  listClassArmSections,
  type ClassArmSection,
} from "@/lib/classArmSections";
import {
  createSubjectAssignment,
  deleteSubjectAssignment,
  listSubjectAssignments,
  updateSubjectAssignment,
  type SubjectAssignment,
  type SubjectAssignmentListResponse,
} from "@/lib/subjectAssignments";

interface AssignmentForm {
  subjectIds: string[];
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
}

const initialForm: AssignmentForm = {
  subjectIds: [],
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
};

interface AssignmentFilters {
  search: string;
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
}

const initialFilters: AssignmentFilters = {
  search: "",
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
};

type ArmsCache = Record<string, ClassArm[]>;
type SectionsCache = Record<string, ClassArmSection[]>;
type FeedbackKind = "success" | "danger" | "warning";

interface FormFeedbackState {
  type: FeedbackKind;
  message: string;
}

export default function AssignSubjectsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [armsCache, setArmsCache] = useState<ArmsCache>({});
  const [sectionsCache, setSectionsCache] = useState<SectionsCache>({});

  const [form, setForm] = useState<AssignmentForm>(initialForm);
  const [filters, setFilters] = useState<AssignmentFilters>(initialFilters);

  const [editingId, setEditingId] = useState<number | null>(null);

  const [page, setPage] = useState(1);
  const perPage = 10;

  const [listData, setListData] = useState<SubjectAssignmentListResponse | null>(null);
  const [assignments, setAssignments] = useState<SubjectAssignment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FormFeedbackState | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const subjectOptions = useMemo(
    () =>
      subjects.map((subject) => ({
        value: `${subject.id}`,
        label: subject.code
          ? `${subject.name} (${subject.code})`
          : subject.name,
      })),
    [subjects],
  );

  const subjectLabelMap = useMemo(() => {
    const map = new Map<string, string>();
    subjectOptions.forEach((option) => {
      map.set(option.value, option.label);
    });
    return map;
  }, [subjectOptions]);

  const selectedSubjectSet = useMemo(
    () => new Set(form.subjectIds),
    [form.subjectIds],
  );

  const handleSubjectToggle = useCallback(
    (subjectId: string, checked: boolean) => {
      setForm((prev) => {
        let nextIds: string[];
        if (checked) {
          if (editingId) {
            nextIds = [subjectId];
          } else {
            const ids = new Set(prev.subjectIds);
            ids.add(subjectId);
            nextIds = Array.from(ids);
          }
        } else {
          nextIds = prev.subjectIds.filter((id) => id !== subjectId);
        }
        return {
          ...prev,
          subjectIds: nextIds,
        };
      });
    },
    [editingId],
  );

  const classOptions = useMemo(
    () =>
      classes.map((schoolClass) => ({
        value: `${schoolClass.id}`,
        label: schoolClass.name,
      })),
    [classes],
  );

  const ensureArmsLoaded = useCallback(
    async (classId: string | number) => {
      const key = `${classId}`;
      if (!key || armsCache[key]) {
        return;
      }
      try {
        const data = await listClassArms(classId);
        setArmsCache((prev) => ({
          ...prev,
          [key]: data,
        }));
      } catch (error) {
        console.error("Unable to load class arms", error);
      }
    },
    [armsCache],
  );

  const ensureSectionsLoaded = useCallback(
    async (classId: string | number, armId: string | number) => {
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
        console.error("Unable to load class sections", error);
      }
    },
    [sectionsCache],
  );

  const armsForClass = useMemo(() => {
    if (!form.school_class_id) {
      return [];
    }
    return armsCache[form.school_class_id] ?? [];
  }, [armsCache, form.school_class_id]);

  const sectionsForSelection = useMemo(() => {
    if (!form.school_class_id || !form.class_arm_id) {
      return [];
    }
    const key = `${form.school_class_id}:${form.class_arm_id}`;
    return sectionsCache[key] ?? [];
  }, [sectionsCache, form.school_class_id, form.class_arm_id]);

  const filterArms = useMemo(() => {
    if (!filters.school_class_id) {
      return [];
    }
    return armsCache[filters.school_class_id] ?? [];
  }, [armsCache, filters.school_class_id]);

  const filterSections = useMemo(() => {
    if (!filters.school_class_id || !filters.class_arm_id) {
      return [];
    }
    const key = `${filters.school_class_id}:${filters.class_arm_id}`;
    return sectionsCache[key] ?? [];
  }, [sectionsCache, filters.school_class_id, filters.class_arm_id]);

  useEffect(() => {
    listAllSubjects()
      .then(setSubjects)
      .catch((err) => console.error("Unable to load subjects", err));
    listClasses()
      .then(setClasses)
      .catch((err) => console.error("Unable to load classes", err));
  }, []);

  useEffect(() => {
    if (form.school_class_id) {
      ensureArmsLoaded(form.school_class_id).catch((err) =>
        console.error(err),
      );
    }
  }, [form.school_class_id, ensureArmsLoaded]);

  useEffect(() => {
    if (form.school_class_id && form.class_arm_id) {
      ensureSectionsLoaded(form.school_class_id, form.class_arm_id).catch(
        (err) => console.error(err),
      );
    }
  }, [form.school_class_id, form.class_arm_id, ensureSectionsLoaded]);

  useEffect(() => {
    if (filters.school_class_id) {
      ensureArmsLoaded(filters.school_class_id).catch((err) =>
        console.error(err),
      );
    }
  }, [filters.school_class_id, ensureArmsLoaded]);

  useEffect(() => {
    if (filters.school_class_id && filters.class_arm_id) {
      ensureSectionsLoaded(filters.school_class_id, filters.class_arm_id).catch(
        (err) => console.error(err),
      );
    }
  }, [filters.school_class_id, filters.class_arm_id, ensureSectionsLoaded]);

  const fetchAssignments = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await listSubjectAssignments({
        page,
        per_page: perPage,
        search: filters.search || undefined,
        school_class_id: filters.school_class_id || undefined,
        class_arm_id: filters.class_arm_id || undefined,
        class_section_id: filters.class_section_id || undefined,
      });
      setListData(response);
      setAssignments(response.data ?? []);
      setListError(null);
    } catch (err) {
      console.error("Unable to load subject assignments", err);
      setListError(
        err instanceof Error ? err.message : "Unable to load assignments.",
      );
      setListData(null);
      setAssignments([]);
    } finally {
      setLoadingList(false);
    }
  }, [filters, page, perPage]);

  useEffect(() => {
    fetchAssignments().catch((err) => console.error(err));
  }, [fetchAssignments]);

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormFeedback(null);

    if (!form.school_class_id) {
      setFormFeedback({
        type: "danger",
        message: "Class is required.",
      });
      return;
    }

    if (!form.subjectIds.length) {
      setFormFeedback({
        type: "warning",
        message: "Select at least one subject to assign.",
      });
      return;
    }

    if (editingId && form.subjectIds.length !== 1) {
      setFormFeedback({
        type: "warning",
        message: "Select exactly one subject when updating an assignment.",
      });
      return;
    }

    setSubmitting(true);
    try {
      if (editingId) {
        const subjectId = form.subjectIds[0];
        await updateSubjectAssignment(editingId, {
          subject_id: subjectId,
          school_class_id: form.school_class_id,
          class_arm_id: form.class_arm_id || null,
          class_section_id: form.class_section_id || null,
        });
        setFormFeedback({
          type: "success",
          message: "Subject assignment updated successfully.",
        });
        setEditingId(null);
        setForm({
          ...initialForm,
          subjectIds: [],
        });
        setPage(1);
        await fetchAssignments();
        return;
      }

      const successIds: string[] = [];
      const failures: Array<{ id: string; message: string }> = [];

      for (const subjectId of form.subjectIds) {
        try {
          await createSubjectAssignment({
            subject_id: subjectId,
            school_class_id: form.school_class_id,
            class_arm_id: form.class_arm_id || null,
            class_section_id: form.class_section_id || null,
          });
          successIds.push(subjectId);
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : "Unable to save assignment.";
          failures.push({ id: subjectId, message });
        }
      }

      if (successIds.length) {
        setEditingId(null);
        setForm({
          ...initialForm,
          subjectIds: [],
        });
        setPage(1);
        await fetchAssignments();
      }

      if (failures.length) {
        const uniqueMessages = Array.from(
          new Set(
            failures.map(({ id, message }) => {
              const label = subjectLabelMap.get(id) ?? "Selected subject";
              return `${label}: ${message}`;
            }),
          ),
        );

        setFormFeedback({
          type: successIds.length ? "warning" : "danger",
          message:
            successIds.length && failures.length
              ? `Assigned ${successIds.length} subject${
                  successIds.length === 1 ? "" : "s"
                }, but ${failures.length} failed. ${uniqueMessages.join(" ")}`
              : uniqueMessages.join(" ") || "Unable to save assignment.",
        });
      } else if (successIds.length) {
        setFormFeedback({
          type: "success",
          message:
            successIds.length === 1
              ? "Subject assigned successfully."
              : `Assigned ${successIds.length} subjects successfully.`,
        });
      }
    } catch (err) {
      console.error("Unable to save assignment", err);
      setFormFeedback({
        type: "danger",
        message: err instanceof Error ? err.message : "Unable to save assignment.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (assignment: SubjectAssignment) => {
    setEditingId(assignment.id);
    setFormFeedback(null);

    const classId = assignment.school_class_id
      ? `${assignment.school_class_id}`
      : "";
    const armId = assignment.class_arm_id ? `${assignment.class_arm_id}` : "";
    const sectionId = assignment.class_section_id
      ? `${assignment.class_section_id}`
      : "";

    if (classId) {
      await ensureArmsLoaded(classId);
    }
    if (classId && armId) {
      await ensureSectionsLoaded(classId, armId);
    }

    startTransition(() => {
      setForm({
        subjectIds: assignment.subject_id ? [`${assignment.subject_id}`] : [],
        school_class_id: classId,
        class_arm_id: armId,
        class_section_id: sectionId,
      });
    });
  };

  const handleDelete = async (assignment: SubjectAssignment) => {
    if (
      !window.confirm(
        `Remove subject assignment for "${assignment.subject?.name ?? "Subject"}"?`,
      )
    ) {
      return;
    }
    try {
      await deleteSubjectAssignment(assignment.id);
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

  const totalPages = listData?.last_page ?? 1;

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Subject Assignments</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Assign Subjects to Classes</li>
        </ul>
      </div>

      <div className="row">
        <div className="col-lg-5">
          <div className="card height-auto">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>{editingId ? "Edit Assignment" : "Assign Subject"}</h3>
                </div>
              </div>

              {formFeedback ? (
                <div className={`alert alert-${formFeedback.type}`} role="alert">
                  {formFeedback.message}
                </div>
              ) : null}

              <form onSubmit={handleFormSubmit}>
                <div className="row">
                  <div className="col-12 form-group">
                    <label>Subjects *</label>
                    <div className="border rounded p-2 subject-checkbox-list">
                      {subjectOptions.length ? (
                        subjectOptions.map((option) => (
                          <div className="form-check" key={option.value}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`form-subject-${option.value}`}
                              checked={selectedSubjectSet.has(option.value)}
                              onChange={(event) =>
                                handleSubjectToggle(option.value, event.target.checked)
                              }
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`form-subject-${option.value}`}
                            >
                              {option.label}
                            </label>
                          </div>
                        ))
                      ) : (
                        <p className="text-muted mb-0">No subjects available.</p>
                      )}
                    </div>
                    <small className="form-text text-muted">
                      {editingId
                        ? "Select the subject that should remain assigned."
                        : "Tick one or more subjects to assign to the selected class."}
                    </small>
                  </div>
                  <div className="col-12 form-group">
                    <label htmlFor="form-class">Class *</label>
                    <select
                      id="form-class"
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
                      {classOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-12 form-group">
                    <label htmlFor="form-arm">Class Arm</label>
                    <select
                      id="form-arm"
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
                      {armsForClass.map((arm) => (
                        <option key={arm.id} value={arm.id}>
                          {arm.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {/*
                    Class section selection hidden per request
                    <div className="col-12 form-group">
                      <label htmlFor="form-section">Class Section</label>
                      <select
                        id="form-section"
                        className="form-control"
                        value={form.class_section_id}
                        onChange={(event) =>
                          setForm((prev) => ({
                            ...prev,
                            class_section_id: event.target.value,
                          }))
                        }
                        disabled={!form.class_arm_id || sectionsForSelection.length === 0}
                      >
                        <option value="">All sections</option>
                        {sectionsForSelection.map((section) => (
                          <option key={section.id} value={section.id}>
                            {section.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  */}
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
                        : "Assign Subject"}
                    </button>
                    <button
                      type="button"
                      className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                      onClick={() => {
                        setEditingId(null);
                        setForm({
                          ...initialForm,
                          subjectIds: [],
                        });
                        setFormFeedback(null);
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
                  <label htmlFor="filter-search">Search</label>
                  <input
                    id="filter-search"
                    type="text"
                    className="form-control"
                    placeholder="Subject or class"
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
                <div className="col-md-3 col-12 form-group">
                  <label htmlFor="filter-class">Class</label>
                  <select
                    id="filter-class"
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
                    {classOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-3 col-12 form-group">
                  <label htmlFor="filter-arm">Class Arm</label>
                  <select
                    id="filter-arm"
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
                    disabled={!filters.school_class_id || filterArms.length === 0}
                  >
                    <option value="">None</option>
                    {filterArms.map((arm) => (
                      <option key={arm.id} value={arm.id}>
                        {arm.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/*
                  Class section filter hidden per request
                  <div className="col-md-2 col-12 form-group">
                    <label htmlFor="filter-section">Section</label>
                    <select
                      id="filter-section"
                      className="form-control"
                      value={filters.class_section_id}
                      onChange={(event) => {
                        setFilters((prev) => ({
                          ...prev,
                          class_section_id: event.target.value,
                        }));
                        setPage(1);
                      }}
                      disabled={!filters.class_arm_id || filterSections.length === 0}
                    >
                      <option value="">All</option>
                      {filterSections.map((section) => (
                        <option key={section.id} value={section.id}>
                          {section.name}
                        </option>
                      ))}
                    </select>
                  </div>
                */}
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
                      <th>Subject</th>
                      <th>Class</th>
                      <th>Arm</th>
                      {/* <th>Section</th> */}
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {loadingList ? (
                      <tr>
                        <td colSpan={5} className="text-center">
                          Loading assignments…
                        </td>
                      </tr>
                    ) : assignments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="text-center">
                          No assignments found.
                        </td>
                      </tr>
                    ) : (
                      assignments.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>
                            {assignment.subject?.name ?? "N/A"}
                            {assignment.subject?.code
                              ? ` (${assignment.subject.code})`
                              : ""}
                          </td>
                          <td>{assignment.school_class?.name ?? "N/A"}</td>
                          <td>{assignment.class_arm?.name ?? "N/A"}</td>
                          {/* <td>{assignment.class_section?.name ?? "All"}</td> */}
                          <td>
                            {assignment.updated_at
                              ? new Date(assignment.updated_at).toLocaleString()
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
                  {listData && listData.total
                    ? `Showing ${listData.from ?? 0}-${listData.to ?? 0} of ${listData.total} assignments`
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
