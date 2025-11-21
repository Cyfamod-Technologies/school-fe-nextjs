"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState, type ReactElement } from "react";
import {
  createAssessmentComponent,
  deleteAssessmentComponent,
  getAssessmentComponent,
  listAssessmentComponents,
  updateAssessmentComponent,
  type AssessmentComponentListResponse,
} from "@/lib/assessmentComponents";
import { listAllSubjects, type Subject } from "@/lib/subjects";

type FeedbackKind = "success" | "danger" | "warning" | "info";

interface FeedbackState {
  type: FeedbackKind;
  message: string;
}

interface ComponentFormState {
  id: string;
  name: string;
  weight: string;
  order: string;
  label: string;
  subjectIds: Set<string>;
}

interface ComponentFilters {
  search: string;
  subject_id: string;
}

const emptyForm: ComponentFormState = {
  id: "",
  name: "",
  weight: "",
  order: "",
  label: "",
  subjectIds: new Set<string>(),
};

const emptyFilters: ComponentFilters = {
  search: "",
  subject_id: "",
};

const perPage = 10;

export default function AssessmentComponentsPage() {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [form, setForm] = useState<ComponentFormState>(emptyForm);
  const [filters, setFilters] = useState<ComponentFilters>(emptyFilters);
  const [filterSearch, setFilterSearch] = useState("");
  const [filterSubject, setFilterSubject] = useState("");
  const [page, setPage] = useState(1);
  const [tableData, setTableData] =
    useState<AssessmentComponentListResponse | null>(null);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableLoading, setTableLoading] = useState(false);
  const [formFeedback, setFormFeedback] = useState<FeedbackState | null>(null);
  const [tableFeedback, setTableFeedback] =
    useState<FeedbackState | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listAllSubjects()
      .then(setSubjects)
      .catch((error) =>
        console.error("Unable to load subjects", error),
      );
  }, []);

  useEffect(() => {
    let active = true;
    setTableLoading(true);
    setTableError(null);
    listAssessmentComponents({
      page,
      per_page: perPage,
      search: filters.search || undefined,
      subject_id: filters.subject_id || undefined,
    })
      .then((data) => {
        if (!active) {
          return;
        }
        setTableData(data);
      })
      .catch((error) => {
        if (!active) {
          return;
        }
        console.error("Unable to load assessment components", error);
        setTableError(
          error instanceof Error
            ? error.message
            : "Unable to load assessment components.",
        );
        setTableData(null);
      })
      .finally(() => {
        if (active) {
          setTableLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [page, filters]);

  const subjectOptions = useMemo(() => {
    return subjects.map((subject) => ({
      value: String(subject.id),
      label: subject.code
        ? `${subject.name} (${subject.code})`
        : subject.name,
    }));
  }, [subjects]);

  const selectedSubjectIds = form.subjectIds;

  const handleSubjectToggle = (subjectId: string, checked: boolean) => {
    setForm((prev) => {
      const nextIds = new Set(prev.subjectIds);
      if (checked) {
        nextIds.add(subjectId);
      } else {
        nextIds.delete(subjectId);
      }
      return {
        ...prev,
        subjectIds: nextIds,
      };
    });
  };

  const handleSelectAllSubjects = (checked: boolean) => {
    setForm((prev) => {
      if (checked) {
        // Select all subjects
        const allSubjectIds = new Set(subjectOptions.map((s) => s.value));
        return {
          ...prev,
          subjectIds: allSubjectIds,
        };
      } else {
        // Deselect all subjects
        return {
          ...prev,
          subjectIds: new Set<string>(),
        };
      }
    });
  };

  const resetForm = () => {
    setForm({
      ...emptyForm,
      subjectIds: new Set<string>(),
    });
    setFormFeedback(null);
  };

  const handleFormSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormFeedback(null);
    setTableFeedback(null);

    const name = form.name.trim();
    const weightRaw = form.weight.trim();
    const orderRaw = form.order.trim();
    const label = form.label.trim();

    if (!name || weightRaw === "" || orderRaw === "") {
      setFormFeedback({
        type: "warning",
        message: "Please complete all required fields.",
      });
      return;
    }

    if (!selectedSubjectIds.size) {
      setFormFeedback({
        type: "warning",
        message: "Select at least one subject.",
      });
      return;
    }

    const weightValue = Number.parseFloat(weightRaw);
    if (Number.isNaN(weightValue)) {
      setFormFeedback({
        type: "warning",
        message: "Score must be a valid number.",
      });
      return;
    }

    const orderValue = Number.parseInt(orderRaw, 10);
    if (Number.isNaN(orderValue)) {
      setFormFeedback({
        type: "warning",
        message: "Order must be a valid number.",
      });
      return;
    }

    const payload = {
      name,
      weight: weightValue,
      order: orderValue,
      label: label || null,
      subject_ids: Array.from(selectedSubjectIds),
    };

    try {
      setSubmitting(true);
      if (form.id) {
        await updateAssessmentComponent(form.id, payload);
        setFormFeedback({
          type: "success",
          message: "Component updated successfully.",
        });
      } else {
        await createAssessmentComponent(payload);
        setFormFeedback({
          type: "success",
          message: "Component created successfully.",
        });
      }
      resetForm();
      setPage(1);
      setFilters((prev) => ({ ...prev }));
    } catch (error) {
      console.error("Unable to save assessment component", error);
      setFormFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to save assessment component.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = async (componentId: number | string) => {
    setFormFeedback(null);
    try {
      const component = await getAssessmentComponent(componentId);
      if (!component) {
        setFormFeedback({
          type: "danger",
          message: "Unable to load assessment component.",
        });
        return;
      }
      setForm({
        id: String(component.id),
        name: component.name ?? "",
        weight:
          component.weight === null || component.weight === undefined
            ? ""
            : `${Number(component.weight).toFixed(2)}`,
        order:
          component.order === null || component.order === undefined
            ? ""
            : `${component.order}`,
        label: component.label ?? "",
        subjectIds: new Set(
          Array.isArray(component.subjects)
            ? component.subjects.map((subject) => String(subject.id))
            : [],
        ),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (error) {
      console.error("Unable to load assessment component", error);
      setFormFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to load assessment component.",
      });
    }
  };

  const handleDelete = async (componentId: number | string) => {
    if (
      !window.confirm("Are you sure you want to remove this assessment component?")
    ) {
      return;
    }
    try {
      await deleteAssessmentComponent(componentId);
      setTableFeedback({
        type: "success",
        message: "Component removed successfully.",
      });
      if (form.id === String(componentId)) {
        resetForm();
      }
      setFilters((prev) => ({ ...prev }));
    } catch (error) {
      console.error("Unable to delete assessment component", error);
      setTableFeedback({
        type: "danger",
        message:
          error instanceof Error
            ? error.message
            : "Unable to delete assessment component.",
      });
    }
  };

  const handleFilterApply = () => {
    setFilters({
      search: filterSearch.trim(),
      subject_id: filterSubject,
    });
    setPage(1);
  };

  const handleFilterReset = () => {
    setFilterSearch("");
    setFilterSubject("");
    setFilters(emptyFilters);
    setPage(1);
  };

  const summaryText = useMemo(() => {
    if (!tableData || !tableData.data.length) {
      return "";
    }
    const from =
      tableData.from ??
      (tableData.data.length
        ? (tableData.current_page - 1) * tableData.per_page + 1
        : 0);
    const to =
      tableData.to ??
      (tableData.data.length
        ? from + tableData.data.length - 1
        : 0);
    const total = tableData.total ?? tableData.data.length;
    return `Showing ${from}-${to} of ${total} components`;
  }, [tableData]);

  const renderPagination = () => {
    if (!tableData) {
      return null;
    }
    const current = tableData.current_page ?? 1;
    const last = tableData.last_page ?? 1;
    if (last <= 1) {
      return null;
    }

    const items: ReactElement[] = [];

    const appendPage = (pageNumber: number, label?: string) => {
      const active = pageNumber === current;
      items.push(
        <li
          key={`page-${pageNumber}-${label ?? ""}`}
          className={`page-item${active ? " active" : ""}`}
        >
          <button
            type="button"
            className="page-link"
            onClick={() => setPage(pageNumber)}
            disabled={active}
          >
            {label ?? pageNumber}
          </button>
        </li>,
      );
    };

    const appendEllipsis = (key: string) => {
      items.push(
        <li key={key} className="page-item disabled">
          <span className="page-link">…</span>
        </li>,
      );
    };

    items.push(
      <li key="prev" className={`page-item${current <= 1 ? " disabled" : ""}`}>
        <button
          type="button"
          className="page-link"
          onClick={() => setPage(Math.max(1, current - 1))}
          disabled={current <= 1}
        >
          «
        </button>
      </li>,
    );

    if (last <= 7) {
      for (let pageNumber = 1; pageNumber <= last; pageNumber++) {
        appendPage(pageNumber);
      }
    } else {
      appendPage(1);
      const start = Math.max(2, current - 2);
      const end = Math.min(last - 1, current + 2);
      if (start > 2) {
        appendEllipsis("start-ellipsis");
      }
      for (let pageNumber = start; pageNumber <= end; pageNumber++) {
        appendPage(pageNumber);
      }
      if (end < last - 1) {
        appendEllipsis("end-ellipsis");
      }
      appendPage(last);
    }

    items.push(
      <li key="next" className={`page-item${current >= last ? " disabled" : ""}`}>
        <button
          type="button"
          className="page-link"
          onClick={() => setPage(Math.min(last, current + 1))}
          disabled={current >= last}
        >
          »
        </button>
      </li>,
    );

    return <ul className="pagination pagination-sm mb-0">{items}</ul>;
  };

  const renderTableBody = () => {
    if (tableLoading) {
      return (
        <tr>
          <td colSpan={7} className="text-center">
            Loading...
          </td>
        </tr>
      );
    }
    if (tableError) {
      return (
        <tr>
          <td colSpan={7} className="text-center text-danger">
            {tableError}
          </td>
        </tr>
      );
    }
    if (!tableData || !tableData.data.length) {
      return (
        <tr>
          <td colSpan={7} className="text-center">
            No components found.
          </td>
        </tr>
      );
    }
    return tableData.data.map((item) => {
      const subjectsList = Array.isArray(item.subjects)
        ? item.subjects
        : [];
      return (
        <tr key={item.id}>
          <td>{item.name}</td>
          <td>{Number(item.weight).toFixed(2)}</td>
          <td>{item.order}</td>
          <td>{item.label || "—"}</td>
          <td>
            {subjectsList.length ? (
              <div className="d-flex flex-wrap">
                {subjectsList.map((subject) => (
                  <span
                    key={subject.id}
                    className="badge badge-light text-dark mr-1 mb-1"
                  >
                    {subject.code
                      ? `${subject.name} (${subject.code})`
                      : subject.name}
                  </span>
                ))}
              </div>
            ) : (
              "—"
            )}
          </td>
          <td>
            {item.updated_at
              ? new Date(item.updated_at).toLocaleString()
              : "—"}
          </td>
          <td>
            <button
              type="button"
              className="btn btn-sm btn-outline-primary mr-2"
              onClick={() => handleEdit(item.id)}
            >
              Edit
            </button>
            <button
              type="button"
              className="btn btn-sm btn-outline-danger"
              onClick={() => handleDelete(item.id)}
            >
              Delete
            </button>
          </td>
        </tr>
      );
    });
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Assessment Components</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Assessment Components</li>
        </ul>
      </div>

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Add / Edit Component</h3>
            </div>
          </div>
          <form onSubmit={handleFormSubmit}>
            <div className="row gutters-8">
              <div className="col-lg-4 col-md-6 col-12 form-group">
                <label>Name *</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  maxLength={100}
                  required
                />
              </div>
              <div className="col-lg-4 col-md-6 col-12 form-group">
                <label>Score *</label>
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  step={0.01}
                  value={form.weight}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      weight: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="col-lg-4 col-md-6 col-12 form-group">
                <label>Order *</label>
                <input
                  type="number"
                  className="form-control"
                  min={0}
                  value={form.order}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      order: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="col-lg-4 col-md-6 col-12 form-group">
                <label>Label</label>
                <input
                  type="text"
                  className="form-control"
                  value={form.label}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      label: event.target.value,
                    }))
                  }
                  maxLength={50}
                />
              </div>
              <div className="col-lg-8 col-md-12 col-12 form-group">
                <label>Subjects *</label>
                <div className="border rounded p-2 subject-checkbox-list">
                  {subjectOptions.length ? (
                    <>
                      <div className="form-check mb-2 pb-2 border-bottom">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="select-all-subjects"
                          checked={
                            subjectOptions.length > 0 &&
                            selectedSubjectIds.size === subjectOptions.length
                          }
                          onChange={(event) =>
                            handleSelectAllSubjects(event.target.checked)
                          }
                        />
                        <label
                          className="form-check-label fw-bold"
                          htmlFor="select-all-subjects"
                        >
                          Select All
                        </label>
                      </div>
                      {subjectOptions.map((subject) => (
                        <div className="form-check" key={subject.value}>
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id={`subject-${subject.value}`}
                            checked={selectedSubjectIds.has(subject.value)}
                            onChange={(event) =>
                              handleSubjectToggle(
                                subject.value,
                                event.target.checked,
                              )
                            }
                          />
                          <label
                            className="form-check-label"
                            htmlFor={`subject-${subject.value}`}
                          >
                            {subject.label}
                          </label>
                        </div>
                      ))}
                    </>
                  ) : (
                    <p className="text-muted mb-0">No subjects available.</p>
                  )}
                </div>
                <small className="form-text text-muted">
                  Tick one or more subjects this component should apply to.
                </small>
              </div>
              <div className="col-12 form-group d-flex justify-content-between">
                <button
                  type="submit"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  disabled={submitting}
                >
                  {form.id ? "Update Component" : "Save Component"}
                </button>
                <button
                  type="button"
                  className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                  onClick={resetForm}
                  disabled={submitting}
                >
                  Reset
                </button>
              </div>
            </div>
          </form>
          {formFeedback ? (
            <div
              className={`alert alert-${formFeedback.type}`}
              role="alert"
            >
              {formFeedback.message}
            </div>
          ) : null}
        </div>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Assessment Components</h3>
            </div>
          </div>
          <div className="row gutters-8 align-items-end mb-3">
            <div className="col-xl-3 col-lg-4 col-md-6 col-12 form-group">
              <label>Search</label>
              <input
                type="text"
                className="form-control"
                placeholder="Name or label"
                value={filterSearch}
                onChange={(event) => setFilterSearch(event.target.value)}
              />
            </div>
            <div className="col-xl-3 col-lg-4 col-md-6 col-12 form-group">
              <label>Subject</label>
              <select
                className="form-control"
                value={filterSubject}
                onChange={(event) => setFilterSubject(event.target.value)}
              >
                <option value="">All subjects</option>
                {subjectOptions.map((subject) => (
                  <option key={subject.value} value={subject.value}>
                    {subject.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-12 col-md-6 col-lg-3 form-group">
              <label>&nbsp;</label>
              <div className="d-flex">
                <button
                  type="button"
                  className="fw-btn-fill btn-gradient-yellow mr-2"
                  onClick={handleFilterApply}
                >
                  Apply
                </button>
                <button
                  type="button"
                  className="fw-btn-fill btn-outline-secondary"
                  onClick={handleFilterReset}
                >
                  Reset
                </button>
              </div>
            </div>
          </div>

          {tableFeedback ? (
            <div
              className={`alert alert-${tableFeedback.type}`}
              role="alert"
            >
              {tableFeedback.message}
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Score</th>
                  <th>Order</th>
                  <th>Label</th>
                  <th>Subjects</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>{renderTableBody()}</tbody>
            </table>
            <div className="d-flex justify-content-between align-items-center mt-3 flex-wrap">
              <div className="text-muted mb-2">{summaryText}</div>
              {renderPagination()}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
