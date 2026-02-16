import { API_ROUTES, BACKEND_URL } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

type Nullable<T> = T | null;

export interface AttendanceListResponse<T> {
  data: T[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number;
  to?: number;
  [key: string]: unknown;
}

export interface StudentAttendanceRecord {
  id: number | string;
  date?: string;
  status?: string;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  comment?: string | null;
  student_id?: number | string;
  student?: {
    id?: number | string;
    name?: string;
    first_name?: string | null;
    last_name?: string | null;
    admission_no?: string | null;
    [key: string]: unknown;
  } | null;
  class?: {
    id?: number | string;
    name?: string;
    [key: string]: unknown;
  } | null;
  recorded_by?: {
    id?: number | string;
    name?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

export interface StaffAttendanceRecord {
  id: number | string;
  date?: string;
  status?: string;
  notes?: string | null;
  staff_id?: number | string;
  branch_name?: string | null;
  staff?: {
    id?: number | string;
    name?: string;
    full_name?: string | null;
    email?: string | null;
    role?: string | null;
    [key: string]: unknown;
  } | null;
  recorded_by?: {
    id?: number | string;
    name?: string;
    [key: string]: unknown;
  } | null;
  [key: string]: unknown;
}

function buildQuery(
  params: Record<string, string | number | boolean | undefined | null>,
): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (
      value !== undefined &&
      value !== null &&
      value !== "" &&
      value !== false
    ) {
      search.append(key, String(value));
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

function normalizeAttendanceList<T>(
  payload:
    | AttendanceListResponse<T>
    | {
        data?: AttendanceListResponse<T>["data"] | AttendanceListResponse<T>;
        [key: string]: unknown;
      }
    | T[],
): AttendanceListResponse<T> {
  if (Array.isArray(payload)) {
    return {
      data: payload,
      current_page: 1,
      last_page: 1,
      per_page: payload.length,
      total: payload.length,
    };
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    const dataField = (payload as { data?: unknown }).data;
    if (Array.isArray(dataField)) {
      return {
        data: dataField as T[],
        current_page: 1,
        last_page: 1,
        per_page: dataField.length,
        total: dataField.length,
      };
    }
    if (
      dataField &&
      typeof dataField === "object" &&
      Array.isArray(
        (dataField as AttendanceListResponse<T>).data,
      )
    ) {
      return dataField as AttendanceListResponse<T>;
    }
  }
  if (
    payload &&
    typeof payload === "object" &&
    Array.isArray((payload as AttendanceListResponse<T>).data)
  ) {
    return payload as AttendanceListResponse<T>;
  }
  return {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 0,
    total: 0,
  };
}

export interface StudentAttendanceFilters {
  page?: number;
  per_page?: number;
  date?: string;
  session_id?: string | number | null;
  term_id?: string | number | null;
  school_class_id?: string | number | null;
  class_arm_id?: string | number | null;
  class_section_id?: string | number | null;
  search?: string | null;
}

export async function listStudentAttendance(
  filters: StudentAttendanceFilters = {},
): Promise<AttendanceListResponse<StudentAttendanceRecord>> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    date: filters.date,
    session_id: filters.session_id,
    term_id: filters.term_id,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id,
    search: filters.search,
  });

  const payload = await apiFetch<
    AttendanceListResponse<StudentAttendanceRecord> | StudentAttendanceRecord[]
  >(`${API_ROUTES.studentAttendance}${query}`);

  return normalizeAttendanceList<StudentAttendanceRecord>(payload);
}

export interface StudentAttendanceEntryPayload {
  student_id: number | string;
  status: string;
  notes?: string | null;
}

export interface SaveStudentAttendancePayload {
  date: string;
  session_id?: Nullable<string | number>;
  term_id?: Nullable<string | number>;
  school_class_id?: Nullable<string | number>;
  class_arm_id?: Nullable<string | number>;
  class_section_id?: Nullable<string | number>;
  entries: StudentAttendanceEntryPayload[];
}

interface AttendanceMutationResponse<T> {
  data?: T[] | { data?: T[] };
  message?: string;
  [key: string]: unknown;
}

export interface AttendanceSaveResult<T> {
  records: T[];
  message?: string;
}

function extractMutationResponse<T>(
  payload: AttendanceMutationResponse<T> | T[] | T | undefined,
): AttendanceSaveResult<T> {
  if (!payload) {
    return { records: [] };
  }
  if (Array.isArray(payload)) {
    return { records: payload };
  }
  if (payload && typeof payload === "object" && "data" in payload) {
    const dataField = (payload as { data?: unknown }).data;
    if (Array.isArray(dataField)) {
      return {
        records: dataField as T[],
        message:
          typeof (payload as AttendanceMutationResponse<T>).message === "string"
            ? (payload as AttendanceMutationResponse<T>).message
            : undefined,
      };
    }
    if (
      dataField &&
      typeof dataField === "object" &&
      Array.isArray((dataField as { data?: T[] }).data)
    ) {
      return {
        records: ((dataField as { data?: T[] }).data ?? []) as T[],
        message:
          typeof (payload as AttendanceMutationResponse<T>).message === "string"
            ? (payload as AttendanceMutationResponse<T>).message
            : undefined,
      };
    }
  }
  return {
    records: [],
    message:
      typeof (payload as AttendanceMutationResponse<T>).message === "string"
        ? (payload as AttendanceMutationResponse<T>).message
        : undefined,
  };
}

export async function saveStudentAttendance(
  payload: SaveStudentAttendancePayload,
): Promise<AttendanceSaveResult<StudentAttendanceRecord>> {
  const sanitizedPayload = { ...payload };
  delete sanitizedPayload.class_section_id;
  const response = await apiFetch<
    AttendanceMutationResponse<StudentAttendanceRecord>
  >(API_ROUTES.studentAttendance, {
    method: "POST",
    body: JSON.stringify(sanitizedPayload),
  });
  return extractMutationResponse<StudentAttendanceRecord>(response);
}

export async function deleteStudentAttendance(
  attendanceId: number | string,
): Promise<void> {
  await apiFetch(`${API_ROUTES.studentAttendance}/${attendanceId}`, {
    method: "DELETE",
  });
}

export interface StaffAttendanceFilters {
  page?: number;
  per_page?: number;
  date?: string;
  branch_name?: string | null;
  department?: string | null;
  search?: string | null;
}

export async function listStaffAttendance(
  filters: StaffAttendanceFilters = {},
): Promise<AttendanceListResponse<StaffAttendanceRecord>> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    date: filters.date,
    branch_name: filters.branch_name,
    department: filters.department,
    search: filters.search,
  });

  const payload = await apiFetch<
    AttendanceListResponse<StaffAttendanceRecord> | StaffAttendanceRecord[]
  >(`${API_ROUTES.staffAttendance}${query}`);

  return normalizeAttendanceList<StaffAttendanceRecord>(payload);
}

