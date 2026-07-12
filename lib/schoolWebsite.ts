import { ApiError, apiFetch } from "@/lib/apiClient";
import type { School } from "@/lib/auth";
import { API_ROUTES } from "@/lib/config";

export type SchoolWebsiteStatus = "draft" | "published" | "unpublished";

export interface WebsiteAction {
  label: string;
  href: string;
}

export interface WebsiteBranding {
  primaryColor: string;
  secondaryColor: string;
}

export interface WebsiteSeo {
  title: string;
  description: string;
  imageUrl: string | null;
}

export interface WebsiteHeader {
  welcomeText: string;
  utilityText: string;
  tagline: string;
}

export interface WebsiteHero {
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string | null;
  primaryAction: WebsiteAction;
  secondaryAction: WebsiteAction;
  trustItems: string[];
  infoCard: {
    label: string;
    title: string;
    description: string;
  };
}

export interface WebsiteHighlight {
  id: string;
  title: string;
  description: string;
  iconUrl: string | null;
}

export interface WebsiteAbout {
  eyebrow: string;
  title: string;
  description: string;
  imageUrl: string | null;
  mission: string;
  vision: string;
}

export interface WebsiteProgramme {
  id: string;
  name: string;
  summary: string;
  imageUrl: string | null;
}

export interface WebsiteAdmissions {
  eyebrow: string;
  title: string;
  description: string;
  action: WebsiteAction;
}

export interface WebsiteContact {
  address: string;
  phone: string;
  email: string;
  mapUrl: string | null;
}

export interface WebsiteSocialLinks {
  facebook: string | null;
  instagram: string | null;
  linkedin: string | null;
  youtube: string | null;
  x: string | null;
}

export interface WebsiteEnabledSections {
  hero: boolean;
  highlights: boolean;
  about: boolean;
  programmes: boolean;
  admissions: boolean;
  contact: boolean;
}

/** The full website contract, as returned by GET /api/v1/school/website. */
export interface SchoolWebsite {
  id: string;
  schoolId: string;
  contractVersion: 1;
  status: SchoolWebsiteStatus;
  themeKey: string;
  branding: WebsiteBranding;
  seo: WebsiteSeo;
  header: WebsiteHeader;
  hero: WebsiteHero;
  highlights: WebsiteHighlight[];
  about: WebsiteAbout;
  programmes: WebsiteProgramme[];
  admissions: WebsiteAdmissions;
  contact: WebsiteContact;
  socialLinks: WebsiteSocialLinks;
  enabledSections: WebsiteEnabledSections;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** The full contract minus server-managed fields, as sent to PUT. */
export type SchoolWebsitePayload = Omit<
  SchoolWebsite,
  "id" | "schoolId" | "publishedAt" | "createdAt" | "updatedAt"
>;

type SchoolWebsiteResponse = SchoolWebsite | { data: SchoolWebsite };

/**
 * Laravel's default JsonResource wraps single-resource responses in a
 * `{ data: ... }` envelope (confirmed against the live endpoint -- not
 * disabled via withoutWrapping() anywhere in this backend). Same defensive
 * unwrap already used by lib/school.ts and lib/resultPageSettings.ts for
 * their own endpoints' envelopes.
 */
function unwrap(payload: SchoolWebsiteResponse): SchoolWebsite {
  if (payload && typeof payload === "object" && "data" in payload) {
    return (payload as { data: SchoolWebsite }).data;
  }
  return payload as SchoolWebsite;
}

export async function getSchoolWebsite(): Promise<SchoolWebsite | null> {
  try {
    const payload = await apiFetch<SchoolWebsiteResponse>(
      API_ROUTES.schoolWebsite,
      { treatForbiddenAsEmpty: false },
    );
    return unwrap(payload);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) {
      return null;
    }

    // 401 (session expired), 403 (no permission), 422, 500, and network
    // failures all mean something real went wrong -- never mask them as
    // "no website configured yet".
    throw error;
  }
}

const PLACEHOLDER_HIGHLIGHT: WebsiteHighlight = {
  id: "highlight-1",
  title: "Update this highlight",
  description: "Edit or replace this from a future Highlights editor.",
  iconUrl: null,
};

const PLACEHOLDER_PROGRAMME: WebsiteProgramme = {
  id: "programme-1",
  name: "Update this programme",
  summary: "Edit or replace this from a future Programmes editor.",
  imageUrl: null,
};

/**
 * Backfills contract sections the MVP form can't edit but the backend's
 * `required` validation still rejects when empty (confirmed live: an
 * existing website loaded with `highlights: []`/`programmes: []` -- which
 * can happen for records seeded before this validation existed, or any
 * other bypass of the FormRequest -- 422s on save with "highlights field
 * is required" otherwise). Always called before PUT so a save never fails
 * because of a section this form doesn't touch.
 */
