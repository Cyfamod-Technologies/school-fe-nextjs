import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";
import { deleteCookie, setCookie } from "@/lib/cookies";
import type { Staff } from "@/lib/staff";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  [key: string]: unknown;
}

export interface UserParent {
  id: string | number;
  first_name?: string | null;
  last_name?: string | null;
  phone?: string | null;
  students_count?: number;
  [key: string]: unknown;
}

export interface UserRole {
  id: number;
  name: string;
  description?: string | null;
  permissions?: UserPermission[];
}

export interface UserPermission {
  id: number;
  name: string;
  description?: string | null;
}

export interface User {
  id: number;
  name: string;
  email: string;
  school?: School;
  parents?: UserParent[];
  roles?: UserRole[];
  permissions?: string[];
  staff?: Staff | null;
  linked_students_count?: number;
  student_count?: number;
  parent_count?: number;
  teacher_count?: number;
  [key: string]: unknown;
}

export interface School {
  id: number;
  name: string;
  logo_url?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  signature_url?: string | null;
  current_session_id?: number | null;
  current_term_id?: number | null;
  current_session?: Session | null;
  current_term?: Term | null;
  [key: string]: unknown;
}

export interface Session {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface Term {
  id: number;
  name: string;
  [key: string]: unknown;
}

export interface AuthenticatedUserResponse {
  user?: User;
  school?: School;
  linked_students_count?: number;
  student_count?: number;
  parent_count?: number;
  teacher_count?: number;
  permissions?: string[];
  [key: string]: unknown;
}

export interface UpdateUserPayload {
  name?: string;
  email?: string;
  old_password?: string;
  password?: string;
  password_confirmation?: string;
}

export async function login(payload: LoginPayload): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>(API_ROUTES.login, {
    method: "POST",
    body: JSON.stringify(payload),
    skipAuth: true,
  });

  if (response.token) {
    setCookie("token", response.token);
  }

  return response;
}

export async function logout(): Promise<void> {
  try {
    await apiFetch(API_ROUTES.logout, { method: "POST" });
  } catch (error) {
    console.warn("Logout request failed:", error);
  } finally {
    deleteCookie("token");
  }
}

export async function getAuthenticatedUser(): Promise<User | null> {
  try {
    const payload = await apiFetch<AuthenticatedUserResponse>(
      API_ROUTES.currentUser,
    );
    if (payload?.user) {
      const linkedStudentsCount =
        typeof payload.linked_students_count === "number"
          ? payload.linked_students_count
          : undefined;
      const studentCount =
        typeof payload.student_count === "number"
          ? payload.student_count
          : undefined;
      const parentCount =
        typeof payload.parent_count === "number"
          ? payload.parent_count
          : undefined;
      const teacherCount =
        typeof payload.teacher_count === "number"
          ? payload.teacher_count
          : undefined;

      return {
        ...payload.user,
        school: payload.user.school ?? payload.school,
        linked_students_count: linkedStudentsCount,
        student_count: studentCount,
        parent_count: parentCount,
        teacher_count: teacherCount,
        permissions: Array.isArray(payload.permissions)
          ? payload.permissions
          : Array.isArray(payload.user.permissions)
            ? (payload.user.permissions as string[])
            : [],
      };
    }
    if (payload?.school) {
      return {
        id: -1,
        name: "Unknown",
        email: "",
        school: payload.school,
      };
    }
    return null;
  } catch (error) {
    console.error("Unable to fetch authenticated user", error);
    return null;
  }
}

export async function getPermissionHierarchy(): Promise<any> {
  try {
    const payload = await apiFetch(API_ROUTES.permissionHierarchy);
    return payload;
  } catch (error) {
    console.error("Unable to fetch permission hierarchy", error);
    return null;
  }
}

export async function updateUserProfile(
  payload: UpdateUserPayload,
): Promise<User | null> {
  try {
    const response = await apiFetch<User | AuthenticatedUserResponse>(
      API_ROUTES.currentUser,
      {
        method: "PUT",
        body: JSON.stringify(payload),
      },
    );

    if (response && typeof response === "object") {
      if ("user" in response && (response as AuthenticatedUserResponse).user) {
        return (response as AuthenticatedUserResponse).user ?? null;
      }
    }

    return (response as User) ?? null;
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Unable to update user profile");
  }
}
