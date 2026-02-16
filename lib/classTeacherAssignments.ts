import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";
import type { Staff } from "@/lib/staff";
import type { SchoolClass } from "@/lib/classes";
import type { ClassArm } from "@/lib/classArms";
import type { ClassArmSection } from "@/lib/classArmSections";
import type { Session, Term } from "@/lib/auth";

export interface ClassTeacherAssignment {
  id: number;
  staff_id: number;
  school_class_id: number;
  class_arm_id?: number | null;
  class_section_id?: number | null;
  session_id: number;
  term_id: number;
  created_at?: string;
  updated_at?: string;
  staff?: Staff | null;
  school_class?: SchoolClass | null;
  class_arm?: ClassArm | null;
  class_section?: ClassArmSection | null;
  session?: Session | null;
  term?: Term | null;
  [key: string]: unknown;
}

export interface ClassTeacherAssignmentListResponse {
  data: ClassTeacherAssignment[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

export interface ClassTeacherFilters {
  page?: number;
  per_page?: number;
  search?: string;
  staff_id?: string;
  school_class_id?: string;
  class_arm_id?: string;
  class_section_id?: string;
  session_id?: string;
  term_id?: string;
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

export async function listClassTeacherAssignments(
  filters: ClassTeacherFilters = {},
): Promise<ClassTeacherAssignmentListResponse> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    search: filters.search,
    staff_id: filters.staff_id,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id,
    session_id: filters.session_id,
    term_id: filters.term_id,
  });

  const payload = await apiFetch<ClassTeacherAssignmentListResponse>(
    `${API_ROUTES.classTeachers}${query}`,
  );

  if (!Array.isArray(payload.data)) {
    return {
      ...payload,
      data: [],
    };
  }

  return payload;
}

export async function createClassTeacherAssignment(
  payload: {
    staff_id: string | number;
    school_class_id: string | number;
    class_arm_id?: string | number | null;
    class_section_id?: string | number | null;
    session_id: string | number;
    term_id: string | number;
  },
): Promise<ClassTeacherAssignment> {
  const sanitizedPayload = { ...payload };
  delete sanitizedPayload.class_section_id;
  return apiFetch<ClassTeacherAssignment>(API_ROUTES.classTeachers, {
    method: "POST",
    body: JSON.stringify(sanitizedPayload),
  });
}

export async function updateClassTeacherAssignment(
  assignmentId: number | string,
  payload: {
    staff_id: string | number;
    school_class_id: string | number;
    class_arm_id?: string | number | null;
    class_section_id?: string | number | null;
    session_id: string | number;
    term_id: string | number;
  },
): Promise<ClassTeacherAssignment> {
  const sanitizedPayload = { ...payload };
  delete sanitizedPayload.class_section_id;
  return apiFetch<ClassTeacherAssignment>(
    `${API_ROUTES.classTeachers}/${assignmentId}`,
    {
      method: "PUT",
      body: JSON.stringify(sanitizedPayload),
    },
  );
}

export async function deleteClassTeacherAssignment(
  assignmentId: number | string,
): Promise<void> {
  await apiFetch(`${API_ROUTES.classTeachers}/${assignmentId}`, {
    method: "DELETE",
  });
}
