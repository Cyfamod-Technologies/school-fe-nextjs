const DEFAULT_BACKEND_URL = "http://127.0.0.1:8000";

export const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL?.replace(/\/$/, "") ||
  DEFAULT_BACKEND_URL;

export function resolveBackendUrl(path: string | null | undefined): string {
  if (!path) {
    return "";
  }

  const normalized = `${path}`;

  if (/^https?:\/\//i.test(normalized)) {
    return normalized;
  }

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
  resultBatch: "/api/v1/results/batch",
  resultPins: "/api/v1/result-pins",
  permissions: "/api/v1/permissions",
  roles: "/api/v1/roles",
  users: "/api/v1/users",
} as const;
