import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface SkillCategory {
  id: number | string;
  name: string;
  description?: string | null;
  school_class_id?: string | null;
  school_class?: {
    id: string | number;
    name: string;
  } | null;
  skill_types?: SkillType[];
  [key: string]: unknown;
}

export interface SkillType {
  id: number | string;
  skill_category_id: number | string;
  name: string;
  weight?: number | null;
  description?: string | null;
  category?: string | null;
  school_class_id?: string | null;
  school_class?: {
    id: string | number;
    name: string;
  } | null;
  category_school_class_id?: string | null;
  [key: string]: unknown;
}

type CategoriesResponse =
  | SkillCategory[]
  | {
      data?: SkillCategory[];
      [key: string]: unknown;
    };

type SkillTypesResponse =
  | SkillType[]
  | {
      data?: SkillType[];
      [key: string]: unknown;
    };

function normalizeCategories(payload: CategoriesResponse): SkillCategory[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

function normalizeSkillTypes(payload: SkillTypesResponse): SkillType[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload && Array.isArray(payload.data)) {
    return payload.data;
  }
  return [];
}

export interface ListSkillCategoriesOptions {
  schoolClassId?: string | number;
}

export async function listSkillCategories(
  options: ListSkillCategoriesOptions = {},
): Promise<SkillCategory[]> {
  const params = new URLSearchParams();
  if (options.schoolClassId) {
    params.set("school_class_id", String(options.schoolClassId));
  }
  const endpoint = params.size
    ? `${API_ROUTES.skillCategories}?${params.toString()}`
    : API_ROUTES.skillCategories;

  const payload = await apiFetch<CategoriesResponse>(endpoint);
  return normalizeCategories(payload);
}

export interface UpsertSkillCategoryPayload {
  name: string;
  description?: string | null;
  school_class_id?: string | number | null;
}

interface SkillCategoryResponse {
  data?: SkillCategory;
  message?: string;
  [key: string]: unknown;
}

