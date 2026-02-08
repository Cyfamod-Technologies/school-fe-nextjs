import { apiFetch } from "@/lib/apiClient";

export interface StudentParent {
  id?: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  phone: string;
  email?: string | null;
  relationship?: string | null;
  occupation?: string | null;
  address?: string | null;
  [key: string]: unknown;
}

export interface StudentParentResponse {
  id: string;
  first_name: string;
  middle_name?: string | null;
  last_name: string;
  phone: string;
  email?: string | null;
  relationship?: string | null;
  occupation?: string | null;
  address?: string | null;
  user_id?: string | null;
  [key: string]: unknown;
}

/**
 * Update or create parent information for a student
 */
export async function upsertStudentParent(
  studentId: string | number,
  parentData: StudentParent,
): Promise<StudentParentResponse> {
  const formData = new FormData();

  Object.entries(parentData).forEach(([key, value]) => {
    if (value !== null && value !== undefined) {
      formData.append(key, String(value));
    }
  });

  return apiFetch<StudentParentResponse>(
    `/api/v1/students/${studentId}/parent`,
    {
      method: "POST",
      body: formData,
      authScope: "student",
    },
  );
}

/**
 * Get parent information for the current student
 */
export async function getStudentParent(): Promise<StudentParentResponse | null> {
  try {
    const response = await apiFetch<{ parent: StudentParentResponse | null }>(
      "/api/v1/student/parent",
      { authScope: "student" },
    );
    return response.parent ?? null;
  } catch (error) {
    console.error("Unable to fetch parent", error);
    return null;
  }
}
