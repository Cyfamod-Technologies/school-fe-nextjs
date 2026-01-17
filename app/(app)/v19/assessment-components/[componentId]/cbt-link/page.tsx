"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { apiFetch } from "@/lib/apiClient";
import { useAuth } from "@/contexts/AuthContext";

type FeedbackKind = "success" | "danger" | "warning" | "info";

interface FeedbackState {
  type: FeedbackKind;
  message: string;
}

interface AssessmentComponent {
  id: string;
  name: string;
  label?: string | null;
}

interface QuizSummary {
  id: string;
  title: string;
  subject_id?: string | null;
  subject_name?: string | null;
  class_id?: string | null;
  total_questions?: number;
  status?: string;
}

interface CbtLink {
  id: string;
  assessment_component_id: string;
  cbt_exam_id: string;
  class_id: string | null;
  term_id: string | null;
  session_id: string | null;
  subject_id: string | null;
  auto_sync: boolean;
  score_mapping_type: "direct" | "percentage" | "scaled";
  max_score_override: number | null;
  is_active: boolean;
  pending_imports_count?: number;
  cbt_exam?: { id: string; title: string; subject_id?: string | null };
  class?: { id: string; name: string };
  term?: { id: string; name: string };
  session?: { id: string; name: string };
  subject?: { id: string; name: string };
}

interface ImportRow {
  id: string;
  student_id: string;
  cbt_raw_score: number;
  cbt_max_score: number;
  converted_score: number | null;
  status: "pending" | "approved" | "rejected" | "synced";
  student?: { id: string; first_name: string; last_name: string; admission_no?: string | null };
  created_at?: string;
}

interface SchoolClass {
  id: string;
  name: string;
}

interface Subject {
  id: string;
  name: string;
  code?: string | null;
}

const emptyForm = {
  cbt_exam_id: "",
  class_id: "",
  subject_id: "",
  auto_sync: false,
  score_mapping_type: "direct" as CbtLink["score_mapping_type"],
  max_score_override: "",
  is_active: true,
};

