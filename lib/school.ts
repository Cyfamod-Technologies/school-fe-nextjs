import { apiFetch } from "@/lib/apiClient";
import type { School } from "@/lib/auth";

export interface UpdateSchoolPayload {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  student_portal_link?: string;
  current_session_id?: string | number | null;
  current_term_id?: string | number | null;
  logo?: File | null;
  signature?: File | null;
  removeSignature?: boolean;
}

export async function getSchool(): Promise<School | null> {
  try {
    const payload = await apiFetch<{ school?: School } | School>("/api/v1/school");
    if (payload && typeof payload === "object" && "school" in payload) {
      return (payload as { school?: School }).school ?? null;
    }
    return (payload as School) ?? null;
  } catch (error) {
    console.error("Failed to fetch school profile", error);
    return null;
  }
}

export async function updateSchoolProfile(
  payload: UpdateSchoolPayload,
): Promise<void> {
  const formData = new FormData();

  if (payload.name !== undefined) {
    formData.append("name", `${payload.name}`);
  }
  if (payload.email !== undefined) {
    formData.append("email", `${payload.email}`);
  }
  if (payload.phone !== undefined) {
    formData.append("phone", `${payload.phone}`);
  }
  if (payload.address !== undefined) {
    formData.append("address", `${payload.address}`);
  }
  if (payload.student_portal_link !== undefined) {
    formData.append("student_portal_link", `${payload.student_portal_link}`);
  }
  if (payload.current_session_id) {
    formData.append("current_session_id", `${payload.current_session_id}`);
  }
  if (payload.current_term_id) {
    formData.append("current_term_id", `${payload.current_term_id}`);
  }
  if (payload.logo instanceof File) {
    formData.append("logo", payload.logo);
  }
  if (payload.signature instanceof File) {
    formData.append("signature", payload.signature);
  }
  if (payload.removeSignature) {
    formData.append("signature_url", "");
  }

  formData.append("_method", "PUT");

  await apiFetch("/api/v1/school", {
    method: "POST",
    body: formData,
  });
}