export interface StaffAttendanceEntryPayload {
  staff_id: number | string;
  status: string;
  branch_name?: string | null;
  notes?: string | null;
}

export interface SaveStaffAttendancePayload {
  date: string;
  branch_name?: Nullable<string>;
  department?: Nullable<string>;
  entries: StaffAttendanceEntryPayload[];
}

export async function saveStaffAttendance(
  payload: SaveStaffAttendancePayload,
): Promise<AttendanceSaveResult<StaffAttendanceRecord>> {
  const response = await apiFetch<
    AttendanceMutationResponse<StaffAttendanceRecord>
  >(API_ROUTES.staffAttendance, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return extractMutationResponse<StaffAttendanceRecord>(response);
}

export async function deleteStaffAttendance(
  attendanceId: number | string,
): Promise<void> {
  await apiFetch(`${API_ROUTES.staffAttendance}/${attendanceId}`, {
    method: "DELETE",
  });
}

export interface StudentAttendanceReport {
  summary?: {
    total_records?: number;
    unique_students?: number;
    [key: string]: number | undefined;
  };
  status_breakdown?: Record<string, number>;
  students_at_risk?: Array<{
    student_id?: number | string;
    student_name?: string;
    admission_no?: string | null;
    absent_days?: number;
    late_days?: number;
    [key: string]: unknown;
  }>;
  [key: string]: unknown;
}

export interface StaffAttendanceReport {
  summary?: {
    total_records?: number;
    unique_staff?: number;
    [key: string]: number | undefined;
  };
  status_breakdown?: Record<string, number>;
  department_breakdown?: Record<string, number>;
  [key: string]: unknown;
}

export interface AttendanceReportFilters {
  from?: string;
  to?: string;
  school_class_id?: string | number | null;
  department?: string | null;
  session_id?: string | number | null;
  term_id?: string | number | null;
  student_id?: string | number | null;
}

export async function fetchStudentAttendanceReport(
  filters: AttendanceReportFilters = {},
): Promise<StudentAttendanceReport> {
  const query = buildQuery({
    from: filters.from,
    to: filters.to,
    school_class_id: filters.school_class_id,
    session_id: filters.session_id,
    term_id: filters.term_id,
    student_id: filters.student_id,
  });
  return apiFetch<StudentAttendanceReport>(
    `${API_ROUTES.studentAttendance}/report${query}`,
  );
}

export async function fetchStaffAttendanceReport(
  filters: AttendanceReportFilters = {},
): Promise<StaffAttendanceReport> {
  const query = buildQuery({
    from: filters.from,
    to: filters.to,
    department: filters.department,
  });
  return apiFetch<StaffAttendanceReport>(
    `${API_ROUTES.staffAttendance}/report${query}`,
  );
}

export type AttendanceExportType = "csv" | "pdf";

export interface StudentAttendanceExportFilters
  extends StudentAttendanceFilters {
  from?: string;
  to?: string;
}

export function buildStudentAttendanceExportUrl(
  type: AttendanceExportType,
  filters: StudentAttendanceExportFilters,
): string {
  const endpoint = type === "pdf" ? "export.pdf" : "export.csv";
  const query = buildQuery({
    date: filters.date,
    from: filters.from,
    to: filters.to,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id,
    session_id: filters.session_id,
    term_id: filters.term_id,
  });
  return `${BACKEND_URL}${API_ROUTES.studentAttendance}/${endpoint}${query}`;
}

export interface StaffAttendanceExportFilters
  extends StaffAttendanceFilters,
    AttendanceReportFilters {}

export function buildStaffAttendanceExportUrl(
  type: AttendanceExportType,
  filters: StaffAttendanceExportFilters,
): string {
  const endpoint = type === "pdf" ? "export.pdf" : "export.csv";
  const query = buildQuery({
    date: filters.date,
    from: filters.from,
    to: filters.to,
    branch_name: filters.branch_name,
    department: filters.department,
  });
  return `${BACKEND_URL}${API_ROUTES.staffAttendance}/${endpoint}${query}`;
}
