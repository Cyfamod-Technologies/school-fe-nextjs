"use client";

import Link from "next/link";
import { FormEvent, Fragment, startTransition, useCallback, useEffect, useMemo, useState } from "react";
import { listAllSubjects, type Subject } from "@/lib/subjects";
import { listStaffForDropdown, type Staff } from "@/lib/staff";
import { listSessions, type Session } from "@/lib/sessions";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import {
  listClassArmSections,
  type ClassArmSection,
} from "@/lib/classArmSections";
import {
  createSubjectTeacherAssignment,
  bulkSaveSubjectTeacherAssignments,
  deleteSubjectTeacherAssignment,
  listSubjectTeacherAssignments,
  type SubjectTeacherAssignmentContext,
  updateSubjectTeacherAssignment,
  type SubjectTeacherAssignment,
  type SubjectTeacherAssignmentListResponse,
} from "@/lib/subjectTeacherAssignments";
import {
  listSubjectAssignments,
  type SubjectAssignment,
} from "@/lib/subjectAssignments";
import {
  listStudents,
  type StudentSummary,
} from "@/lib/students";
import { useAuth } from "@/contexts/AuthContext";

interface AssignmentForm {
  subjectIds: string[];
  staff_id: string;
  session_id: string;
  selectedClassIds: string[];
  selectedClassArmIdsByClass: Record<string, string[]>;
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
  student_ids: string[];
}

const initialForm: AssignmentForm = {
  subjectIds: [],
  staff_id: "",
  session_id: "",
  selectedClassIds: [],
  selectedClassArmIdsByClass: {},
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
  student_ids: [],
};

interface AssignmentFilters {
  search: string;
  subject_id: string;
  staff_id: string;
  session_id: string;
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
}

const initialFilters: AssignmentFilters = {
  search: "",
  subject_id: "",
  staff_id: "",
  session_id: "",
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
};

interface BulkAssignmentRow {
  client_id: string;
  id?: string;
  subject_id: string;
  school_class_id: string;
  class_arm_id: string;
  student_ids: Array<string | number> | null;
}

interface AssignmentGroupEditor {
  staff_id: string;
  session_id: string;
  existing: boolean;
  rows: BulkAssignmentRow[];
}

const emptyBulkRow = (): BulkAssignmentRow => ({
  client_id: `${Date.now()}-${Math.random()}`,
  subject_id: "",
  school_class_id: "",
  class_arm_id: "",
  student_ids: null,
});