function ensureValidNonMvpSections(
  payload: SchoolWebsitePayload,
): SchoolWebsitePayload {
  return {
    ...payload,
    highlights:
      payload.highlights.length > 0 ? payload.highlights : [PLACEHOLDER_HIGHLIGHT],
    programmes:
      payload.programmes.length > 0 ? payload.programmes : [PLACEHOLDER_PROGRAMME],
  };
}

export async function saveSchoolWebsite(
  payload: SchoolWebsitePayload,
  status: SchoolWebsiteStatus,
): Promise<SchoolWebsite> {
  const response = await apiFetch<SchoolWebsiteResponse>(
    API_ROUTES.schoolWebsite,
    {
      method: "PUT",
      body: JSON.stringify({
        ...ensureValidNonMvpSections(payload),
        status,
      }),
    },
  );
  return unwrap(response);
}

export interface SchoolWebsitePreviewLink {
  url: string;
  expiresAt: string;
}

/**
 * Requests a fresh short-lived signed preview link (SWT-012) for the
 * authenticated school's current website. 404s (surfaced as a thrown
 * ApiError) if nothing has been saved yet -- a draft has to exist before
 * it can be previewed. Always request a fresh link right before showing
 * the preview; links expire after 10 minutes server-side.
 */
export async function getPreviewLink(): Promise<SchoolWebsitePreviewLink> {
  return apiFetch<SchoolWebsitePreviewLink>(
    API_ROUTES.schoolWebsitePreviewLink,
    { method: "POST" },
  );
}

const THEME_KEY = "kidza-home-2";

/**
 * Kept in sync manually with `themeDefinitions` in
 * `public-web/src/lib/contracts/website.ts` -- the two repos can't share a
 * TypeScript import across a network boundary, so this list is the
 * frontend's own copy. If you add a theme to public-web, add it here too.
 */
export const THEME_OPTIONS: { key: string; label: string }[] = [
  { key: "kidza-home-1", label: "Kidza Home 1" },
  { key: "kidza-home-2", label: "Kidza Home 2" },
  { key: "kidza-home-3", label: "Kidza Home 3" },
];

/**
 * A complete, backend-valid payload for a school that has never configured
 * a website. Only branding/header/hero/status are surfaced in the MVP form,
 * but Laravel's `required` rule rejects empty strings AND empty arrays
 * (confirmed against UpsertSchoolWebsiteRequest and the passing test
 * suite's fixtures) -- so every non-MVP section still needs a real,
 * non-empty value, including one seed entry each for `highlights` and
 * `programmes`. `enabledSections` keeps them hidden from the public site
 * until their own editors exist.
 */
export function createDefaultSchoolWebsite(school: School): SchoolWebsitePayload {
  const name = school.name?.trim() || "Our School";
  const address = school.address?.trim() || "Address not yet provided.";
  const phone = school.phone ? `${school.phone}`.trim() : "";
  const email = school.email?.trim() || "";

  return {
    contractVersion: 1,
    status: "draft",
    themeKey: THEME_KEY,
    branding: {
      primaryColor: "#172033",
      secondaryColor: "#f97316",
    },
    seo: {
      title: name,
      description: `Welcome to ${name}.`,
      imageUrl: school.logo_url ?? null,
    },
    header: {
      welcomeText: "Welcome to",
      utilityText: "Admissions are open",
      tagline: "Learning without limits",
    },
    hero: {
      eyebrow: "Now enrolling",
      title: name,
      description: `A place where every learner at ${name} thrives.`,
      imageUrl: school.logo_url ?? null,
      primaryAction: { label: "Apply now", href: "/apply" },
      secondaryAction: { label: "Learn more", href: "/about" },
      trustItems: ["Quality education"],
      infoCard: {
        label: "Welcome",
        title: name,
        description: "Update this card from Website Management.",
      },
    },
    // Not editable in this MVP -- kept valid-but-hidden via enabledSections
    // until their own editors ship.
    highlights: [PLACEHOLDER_HIGHLIGHT],
    about: {
      eyebrow: "About us",
      title: "Our story",
      description: `${name} is committed to providing a supportive, high-quality learning environment.`,
      imageUrl: null,
      mission: "Update this mission statement from Website Management.",
      vision: "Update this vision statement from Website Management.",
    },
    programmes: [PLACEHOLDER_PROGRAMME],
    admissions: {
      eyebrow: "Admissions",
      title: "Join us",
      description: "Update the admissions description from Website Management.",
      action: { label: "Apply", href: "/apply" },
    },
    contact: {
      address,
      phone: phone || "Not yet provided",
      email: email || "info@example.com",
      mapUrl: null,
    },
    socialLinks: {
      facebook: null,
      instagram: null,
      linkedin: null,
      youtube: null,
      x: null,
    },
    enabledSections: {
      hero: true,
      highlights: false,
      about: false,
      programmes: false,
      admissions: false,
      contact: false,
    },
  };
}
