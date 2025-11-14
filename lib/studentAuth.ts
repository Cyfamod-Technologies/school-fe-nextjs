import { apiFetch } from "@/lib/apiClient";
import { deleteCookie, setCookie } from "@/lib/cookies";

export interface StudentLoginPayload {
  admission_no: string;
  password: string;
}

export interface StudentProfile {
  id: string;
  admission_no: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  gender?: string | null;
  subjects?: Array<{ id: string; name: string }>;
  school?: {
    id: string;
    name: string;
    logo_url?: string | null;
  } | null;
  current_session?: {
    id: string;
    name: string;
  } | null;
  current_term?: {
    id: string;
    name: string;
  } | null;
  school_class?: {
    id: string;
    name: string;
  } | null;
  class_arm?: {
    id: string;
    name: string;
  } | null;
}

export interface StudentLoginResponse {
  token: string;
  student: StudentProfile;
}

export async function studentLogin(
  payload: StudentLoginPayload,
): Promise<StudentLoginResponse> {
  const response = await apiFetch<StudentLoginResponse>(
    "/api/v1/student/login",
    {
      method: "POST",
      body: JSON.stringify(payload),
      skipAuth: true,
    },
  );

  if (response.token) {
    setCookie("student_token", response.token);
  }

  return response;
}

export async function studentLogout(): Promise<void> {
  try {
    await apiFetch("/api/v1/student/logout", {
      method: "POST",
      authScope: "student",
    });
  } catch (error) {
    console.warn("Student logout request failed", error);
  } finally {
    deleteCookie("student_token");
  }
}

export async function getStudentProfile(): Promise<StudentProfile | null> {
  try {
    const response = await apiFetch<{ student: StudentProfile }>(
      "/api/v1/student/profile",
      { authScope: "student" },
    );
    return response.student ?? null;
  } catch (error) {
    console.error("Unable to fetch student profile", error);
    return null;
  }
}
