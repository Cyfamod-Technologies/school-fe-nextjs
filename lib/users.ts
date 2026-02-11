import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";
import { type Role } from "@/lib/roles";

export interface ManagedUser {
  id: string;
  name: string;
  email: string;
  role?: string | null;
  status?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  roles?: Role[];
  [key: string]: unknown;
}

export interface UserListResponse {
  data: ManagedUser[];
  current_page: number;
  last_page: number;
  per_page: number;
  total: number;
  from?: number | null;
  to?: number | null;
  [key: string]: unknown;
}

export interface UserFilters {
  page?: number;
  per_page?: number;
  search?: string;
  support_only?: boolean;
}

type UserPayload =
  | ManagedUser[]
  | UserListResponse
  | {
      data?: ManagedUser[] | UserListResponse;
      [key: string]: unknown;
    }
  | undefined;

function buildQuery(params: Record<string, string | number | undefined>): string {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== "") {
      search.append(key, String(value));
    }
  });
  const queryString = search.toString();
  return queryString ? `?${queryString}` : "";
}

function normalizeUserList(payload: UserPayload): UserListResponse {
  if (!payload) {
    return {
      data: [],
      current_page: 1,
      last_page: 1,
      per_page: 0,
      total: 0,
    };
  }

  if (Array.isArray(payload)) {
    return {
      data: payload,
      current_page: 1,
      last_page: 1,
      per_page: payload.length,
      total: payload.length,
    };
  }

  if ("data" in payload) {
    const dataField = payload.data;
    if (Array.isArray(dataField)) {
      return {
        data: dataField,
        current_page: 1,
        last_page: 1,
        per_page: dataField.length,
        total: dataField.length,
      };
    }

    if (
      dataField &&
      typeof dataField === "object" &&
      Array.isArray((dataField as UserListResponse).data)
    ) {
      return dataField as UserListResponse;
    }
  }

  if (
    payload &&
    typeof (payload as UserListResponse).data !== "undefined" &&
    Array.isArray((payload as UserListResponse).data)
  ) {
    return payload as UserListResponse;
  }

  return {
    data: [],
    current_page: 1,
    last_page: 1,
    per_page: 0,
    total: 0,
  };
}

export async function listUsers(filters: UserFilters = {}): Promise<UserListResponse> {
  const query = buildQuery({
    page: filters.page,
    per_page: filters.per_page,
    search: filters.search,
    support_only: filters.support_only ? 1 : undefined,
  });

  const payload = await apiFetch<UserPayload>(`${API_ROUTES.users}${query}`);
  return normalizeUserList(payload);
}

export async function updateUserRoles(
  userId: string,
  roleIds: Array<number | string>,
): Promise<Role[]> {
  const numericRoleIds = roleIds.map((value) => {
    const numeric = Number(value);
    return Number.isNaN(numeric) ? value : numeric;
  });

  const response = await apiFetch<{
    data?: {
      user_id?: string | number;
      roles?: Role[] | { data?: Role[] };
    };
  }>(`${API_ROUTES.users}/${userId}/roles`, {
    method: "PUT",
    body: JSON.stringify({
      roles: numericRoleIds,
    }),
  });

  const rolesPayload = response?.data?.roles;
  if (!rolesPayload) {
    return [];
  }

  if (Array.isArray(rolesPayload)) {
    return rolesPayload;
  }

  if (
    rolesPayload &&
    typeof rolesPayload === "object" &&
    Array.isArray((rolesPayload as { data?: Role[] }).data)
  ) {
    return ((rolesPayload as { data?: Role[] }).data ?? []) as Role[];
  }

  return [];
}
