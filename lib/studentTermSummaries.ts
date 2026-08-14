import { apiFetch } from "@/lib/apiClient";

export interface StudentTermSummary {
  class_teacher_comment?: string | null;
  principal_comment?: string | null;
  class_teacher_comment_options?: string[];
  principal_comment_options?: string[];
  days_present?: number | null;
  days_absent?: number | null;
  [key: string]: unknown;
}

export interface StudentTermSummaryFilters {
  session_id: string | number;
  term_id: string | number;
}

export interface UpdateStudentTermSummaryPayload
  extends StudentTermSummaryFilters {
  class_teacher_comment?: string | null;
  principal_comment?: string | null;
  days_present?: number | null;
  days_absent?: number | null;
}

export interface StudentTermSummaryBatchFilters
  extends StudentTermSummaryFilters {
  school_class_id: string | number;
  class_arm_id?: string | number | null;
  class_section_id?: string | number | null;
}

export interface StudentTermSummaryBatchRow {
  student: {
    id: string | number;
    name?: string | null;
    admission_no?: string | null;
    class_label?: string | null;
    [key: string]: unknown;
  };
  class_teacher_comment?: string | null;
  principal_comment?: string | null;
  days_present?: number | null;
  days_absent?: number | null;
  [key: string]: unknown;
}

export interface UpdateStudentTermSummaryBatchPayload
  extends StudentTermSummaryFilters {
  entries: Array<{
    student_id: string | number;
    days_present?: number | null;
    days_absent?: number | null;
  }>;
}

interface TermSummaryResponse {
  data?: StudentTermSummary | null;
  [key: string]: unknown;
}

interface TermSummaryBatchResponse {
  data?:
    | StudentTermSummaryBatchRow[]
    | { data?: StudentTermSummaryBatchRow[] };
  message?: string;
  [key: string]: unknown;
}

const EMPTY_SUMMARY: StudentTermSummary = {
  class_teacher_comment: "",
  principal_comment: "",
  class_teacher_comment_options: [],
  principal_comment_options: [],
  days_present: null,
  days_absent: null,
};

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

function extractSummary(
  payload: StudentTermSummary | TermSummaryResponse | null,
): StudentTermSummary {
  if (!payload) {
    return { ...EMPTY_SUMMARY };
  }
  if (
    "class_teacher_comment" in payload ||
    "principal_comment" in payload ||
    "class_teacher_comment_options" in payload ||
    "principal_comment_options" in payload ||
    "days_present" in payload ||
    "days_absent" in payload
  ) {
    return {
      class_teacher_comment:
        (payload as StudentTermSummary).class_teacher_comment ?? "",
      principal_comment:
        (payload as StudentTermSummary).principal_comment ?? "",
      class_teacher_comment_options: Array.isArray(
        (payload as StudentTermSummary).class_teacher_comment_options,
      )
        ? ((payload as StudentTermSummary).class_teacher_comment_options as string[])
        : [],
      principal_comment_options: Array.isArray(
        (payload as StudentTermSummary).principal_comment_options,
      )
        ? ((payload as StudentTermSummary).principal_comment_options as string[])
        : [],
      days_present: (payload as StudentTermSummary).days_present ?? null,
      days_absent: (payload as StudentTermSummary).days_absent ?? null,
    };
  }
  const wrapper = payload as TermSummaryResponse;
  if (wrapper?.data) {
    return {
      class_teacher_comment: wrapper.data.class_teacher_comment ?? "",
      principal_comment: wrapper.data.principal_comment ?? "",
      class_teacher_comment_options: Array.isArray(
        wrapper.data.class_teacher_comment_options,
      )
        ? (wrapper.data.class_teacher_comment_options as string[])
        : [],
      principal_comment_options: Array.isArray(
        wrapper.data.principal_comment_options,
      )
        ? (wrapper.data.principal_comment_options as string[])
        : [],
      days_present: wrapper.data.days_present ?? null,
      days_absent: wrapper.data.days_absent ?? null,
    };
  }
  return { ...EMPTY_SUMMARY };
}

function extractBatchRows(
  payload:
    | StudentTermSummaryBatchRow[]
    | TermSummaryBatchResponse
    | null,
): StudentTermSummaryBatchRow[] {
  if (!payload) {
    return [];
  }
  if (Array.isArray(payload)) {
    return payload;
  }
  if (Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload.data && typeof payload.data === "object") {
    const nested = payload.data as { data?: StudentTermSummaryBatchRow[] };
    if (Array.isArray(nested.data)) {
      return nested.data;
    }
  }
  return [];
}

export async function getStudentTermSummary(
  studentId: string | number,
  filters: StudentTermSummaryFilters,
): Promise<StudentTermSummary> {
  const query = buildQuery({
    session_id: filters.session_id,
    term_id: filters.term_id,
  });
  try {
    const payload = await apiFetch<StudentTermSummary | TermSummaryResponse>(
      `/api/v1/students/${studentId}/term-summary${query}`,
    );
    return extractSummary(payload);
  } catch (error) {
    if (
      error instanceof Error &&
      /(not\s+found|404)/i.test(error.message ?? "")
    ) {
      return { ...EMPTY_SUMMARY };
    }
    throw error;
  }
}

export async function updateStudentTermSummary(
  studentId: string | number,
  payload: UpdateStudentTermSummaryPayload,
): Promise<StudentTermSummary> {
  const response = await apiFetch<StudentTermSummary | TermSummaryResponse>(
    `/api/v1/students/${studentId}/term-summary`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return extractSummary(response);
}

export async function listStudentTermSummaryBatch(
  filters: StudentTermSummaryBatchFilters,
): Promise<StudentTermSummaryBatchRow[]> {
  const query = buildQuery({
    session_id: filters.session_id,
    term_id: filters.term_id,
    school_class_id: filters.school_class_id,
    class_arm_id: filters.class_arm_id ?? undefined,
    class_section_id: filters.class_section_id ?? undefined,
  });
  const response = await apiFetch<
    StudentTermSummaryBatchRow[] | TermSummaryBatchResponse
  >(`/api/v1/student-term-summaries${query}`);
  return extractBatchRows(response);
}

export async function updateStudentTermSummaryBatch(
  payload: UpdateStudentTermSummaryBatchPayload,
): Promise<{ rows: StudentTermSummaryBatchRow[]; message?: string }> {
  const response = await apiFetch<
    StudentTermSummaryBatchRow[] | TermSummaryBatchResponse
  >("/api/v1/student-term-summaries/batch", {
    method: "PUT",
    body: JSON.stringify(payload),
  });

  return {
    rows: extractBatchRows(response),
    message:
      response && typeof response === "object" && "message" in response
        ? typeof response.message === "string"
          ? response.message
          : undefined
        : undefined,
  };
}
