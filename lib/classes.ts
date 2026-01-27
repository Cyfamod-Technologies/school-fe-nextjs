import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface SchoolClass {
  id: number;
  name: string;
  school_id?: number;
  result_show_position?: boolean | null;
  [key: string]: unknown;
}

type ClassesResponse =
  | SchoolClass[]
  | {
      data?: SchoolClass[];
      [key: string]: unknown;
    };

function normalizeClasses(payload: ClassesResponse): SchoolClass[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

export async function listClasses(): Promise<SchoolClass[]> {
  try {
    const payload = await apiFetch<ClassesResponse>(API_ROUTES.classes);
    const items = normalizeClasses(payload);
    // Sort by created_at (oldest first) if available, otherwise by numeric id, otherwise by name.
    items.sort((a, b) => {
      const aTime = a?.created_at ? Date.parse(String(a.created_at)) : NaN;
      const bTime = b?.created_at ? Date.parse(String(b.created_at)) : NaN;
      if (!Number.isNaN(aTime) && !Number.isNaN(bTime)) {
        return aTime - bTime;
      }
      if (a.id != null && b.id != null) {
        const aId = Number(a.id);
        const bId = Number(b.id);
        if (!Number.isNaN(aId) && !Number.isNaN(bId)) {
          return aId - bId;
        }
      }
      const aName = String(a.name ?? "");
      const bName = String(b.name ?? "");
      return aName.localeCompare(bName);
    });
    return items;
  } catch (error) {
    // If it's a 403 error, return empty array (permission denied - user shouldn't see classes)
    if (error instanceof Error && ((error as Error & { status?: number }).status === 403 || error.message.includes("403") || error.message.includes("permission"))) {
      return [];
    }
    // For other errors, re-throw
    throw error;
  }
}

export async function getClass(
  classId: number | string,
): Promise<SchoolClass | null> {
  try {
    return await apiFetch<SchoolClass>(`${API_ROUTES.classes}/${classId}`);
  } catch (error) {
    console.error("Unable to load class", error);
    return null;
  }
}

export interface CreateClassPayload {
  name: string;
  school_id: number;
  result_show_position?: boolean | null;
}

export async function createClass(
  payload: CreateClassPayload,
): Promise<SchoolClass> {
  return apiFetch<SchoolClass>(API_ROUTES.classes, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateClass(
  classId: number | string,
  payload: { name: string; result_show_position?: boolean | null },
): Promise<SchoolClass> {
  return apiFetch<SchoolClass>(`${API_ROUTES.classes}/${classId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteClass(classId: number | string): Promise<void> {
  await apiFetch(`${API_ROUTES.classes}/${classId}`, {
    method: "DELETE",
  });
}
