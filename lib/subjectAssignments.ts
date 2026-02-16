import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";
import type { Subject } from "@/lib/subjects";
import type { SchoolClass } from "@/lib/classes";
import type { ClassArm } from "@/lib/classArms";
import type { ClassArmSection } from "@/lib/classArmSections";

export interface SubjectAssignment {
  id: number;
  subject_id: number;
  school_class_id: number;
  class_arm_id: number;
  class_section_id?: number | null;
  created_at?: string;
  updated_at?: string;
  subject?: Subject | null;
  school_class?: SchoolClass | null;
  class_arm?: ClassArm | null;
  class_section?: ClassArmSection | null;
  [key: string]: unknown;
}

export interface SubjectAssignmentListResponse {
  data: SubjectAssignment[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

export interface SubjectAssignmentFilters {
  page?: number;
  per_page?: number;
  search?: string;
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

export async function listSubjectAssignments(
  filters: SubjectAssignmentFilters = {},
): Promise<SubjectAssignmentListResponse> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    search: filters.search,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id,
  });

  const payload = await apiFetch<SubjectAssignmentListResponse>(
    `${API_ROUTES.subjectAssignments}${query}`,
  );

  if (!Array.isArray(payload.data)) {
    return {
      ...payload,
      data: [],
    };
  }

  return payload;
}

export async function createSubjectAssignment(
  payload: {
    subject_id: string | number;
    school_class_id: string | number;
    class_arm_id: string | number;
    class_section_id?: string | number | null;
  },
): Promise<SubjectAssignment> {
  const sanitizedPayload = { ...payload };
  delete sanitizedPayload.class_section_id;
  return apiFetch<SubjectAssignment>(API_ROUTES.subjectAssignments, {
    method: "POST",
    body: JSON.stringify(sanitizedPayload),
  });
}

export async function updateSubjectAssignment(
  assignmentId: number | string,
  payload: {
    subject_id: string | number;
    school_class_id: string | number;
    class_arm_id: string | number;
    class_section_id?: string | number | null;
  },
): Promise<SubjectAssignment> {
  const sanitizedPayload = { ...payload };
  delete sanitizedPayload.class_section_id;
  return apiFetch<SubjectAssignment>(
    `${API_ROUTES.subjectAssignments}/${assignmentId}`,
    {
      method: "PUT",
      body: JSON.stringify(sanitizedPayload),
    },
  );
}

export async function deleteSubjectAssignment(
  assignmentId: number | string,
): Promise<void> {
  await apiFetch(`${API_ROUTES.subjectAssignments}/${assignmentId}`, {
    method: "DELETE",
  });
}
