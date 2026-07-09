import { apiFetch } from "@/lib/apiClient";

export interface StudentSkillType {
  id: string;
  name: string;
  description?: string | null;
  skill_category_id?: string | null;
  category?: string | null;
  [key: string]: unknown;
}

export interface StudentSkillRating {
  id: string;
  student_id: string;
  session_id: string;
  term_id: string;
  skill_type_id: string;
  rating_value: number;
  updated_at?: string | null;
  skill_type?: StudentSkillType | null;
  [key: string]: unknown;
}

export interface SkillRatingFilters {
  session_id?: string | number;
  term_id?: string | number;
}

export interface CreateSkillRatingPayload {
  session_id: string | number;
  term_id: string | number;
  skill_type_id: string;
  rating_value: number;
}

export type UpdateSkillRatingPayload = Partial<CreateSkillRatingPayload>;

function buildQuery(params: Record<string, string | number | undefined>) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listStudentSkillTypes(
  studentId: string | number,
): Promise<StudentSkillType[]> {
  const response = await apiFetch<{ data?: StudentSkillType[] } | StudentSkillType[]>(
    `/api/v1/students/${studentId}/skill-types`,
  );
  if (Array.isArray(response)) {
    return response;
  }
  return response?.data ?? [];
}

export async function listStudentSkillRatings(
  studentId: string | number,
  filters: SkillRatingFilters,
): Promise<StudentSkillRating[]> {
  const query = buildQuery({
    session_id: filters.session_id,
    term_id: filters.term_id,
  });
  const response = await apiFetch<{ data?: StudentSkillRating[] } | StudentSkillRating[]>(
    `/api/v1/students/${studentId}/skill-ratings${query}`,
  );
  if (Array.isArray(response)) {
    return response;
  }
  return response?.data ?? [];
}

export async function createStudentSkillRating(
  studentId: string | number,
  payload: CreateSkillRatingPayload,
): Promise<StudentSkillRating> {
  const response = await apiFetch<{ data?: StudentSkillRating } | StudentSkillRating>(
    `/api/v1/students/${studentId}/skill-ratings`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data?: StudentSkillRating }).data ?? ({} as StudentSkillRating);
  }
  return response as StudentSkillRating;
}

export async function updateStudentSkillRating(
  studentId: string | number,
  ratingId: string | number,
  payload: UpdateSkillRatingPayload,
): Promise<StudentSkillRating> {
  const response = await apiFetch<{ data?: StudentSkillRating } | StudentSkillRating>(
    `/api/v1/students/${studentId}/skill-ratings/${ratingId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  if (response && typeof response === "object" && "data" in response) {
    return (response as { data?: StudentSkillRating }).data ?? ({} as StudentSkillRating);
  }
  return response as StudentSkillRating;
}

export async function deleteStudentSkillRating(
  studentId: string | number,
  ratingId: string | number,
): Promise<void> {
  await apiFetch(`/api/v1/students/${studentId}/skill-ratings/${ratingId}`, {
    method: "DELETE",
  });
}
