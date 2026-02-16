import { apiFetch } from "@/lib/apiClient";

export interface StudentName {
  id?: number | string;
  name?: string;
}

export interface StudentSummary {
  id: number;
  admission_no?: string | null;
  first_name?: string | null;
  middle_name?: string | null;
  last_name?: string | null;
  gender?: string | null;
  photo_url?: string | null;
  status?: string | null;
  school_class?: StudentName & { class_arm?: StudentName | null };
  class_arm?: StudentName | null;
  class_section?: StudentName | null;
  parent?: {
    id?: number;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
  } | null;
  session?: StudentName | null;
  term?: StudentName | null;
  [key: string]: unknown;
}

export interface StudentListResponse {
  data: StudentSummary[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

export interface StudentFilters {
  page?: number;
  per_page?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  search?: string;
  session_id?: string;
  term_id?: string;
  current_session_id?: string;
  current_term_id?: string;
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
  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

export async function listStudents(
  filters: StudentFilters = {},
): Promise<StudentListResponse> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
    search: filters.search,
    session_id: filters.session_id,
    term_id: filters.term_id,
    current_session_id: filters.current_session_id,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id,
  });

  const payload = await apiFetch<StudentListResponse>(
    `/api/v1/students${query}`,
  );

  if (!Array.isArray(payload.data)) {
    return {
      ...payload,
      data: [],
    };
  }

  return payload;
}

export interface StudentDetail extends StudentSummary {
  date_of_birth?: string | null;
  admission_date?: string | null;
  nationality?: string | null;
  state_of_origin?: string | null;
  lga_of_origin?: string | null;
  house?: string | null;
  club?: string | null;
  blood_group_id?: number | string | null;
  blood_group?: StudentName | null;
  medical_information?: string | null;
  address?: string | null;
  status?: string | null;
  current_session_id?: number | string | null;
  current_term_id?: number | string | null;
  school_class_id?: number | string | null;
  class_arm_id?: number | string | null;
  class_section_id?: number | string | null;
  parent_id?: number | string | null;
  parent?: {
    id?: number;
    first_name?: string | null;
    last_name?: string | null;
    phone?: string | null;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export async function getStudent(
  studentId: number | string,
): Promise<StudentDetail | null> {
  try {
    const payload = await apiFetch<{ data?: StudentDetail } | StudentDetail>(
      `/api/v1/students/${studentId}`,
    );
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as { data?: StudentDetail }).data ?? null;
    }
    return payload as StudentDetail;
  } catch (error) {
    console.error("Unable to load student", error);
    return null;
  }
}

export async function createStudent(formData: FormData): Promise<StudentDetail> {
  return apiFetch<StudentDetail>("/api/v1/students", {
    method: "POST",
    body: formData,
  });
}

export async function updateStudent(
  studentId: number | string,
  formData: FormData,
): Promise<StudentDetail> {
  if (!formData.has("_method")) {
    formData.append("_method", "PUT");
  }

  return apiFetch<StudentDetail>(`/api/v1/students/${studentId}`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteStudent(
  studentId: number | string,
): Promise<void> {
  await apiFetch(`/api/v1/students/${studentId}`, {
    method: "DELETE",
  });
}