export default function AssignTeachersPage() {
  const { schoolContext } = useAuth();
  const currentSessionId = schoolContext.current_session_id
    ? String(schoolContext.current_session_id)
    : "";
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [teachers, setTeachers] = useState<Staff[]>([]);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classArmsByClass, setClassArmsByClass] = useState<Record<string, ClassArm[]>>({});
  const [classSectionsByKey, setClassSectionsByKey] = useState<
    Record<string, ClassArmSection[]>
  >({});
  const [classSubjectsByKey, setClassSubjectsByKey] = useState<
    Record<string, Subject[]>
  >({});
  const [classSubjectsLoading, setClassSubjectsLoading] = useState(false);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [studentsLoading, setStudentsLoading] = useState(false);
  const [studentSearch, setStudentSearch] = useState("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Record<string, boolean>>({});

  const [form, setForm] = useState<AssignmentForm>(() => ({
    ...initialForm,
    session_id: currentSessionId,
  }));
  const [filters, setFilters] = useState<AssignmentFilters>(() => ({
    ...initialFilters,
    session_id: currentSessionId,
  }));

  const [editingId, setEditingId] = useState<string | null>(null);
  const [groupEditor, setGroupEditor] = useState<AssignmentGroupEditor | null>(null);
  const [groupSaving, setGroupSaving] = useState(false);
  const [groupError, setGroupError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const perPage = 10;

  const [data, setData] =
    useState<SubjectTeacherAssignmentListResponse | null>(null);
  const [assignments, setAssignments] = useState<SubjectTeacherAssignment[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const selectedSubjectSet = useMemo(
    () => new Set(form.subjectIds),
    [form.subjectIds],
  );

  const selectedClassSet = useMemo(
    () => new Set(form.selectedClassIds),
    [form.selectedClassIds],
  );

  const ensureClassArms = useCallback(
    async (classId: string) => {
      if (!classId || classArmsByClass[classId]) {
        return;
      }
      try {
        const arms = await listClassArms(classId);
        setClassArmsByClass((prev) => ({
          ...prev,
          [classId]: arms,
        }));
      } catch (error) {
        console.error("Unable to load class arms", error);
      }
    },
    [classArmsByClass],
  );

  const ensureClassSections = useCallback(
    async (classId: string, armId: string) => {
      if (!classId || !armId) {
        return;
      }
      const key = `${classId}:${armId}`;
      if (classSectionsByKey[key]) {
        return;
      }
      try {
        const sections = await listClassArmSections(classId, armId);
        setClassSectionsByKey((prev) => ({
          ...prev,
          [key]: sections,
        }));
      } catch (error) {
        console.error("Unable to load class sections", error);
      }
    },
    [classSectionsByKey],
  );

  const ensureClassSubjects = useCallback(
    async (classId: string, armId?: string) => {
      if (!classId) {
        return;
      }
      const key = `${currentSessionId}:${classId}:${armId || "all"}`;
      if (classSubjectsByKey[key]) {
        return;
      }
      setClassSubjectsLoading(true);
      try {
        const response = await listSubjectAssignments({
          session_id: currentSessionId,
          school_class_id: classId,
          class_arm_id: armId || undefined,
          per_page: 500,
        });
        const subjectMap = new Map<string, Subject>();
        (response.data ?? []).forEach((assignment: SubjectAssignment) => {
          const subject = assignment.subject;
          if (subject?.id) {
            subjectMap.set(String(subject.id), subject);
          }
        });
        setClassSubjectsByKey((prev) => ({
          ...prev,
          [key]: Array.from(subjectMap.values()),
        }));
      } catch (error) {
        console.error("Unable to load class subjects", error);
        setClassSubjectsByKey((prev) => ({
          ...prev,
          [key]: [],
        }));
      } finally {
        setClassSubjectsLoading(false);
      }
    },
    [classSubjectsByKey, currentSessionId],
  );

  const fetchStudentsForClass = useCallback(
    async (classId: string, armId?: string, sectionId?: string, sessionId?: string) => {
      if (!classId) {
        setStudents([]);
        return;
      }
      setStudentsLoading(true);
      try {
        const response = await listStudents({
          per_page: 500,
          school_class_id: classId,
          class_arm_id: armId || undefined,
          class_section_id: sectionId || undefined,
          current_session_id: sessionId || undefined,
          sortBy: "first_name",
          sortDirection: "asc",
        });
        setStudents(Array.isArray(response.data) ? response.data : []);
      } catch (error) {
        console.error("Unable to load students for assignment", error);
        setStudents([]);
      } finally {
        setStudentsLoading(false);
      }
    },
    [],
  );

  const selectedContexts = useMemo<SubjectTeacherAssignmentContext[]>(() => {
    if (editingId) {
      if (!form.school_class_id) {
        return [];
      }

      return [{
        school_class_id: form.school_class_id,
        class_arm_id: form.class_arm_id || null,
      }];
    }

    return form.selectedClassIds.flatMap<SubjectTeacherAssignmentContext>((classId) => {
      const armIds = form.selectedClassArmIdsByClass[classId] ?? [];
      if (armIds.length === 0) {
        return [{
          school_class_id: classId,
          class_arm_id: null,
        }];
      }

      return armIds.map((armId) => ({
        school_class_id: classId,
        class_arm_id: armId,
      }));
    });
  }, [editingId, form.class_arm_id, form.school_class_id, form.selectedClassArmIdsByClass, form.selectedClassIds]);

  const hasSingleSelectedContext = selectedContexts.length === 1;

  const singleSelectedContext = useMemo(
    () => hasSingleSelectedContext ? selectedContexts[0] : null,
    [hasSingleSelectedContext, selectedContexts],
  );

  const subjectsForForm = useMemo(() => {
    if (selectedContexts.length === 0) {
      return [];
    }

    const subjectMap = new Map<string, Subject>();
    selectedContexts.forEach((context) => {
      const key = `${currentSessionId}:${context.school_class_id}:${context.class_arm_id || "all"}`;
      (classSubjectsByKey[key] ?? []).forEach((subject) => {
        if (subject?.id) {
          subjectMap.set(String(subject.id), subject);
        }
      });
    });

    return Array.from(subjectMap.values());
  }, [classSubjectsByKey, currentSessionId, selectedContexts]);

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase();
    if (!term) {
      return students;
    }
    return students.filter((student) => {
      const name = [
        student.first_name,
        student.middle_name,
        student.last_name,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      const admission = String(student.admission_no ?? "").toLowerCase();
      return name.includes(term) || admission.includes(term);
    });
  }, [studentSearch, students]);

  const classArmsForFilter = useMemo(() => {
    if (!filters.school_class_id) {
      return [];
    }
    return classArmsByClass[filters.school_class_id] ?? [];
  }, [classArmsByClass, filters.school_class_id]);

  const selectedStudentCount = useMemo(() => {
    return Object.values(selectedStudentIds).filter(Boolean).length;
  }, [selectedStudentIds]);

  const selectedStudentIdList = useMemo(() => {
    return Object.keys(selectedStudentIds).filter(
      (studentId) => selectedStudentIds[studentId],
    );
  }, [selectedStudentIds]);

  const allFilteredSelected = useMemo(() => {
    if (!filteredStudents.length) {
      return false;
    }
    return filteredStudents.every(
      (student) => selectedStudentIds[String(student.id)],
    );
  }, [filteredStudents, selectedStudentIds]);

  const handleSubjectToggle = useCallback(
    (subjectId: string, checked: boolean) => {
      setForm((prev) => {
        if (editingId) {
          return {
            ...prev,
            subjectIds: checked ? [subjectId] : [],
          };
        }

        const nextIds = new Set(prev.subjectIds);
        if (checked) {
          nextIds.add(subjectId);
        } else {
          nextIds.delete(subjectId);
        }

        return {
          ...prev,
          subjectIds: Array.from(nextIds),
        };
      });
    },
    [editingId],
  );

  const handleClassToggle = useCallback(
    (classId: string, checked: boolean) => {
      setForm((prev) => {
        if (editingId) {
          return {
            ...prev,
            school_class_id: checked ? classId : "",
            class_arm_id: "",
            class_section_id: "",
            subjectIds: [],
            staff_id: "",
            student_ids: [],
          };
        }

        const nextClassIds = new Set(prev.selectedClassIds);
        const nextClassArmIdsByClass = { ...prev.selectedClassArmIdsByClass };

        if (checked) {
          nextClassIds.add(classId);
        } else {
          nextClassIds.delete(classId);
          delete nextClassArmIdsByClass[classId];
        }

        return {
          ...prev,
          selectedClassIds: Array.from(nextClassIds),
          selectedClassArmIdsByClass: nextClassArmIdsByClass,
          class_section_id: "",
          subjectIds: [],
          staff_id: "",
          student_ids: [],
        };
      });
      setSelectedStudentIds({});
      setStudentSearch("");
      if (checked) {
        ensureClassArms(classId).catch((err) => console.error(err));
      }
    },
    [editingId, ensureClassArms],
  );

  const handleClassArmToggle = useCallback(
    (classId: string, armId: string, checked: boolean) => {
      setForm((prev) => {
        if (editingId) {
          return {
            ...prev,
            class_arm_id: checked ? armId : "",
            class_section_id: "",
            subjectIds: [],
            staff_id: "",
            student_ids: [],
          };
        }

        const existingArmIds = prev.selectedClassArmIdsByClass[classId] ?? [];
        const nextArmIds = new Set(existingArmIds);
        if (checked) {
          nextArmIds.add(armId);
        } else {
          nextArmIds.delete(armId);
        }

        return {
          ...prev,
          selectedClassArmIdsByClass: {
            ...prev.selectedClassArmIdsByClass,
            [classId]: Array.from(nextArmIds),
          },
          class_section_id: "",
          subjectIds: [],
          staff_id: "",
          student_ids: [],
        };
      });
      setSelectedStudentIds({});
      setStudentSearch("");
      if (checked) {
        ensureClassSections(classId, armId).catch((err) => console.error(err));
      }
    },
    [editingId, ensureClassSections],
  );

  useEffect(() => {
    listAllSubjects()
      .then(setSubjects)
      .catch((err) => console.error("Unable to load subjects", err));
    listStaffForDropdown()
      .then(setTeachers)
      .catch((err) => console.error("Unable to load staff", err));
    listSessions()
      .then(setSessions)
      .catch((err) => console.error("Unable to load sessions", err));
    listClasses()
      .then(setClasses)
      .catch((err) => console.error("Unable to load classes", err));
  }, []);

  useEffect(() => {
    if (!currentSessionId) return;

    setFilters((previous) =>
      previous.session_id
        ? previous
        : { ...previous, session_id: currentSessionId },
    );
    setForm((previous) =>
      previous.session_id
        ? previous
        : { ...previous, session_id: currentSessionId },
    );
  }, [currentSessionId]);

  useEffect(() => {
    if (editingId) {
      if (form.school_class_id) {
        ensureClassArms(form.school_class_id).catch((err) => console.error(err));
      }
      return;
    }

    form.selectedClassIds.forEach((classId) => {
      ensureClassArms(classId).catch((err) => console.error(err));
    });
  }, [editingId, form.school_class_id, form.selectedClassIds, ensureClassArms]);

  useEffect(() => {
    if (form.school_class_id && form.class_arm_id) {
      ensureClassSections(form.school_class_id, form.class_arm_id).catch((err) =>
        console.error(err),
      );
    }
  }, [form.school_class_id, form.class_arm_id, ensureClassSections]);

  useEffect(() => {
    if (selectedContexts.length === 0) {
      return;
    }

    selectedContexts.forEach((context) => {
      ensureClassSubjects(
        String(context.school_class_id),
        context.class_arm_id ? String(context.class_arm_id) : undefined,
      ).catch((err) => console.error(err));
    });
  }, [ensureClassSubjects, selectedContexts]);

  useEffect(() => {
    if (!singleSelectedContext) {
      setStudents([]);
      setSelectedStudentIds({});
      return;
    }
    fetchStudentsForClass(
      String(singleSelectedContext.school_class_id),
      singleSelectedContext.class_arm_id ? String(singleSelectedContext.class_arm_id) : undefined,
      form.class_section_id || undefined,
      form.session_id || undefined,
    ).catch((err) => console.error(err));
  }, [
    singleSelectedContext,
    form.class_section_id,
    form.session_id,
    fetchStudentsForClass,
  ]);

  useEffect(() => {
    if (form.subjectIds.length === 0) {
      return;
    }
    const availableSubjectIds = new Set(
      subjectsForForm.map((subject) => String(subject.id)),
    );
    const nextSubjectIds = form.subjectIds.filter((subjectId) =>
      availableSubjectIds.has(subjectId),
    );
    if (nextSubjectIds.length !== form.subjectIds.length) {
      setForm((prev) => ({
        ...prev,
        subjectIds: nextSubjectIds,
      }));
    }
  }, [subjectsForForm, form.subjectIds]);

  useEffect(() => {
    if (filters.school_class_id) {
      ensureClassArms(filters.school_class_id).catch((err) => console.error(err));
    }
  }, [filters.school_class_id, ensureClassArms]);

  useEffect(() => {
    if (filters.school_class_id && filters.class_arm_id) {
      ensureClassSections(filters.school_class_id, filters.class_arm_id).catch(
        (err) => console.error(err),
      );
    }
  }, [filters.school_class_id, filters.class_arm_id, ensureClassSections]);

  const fetchAssignments = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await listSubjectTeacherAssignments({
        page,
        per_page: perPage,
        search: filters.search || undefined,
        subject_id: filters.subject_id || undefined,
        staff_id: filters.staff_id || undefined,
        session_id: filters.session_id || undefined,
        school_class_id: filters.school_class_id || undefined,
        class_arm_id: filters.class_arm_id || undefined,
        class_section_id: filters.class_section_id || undefined,
      });
      setData(response);
      setAssignments(response.data ?? []);
      setListError(null);
    } catch (err) {
      console.error("Unable to load subject/teacher assignments", err);
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

  const groupedAssignments = useMemo(() => {
    const groups = new Map<string, SubjectTeacherAssignment[]>();
    assignments.forEach((assignment) => {
      const key = `${assignment.staff_id}:${assignment.session_id}`;
      const rows = groups.get(key) ?? [];
      rows.push(assignment);
      groups.set(key, rows);
    });
    return Array.from(groups.entries()).map(([key, rows]) => ({ key, rows }));
  }, [assignments]);

  const handleToggleStudent = useCallback(
    (studentId: string | number) => () => {
      const key = String(studentId);
      setSelectedStudentIds((prev) => {
        const next = { ...prev };
        if (next[key]) {
          delete next[key];
        } else {
          next[key] = true;
        }
        return next;
      });
    },
    [],
  );

  const handleToggleAllFiltered = useCallback(() => {
    setSelectedStudentIds((prev) => {
      if (!filteredStudents.length) {
        return prev;
      }
      const next = { ...prev };
      if (allFilteredSelected) {
        filteredStudents.forEach((student) => {
          delete next[String(student.id)];
        });
      } else {
        filteredStudents.forEach((student) => {
          next[String(student.id)] = true;
        });
      }
      return next;
    });
  }, [allFilteredSelected, filteredStudents]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormError(null);

    if (form.subjectIds.length === 0 || !form.staff_id || !form.session_id) {
      setFormError("Please complete all required fields.");
      return;
    }
    if (selectedContexts.length === 0) {
      setFormError("Please select at least one class or class arm for this assignment.");
      return;
    }

    const payload = {
      ...(editingId
        ? {
            subject_id: form.subjectIds[0],
            school_class_id: form.school_class_id,
            class_arm_id: form.class_arm_id || null,
          }
        : {
            subject_ids: form.subjectIds,
            contexts: selectedContexts,
          }),
      staff_id: form.staff_id,
      session_id: form.session_id,
      student_ids: hasSingleSelectedContext && selectedStudentCount ? selectedStudentIdList : null,
      class_section_id: form.class_section_id || null,
    };

    setSubmitting(true);
    try {
      if (editingId) {
        await updateSubjectTeacherAssignment(editingId, payload);
      } else {
        await createSubjectTeacherAssignment(payload);
      }
      setEditingId(null);
      setForm({ ...initialForm, session_id: currentSessionId });
      setSelectedStudentIds({});
      setStudentSearch("");
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

  const handleEdit = async (assignment: SubjectTeacherAssignment) => {
    if (String(assignment.session_id) !== currentSessionId) {
      setFormError("Previous-session assignments are read-only.");
      return;
    }
    setEditingId(assignment.id);
    setFormError(null);

    const sessionId = `${assignment.session_id}`;
    const classId = assignment.school_class_id ? `${assignment.school_class_id}` : "";
    if (classId) {
      await ensureClassArms(classId);
    }
    const armId = assignment.class_arm_id ? `${assignment.class_arm_id}` : "";
    if (classId && armId) {
      await ensureClassSections(classId, armId);
    }
    if (classId) {
      await ensureClassSubjects(classId, armId || undefined);
    }
    const sectionId = assignment.class_section_id
      ? `${assignment.class_section_id}`
      : "";

    const assignedStudents: Array<string> = Array.isArray(assignment.student_ids)
      ? assignment.student_ids.map((id) => String(id))
      : Array.isArray(assignment.students)
        ? assignment.students
            .map((student) => student?.id)
            .filter(Boolean)
            .map((id) => String(id))
        : [];

    startTransition(() => {
      setForm({
        subjectIds: [`${assignment.subject_id}`],
        staff_id: `${assignment.staff_id}`,
        session_id: sessionId,
        selectedClassIds: [`${assignment.school_class_id}`].filter(Boolean),
        selectedClassArmIdsByClass: classId
          ? {
              [classId]: armId ? [armId] : [],
            }
          : {},
        school_class_id: classId,
        class_arm_id: armId,
        class_section_id: sectionId,
        student_ids: assignedStudents,
      });
    });

    setSelectedStudentIds(() => {
      const next: Record<string, boolean> = {};
      assignedStudents.forEach((studentId) => {
        next[String(studentId)] = true;
      });
      return next;
    });
  };

  const openNewGroup = () => {
    setEditingId(null);
    setGroupError(null);
    setGroupEditor({
      staff_id: "",
      session_id: currentSessionId,
      existing: false,
      rows: [emptyBulkRow()],
    });
  };

  const handleEditGroup = async (seed: SubjectTeacherAssignment) => {
    if (String(seed.session_id) !== currentSessionId) {
      setGroupError("Previous-session assignments are read-only.");
      return;
    }
    setGroupError(null);
    try {
      const response = await listSubjectTeacherAssignments({
        staff_id: String(seed.staff_id),
        session_id: String(seed.session_id),
        per_page: 500,
      });
      const rows = response.data ?? [];

      await Promise.all(
        rows.map(async (assignment) => {
          const classId = String(assignment.school_class_id ?? "");
          const armId = String(assignment.class_arm_id ?? "");
          if (!classId) return;
          await ensureClassArms(classId);
          await ensureClassSubjects(classId, armId || undefined);
        }),
      );

      setEditingId(null);
      setGroupEditor({
        staff_id: String(seed.staff_id),
        session_id: String(seed.session_id),
        existing: true,
        rows: rows.map((assignment) => ({
          client_id: assignment.id,
          id: assignment.id,
          subject_id: String(assignment.subject_id),
          school_class_id: String(assignment.school_class_id ?? ""),
          class_arm_id: String(assignment.class_arm_id ?? ""),
          student_ids: assignment.student_ids ?? null,
        })),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : "Unable to load assignment group.");
    }
  };

  const updateGroupRow = (
    clientId: string,
    changes: Partial<BulkAssignmentRow>,
  ) => {
    setGroupEditor((current) => current ? {
      ...current,
      rows: current.rows.map((row) => row.client_id === clientId ? { ...row, ...changes } : row),
    } : current);
  };

  const handleBulkClassChange = async (row: BulkAssignmentRow, classId: string) => {
    updateGroupRow(row.client_id, {
      school_class_id: classId,
      class_arm_id: "",
      subject_id: "",
    });
    if (classId) {
      await ensureClassArms(classId);
      await ensureClassSubjects(classId);
    }
  };

  const handleBulkArmChange = async (row: BulkAssignmentRow, armId: string) => {
    updateGroupRow(row.client_id, { class_arm_id: armId, subject_id: "" });
    if (row.school_class_id) {
      await ensureClassSubjects(row.school_class_id, armId || undefined);
    }
  };

  const handleSaveGroup = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!groupEditor) return;

    if (!groupEditor.staff_id || !groupEditor.session_id ||
      groupEditor.rows.some((row) => !row.subject_id || !row.school_class_id)) {
      setGroupError("Select the teacher, session, class and subject for every row.");
      return;
    }

    setGroupSaving(true);
    setGroupError(null);
    try {
      await bulkSaveSubjectTeacherAssignments({
        staff_id: groupEditor.staff_id,
        session_id: groupEditor.session_id,
        assignments: groupEditor.rows.map((row) => ({
          id: row.id,
          subject_id: row.subject_id,
          school_class_id: row.school_class_id,
          class_arm_id: row.class_arm_id || null,
          student_ids: row.student_ids,
        })),
      });
      setGroupEditor(null);
      setPage(1);
      await fetchAssignments();
    } catch (err) {
      setGroupError(err instanceof Error ? err.message : "Unable to save assignment group.");
    } finally {
      setGroupSaving(false);
    }
  };

  const handleDelete = async (assignment: SubjectTeacherAssignment) => {
    if (String(assignment.session_id) !== currentSessionId) {
      setListError("Previous-session assignments are read-only.");
      return;
    }
    if (
      !window.confirm(
        `Remove teacher assignment for "${assignment.subject?.name ?? "Subject"}"?`,
      )
    ) {
      return;
    }
    try {
      await deleteSubjectTeacherAssignment(assignment.id);
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
        <h3>Teacher to Subjects</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Assign Teachers to Subjects</li>
        </ul>
      </div>

      {groupEditor ? (
        <div className="card height-auto mb-4">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>{groupEditor.existing ? "Edit Teacher Assignment Group" : "Add Assignment Group"}</h3>
                <p className="text-muted mb-0">
                  Add or edit different subject, class and arm combinations, then save them together.
                </p>
              </div>
            </div>

            {groupError ? <div className="alert alert-danger">{groupError}</div> : null}

            <form onSubmit={handleSaveGroup}>
              <div className="row">
                <div className="col-md-6 form-group">
                  <label htmlFor="group-teacher">Teacher *</label>
                  <select
                    id="group-teacher"
                    className="form-control"
                    value={groupEditor.staff_id}
                    disabled={groupEditor.existing}
                    onChange={(event) => setGroupEditor((current) => current ? {
                      ...current,
                      staff_id: event.target.value,
                    } : current)}
                  >
                    <option value="">Select teacher</option>
                    {teachers.map((teacher) => (
                      <option key={teacher.id} value={teacher.id}>
                        {teacher.full_name ?? teacher.user?.name ?? teacher.email ?? `Staff #${teacher.id}`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-6 form-group">
                  <label htmlFor="group-session">Session *</label>
                  <select
                    id="group-session"
                    className="form-control"
                    value={groupEditor.session_id}
                    disabled
                    onChange={(event) => {
                      const sessionId = event.target.value;
                      setGroupEditor((current) => current ? {
                        ...current,
                        session_id: sessionId,
                      } : current);
                    }}
                  >
                    <option value="">Select session</option>
                    {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
                  </select>
                  <small className="form-text text-muted">
                    Session is locked to the school&apos;s current session.
                  </small>
                </div>
              </div>

              <div className="table-responsive">
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ minWidth: 180 }}>Class</th>
                      <th style={{ minWidth: 160 }}>Class Arm</th>
                      <th style={{ minWidth: 220 }}>Subject</th>
                      <th>Students</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {groupEditor.rows.map((row) => {
                      const assignedRowSubjects = classSubjectsByKey[
                        `${currentSessionId}:${row.school_class_id}:${row.class_arm_id || "all"}`
                      ] ?? [];
                      const currentSubject = subjects.find((subject) => String(subject.id) === row.subject_id);
                      const rowSubjects = currentSubject && !assignedRowSubjects.some(
                        (subject) => String(subject.id) === row.subject_id,
                      ) ? [currentSubject, ...assignedRowSubjects] : assignedRowSubjects;
                      return (
                        <tr key={row.client_id}>
                          <td>
                            <select
                              className="form-control"
                              value={row.school_class_id}
                              onChange={(event) => handleBulkClassChange(row, event.target.value)}
                            >
                              <option value="">Select class</option>
                              {classes.map((schoolClass) => (
                                <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-control"
                              value={row.class_arm_id}
                              disabled={!row.school_class_id}
                              onChange={(event) => handleBulkArmChange(row, event.target.value)}
                            >
                              <option value="">Whole class / no arm</option>
                              {(classArmsByClass[row.school_class_id] ?? []).map((arm) => (
                                <option key={arm.id} value={arm.id}>{arm.name}</option>
                              ))}
                            </select>
                          </td>
                          <td>
                            <select
                              className="form-control"
                              value={row.subject_id}
                              disabled={!row.school_class_id}
                              onChange={(event) => updateGroupRow(row.client_id, { subject_id: event.target.value })}
                            >
                              <option value="">Select subject</option>
                              {rowSubjects.map((subject) => (
                                <option key={subject.id} value={subject.id}>
                                  {subject.code ? `${subject.name} (${subject.code})` : subject.name}
                                </option>
                              ))}
                            </select>
                          </td>
                          <td>{row.student_ids?.length ? `${row.student_ids.length} selected` : "All"}</td>
                          <td>
                            {!row.id ? (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                disabled={groupEditor.rows.length === 1}
                                onClick={() => setGroupEditor((current) => current ? {
                                  ...current,
                                  rows: current.rows.filter((item) => item.client_id !== row.client_id),
                                } : current)}
                              >
                                Remove
                              </button>
                            ) : <small className="text-muted">Existing</small>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-between flex-wrap">
                <button
                  type="button"
                  className="btn btn-outline-primary mb-2"
                  onClick={() => setGroupEditor((current) => current ? {
                    ...current,
                    rows: [...current.rows, emptyBulkRow()],
                  } : current)}
                >
                  + Add another subject/class
                </button>
                <div>
                  <button type="button" className="btn btn-outline-secondary mr-2" onClick={() => setGroupEditor(null)}>
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-gradient-yellow" disabled={groupSaving}>
                    {groupSaving ? "Saving…" : "Save Group"}
                  </button>
                </div>
              </div>
              {groupEditor.existing ? (
                <small className="text-muted d-block mt-2">
                  Existing rows are never removed by bulk save. Use the row&apos;s Delete button in the list when removal is intended.
                </small>
              ) : null}
            </form>
          </div>
        </div>
      ) : null}

  <div className="row">
        <div className="col-lg-5">
          <div className="card height-auto">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>{editingId ? "Edit Assignment" : "Assign Teacher"}</h3>
                </div>
                {!editingId ? (
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: "10px 18px", fontSize: "14px", fontWeight: 600 }}
                    onClick={openNewGroup}
                  >
                    Row-by-row bulk add
                  </button>
                ) : null}
              </div>

              {formError ? (
                <div className="alert alert-danger" role="alert">
                  {formError}
                </div>
              ) : null}

              <form onSubmit={handleSubmit}>
                <div className="row">
                  <div className="col-12 form-group">
                    <label>Classes *</label>
                    <div
                      className="border rounded p-2"
                      style={{ maxHeight: "220px", overflowY: "auto" }}
                    >
                      {classes.length === 0 ? (
                        <p className="text-muted mb-0">No classes available.</p>
                      ) : (
                        classes.map((schoolClass) => {
                          const classId = String(schoolClass.id);
                          const checked = editingId
                            ? form.school_class_id === classId
                            : selectedClassSet.has(classId);

                          return (
                            <div className="form-check" key={schoolClass.id}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`teacher-class-${schoolClass.id}`}
                                checked={checked}
                                onChange={(event) =>
                                  handleClassToggle(classId, event.target.checked)
                                }
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`teacher-class-${schoolClass.id}`}
                              >
                                {schoolClass.name}
                              </label>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <small className="form-text text-muted">
                      {editingId
                        ? "Editing supports one class at a time."
                        : "Tick one or more classes for this teacher assignment."}
                    </small>
                  </div>
                  <div className="col-12 form-group">
                    <label>
                      Class Arms <span className="text-muted">(optional)</span>
                    </label>
                    {!editingId && form.selectedClassIds.length === 0 ? (
                      <p className="text-muted mb-0">Select class first.</p>
                    ) : editingId && !form.school_class_id ? (
                      <p className="text-muted mb-0">Select class first.</p>
                    ) : (
                      <div
                        className="border rounded p-2"
                        style={{ maxHeight: "260px", overflowY: "auto" }}
                      >
                        {(editingId ? [form.school_class_id] : form.selectedClassIds).map((classId) => {
                          const schoolClass = classes.find(
                            (item) => String(item.id) === classId,
                          );
                          const arms = classArmsByClass[classId] ?? [];

                          return (
                            <div key={classId} className="mb-2">
                              <strong className="d-block mb-1">
                                {schoolClass?.name ?? "Selected Class"}
                              </strong>
                              {arms.length === 0 ? (
                                <small className="text-muted">
                                  No class arms available. This will assign against the whole class.
                                </small>
                              ) : (
                                arms.map((arm) => {
                                  const armId = String(arm.id);
                                  const checked = editingId
                                    ? form.class_arm_id === armId
                                    : (form.selectedClassArmIdsByClass[classId] ?? []).includes(armId);

                                  return (
                                    <div className="form-check" key={arm.id}>
                                      <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id={`teacher-class-arm-${classId}-${arm.id}`}
                                        checked={checked}
                                        onChange={(event) =>
                                          handleClassArmToggle(
                                            classId,
                                            armId,
                                            event.target.checked,
                                          )
                                        }
                                      />
                                      <label
                                        className="form-check-label"
                                        htmlFor={`teacher-class-arm-${classId}-${arm.id}`}
                                      >
                                        {arm.name}
                                      </label>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <small className="form-text text-muted">
                      Leave all arms unticked for a selected class to assign against the whole class. Tick arms to target specific arms.
                    </small>
                  </div>
                  <div className="col-12 form-group">
                    <label>Subjects *</label>
                    <div
                      className="border rounded p-2"
                      style={{ maxHeight: "240px", overflowY: "auto" }}
                    >
                      {selectedContexts.length === 0 ? (
                        <p className="text-muted mb-0">Select class or class arm first.</p>
                      ) : classSubjectsLoading ? (
                        <p className="text-muted mb-0">Loading subjects...</p>
                      ) : subjectsForForm.length === 0 ? (
                        <p className="text-muted mb-0">
                          No subjects assigned to this class.
                        </p>
                      ) : (
                        subjectsForForm.map((subject) => {
                          const subjectId = String(subject.id);
                          return (
                            <div className="form-check" key={subject.id}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`teacher-subject-${subject.id}`}
                                checked={selectedSubjectSet.has(subjectId)}
                                onChange={(event) =>
                                  handleSubjectToggle(subjectId, event.target.checked)
                                }
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`teacher-subject-${subject.id}`}
                              >
                                {subject.code
                                  ? `${subject.name} (${subject.code})`
                                  : subject.name}
                              </label>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <small className="form-text text-muted">
                      {editingId
                        ? "Editing supports one subject at a time."
                        : "Tick one or more subjects to assign to the selected teacher."}
                    </small>
                  </div>
                  <div className="col-12 form-group">
                    <label htmlFor="teacher-staff">Teacher *</label>
                    <select
                      id="teacher-staff"
                      className="form-control"
                      value={form.staff_id}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          staff_id: event.target.value,
                        }))
                      }
                      disabled={form.subjectIds.length === 0}
                      required
                    >
                      <option value="">
                        {form.subjectIds.length > 0
                          ? "Select teacher"
                          : "Select at least one subject first"}
                      </option>
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
                    <label htmlFor="teacher-students">
                      Students <span className="text-muted">(optional)</span>
                    </label>
                    <input
                      id="teacher-students"
                      type="text"
                      className="form-control mb-2"
                      placeholder="Search students by name or admission number..."
                      value={studentSearch}
                      onChange={(event) => setStudentSearch(event.target.value)}
                      disabled={!hasSingleSelectedContext}
                    />
                    <div className="d-flex justify-content-between align-items-center mb-2">
                      <small className="text-muted">
                        {!hasSingleSelectedContext
                          ? "Student targeting is available for one class context at a time."
                          : selectedStudentCount
                          ? `${selectedStudentCount} selected`
                          : "No students selected"}
                      </small>
                      <button
                        type="button"
                        className="btn btn-sm btn-outline-secondary"
                        onClick={handleToggleAllFiltered}
                        disabled={!hasSingleSelectedContext || !filteredStudents.length}
                      >
                        {allFilteredSelected ? "Clear filtered" : "Select filtered"}
                      </button>
                    </div>
                    <div className="border rounded p-2" style={{ maxHeight: "240px", overflowY: "auto" }}>
                      {studentsLoading ? (
                        <p className="text-muted mb-0">Loading students…</p>
                      ) : !hasSingleSelectedContext ? (
                        <p className="text-muted mb-0">Select exactly one class or class arm to load students.</p>
                      ) : filteredStudents.length === 0 ? (
                        <p className="text-muted mb-0">No students found.</p>
                      ) : (
                        filteredStudents.map((student) => {
                          const fullName = [
                            student.first_name,
                            student.middle_name,
                            student.last_name,
                          ]
                            .filter(Boolean)
                            .join(" ")
                            .trim();
                          return (
                            <div className="form-check" key={student.id}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`teacher-student-${student.id}`}
                                checked={Boolean(selectedStudentIds[String(student.id)])}
                                onChange={handleToggleStudent(student.id)}
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`teacher-student-${student.id}`}
                              >
                                {fullName || "Unnamed Student"}
                                {student.admission_no ? ` (${student.admission_no})` : ""}
                              </label>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <small className="form-text text-muted">
                      Leave blank to assign the subject to all students in the selected class context.
                    </small>
                  </div>
                  {/* Class Section field intentionally hidden */}
                  <div className="col-12 form-group">
                    <label htmlFor="teacher-session">Session *</label>
                    <select
                      id="teacher-session"
                      className="form-control"
                      value={form.session_id}
                      onChange={(event) => {
                        const value = event.target.value;
                        setForm((prev) => ({
                          ...prev,
                          session_id: value,
                        }));
                      }}
                      disabled
                      required
                    >
                      <option value="">Select session</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name}
                        </option>
                      ))}
                    </select>
                    <small className="form-text text-muted">
                      Session is locked to the school&apos;s current session.
                    </small>
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
                        setForm({ ...initialForm, session_id: currentSessionId });
                        setSelectedStudentIds({});
                        setStudentSearch("");
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
                  <h3>Filter</h3>
                </div>
              </div>

              <div className="row gutters-8 align-items-end mb-3">
                <div className="col-md-4 col-12 form-group">
                  <label htmlFor="teacher-filter-search">Search</label>
                  <input
                    id="teacher-filter-search"
                    type="text"
                    className="form-control"
                    placeholder="Subject or teacher"
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
                  <label htmlFor="teacher-filter-subject">Subject</label>
                  <select
                    id="teacher-filter-subject"
                    className="form-control"
                    value={filters.subject_id}
                    onChange={(event) => {
                      setFilters((prev) => ({
                        ...prev,
                        subject_id: event.target.value,
                      }));
                      setPage(1);
                    }}
                  >
                    <option value="">All subjects</option>
                    {subjects.map((subject) => (
                      <option key={subject.id} value={subject.id}>
                        {subject.code
                          ? `${subject.name} (${subject.code})`
                          : subject.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="col-md-4 col-12 form-group">
                  <label htmlFor="teacher-filter-staff">Teacher</label>
                  <select
                    id="teacher-filter-staff"
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
                  <label htmlFor="teacher-filter-class">Class</label>
                  <select
                    id="teacher-filter-class"
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
                      if (value) {
                        ensureClassArms(value).catch((err) =>
                          console.error(err),
                        );
                      }
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
                <div className="col-md-4 col-12 form-group">
                  <label htmlFor="teacher-filter-class-arm">Class Arm</label>
                  <select
                    id="teacher-filter-class-arm"
                    className="form-control"
                    value={filters.class_arm_id}
                    onChange={(event) => {
                      const value = event.target.value;
                      setFilters((prev) => ({
                        ...prev,
                        class_arm_id: value,
                        class_section_id: "",
                      }));
                      if (value && filters.school_class_id) {
                        ensureClassSections(
                          filters.school_class_id,
                          value,
                        ).catch((err) => console.error(err));
                      }
                      setPage(1);
                    }}
                    disabled={
                      !filters.school_class_id || classArmsForFilter.length === 0
                    }
                  >
                    <option value="">All class arms</option>
                    {classArmsForFilter.map((arm) => (
                      <option key={arm.id} value={arm.id}>
                        {arm.name}
                      </option>
                    ))}
                  </select>
                </div>
                {/* Class Section filter intentionally hidden */}
                <div className="col-md-4 col-12 form-group">
                  <label htmlFor="teacher-filter-session">Session</label>
                  <select
                    id="teacher-filter-session"
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
                    disabled
                  >
                    <option value="">All sessions</option>
                    {sessions.map((session) => (
                      <option key={session.id} value={session.id}>
                        {session.name}
                      </option>
                    ))}
                  </select>
                  <small className="form-text text-muted">
                    Filter is locked to the current session.
                  </small>
                </div>
                <div className="col-12 d-flex justify-content-end mt-2">
                  <button
                    className="btn btn-outline-secondary mr-2"
                    type="button"
                    onClick={() => {
                      setFilters({
                        ...initialFilters,
                        session_id: currentSessionId,
                      });
                      setPage(1);
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
                      <th>Teacher</th>
                      <th>Class</th>
                      <th>Class Arm</th>
                {/* <th>Class Section</th> */}
                      <th>Students</th>
                      <th>Session</th>
                      <th>Updated</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {loadingList ? (
                      <tr>
                        <td colSpan={9} className="text-center">
                          Loading assignments…
                        </td>
                      </tr>
                    ) : assignments.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center">
                          No assignments found.
                        </td>
                      </tr>
                    ) : (
                      groupedAssignments.map((group) => {
                        const first = group.rows[0];
                        const isCurrentSession =
                          String(first.session_id) === currentSessionId;
                        return (
                        <Fragment key={group.key}>
                          <tr className="table-active">
                            <td colSpan={7}>
                              <strong>
                                {first.staff?.full_name ?? first.staff?.user?.name ?? "Teacher"}
                              </strong>
                              <span className="text-muted ml-2">
                                {first.session?.name ?? "Session"} · {group.rows.length} assignment{group.rows.length === 1 ? "" : "s"} on this page
                              </span>
                            </td>
                            <td className="text-right">
                              <button
                                type="button"
                                className="btn btn-sm btn-primary"
                                onClick={() => handleEditGroup(first)}
                                disabled={!isCurrentSession}
                                title={
                                  isCurrentSession
                                    ? "Edit assignment group"
                                    : "Previous-session assignments are read-only"
                                }
                              >
                                {isCurrentSession ? "Edit Group" : "Historical · Read only"}
                              </button>
                            </td>
                          </tr>
                          {group.rows.map((assignment) => (
                        <tr key={assignment.id}>
                          <td>
                            {assignment.subject?.name ?? "N/A"}
                            {assignment.subject?.code
                              ? ` (${assignment.subject.code})`
                              : ""}
                          </td>
                          <td>
                            {assignment.staff?.full_name ??
                              assignment.staff?.user?.name ??
                              "N/A"}
                          </td>
                          <td>{assignment.school_class?.name ?? "—"}</td>
                          <td>{assignment.class_arm?.name ?? "—"}</td>
                          {/* <td>{assignment.class_section?.name ?? "—"}</td> */}
                          <td>
                            {Array.isArray(assignment.student_ids) &&
                            assignment.student_ids.length > 0
                              ? `${assignment.student_ids.length} selected`
                              : Array.isArray(assignment.students) &&
                                assignment.students.length > 0
                              ? `${assignment.students.length} selected`
                              : "All"}
                          </td>
                          <td>{assignment.session?.name ?? "N/A"}</td>
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
                                disabled={!isCurrentSession}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => handleDelete(assignment)}
                                disabled={!isCurrentSession}
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                          ))}
                        </Fragment>
                        );
                      })
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
