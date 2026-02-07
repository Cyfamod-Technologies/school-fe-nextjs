import { apiFetch } from "@/lib/apiClient";

export interface Country {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

export interface State {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

export interface Lga {
  id?: number | string;
  name: string;
  [key: string]: unknown;
}

export interface BloodGroup {
  id: number | string;
  name: string;
  [key: string]: unknown;
}

type CollectionResponse<T> =
  | T[]
  | {
      data?: T[];
      items?: T[];
      results?: T[];
      [key: string]: unknown;
    };

function normalizeCollection<T>(payload: CollectionResponse<T>): T[] {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (payload?.data && Array.isArray(payload.data)) {
    return payload.data;
  }
  if (payload?.items && Array.isArray(payload.items)) {
    return payload.items;
  }
  if (payload?.results && Array.isArray(payload.results)) {
    return payload.results;
  }
  return [];
}

type LocationFetchOptions = {
  authScope?: "staff" | "student";
  skipAuth?: boolean;
};

function locationPrefix(options: LocationFetchOptions): string {
  return options.authScope === "student"
    ? "/api/v1/student/locations"
    : "/api/v1/locations";
}

export async function listCountries(
  options: LocationFetchOptions = {},
): Promise<Country[]> {
  const payload = await apiFetch<CollectionResponse<Country>>(
    `${locationPrefix(options)}/countries`,
    options,
  );
  return normalizeCollection(payload);
}

export async function listStates(
  countryId: string | number,
  options: LocationFetchOptions = {},
): Promise<State[]> {
  const payload = await apiFetch<CollectionResponse<State>>(
    `${locationPrefix(options)}/states?country_id=${countryId}`,
    options,
  );
  return normalizeCollection(payload);
}

export async function listLgas(
  stateId: string | number,
  options: LocationFetchOptions = {},
): Promise<Lga[]> {
  const payload = await apiFetch<CollectionResponse<Lga>>(
    `${locationPrefix(options)}/states/${stateId}/lgas`,
    options,
  );
  return normalizeCollection(payload);
}

export async function listBloodGroups(
  options: LocationFetchOptions = {},
): Promise<BloodGroup[]> {
  const payload = await apiFetch<CollectionResponse<BloodGroup>>(
    `${locationPrefix(options)}/blood-groups`,
    options,
  );
  return normalizeCollection(payload);
}
