import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface ParentUser {
  email?: string | null;
  [key: string]: unknown;
}

export interface Parent {
  id: number;
  first_name: string;
  last_name: string;
  phone: string;
  email?: string | null;
  occupation?: string | null;
  address?: string | null;
  students_count?: number;
  user?: ParentUser | null;
  [key: string]: unknown;
}

type ParentsResponse =
  | Parent[]
  | {
      data?: Parent[];
      [key: string]: unknown;
    };

function normalizeParents(payload: ParentsResponse): Parent[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

export async function listParents(): Promise<Parent[]> {
  const payload = await apiFetch<ParentsResponse>(API_ROUTES.parentsIndex);
  return normalizeParents(payload);
}

export async function searchParents(query: string): Promise<Parent[]> {
  const payload = await apiFetch<ParentsResponse>(
    `${API_ROUTES.parentsSearch}?search=${encodeURIComponent(query)}`,
  );
  return normalizeParents(payload);
}

export async function getParent(
  parentId: number | string,
): Promise<Parent | null> {
  try {
    return await apiFetch<Parent>(`${API_ROUTES.parents}/${parentId}`);
  } catch (error) {
    console.error("Unable to load parent", error);
    return null;
  }
}

export interface SaveParentPayload {
  first_name: string;
  last_name: string;
  phone: string;
  email?: string;
  occupation?: string;
  address?: string;
}

export async function createParent(
  payload: SaveParentPayload,
): Promise<Parent> {
  return apiFetch<Parent>(API_ROUTES.parents, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function updateParent(
  parentId: number | string,
  payload: SaveParentPayload,
): Promise<Parent> {
  return apiFetch<Parent>(`${API_ROUTES.parents}/${parentId}`, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export async function deleteParent(parentId: number | string): Promise<void> {
  await apiFetch(`${API_ROUTES.parents}/${parentId}`, {
    method: "DELETE",
  });
}
