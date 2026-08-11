import { apiFetch } from "@/lib/apiClient";

export interface StudentSessionOption {
  id: string;
  name: string;
  start_date?: string | null;
  terms?: Array<{
    id: string;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
  }>;
}

export interface StudentResultComponent {
  id?: string | null;
  label?: string | null;
  score?: number | null;
}

export interface StudentResultEntry {
  subject?: string | null;
  components?: StudentResultComponent[];
  total?: number | null;
}

export interface StudentResultResponse {
  student: {
    id: string;
    first_name: string;
    last_name: string;
    admission_no: string;
  };
  results: StudentResultEntry[];
}

export interface StudentSessionsResponse {
  sessions: StudentSessionOption[];
  requirePinForResultAccess: boolean;
}

export async function listStudentSessions(): Promise<StudentSessionsResponse> {
  const payload = await apiFetch<{
    data: StudentSessionOption[];
    meta?: { require_pin_for_pdf_download?: boolean };
  }>(
    "/api/v1/student/sessions",
    { authScope: "student" },
  );
  return {
    sessions: Array.isArray(payload.data) ? payload.data : [],
    requirePinForResultAccess:
      payload.meta?.require_pin_for_pdf_download !== false,
  };
}

export async function previewStudentResult(params: {
  session_id: string;
  term_id: string;
  pin_code?: string;
}): Promise<StudentResultResponse> {
  return apiFetch<StudentResultResponse>("/api/v1/student/results/preview", {
    method: "POST",
    authScope: "student",
    body: JSON.stringify(params),
  });
}
