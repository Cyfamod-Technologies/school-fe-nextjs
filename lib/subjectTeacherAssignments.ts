import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";
import type { Subject } from "@/lib/subjects";
import type { Staff } from "@/lib/staff";
import type { Session } from "@/lib/auth";
import type { Term } from "@/lib/auth";
import type { SchoolClass } from "@/lib/classes";
import type { ClassArm } from "@/lib/classArms";
import type { ClassArmSection } from "@/lib/classArmSections";

export interface SubjectTeacherAssignment {
  id: string;
  subject_id: string;
  staff_id: string;
  session_id: string;
  term_id: string;
  school_class_id?: string | null;
  class_arm_id?: string | null;
  class_section_id?: string | null;
  created_at?: string;
  updated_at?: string;
  subject?: Subject | null;
  staff?: Staff | null;
  session?: Session | null;
  term?: Term | null;
  school_class?: SchoolClass | null;
  class_arm?: ClassArm | null;
  class_section?: ClassArmSection | null;
  [key: string]: unknown;
}

export interface SubjectTeacherAssignmentListResponse {
  data: SubjectTeacherAssignment[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

export interface SubjectTeacherFilters {
  page?: number;
  per_page?: number;
  search?: string;
  subject_id?: string;
  staff_id?: string;
  session_id?: string;
  term_id?: string;
  school_class_id?: string;
  class_arm_id?: string;
  class_section_id?: string;
}

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const query = search.toString();
  return query ? `?${query}` : "";
}

export async function listSubjectTeacherAssignments(
  filters: SubjectTeacherFilters = {},
): Promise<SubjectTeacherAssignmentListResponse> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    search: filters.search,
    subject_id: filters.subject_id,
    staff_id: filters.staff_id,
    session_id: filters.session_id,
    term_id: filters.term_id,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id,
    class_section_id: filters.class_section_id,
  });

  const payload = await apiFetch<SubjectTeacherAssignmentListResponse>(
    `${API_ROUTES.subjectTeacherAssignments}${query}`,
  );

  if (!Array.isArray(payload.data)) {
    return {
      ...payload,
      data: [],
    };
  }

  return payload;
}

type AssignmentMutationPayload = {
  subject_id: string | number;
  staff_id: string | number;
  session_id: string | number;
  term_id: string | number;
  school_class_id?: string | number | null;
  class_arm_id?: string | number | null;
  class_section_id?: string | number | null;
};

export async function createSubjectTeacherAssignment(
  payload: AssignmentMutationPayload,
): Promise<SubjectTeacherAssignment> {
  return apiFetch<SubjectTeacherAssignment>(API_ROUTES.subjectTeacherAssignments, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSubjectTeacherAssignment(
  assignmentId: number | string,
  payload: AssignmentMutationPayload,
): Promise<SubjectTeacherAssignment> {
  return apiFetch<SubjectTeacherAssignment>(
    `${API_ROUTES.subjectTeacherAssignments}/${assignmentId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
}

export async function deleteSubjectTeacherAssignment(
  assignmentId: number | string,
): Promise<void> {
  await apiFetch(`${API_ROUTES.subjectTeacherAssignments}/${assignmentId}`, {
    method: "DELETE",
  });
}
