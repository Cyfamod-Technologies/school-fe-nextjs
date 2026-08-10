import { apiFetch } from "@/lib/apiClient";

export type StudentAttendanceStatus =
  | "present"
  | "absent"
  | "late"
  | "excused";

export interface StudentAttendanceDay {
  id: string;
  date: string;
  status: StudentAttendanceStatus;
  updated_at?: string | null;
}

export interface StudentAttendanceSummary {
  present: number;
  absent: number;
  late: number;
  excused: number;
  recorded_days: number;
  percentage: number;
}

export interface StudentAttendanceHistory {
  session: {
    id: string;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
  };
  term: {
    id: string;
    name: string;
    start_date?: string | null;
    end_date?: string | null;
  };
  month: string;
  summary: StudentAttendanceSummary;
  days: StudentAttendanceDay[];
}

export async function getStudentAttendance(params: {
  sessionId: string;
  termId: string;
  month: string;
}): Promise<StudentAttendanceHistory> {
  const query = new URLSearchParams({
    session_id: params.sessionId,
    term_id: params.termId,
    month: params.month,
  });

  return apiFetch<StudentAttendanceHistory>(
    `/api/v1/student/attendance?${query.toString()}`,
    { authScope: "student" },
  );
}
