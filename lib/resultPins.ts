import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface ResultPinStudent {
  id?: number | string;
  name?: string;
  first_name?: string | null;
  last_name?: string | null;
  admission_no?: string | null;
  [key: string]: unknown;
}

export interface ResultPinSessionOrTerm {
  id?: number | string;
  name?: string;
  [key: string]: unknown;
}

export interface ResultPin {
  id: number | string;
  student_id: number | string;
  session_id: number | string;
  term_id: number | string;
  pin_code?: string;
  status?: string;
  expires_at?: string | null;
  updated_at?: string | null;
  use_count?: number;
  max_usage?: number | null;
  student?: ResultPinStudent;
  session?: ResultPinSessionOrTerm;
  term?: ResultPinSessionOrTerm;
  [key: string]: unknown;
}

type ResultPinResponse =
  | ResultPin[]
  | {
      data?: ResultPin[];
      [key: string]: unknown;
    };

function normalizePins(payload: ResultPinResponse): ResultPin[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

export interface ResultPinFilters {
  session_id: string | number;
  term_id: string | number;
  school_class_id?: string | number | null;
  class_arm_id?: string | number | null;
  student_id?: string | number | null;
}

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

export async function listResultPins(
  filters: ResultPinFilters,
): Promise<ResultPin[]> {
  const query = buildQuery({
    session_id: filters.session_id,
    term_id: filters.term_id,
    school_class_id: filters.school_class_id ?? undefined,
    class_arm_id: filters.class_arm_id ?? undefined,
    student_id: filters.student_id ?? undefined,
  });

  const payload = await apiFetch<ResultPinResponse>(
    `${API_ROUTES.resultPins}${query}`,
  );
  return normalizePins(payload);
}

export type StudentResultPinFilters = Omit<ResultPinFilters, "student_id">;

export async function listStudentResultPins(
  studentId: number | string,
  filters: StudentResultPinFilters,
): Promise<ResultPin[]> {
  return listResultPins({
    ...filters,
    student_id: studentId,
  });
}

export interface GenerateStudentPinPayload {
  session_id: string | number;
  term_id: string | number;
  regenerate?: boolean;
  expires_at?: string | null;
  max_usage?: number | null;
}

interface PinMutationResponse {
  data?: ResultPin | ResultPin[];
  message?: string;
  [key: string]: unknown;
}

function extractPin(response: PinMutationResponse | ResultPin): ResultPin {
  if (response && typeof response === "object" && "student_id" in response) {
    return response as ResultPin;
  }
  const wrapper = response as PinMutationResponse;
  if (wrapper?.data) {
    if (Array.isArray(wrapper.data)) {
      const [first] = wrapper.data;
      if (first) {
        return first;
      }
    } else {
      return wrapper.data;
    }
  }
  throw new Error("Unexpected response while generating result PIN.");
}

export async function generateResultPinForStudent(
  studentId: number | string,
  payload: GenerateStudentPinPayload,
): Promise<ResultPin> {
  const response = await apiFetch<PinMutationResponse | ResultPin>(
    `/api/v1/students/${studentId}/result-pins`,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return extractPin(response);
}

export interface BulkGeneratePinsPayload {
  session_id: string | number;
  term_id: string | number;
  school_class_id?: string | number | null;
  class_arm_id?: string | number | null;
  regenerate?: boolean;
  expires_at?: string | null;
  max_usage?: number | null;
}

export async function bulkGenerateResultPins(
  payload: BulkGeneratePinsPayload,
): Promise<PinMutationResponse> {
  return apiFetch<PinMutationResponse>(`${API_ROUTES.resultPins}/bulk`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function invalidateResultPin(
  pinId: number | string,
): Promise<void> {
  await apiFetch(`${API_ROUTES.resultPins}/${pinId}/invalidate`, {
    method: "PUT",
  });
}
