"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { PermissionGate } from "@/components/PermissionGate";
import { useAuth } from "@/contexts/AuthContext";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import {
  createFeeAssignment,
  deleteFeeAssignment,
  FEE_SCOPES,
  listFeeAssignments,
  previewFeeAssignment,
  syncFeeAssignmentStudents,
  updateFeeAssignment,
  type BillSyncSummary,
  type FeeAssignment,
  type FeeAssignmentPayload,
  type FeeAssignmentPreview,
  type FeeScope,
} from "@/lib/feeAssignments";
import { listFeeItems, type FeeItem } from "@/lib/fees";
import { listSessions, type Session } from "@/lib/sessions";
import { listStudents, type StudentSummary } from "@/lib/students";
import { formatNaira } from "@/lib/studentBills";
import { listTermsBySession, type Term } from "@/lib/terms";

type FeedbackKind = "success" | "info" | "warning" | "danger";

interface FeedbackState {
  type: FeedbackKind;
  message: string;
}

interface AssignmentFormState {
  scope: FeeScope;
  sessionId: string;
  termId: string;
  schoolClassId: string;
  classArmId: string;
  feeItemId: string;
  amount: string;
  description: string;
  dueDate: string;
  isMandatory: boolean;
  studentIds: string[];
}

const initialForm: AssignmentFormState = {
  scope: "school",
  sessionId: "",
  termId: "",
  schoolClassId: "",
  classArmId: "",
  feeItemId: "",
  amount: "",
  description: "",
  dueDate: "",
  isMandatory: true,
  studentIds: [],
};

function describeSync(summary: BillSyncSummary | undefined): string {
  if (!summary) {
    return "";
  }
  return ` ${summary.students} student bill(s) updated: ${summary.items_created} added, ${summary.items_updated} changed, ${summary.items_removed} removed.`;
}

interface StudentPickerProps {
  /** Keeps checkbox ids unique when two pickers are on the page at once. */
  idPrefix: string;
  students: StudentSummary[];
  search: string;
  onSearch: (value: string) => void;
  selected: string[];
  onToggle: (studentId: string) => void;
}

function StudentPicker({
  idPrefix,
  students,
  search,
  onSearch,
  selected,
  onToggle,
}: StudentPickerProps) {
  return (
    <>
      <input
        type="search"
        className="form-control mb-2"
        placeholder="Search by name or admission number"
        value={search}
        onChange={(event) => onSearch(event.target.value)}
        aria-label="Search students"
      />
      <div className="border rounded p-2" style={{ maxHeight: "220px", overflowY: "auto" }}>
        {students.length ? (
          students.map((student) => {
            const id = String(student.id);
            return (
              <div className="form-check" key={id}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  id={`${idPrefix}-student-${id}`}
                  checked={selected.includes(id)}
                  onChange={() => onToggle(id)}
                />
                <label className="form-check-label" htmlFor={`${idPrefix}-student-${id}`}>
                  {student.first_name} {student.last_name}{" "}
                  <span className="text-muted">({student.admission_no})</span>
                </label>
              </div>
            );
          })
        ) : (
          <p className="text-muted mb-0">No students found.</p>
        )}
      </div>
      <small className="text-muted">{selected.length} selected</small>
    </>
  );
}

