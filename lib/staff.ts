import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface Staff {
  id: number;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role?: string | null;
  gender?: string | null;
  employment_start_date?: string | null;
  address?: string | null;
  qualifications?: string | null;
  photo_url?: string | null;
  user?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
    [key: string]: unknown;
  } | null;
  temporary_password?: string | null;
  [key: string]: unknown;
}

export interface StaffListResponse {
  data: Staff[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

export interface StaffFilters {
  page?: number;
  per_page?: number;
  sortBy?: string;
  sortDirection?: "asc" | "desc";
  search?: string;
  role?: string;
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

export async function listStaff(
  filters: StaffFilters = {},
): Promise<StaffListResponse> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    sortBy: filters.sortBy,
    sortDirection: filters.sortDirection,
    search: filters.search,
    role: filters.role,
  });

  const payload = await apiFetch<StaffListResponse>(
    `${API_ROUTES.staff}${query}`,
  );

  if (!Array.isArray(payload.data)) {
    return {
      ...payload,
      data: [],
    };
  }

  return payload;
}

export async function listStaffForDropdown(): Promise<Staff[]> {
  const payload = await listStaff({ per_page: 500 });
  return payload.data ?? [];
}

export async function getStaff(staffId: number | string): Promise<Staff | null> {
  try {
    const payload = await apiFetch<{ data?: Staff } | Staff>(
      `${API_ROUTES.staff}/${staffId}`,
    );
    if (payload && typeof payload === "object" && "data" in payload) {
      return (payload as { data?: Staff }).data ?? null;
    }
    return payload as Staff;
  } catch (error) {
    console.error("Unable to load staff", error);
    return null;
  }
}

export interface StaffPayload {
  full_name: string;
  email: string;
  phone: string;
  role: string;
  gender?: string;
  employment_start_date?: string;
  address?: string;
  qualifications?: string;
}

export async function createStaff(
  formData: FormData,
): Promise<Staff> {
  return apiFetch<Staff>(API_ROUTES.staff, {
    method: "POST",
    body: formData,
  });
}

export async function updateStaff(
  staffId: number | string,
  formData: FormData,
): Promise<Staff> {
  if (!formData.has("_method")) {
    formData.append("_method", "PUT");
  }

  return apiFetch<Staff>(`${API_ROUTES.staff}/${staffId}`, {
    method: "POST",
    body: formData,
  });
}

export async function deleteStaff(staffId: number | string): Promise<void> {
  await apiFetch(`${API_ROUTES.staff}/${staffId}`, {
    method: "DELETE",
  });
}

export interface StaffSelfPayload {
  full_name?: string;
  email?: string;
  phone?: string;
  address?: string;
  qualifications?: string;
  gender?: string;
  employment_start_date?: string;
  password?: string;
  password_confirmation?: string;
  old_password?: string;
}

export async function getCurrentStaffProfile(): Promise<Staff | null> {
  try {
    const response = await apiFetch<{ data?: Staff }>(API_ROUTES.staffSelf);
    if (response && typeof response === "object" && "data" in response) {
      return response.data ?? null;
    }
    return (response as Staff) ?? null;
  } catch (error) {
    console.error("Unable to load staff profile", error);
    return null;
  }
}

export async function updateCurrentStaffProfile(
  payload: StaffSelfPayload,
): Promise<Staff> {
  const response = await apiFetch<{ data?: Staff } | Staff>(API_ROUTES.staffSelf, {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  if (response && typeof response === "object" && "data" in response) {
    return (response as { data?: Staff }).data ?? (response as Staff);
  }

  return response as Staff;
}

export interface TeacherAssignmentSubject {
  id: string;
  name?: string | null;
  code?: string | null;
}

export interface AssignmentMetadata {
  id: string;
  name?: string | null;
}

export interface TeacherAssignmentSummary {
  context_key: string;
  class?: AssignmentMetadata | null;
  class_arm?: AssignmentMetadata | null;
  class_section?: AssignmentMetadata | null;
  session?: AssignmentMetadata | null;
  term?: AssignmentMetadata | null;
  subjects: TeacherAssignmentSubject[];
}

export interface TeacherDashboardStats {
  classes: number;
  subjects: number;
}

export interface TeacherDashboardResponse {
  teacher: Staff;
  assignments: TeacherAssignmentSummary[];
  stats: TeacherDashboardStats;
}

export async function fetchTeacherDashboard(): Promise<TeacherDashboardResponse> {
  return apiFetch<TeacherDashboardResponse>(API_ROUTES.staffDashboard);
}
