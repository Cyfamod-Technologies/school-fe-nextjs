function requireBackendUrl(): string {
  const rawValue = process.env.NEXT_PUBLIC_BACKEND_URL;

  if (!rawValue || !rawValue.trim()) {
    throw new Error(
      "NEXT_PUBLIC_BACKEND_URL is required. Add it to your .env (or Docker env) so the frontend knows where to reach the backend.",
    );
  }

  try {
    const parsed = new URL(rawValue.trim());
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    throw new Error(
      `NEXT_PUBLIC_BACKEND_URL must be a valid http/https URL. Received "${rawValue}".`,
    );
  }
}

export const BACKEND_URL = requireBackendUrl();

function requireStorageUrl(): string {
  const rawValue = process.env.NEXT_PUBLIC_STORAGE_URL;

  // If not provided, fall back to BACKEND_URL
  if (!rawValue || !rawValue.trim()) {
    return BACKEND_URL;
  }

  try {
    const parsed = new URL(rawValue.trim());
    return `${parsed.origin}${parsed.pathname.replace(/\/$/, "")}`;
  } catch {
    throw new Error(
      `NEXT_PUBLIC_STORAGE_URL must be a valid http/https URL. Received "${rawValue}".`,
    );
  }
}

export const STORAGE_URL = requireStorageUrl();

const SCHOOL_REGISTRATION_FLAG = (
  process.env.NEXT_PUBLIC_SCHOOL_REGISTRATION ?? "off"
)
  .toString()
  .trim()
  .toLowerCase();
export const SCHOOL_REGISTRATION_ENABLED = ["on", "true", "1"].includes(
  SCHOOL_REGISTRATION_FLAG,
);

const EMAIL_VERIFICATION_FLAG = (
  process.env.NEXT_PUBLIC_EMAIL_VERIFICATION ?? "off"
)
  .toString()
  .trim()
  .toLowerCase();
export const EMAIL_VERIFICATION_ENABLED = ["on", "true", "1"].includes(
  EMAIL_VERIFICATION_FLAG,
);

const DEMO_MODE_FLAG = (
  process.env.NEXT_PUBLIC_DEMO_MODE ?? "off"
)
  .toString()
  .trim()
  .toLowerCase();
export const DEMO_MODE_ENABLED = ["on", "true", "1"].includes(
  DEMO_MODE_FLAG,
);

export function resolveBackendUrl(path: string | null | undefined): string {
  if (!path) {
    return "";
  }

  const normalized = `${path}`;

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

  // If path is a storage path, use STORAGE_URL instead of BACKEND_URL
  if (normalized.startsWith("/storage/")) {
    if (normalized.startsWith("/")) {
      return `${STORAGE_URL}${normalized}`;
    }
    return `${STORAGE_URL}/${normalized}`;
  }

  // For regular API/backend paths, use BACKEND_URL
  if (normalized.startsWith("/")) {
    return `${BACKEND_URL}${normalized}`;
  }

  return `${BACKEND_URL}/${normalized}`;
}

export const API_ROUTES = {
  login: "/api/v1/login",
  logout: "/api/v1/logout",
  currentUser: "/api/v1/user",
  schoolContext: "/api/v1/school",
  classes: "/api/v1/classes",
  parents: "/api/v1/parents",
  parentsSearch: "/api/v1/parents",
  parentsIndex: "/api/v1/all-parents",
  staff: "/api/v1/staff",
  staffSelf: "/api/v1/staff/me",
  staffDashboard: "/api/v1/staff/dashboard",
  subjects: "/api/v1/settings/subjects",
  subjectAssignments: "/api/v1/settings/subject-assignments",
  subjectTeacherAssignments: "/api/v1/settings/subject-teacher-assignments",
  classTeachers: "/api/v1/settings/class-teachers",
  promotionsBulk: "/api/v1/promotions/bulk",
  promotionsHistory: "/api/v1/promotions/history",
  sessionsRollover: "/api/v1/sessions/rollover",
  studentsBulkTemplate: "/api/v1/students/bulk/template",
  studentsBulkPreview: "/api/v1/students/bulk/preview",
  studentsBulkCommit: "/api/v1/students/bulk",
  feesItems: "/api/v1/fees/items",
  feeStructures: "/api/v1/fees/structures",
  feeStructuresBySessionTerm: "/api/v1/fees/structures/by-session-term",
  feeStructuresCopy: "/api/v1/fees/structures/copy",
  bankDetails: "/api/v1/fees/bank-details",
  studentAttendance: "/api/v1/attendance/students",
  staffAttendance: "/api/v1/attendance/staff",
  gradeScales: "/api/v1/grades/scales",
  skillCategories: "/api/v1/settings/skill-categories",
  skillTypes: "/api/v1/settings/skill-types",
  assessmentComponents: "/api/v1/settings/assessment-components",
  results: "/api/v1/results",
  resultsBulkPrint: "/api/v1/results/bulk/print",
  resultPinCardsPrint: "/api/v1/result-pins/cards/print",
  resultBatch: "/api/v1/results/batch",
  resultPins: "/api/v1/result-pins",
  permissions: "/api/v1/permissions",
  permissionHierarchy: "/api/v1/permissions/hierarchy",
  roles: "/api/v1/roles",
  users: "/api/v1/users",
} as const;