export default function FeeAssignmentsPage() {
  const { schoolContext } = useAuth();
  const [form, setForm] = useState<AssignmentFormState>(initialForm);
  const [assignments, setAssignments] = useState<FeeAssignment[]>([]);
  const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [studentSearch, setStudentSearch] = useState("");
  const [preview, setPreview] = useState<FeeAssignmentPreview | null>(null);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [previewing, setPreviewing] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [scopeFilter, setScopeFilter] = useState<FeeScope | "">("");
  const [editing, setEditing] = useState<FeeAssignment | null>(null);
  const [editingStudentIds, setEditingStudentIds] = useState<string[]>([]);
  const [editSearch, setEditSearch] = useState("");
  const [editStudents, setEditStudents] = useState<StudentSummary[]>([]);
  const [savingStudents, setSavingStudents] = useState(false);

  const fail = useCallback((error: unknown, fallback: string) => {
    setFeedback({
      type: "danger",
      message: error instanceof Error ? error.message : fallback,
    });
  }, []);

  const loadAssignments = useCallback(
    async (sessionId: string, termId: string, scope: FeeScope | "") => {
      if (!sessionId || !termId) {
        setAssignments([]);
        return;
      }
      setLoadingList(true);
      try {
        setAssignments(
          await listFeeAssignments({
            session_id: sessionId,
            term_id: termId,
            scope: scope || undefined,
          }),
        );
      } catch (error) {
        fail(error, "Unable to load fee assignments.");
      } finally {
        setLoadingList(false);
      }
    },
    [fail],
  );

  useEffect(() => {
    listFeeItems().then(setFeeItems).catch((error) => fail(error, "Unable to load fee items."));
    listClasses().then(setClasses).catch((error) => fail(error, "Unable to load classes."));
    listSessions()
      .then((loaded) => {
        setSessions(loaded);
        // Default to the period the school itself is currently in, rather
        // than guessing from the session list.
        const preferred =
          schoolContext.current_session_id ?? loaded[0]?.id ?? null;
        if (preferred !== null) {
          setForm((prev) => ({
            ...prev,
            sessionId: prev.sessionId || String(preferred),
          }));
        }
      })
      .catch((error) => fail(error, "Unable to load sessions."));
  }, [fail, schoolContext.current_session_id]);

  useEffect(() => {
    if (!form.sessionId) {
      setTerms([]);
      return;
    }
    listTermsBySession(form.sessionId)
      .then((loaded) => {
        setTerms(loaded);
        const preferred =
          loaded.find((term) => String(term.id) === String(schoolContext.current_term_id)) ??
          loaded[0];
        setForm((prev) => ({
          ...prev,
          termId: prev.termId || (preferred ? String(preferred.id) : ""),
        }));
      })
      .catch((error) => fail(error, "Unable to load terms."));
  }, [form.sessionId, fail, schoolContext.current_term_id]);

  useEffect(() => {
    if (!form.schoolClassId) {
      setArms([]);
      return;
    }
    listClassArms(form.schoolClassId)
      .then(setArms)
      .catch((error) => fail(error, "Unable to load class arms."));
  }, [form.schoolClassId, fail]);

  // Only the student scope needs a roster, and it is the one scope where the
  // list can be long -- so it loads on demand rather than on mount.
  useEffect(() => {
    if (form.scope !== "student") {
      return;
    }
    listStudents({ per_page: 200, search: studentSearch || undefined, status: "active" })
      .then((page) => setStudents(page.data))
      .catch((error) => fail(error, "Unable to load students."));
  }, [form.scope, studentSearch, fail]);

  useEffect(() => {
    if (!editing) {
      return;
    }
    listStudents({ per_page: 200, search: editSearch || undefined, status: "active" })
      .then((page) => setEditStudents(page.data))
      .catch((error) => fail(error, "Unable to load students."));
  }, [editing, editSearch, fail]);

  useEffect(() => {
    void loadAssignments(form.sessionId, form.termId, scopeFilter);
  }, [form.sessionId, form.termId, scopeFilter, loadAssignments]);

  // Changing scope invalidates whichever target the previous scope had chosen.
  const setScope = (scope: FeeScope) => {
    setPreview(null);
    setForm((prev) => ({
      ...prev,
      scope,
      schoolClassId: scope === "class" || scope === "class_arm" ? prev.schoolClassId : "",
      classArmId: scope === "class_arm" ? prev.classArmId : "",
      studentIds: scope === "student" ? prev.studentIds : [],
    }));
  };

  const buildPayload = (): FeeAssignmentPayload | null => {
    if (!form.sessionId || !form.termId || !form.feeItemId || form.amount === "") {
      setFeedback({
        type: "warning",
        message: "Choose a session, term and fee item, and enter an amount.",
      });
      return null;
    }
    if (form.scope === "class" && !form.schoolClassId) {
      setFeedback({ type: "warning", message: "Choose the class this fee applies to." });
      return null;
    }
    if (form.scope === "class_arm" && !form.classArmId) {
      setFeedback({ type: "warning", message: "Choose the class arm this fee applies to." });
      return null;
    }
    if (form.scope === "student" && form.studentIds.length === 0) {
      setFeedback({ type: "warning", message: "Select at least one student." });
      return null;
    }

    return {
      scope: form.scope,
      session_id: form.sessionId,
      term_id: form.termId,
      fee_item_id: form.feeItemId,
      amount: form.amount,
      school_class_id: form.scope === "class" ? form.schoolClassId : null,
      class_arm_id: form.scope === "class_arm" ? form.classArmId : null,
      student_ids: form.scope === "student" ? form.studentIds : undefined,
      description: form.description || null,
      due_date: form.dueDate || null,
      is_mandatory: form.isMandatory,
    };
  };

  const handlePreview = async () => {
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    setPreviewing(true);
    try {
      setPreview(await previewFeeAssignment(payload));
      setFeedback(null);
    } catch (error) {
      fail(error, "Unable to preview this assignment.");
    } finally {
      setPreviewing(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const payload = buildPayload();
    if (!payload) {
      return;
    }
    setSubmitting(true);
    try {
      const result = await createFeeAssignment(payload);
      setFeedback({
        type: "success",
        message: `Fee assigned.${describeSync(result.meta?.bill_sync)}`,
      });
      setPreview(null);
      setForm((prev) => ({
        ...initialForm,
        sessionId: prev.sessionId,
        termId: prev.termId,
      }));
      await loadAssignments(form.sessionId, form.termId, scopeFilter);
    } catch (error) {
      fail(error, "Unable to assign this fee.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (assignment: FeeAssignment) => {
    try {
      const result = await updateFeeAssignment(assignment.id, {
        is_active: !assignment.is_active,
      });
      setFeedback({
        type: "success",
        message: `${assignment.is_active ? "Deactivated" : "Reactivated"}.${describeSync(result.meta?.bill_sync)}`,
      });
      await loadAssignments(form.sessionId, form.termId, scopeFilter);
    } catch (error) {
      fail(error, "Unable to update this assignment.");
    }
  };

  const handleAmountChange = async (assignment: FeeAssignment) => {
    const next = window.prompt(
      `New amount for ${assignment.fee_item?.name ?? "this fee"}`,
      assignment.amount,
    );
    if (next === null || next.trim() === "") {
      return;
    }
    try {
      const result = await updateFeeAssignment(assignment.id, { amount: next.trim() });
      setFeedback({
        type: "success",
        message: `Amount updated.${describeSync(result.meta?.bill_sync)}`,
      });
      await loadAssignments(form.sessionId, form.termId, scopeFilter);
    } catch (error) {
      fail(error, "Unable to update the amount.");
    }
  };

  const handleDelete = async (assignment: FeeAssignment) => {
    const label = assignment.fee_item?.name ?? "this fee";
    if (
      !window.confirm(
        `Remove ${label} from ${assignment.scope_label}? It comes off every bill it was added to.`,
      )
    ) {
      return;
    }
    try {
      const result = await deleteFeeAssignment(assignment.id);
      setFeedback({
        type: "success",
        message: `Assignment removed. ${result.meta?.bill_items_removed ?? 0} bill line(s) taken off.`,
      });
      await loadAssignments(form.sessionId, form.termId, scopeFilter);
    } catch (error) {
      fail(error, "Unable to remove this assignment.");
    }
  };

  const openStudentEditor = (assignment: FeeAssignment) => {
    setEditing(assignment);
    setEditingStudentIds((assignment.students ?? []).map((student) => student.id));
    setEditSearch("");
  };

  const handleSaveStudents = async () => {
    if (!editing) {
      return;
    }
    if (editingStudentIds.length === 0) {
      setFeedback({ type: "warning", message: "A student fee needs at least one student." });
      return;
    }
    setSavingStudents(true);
    try {
      const result = await syncFeeAssignmentStudents(editing.id, editingStudentIds);
      setFeedback({
        type: "success",
        message: `Student list updated.${describeSync(result.meta?.bill_sync)}`,
      });
      setEditing(null);
      await loadAssignments(form.sessionId, form.termId, scopeFilter);
    } catch (error) {
      fail(error, "Unable to update the student list.");
    } finally {
      setSavingStudents(false);
    }
  };

  const toggleStudent = (studentId: string) => {
    setPreview(null);
    setForm((prev) => ({
      ...prev,
      studentIds: prev.studentIds.includes(studentId)
        ? prev.studentIds.filter((id) => id !== studentId)
        : [...prev.studentIds, studentId],
    }));
  };

  const activeFeeItems = useMemo(
    () => feeItems.filter((item) => item.is_active !== false),
    [feeItems],
  );

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Fee Assignments</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Finance</li>
          <li>Fee Assignments</li>
        </ul>
      </div>

      {feedback ? (
        <div className={`alert alert-${feedback.type}`} role="alert">
          {feedback.message}
        </div>
      ) : null}

      <PermissionGate
        permission="finance.assignments.create"
        fallback={null}
      >
        <div className="card height-auto mb-4">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>Assign a Fee</h3>
              </div>
            </div>
            <p className="text-muted">
              Fees stack. A student in JSS 2A is billed the school-wide fees,
              plus the JSS 2 class fees, plus the JSS 2A arm fees, plus anything
              assigned to them individually.
            </p>

            <form onSubmit={handleSubmit}>
              <div className="form-row">
                <div className="col-md-3 form-group">
                  <label htmlFor="assignment-scope">Apply To *</label>
                  <select
                    id="assignment-scope"
                    className="form-control"
                    value={form.scope}
                    onChange={(event) => setScope(event.target.value as FeeScope)}
                  >
                    {FEE_SCOPES.map((scope) => (
                      <option key={scope.value} value={scope.value}>
                        {scope.label}
                      </option>
                    ))}
                  </select>
                  <small className="text-muted">
                    {FEE_SCOPES.find((scope) => scope.value === form.scope)?.hint}
                  </small>
                </div>

                <div className="col-md-3 form-group">
                  <label htmlFor="assignment-session">Session *</label>
                  <select
                    id="assignment-session"
                    className="form-control"
                    value={form.sessionId}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        sessionId: event.target.value,
                        termId: "",
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

                <div className="col-md-3 form-group">
                  <label htmlFor="assignment-term">Term *</label>
                  <select
                    id="assignment-term"
                    className="form-control"
                    value={form.termId}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, termId: event.target.value }))
                    }
                    required
                  >
                    <option value="">Select term</option>
                    {terms.map((term) => (
                      <option key={term.id} value={term.id}>
                        {term.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="col-md-3 form-group">
                  <label htmlFor="assignment-fee-item">Fee *</label>
                  <select
                    id="assignment-fee-item"
                    className="form-control"
                    value={form.feeItemId}
                    onChange={(event) => {
                      const feeItemId = event.target.value;
                      const item = activeFeeItems.find(
                        (candidate) => String(candidate.id) === feeItemId,
                      );
                      setPreview(null);
                      setForm((prev) => ({
                        ...prev,
                        feeItemId,
                        amount:
                          prev.amount === "" && item?.default_amount
                            ? String(item.default_amount)
                            : prev.amount,
                      }));
                    }}
                    required
                  >
                    <option value="">Select fee</option>
                    {activeFeeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {form.scope === "class" || form.scope === "class_arm" ? (
                <div className="form-row">
                  <div className="col-md-3 form-group">
                    <label htmlFor="assignment-class">Class *</label>
                    <select
                      id="assignment-class"
                      className="form-control"
                      value={form.schoolClassId}
                      onChange={(event) => {
                        setPreview(null);
                        setForm((prev) => ({
                          ...prev,
                          schoolClassId: event.target.value,
                          classArmId: "",
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

                  {form.scope === "class_arm" ? (
                    <div className="col-md-3 form-group">
                      <label htmlFor="assignment-arm">Class Arm *</label>
                      <select
                        id="assignment-arm"
                        className="form-control"
                        value={form.classArmId}
                        onChange={(event) => {
                          setPreview(null);
                          setForm((prev) => ({ ...prev, classArmId: event.target.value }));
                        }}
                        required
                        disabled={!form.schoolClassId}
                      >
                        <option value="">Select arm</option>
                        {arms.map((arm) => (
                          <option key={arm.id} value={arm.id}>
                            {arm.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {form.scope === "student" ? (
                <div className="form-row">
                  <div className="col-md-12 form-group">
                    <label htmlFor="assignment-student-search">Students *</label>
                    <StudentPicker
                      idPrefix="new"
                      students={students}
                      search={studentSearch}
                      onSearch={setStudentSearch}
                      selected={form.studentIds}
                      onToggle={toggleStudent}
                    />
                  </div>
                </div>
              ) : null}

              <div className="form-row">
                <div className="col-md-3 form-group">
                  <label htmlFor="assignment-amount">Amount *</label>
                  <input
                    id="assignment-amount"
                    type="number"
                    min="0"
                    step="0.01"
                    className="form-control"
                    value={form.amount}
                    onChange={(event) => {
                      setPreview(null);
                      setForm((prev) => ({ ...prev, amount: event.target.value }));
                    }}
                    required
                  />
                </div>
                <div className="col-md-3 form-group">
                  <label htmlFor="assignment-due">Due Date</label>
                  <input
                    id="assignment-due"
                    type="date"
                    className="form-control"
                    value={form.dueDate}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, dueDate: event.target.value }))
                    }
                  />
                </div>
                <div className="col-md-4 form-group">
                  <label htmlFor="assignment-description">Note</label>
                  <input
                    id="assignment-description"
                    type="text"
                    className="form-control"
                    value={form.description}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                </div>
                <div className="col-md-2 form-group">
                  <div className="form-check mt-4">
                    <input
                      id="assignment-mandatory"
                      className="form-check-input"
                      type="checkbox"
                      checked={form.isMandatory}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, isMandatory: event.target.checked }))
                      }
                    />
                    <label className="form-check-label" htmlFor="assignment-mandatory">
                      Mandatory
                    </label>
                  </div>
                </div>
              </div>

              {preview ? (
                <div className="alert alert-info" role="status">
                  This will bill <strong>{preview.student_count}</strong> student(s){" "}
                  {formatNaira(preview.amount)} each &mdash;{" "}
                  <strong>{formatNaira(preview.total_amount)}</strong> in total.
                </div>
              ) : null}

              <div className="text-right">
                <button
                  type="button"
                  className="btn btn-outline-secondary mr-2"
                  onClick={handlePreview}
                  disabled={previewing}
                >
                  {previewing ? "Checking..." : "Preview"}
                </button>
                <button
                  type="submit"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  disabled={submitting}
                >
                  {submitting ? "Assigning..." : "Assign Fee"}
                </button>
              </div>
            </form>
          </div>
        </div>
      </PermissionGate>

      {editing ? (
        <div className="card height-auto mb-4">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>
                  Students for {editing.fee_item?.name ?? "this fee"} (
                  {formatNaira(editing.amount)})
                </h3>
              </div>
              <button
                type="button"
                className="btn btn-link"
                onClick={() => setEditing(null)}
              >
                Close
              </button>
            </div>
            <p className="text-muted">
              Students you remove here stop being billed this fee, and the line
              comes off their bill unless a payment has already been allocated
              to it.
            </p>
            <StudentPicker
              idPrefix="edit"
              students={editStudents}
              search={editSearch}
              onSearch={setEditSearch}
              selected={editingStudentIds}
              onToggle={(studentId) =>
                setEditingStudentIds((prev) =>
                  prev.includes(studentId)
                    ? prev.filter((id) => id !== studentId)
                    : [...prev, studentId],
                )
              }
            />
            <div className="text-right mt-3">
              <button
                type="button"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                onClick={handleSaveStudents}
                disabled={savingStudents}
              >
                {savingStudents ? "Saving..." : "Save Students"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Assignments This Term</h3>
            </div>
            <div className="dropdown">
              <select
                className="form-control"
                value={scopeFilter}
                onChange={(event) => setScopeFilter(event.target.value as FeeScope | "")}
                aria-label="Filter by scope"
              >
                <option value="">All scopes</option>
                {FEE_SCOPES.map((scope) => (
                  <option key={scope.value} value={scope.value}>
                    {scope.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table table-bordered">
              <thead>
                <tr>
                  <th>Fee</th>
                  <th>Applies To</th>
                  <th>Amount</th>
                  <th>Students</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingList ? (
                  <tr>
                    <td colSpan={6} className="text-center">
                      Loading...
                    </td>
                  </tr>
                ) : assignments.length ? (
                  assignments.map((assignment) => (
                    <tr key={assignment.id}>
                      <td>
                        {assignment.fee_item?.name ?? "—"}
                        {assignment.description ? (
                          <div className="text-muted small">{assignment.description}</div>
                        ) : null}
                      </td>
                      <td>{assignment.scope_label}</td>
                      <td>{formatNaira(assignment.amount)}</td>
                      <td>
                        {assignment.scope === "student"
                          ? (assignment.student_count ?? 0)
                          : "—"}
                      </td>
                      <td>
                        <span
                          className={`badge badge-${assignment.is_active ? "success" : "secondary"}`}
                        >
                          {assignment.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td>
                        <PermissionGate permission="finance.assignments.update">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-primary mr-2"
                            onClick={() => handleAmountChange(assignment)}
                          >
                            Amount
                          </button>
                          {assignment.scope === "student" ? (
                            <button
                              type="button"
                              className="btn btn-sm btn-outline-primary mr-2"
                              onClick={() => openStudentEditor(assignment)}
                            >
                              Students
                            </button>
                          ) : null}
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-secondary mr-2"
                            onClick={() => handleToggleActive(assignment)}
                          >
                            {assignment.is_active ? "Deactivate" : "Reactivate"}
                          </button>
                        </PermissionGate>
                        <PermissionGate permission="finance.assignments.delete">
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger"
                            onClick={() => handleDelete(assignment)}
                          >
                            Remove
                          </button>
                        </PermissionGate>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center">
                      {form.sessionId && form.termId
                        ? "No fees assigned for this session and term yet."
                        : "Choose a session and term to see assignments."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
