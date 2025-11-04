import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface Subject {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
  created_at?: string | null;
  [key: string]: unknown;
}

export interface SubjectListResponse {
  data: Subject[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

export interface SubjectFilters {
  page?: number;
  per_page?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  search?: string;
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

export async function listSubjects(
  filters: SubjectFilters = {},
): Promise<SubjectListResponse> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
    search: filters.search,
  });
  const payload = await apiFetch<SubjectListResponse>(
    `${API_ROUTES.subjects}${query}`,
  );
  if (!Array.isArray(payload.data)) {
    return {
      ...payload,
      data: [],
    };
  }
  return payload;
}

export async function listAllSubjects(): Promise<Subject[]> {
  const payload = await listSubjects({ per_page: 500 });
  return payload.data ?? [];
}

type SubjectShowResponse = {
  data?: Subject;
  [key: string]: unknown;
};

export async function getSubject(
  subjectId: number | string,
): Promise<Subject | null> {
  try {
    const payload = await apiFetch<Subject | SubjectShowResponse>(
      `${API_ROUTES.subjects}/${subjectId}`,
    );

    if (payload && typeof payload === "object" && "data" in payload) {
      const data = (payload as SubjectShowResponse).data;
      return (data ?? null) as Subject | null;
    }

    return payload as Subject;
  } catch (error) {
    console.error("Unable to load subject", error);
    return null;
  }
}

export interface SubjectPayload {
  name: string;
  code?: string | null;
  description?: string | null;
}

export async function createSubject(
  payload: SubjectPayload,
): Promise<Subject> {
  return apiFetch<Subject>(API_ROUTES.subjects, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateSubject(
  subjectId: number | string,
  payload: SubjectPayload,
): Promise<Subject> {
  return apiFetch<Subject>(`${API_ROUTES.subjects}/${subjectId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteSubject(
  subjectId: number | string,
): Promise<void> {
  await apiFetch(`${API_ROUTES.subjects}/${subjectId}`, {
    method: "DELETE",
  });
}