export async function createSkillCategory(
  payload: UpsertSkillCategoryPayload,
): Promise<SkillCategory> {
  const response = await apiFetch<SkillCategory | SkillCategoryResponse>(
    API_ROUTES.skillCategories,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  return extractCategory(response);
}

export async function updateSkillCategory(
  categoryId: number | string,
  payload: UpsertSkillCategoryPayload,
): Promise<SkillCategory> {
  const response = await apiFetch<SkillCategory | SkillCategoryResponse>(
    `${API_ROUTES.skillCategories}/${categoryId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );

  return extractCategory(response);
}

function extractCategory(
  payload: SkillCategory | SkillCategoryResponse,
): SkillCategory {
  if (payload && typeof payload === "object" && "name" in payload) {
    return payload as SkillCategory;
  }
  const wrapper = payload as SkillCategoryResponse;
  if (wrapper && wrapper.data) {
    return wrapper.data;
  }
  throw new Error("Unexpected server response for skill category request.");
}

export async function deleteSkillCategory(
  categoryId: number | string,
): Promise<void> {
  await apiFetch(`${API_ROUTES.skillCategories}/${categoryId}`, {
    method: "DELETE",
  });
}

export interface ListSkillTypesOptions {
  skillCategoryId?: number | string;
  schoolClassId?: number | string;
}

export async function listSkillTypes(
  options: ListSkillTypesOptions = {},
): Promise<SkillType[]> {
  const params = new URLSearchParams();
  if (options.skillCategoryId) {
    params.set("skill_category_id", String(options.skillCategoryId));
  }
  if (options.schoolClassId) {
    params.set("school_class_id", String(options.schoolClassId));
  }
  const endpoint = params.size
    ? `${API_ROUTES.skillTypes}?${params.toString()}`
    : API_ROUTES.skillTypes;

  const payload = await apiFetch<SkillTypesResponse>(endpoint);
  return normalizeSkillTypes(payload);
}

export interface UpsertSkillTypePayload {
  skill_category_id: number | string;
  name: string;
  weight?: number | null;
  description?: string | null;
  school_class_id?: string | number | null;
}

export interface BulkCreateSkillTypesPayload {
  skill_category_id: number | string;
  names: string[];
  weight?: number | null;
  description?: string | null;
  school_class_id?: string | number | null;
}

interface SkillTypeResponse {
  data?: SkillType;
  message?: string;
  [key: string]: unknown;
}

function extractSkillType(
  payload: SkillType | SkillTypeResponse,
): SkillType {
  if (payload && typeof payload === "object" && "skill_category_id" in payload) {
    return payload as SkillType;
  }
  const wrapper = payload as SkillTypeResponse;
  if (wrapper && wrapper.data) {
    return wrapper.data;
  }
  throw new Error("Unexpected server response for skill type request.");
}

export async function createSkillType(
  payload: UpsertSkillTypePayload,
): Promise<SkillType> {
  const response = await apiFetch<SkillType | SkillTypeResponse>(
    API_ROUTES.skillTypes,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );
  return extractSkillType(response);
}

interface BulkSkillTypeResponse {
  data?: SkillType[];
  message?: string;
  [key: string]: unknown;
}

export async function createSkillTypesBulk(
  payload: BulkCreateSkillTypesPayload,
): Promise<SkillType[]> {
  const response = await apiFetch<BulkSkillTypeResponse>(
    API_ROUTES.skillTypesBulk,
    {
      method: "POST",
      body: JSON.stringify(payload),
    },
  );

  if (response && Array.isArray(response.data)) {
    return response.data;
  }

  throw new Error("Unexpected server response for bulk skill create request.");
}

export async function updateSkillType(
  skillTypeId: number | string,
  payload: UpsertSkillTypePayload,
): Promise<SkillType> {
  const response = await apiFetch<SkillType | SkillTypeResponse>(
    `${API_ROUTES.skillTypes}/${skillTypeId}`,
    {
      method: "PUT",
      body: JSON.stringify(payload),
    },
  );
  return extractSkillType(response);
}

export async function deleteSkillType(
  skillTypeId: number | string,
): Promise<void> {
  await apiFetch(`${API_ROUTES.skillTypes}/${skillTypeId}`, {
    method: "DELETE",
  });
}

interface BulkSkillScopeResponse {
  data?: SkillType[];
  message?: string;
  [key: string]: unknown;
}

export interface BulkCopySkillTypesResponse {
  data?: SkillType[];
  skipped?: Array<{
    id: number | string;
    name: string;
    reason?: string;
  }>;
  message?: string;
  [key: string]: unknown;
}

export async function assignSkillTypesToClass(
  skillTypeIds: Array<number | string>,
  schoolClassId?: number | string | null,
): Promise<SkillType[]> {
  const response = await apiFetch<BulkSkillScopeResponse>(
    `${API_ROUTES.skillTypes}/scope`,
    {
      method: "PUT",
      body: JSON.stringify({
        skill_type_ids: skillTypeIds,
        school_class_id: schoolClassId ?? null,
      }),
    },
  );

  if (response && Array.isArray(response.data)) {
    return response.data;
  }

  throw new Error("Unexpected server response for bulk skill scope update.");
}

export async function copySkillTypesToClass(
  skillTypeIds: Array<number | string>,
  schoolClassId?: number | string | null,
): Promise<BulkCopySkillTypesResponse> {
  const response = await apiFetch<BulkCopySkillTypesResponse>(
    API_ROUTES.skillTypesCopy,
    {
      method: "POST",
      body: JSON.stringify({
        skill_type_ids: skillTypeIds,
        school_class_id: schoolClassId ?? null,
      }),
    },
  );

  if (response && Array.isArray(response.data)) {
    return response;
  }

  throw new Error("Unexpected server response for bulk skill copy request.");
}