export default function CbtAssessmentLinkPage() {
  const params = useParams();
  const componentId = params.componentId as string;

  const [component, setComponent] = useState<AssessmentComponent | null>(null);
  const [links, setLinks] = useState<CbtLink[]>([]);
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [pendingImports, setPendingImports] = useState<ImportRow[]>([]);
  const [selectedLinkId, setSelectedLinkId] = useState<string | null>(null);
  const [selectedImports, setSelectedImports] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const { schoolContext } = useAuth();

  const quizOptions = useMemo(() => {
    return quizzes.map((quiz) => {
      const subject = quiz.subject_name ? ` - ${quiz.subject_name}` : "";
      const status = quiz.status ? ` - ${quiz.status}` : "";
      return {
        value: quiz.id,
        label: `${quiz.title}${subject}${status}`,
      };
    });
  }, [quizzes]);

  const selectedQuiz = useMemo(() => {
    if (!form.cbt_exam_id) {
      return null;
    }
    return quizzes.find((quiz) => quiz.id === form.cbt_exam_id) ?? null;
  }, [form.cbt_exam_id, quizzes]);

  const showSubjectOverride = !selectedQuiz?.subject_id;
  const showClassOverride = !selectedQuiz?.class_id;
  const currentSessionId =
    schoolContext.current_session_id != null
      ? String(schoolContext.current_session_id)
      : null;
  const currentTermId =
    schoolContext.current_term_id != null
      ? String(schoolContext.current_term_id)
      : null;
  const currentSessionName =
    schoolContext.current_session?.name ?? "Not set";
  const currentTermName =
    schoolContext.current_term?.name ?? "Not set";

  const mappingHint = useMemo(() => {
    switch (form.score_mapping_type) {
      case "percentage":
        return "Convert to 0-100% regardless of quiz max score.";
      case "scaled":
        return "Scale raw score to the override max score.";
      default:
        return "Use raw quiz score directly.";
    }
  }, [form.score_mapping_type]);

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const [
          linkPayload,
          quizPayload,
          classPayload,
          subjectPayload,
        ] = (await Promise.all([
          apiFetch(`/api/v1/settings/assessment-components/${componentId}/cbt-links`),
          apiFetch(`/api/v1/cbt/quizzes`),
          apiFetch(`/api/v1/classes`),
          apiFetch(`/api/v1/settings/subjects?per_page=200`),
        ])) as any[];

        if (!active) {
          return;
        }

        setComponent(linkPayload?.component ?? null);
        setLinks(Array.isArray(linkPayload?.links) ? linkPayload.links : []);
        setQuizzes(Array.isArray(quizPayload?.data) ? quizPayload.data : []);

        const normalize = (payload: any) =>
          Array.isArray(payload) ? payload : payload?.data ?? [];

        setClasses(normalize(classPayload));
        setSubjects(normalize(subjectPayload));
      } catch (error) {
        console.error("Failed to load CBT link data", error);
        setFeedback({
          type: "danger",
          message: "Unable to load CBT assessment data.",
        });
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (componentId) {
      load();
    }

    return () => {
      active = false;
    };
  }, [componentId]);

  const refreshLinks = async () => {
    const payload = await apiFetch(
      `/api/v1/settings/assessment-components/${componentId}/cbt-links`,
    );
    setComponent(payload?.component ?? null);
    setLinks(Array.isArray(payload?.links) ? payload.links : []);
  };

  const resetForm = () => {
    setForm(emptyForm);
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFeedback(null);

    if (!form.cbt_exam_id) {
      setFeedback({
        type: "warning",
        message: "Select a CBT exam to link.",
      });
      return;
    }

    if (!currentSessionId || !currentTermId) {
      setFeedback({
        type: "warning",
        message: "Set the current session and term in school settings before linking CBT scores.",
      });
      return;
    }

    if (form.score_mapping_type === "scaled" && !form.max_score_override) {
      setFeedback({
        type: "warning",
        message: "Provide a max score override for scaled mapping.",
      });
      return;
    }

    const payload = {
      cbt_exam_id: form.cbt_exam_id,
      class_id: form.class_id || null,
      term_id: currentTermId,
      session_id: currentSessionId,
      subject_id: form.subject_id || null,
      auto_sync: form.auto_sync,
      score_mapping_type: form.score_mapping_type,
      max_score_override: form.max_score_override
        ? Number.parseFloat(form.max_score_override)
        : null,
      is_active: form.is_active,
    };

    setSubmitting(true);
    try {
      await apiFetch(
        `/api/v1/settings/assessment-components/${componentId}/cbt-links`,
        {
          method: "POST",
          body: JSON.stringify(payload),
        },
      );
      setFeedback({
        type: "success",
        message: "CBT link created successfully.",
      });
      resetForm();
      await refreshLinks();
    } catch (error: any) {
      console.error("Failed to create CBT link", error);
      setFeedback({
        type: "danger",
        message:
          error?.message ??
          "Unable to create CBT link. Please check the fields.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleImport = async (linkId: string) => {
    setFeedback(null);
    try {
      const payload = await apiFetch(
        `/api/v1/settings/cbt-assessment-links/${linkId}/import`,
        { method: "POST" },
      );
      setFeedback({
        type: "success",
        message: payload?.message ?? "Scores imported successfully.",
      });
      await refreshLinks();
      if (selectedLinkId === linkId) {
        await loadPending(linkId);
      }
    } catch (error: any) {
      console.error("Failed to import scores", error);
      setFeedback({
        type: "danger",
        message: error?.message ?? "Failed to import scores.",
      });
    }
  };

  const loadPending = async (linkId: string) => {
    setSelectedLinkId(linkId);
    setSelectedImports(new Set());
    try {
      const payload = await apiFetch(
        `/api/v1/settings/cbt-assessment-links/${linkId}/pending-scores`,
      );
      setPendingImports(Array.isArray(payload?.imports) ? payload.imports : []);
    } catch (error) {
      console.error("Failed to load pending scores", error);
    }
  };

  const toggleImport = (importId: string, checked: boolean) => {
    setSelectedImports((prev) => {
      const next = new Set(prev);
      if (checked) {
        next.add(importId);
      } else {
        next.delete(importId);
      }
      return next;
    });
  };

  const handleApprove = async (importIds: string[]) => {
    if (!selectedLinkId || !importIds.length) {
      return;
    }
    setFeedback(null);
    try {
      await apiFetch(
        `/api/v1/settings/cbt-assessment-links/${selectedLinkId}/approve`,
        {
          method: "POST",
          body: JSON.stringify({ import_ids: importIds }),
        },
      );
      setFeedback({
        type: "success",
        message: "Scores approved and synced.",
      });
      await loadPending(selectedLinkId);
      await refreshLinks();
    } catch (error: any) {
      console.error("Failed to approve scores", error);
      setFeedback({
        type: "danger",
        message: error?.message ?? "Unable to approve scores.",
      });
    }
  };

  const handleReject = async (importIds: string[]) => {
    if (!selectedLinkId || !importIds.length) {
      return;
    }
    const reason = window.prompt("Reason for rejection (optional):") ?? "";
    setFeedback(null);
    try {
      await apiFetch(
        `/api/v1/settings/cbt-assessment-links/${selectedLinkId}/reject`,
        {
          method: "POST",
          body: JSON.stringify({ import_ids: importIds, reason }),
        },
      );
      setFeedback({
        type: "info",
        message: "Scores rejected.",
      });
      await loadPending(selectedLinkId);
      await refreshLinks();
    } catch (error: any) {
      console.error("Failed to reject scores", error);
      setFeedback({
        type: "danger",
        message: error?.message ?? "Unable to reject scores.",
      });
    }
  };

  const handleDelete = async (linkId: string) => {
    if (!window.confirm("Delete this CBT link?")) {
      return;
    }
    setFeedback(null);
    try {
      await apiFetch(`/api/v1/settings/cbt-assessment-links/${linkId}`, {
        method: "DELETE",
      });
      setFeedback({
        type: "success",
        message: "CBT link deleted.",
      });
      await refreshLinks();
      if (selectedLinkId === linkId) {
        setSelectedLinkId(null);
        setPendingImports([]);
      }
    } catch (error: any) {
      console.error("Failed to delete CBT link", error);
      setFeedback({
        type: "danger",
        message: error?.message ?? "Unable to delete CBT link.",
      });
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>CBT Assessment Links</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href="/v19/assessment-components">Assessment Components</Link>
          </li>
          <li>CBT Integration</li>
        </ul>
      </div>

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="row align-items-center">
            <div className="col-lg-8 col-12">
              <div className="item-title">
                <h3 className="mb-2">Link CBT Exams</h3>
                <p className="text-muted mb-0">
                  {component
                    ? `Component: ${component.name}`
                    : "Choose a CBT exam to import scores."}
                </p>
              </div>
            </div>
            <div className="col-lg-4 col-12 d-flex justify-content-lg-end">
              <Link
                href={`/v19/assessment-components/${componentId}/structures`}
                className="btn-fill-lmd btn-gradient-yellow btn-hover-bluedark text-light"
              >
                View Structures
              </Link>
            </div>
          </div>
        </div>
      </div>

      {feedback ? (
        <div className={`alert alert-${feedback.type}`} role="alert">
          {feedback.message}
        </div>
      ) : null}

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Create CBT Link</h3>
            </div>
          </div>
          <form onSubmit={handleSubmit}>
            <div className="row gutters-20">
              <div className="col-md-6 col-12 form-group">
                <label>CBT Exam *</label>
                <select
                  className="form-control"
                  value={form.cbt_exam_id}
                  onChange={(event) =>
                    setForm((prev) => {
                      const nextExamId = event.target.value;
                      const nextQuiz = quizzes.find((quiz) => quiz.id === nextExamId);
                      return {
                        ...prev,
                        cbt_exam_id: nextExamId,
                        subject_id: nextQuiz?.subject_id ? "" : prev.subject_id,
                        class_id: nextQuiz?.class_id ? "" : prev.class_id,
                      };
                    })
                  }
                >
                  <option value="">Select CBT exam</option>
                  {quizOptions.map((quiz) => (
                    <option key={quiz.value} value={quiz.value}>
                      {quiz.label}
                    </option>
                  ))}
                </select>
              </div>
              {showSubjectOverride ? (
                <div className="col-md-6 col-12 form-group">
                  <label>Subject (optional)</label>
                  <select
                    className="form-control"
                    value={form.subject_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        subject_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Use CBT exam subject</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.code
                          ? `${subject.name} (${subject.code})`
                          : subject.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {showClassOverride ? (
                <div className="col-md-4 col-12 form-group">
                  <label>Class (optional)</label>
                  <select
                    className="form-control"
                    value={form.class_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        class_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">All classes</option>
                    {classes.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              <div className="col-md-4 col-12 form-group">
                <label>Session (current)</label>
                <input
                  className="form-control"
                  value={currentSessionName}
                  disabled
                />
              </div>
              <div className="col-md-4 col-12 form-group">
                <label>Term (current)</label>
                <input
                  className="form-control"
                  value={currentTermName}
                  disabled
                />
              </div>
              <div className="col-md-4 col-12 form-group">
                <label>Mapping Type</label>
                <select
                  className="form-control"
                  value={form.score_mapping_type}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      score_mapping_type: event.target.value as CbtLink["score_mapping_type"],
                    }))
                  }
                >
                  <option value="direct">Direct</option>
                  <option value="percentage">Percentage</option>
                  <option value="scaled">Scaled</option>
                </select>
                <small className="text-muted">{mappingHint}</small>
              </div>
              <div className="col-md-4 col-12 form-group">
                <label>Max Score Override</label>
                <input
                  type="number"
                  className="form-control"
                  placeholder="e.g. 10"
                  value={form.max_score_override}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      max_score_override: event.target.value,
                    }))
                  }
                  disabled={form.score_mapping_type !== "scaled"}
                />
              </div>
              <div className="col-md-4 col-12 form-group d-flex align-items-center">
                <div className="form-check mt-3">
                  <input
                    id="autoSync"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.auto_sync}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        auto_sync: event.target.checked,
                      }))
                    }
                  />
                  <label className="form-check-label" htmlFor="autoSync">
                    Auto sync after import
                  </label>
                </div>
              </div>
              <div className="col-md-4 col-12 form-group d-flex align-items-center">
                <div className="form-check mt-3">
                  <input
                    id="isActive"
                    className="form-check-input"
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        is_active: event.target.checked,
                      }))
                    }
                  />
                  <label className="form-check-label" htmlFor="isActive">
                    Active
                  </label>
                </div>
              </div>
            </div>
            <div className="form-group">
              <button
                type="submit"
                className="btn-fill-lmd btn-gradient-yellow btn-hover-bluedark text-light"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Create Link"}
              </button>
              <button
                type="button"
                className="btn-fill-lmd btn-outline-secondary ml-3"
                onClick={resetForm}
                disabled={submitting}
              >
                Reset
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Linked CBT Exams</h3>
            </div>
          </div>
          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>Exam</th>
                  <th>Mapping</th>
                  <th>Scope</th>
                  <th>Auto Sync</th>
                  <th>Pending</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {links.length ? (
                  links.map((link) => (
                    <tr key={link.id}>
                      <td>{link.cbt_exam?.title ?? "-"}</td>
                      <td>
                        {link.score_mapping_type}
                        {link.max_score_override
                          ? ` (max ${link.max_score_override})`
                          : ""}
                      </td>
                      <td>
                        {[link.class?.name, link.term?.name, link.session?.name]
                          .filter(Boolean)
                          .join(" - ") || "All"}
                      </td>
                      <td>{link.auto_sync ? "Yes" : "No"}</td>
                      <td>{link.pending_imports_count ?? 0}</td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-primary mr-2"
                          onClick={() => handleImport(link.id)}
                        >
                          Import
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-secondary mr-2"
                          onClick={() => loadPending(link.id)}
                        >
                          Review
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-outline-danger"
                          onClick={() => handleDelete(link.id)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center">
                      No CBT links created yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Pending Score Review</h3>
            </div>
          </div>
          {selectedLinkId ? (
            <>
              <div className="mb-3">
                <button
                  type="button"
                  className="btn-fill-lmd btn-gradient-green mr-2"
                  onClick={() => handleApprove(Array.from(selectedImports))}
                  disabled={!selectedImports.size}
                >
                  Approve Selected
                </button>
                <button
                  type="button"
                  className="btn-fill-lmd btn-gradient-yellow mr-2"
                  onClick={() =>
                    handleApprove(
                      pendingImports
                        .filter((row) => row.status === "pending")
                        .map((row) => row.id),
                    )
                  }
                  disabled={!pendingImports.length}
                >
                  Approve All
                </button>
                <button
                  type="button"
                  className="btn-fill-lmd btn-outline-danger"
                  onClick={() => handleReject(Array.from(selectedImports))}
                  disabled={!selectedImports.size}
                >
                  Reject Selected
                </button>
              </div>
              <div className="table-responsive">
                <table className="table display text-nowrap">
                  <thead>
                    <tr>
                      <th>Select</th>
                      <th>Student</th>
                      <th>Adm No</th>
                      <th>Raw Score</th>
                      <th>Converted</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingImports.length ? (
                      pendingImports.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedImports.has(row.id)}
                              onChange={(event) =>
                                toggleImport(row.id, event.target.checked)
                              }
                              disabled={row.status !== "pending"}
                            />
                          </td>
                          <td>
                            {row.student
                              ? `${row.student.first_name} ${row.student.last_name}`
                              : "-"}
                          </td>
                          <td>{row.student?.admission_no ?? "-"}</td>
                          <td>
                            {row.cbt_raw_score}/{row.cbt_max_score}
                          </td>
                          <td>{row.converted_score ?? "-"}</td>
                          <td>{row.status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr>
                        <td colSpan={6} className="text-center">
                          No pending imports for this link.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <p className="text-muted mb-0">
              Select a CBT link to review pending scores.
            </p>
          )}
        </div>
      </div>
    </>
  );
}
