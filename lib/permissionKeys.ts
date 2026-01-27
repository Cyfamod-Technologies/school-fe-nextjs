/**
 * Centralized Permission Keys
 * 
 * This file contains all permission keys used throughout the frontend.
 * These keys must match the permissions seeded in the backend database.
 * 
 * Format: {module}.{resource}.{action}
 */

export const PERMISSIONS = {
  // ============================================
  // Dashboard (v10)
  // ============================================
  DASHBOARD_VIEW: 'dashboard.view',
  DASHBOARD_STATS_STUDENTS: 'dashboard.stats.students',
  DASHBOARD_STATS_TEACHERS: 'dashboard.stats.teachers',
  DASHBOARD_STATS_PARENTS: 'dashboard.stats.parents',

  // ============================================
  // Profile (v10)
  // ============================================
  PROFILE_VIEW: 'profile.view',
  ADMIN_PROFILE_UPDATE: 'admin.profile.update',

  // ============================================
  // School Settings (v10)
  // ============================================
  SETTINGS_SCHOOL_VIEW: 'settings.school.view',
  SETTINGS_SCHOOL_UPDATE: 'settings.school.update',
  SETTINGS_SCHOOL_SESSION_UPDATE: 'settings.school.session.update',
  SETTINGS_SCHOOL_TERM_UPDATE: 'settings.school.term.update',

  // ============================================
  // Sessions (v11)
  // ============================================
  SESSIONS_VIEW: 'sessions.view',
  SESSIONS_CREATE: 'sessions.create',
  SESSIONS_UPDATE: 'sessions.update',
  SESSIONS_DELETE: 'sessions.delete',

  // ============================================
  // Terms (v11)
  // ============================================
  TERMS_VIEW: 'terms.view',
  TERMS_CREATE: 'terms.create',
  TERMS_UPDATE: 'terms.update',
  TERMS_DELETE: 'terms.delete',

  // ============================================
  // Classes (v12)
  // ============================================
  CLASSES_VIEW: 'classes.view',
  CLASSES_CREATE: 'classes.create',
  CLASSES_UPDATE: 'classes.update',
  CLASSES_DELETE: 'classes.delete',

  // ============================================
  // Class Arms (v12)
  // ============================================
  CLASS_ARMS_VIEW: 'class-arms.view',
  CLASS_ARMS_CREATE: 'class-arms.create',
  CLASS_ARMS_UPDATE: 'class-arms.update',
  CLASS_ARMS_DELETE: 'class-arms.delete',

  // ============================================
  // Class Sections (v12)
  // ============================================
  CLASS_SECTIONS_VIEW: 'class-sections.view',
  CLASS_SECTIONS_CREATE: 'class-sections.create',
  CLASS_SECTIONS_UPDATE: 'class-sections.update',
  CLASS_SECTIONS_DELETE: 'class-sections.delete',

  // ============================================
  // Parents (v13)
  // ============================================
  PARENTS_VIEW: 'parents.view',
  PARENTS_CREATE: 'parents.create',
  PARENTS_UPDATE: 'parents.update',
  PARENTS_DELETE: 'parents.delete',

  // ============================================
  // Students (v14)
  // ============================================
  STUDENTS_VIEW: 'students.view',
  STUDENTS_CREATE: 'students.create',
  STUDENTS_UPDATE: 'students.update',
  STUDENTS_DELETE: 'students.delete',
  STUDENTS_EXPORT: 'students.export',

  // ============================================
  // Bulk Student Upload (v22)
  // ============================================
  STUDENTS_BULK_UPLOAD_VIEW: 'students.bulk-upload.view',
  STUDENTS_BULK_UPLOAD_UPLOAD: 'students.bulk-upload.upload',
  STUDENTS_BULK_UPLOAD_PREVIEW: 'students.bulk-upload.preview',
  STUDENTS_BULK_UPLOAD_EXECUTE: 'students.bulk-upload.execute',
  STUDENTS_BULK_UPLOAD_TEMPLATE: 'students.bulk-upload.template',

  // ============================================
  // Student Promotion (v20)
  // ============================================
  STUDENTS_PROMOTION_VIEW: 'students.promotion.view',
  STUDENTS_PROMOTION_EXECUTE: 'students.promotion.execute',
  STUDENTS_PROMOTION_BULK: 'students.promotion.bulk',
  STUDENTS_PROMOTION_REPORTS_VIEW: 'students.promotion.reports.view',
  STUDENTS_PROMOTION_REPORTS_EXPORT: 'students.promotion.reports.export',

  // ============================================
  // Academic Rollover (v20)
  // ============================================
  ACADEMIC_ROLLOVER_VIEW: 'academic.rollover.view',
  ACADEMIC_ROLLOVER_EXECUTE: 'academic.rollover.execute',

  // ============================================
  // Staff (v15)
  // ============================================
  STAFF_VIEW: 'staff.view',
  STAFF_CREATE: 'staff.create',
  STAFF_UPDATE: 'staff.update',
  STAFF_DELETE: 'staff.delete',
  STAFF_ROLES_ASSIGN: 'staff.roles.assign',
  STAFF_ROLES_UPDATE: 'staff.roles.update',

  // ============================================
  // Staff Portal (v25)
  // ============================================
  STAFF_DASHBOARD_VIEW: 'staff.dashboard.view',
  STAFF_CLASSES_VIEW: 'staff.classes.view',
  STAFF_SUBJECTS_VIEW: 'staff.subjects.view',
  STAFF_PROFILE_VIEW: 'staff.profile.view',
  STAFF_PROFILE_UPDATE: 'staff.profile.update',

  // ============================================
  // Subjects (v16)
  // ============================================
  SUBJECTS_VIEW: 'subjects.view',
  SUBJECTS_CREATE: 'subjects.create',
  SUBJECTS_UPDATE: 'subjects.update',
  SUBJECTS_DELETE: 'subjects.delete',

  // ============================================
  // Subject Assignments (v17)
  // ============================================
  SUBJECT_ASSIGNMENTS_VIEW: 'subject.assignments.view',
  SUBJECT_ASSIGNMENTS_CREATE: 'subject.assignments.create',
  SUBJECT_ASSIGNMENTS_UPDATE: 'subject.assignments.update',
  SUBJECT_ASSIGNMENTS_DELETE: 'subject.assignments.delete',

  // ============================================
  // Teacher Assignments (v17)
  // ============================================
  TEACHER_ASSIGNMENTS_VIEW: 'teacher.assignments.view',
  TEACHER_ASSIGNMENTS_CREATE: 'teacher.assignments.create',
  TEACHER_ASSIGNMENTS_UPDATE: 'teacher.assignments.update',
  TEACHER_ASSIGNMENTS_DELETE: 'teacher.assignments.delete',

  // ============================================
  // Class Teachers (v18)
  // ============================================
  CLASS_TEACHERS_VIEW: 'class-teachers.view',
  CLASS_TEACHERS_CREATE: 'class-teachers.create',
  CLASS_TEACHERS_UPDATE: 'class-teachers.update',
  CLASS_TEACHERS_DELETE: 'class-teachers.delete',

  // ============================================
  // Assessment Components (v19)
  // ============================================
  ASSESSMENT_COMPONENTS_VIEW: 'assessment.components.view',
  ASSESSMENT_COMPONENTS_CREATE: 'assessment.components.create',
  ASSESSMENT_COMPONENTS_UPDATE: 'assessment.components.update',
  ASSESSMENT_COMPONENTS_DELETE: 'assessment.components.delete',
  ASSESSMENT_COMPONENTS_CBT_LINK: 'assessment.components.cbt-link',

  // ============================================
  // Assessment Structures (v19)
  // ============================================
  ASSESSMENT_STRUCTURES_VIEW: 'assessment.structures.view',
  ASSESSMENT_STRUCTURES_CREATE: 'assessment.structures.create',
  ASSESSMENT_STRUCTURES_UPDATE: 'assessment.structures.update',
  ASSESSMENT_STRUCTURES_DELETE: 'assessment.structures.delete',

  // ============================================
  // Assessment CBT Link (v19)
  // ============================================
  ASSESSMENT_CBT_LINK_VIEW: 'assessment.cbt-link.view',
  ASSESSMENT_CBT_LINK_CREATE: 'assessment.cbt-link.create',
  ASSESSMENT_CBT_LINK_DELETE: 'assessment.cbt-link.delete',

  // ============================================
  // Grade Scales (v19)
  // ============================================
  ASSESSMENT_GRADE_SCALES_VIEW: 'assessment.grade-scales.view',
  ASSESSMENT_GRADE_SCALES_CREATE: 'assessment.grade-scales.create',
  ASSESSMENT_GRADE_SCALES_UPDATE: 'assessment.grade-scales.update',
  ASSESSMENT_GRADE_SCALES_DELETE: 'assessment.grade-scales.delete',
  ASSESSMENT_GRADE_SCALES_SET_ACTIVE: 'assessment.grade-scales.set-active',

  // ============================================
  // Result PINs (v19)
  // ============================================
  RESULT_PIN_VIEW: 'result.pin.view',
  RESULT_PIN_CREATE: 'result.pin.create',
  RESULT_PIN_BULK_CREATE: 'result.pin.bulk-create',
  RESULT_PIN_INVALIDATE: 'result.pin.invalidate',
  RESULT_PIN_EXPORT: 'result.pin.export',

  // ============================================
  // Result Page Settings (v19)
  // ============================================
  SETTINGS_RESULT_PAGE_VIEW: 'settings.result-page.view',
  SETTINGS_RESULT_PAGE_UPDATE: 'settings.result-page.update',

  // ============================================
  // Results Entry (v19)
  // ============================================
  RESULTS_ENTRY_VIEW: 'results.entry.view',
  RESULTS_ENTRY_ENTER: 'results.entry.enter',
  RESULTS_ENTRY_SAVE: 'results.entry.save',

  // ============================================
  // Bulk Results (v14)
  // ============================================
  RESULTS_BULK_VIEW: 'results.bulk.view',
  RESULTS_BULK_GENERATE: 'results.bulk.generate',
  RESULTS_BULK_DOWNLOAD: 'results.bulk.download',
  RESULTS_BULK_PRINT: 'results.bulk.print',

  // ============================================
  // Check Result (v14)
  // ============================================
  RESULTS_CHECK: 'results.check',

  // ============================================
  // Early Years Report (v14)
  // ============================================
  RESULTS_EARLY_YEARS_VIEW: 'results.early-years.view',
  RESULTS_EARLY_YEARS_GENERATE: 'results.early-years.generate',

  // ============================================
  // Skills (v19)
  // ============================================
  SKILLS_CATEGORIES_VIEW: 'skills.categories.view',
  SKILLS_CATEGORIES_CREATE: 'skills.categories.create',
  SKILLS_CATEGORIES_UPDATE: 'skills.categories.update',
  SKILLS_CATEGORIES_DELETE: 'skills.categories.delete',
  SKILLS_TYPES_VIEW: 'skills.types.view',
  SKILLS_TYPES_CREATE: 'skills.types.create',
  SKILLS_TYPES_UPDATE: 'skills.types.update',
  SKILLS_TYPES_DELETE: 'skills.types.delete',

  // ============================================
  // Skill Ratings (v14)
  // ============================================
  SKILLS_RATINGS_VIEW: 'skills.ratings.view',
  SKILLS_RATINGS_ENTER: 'skills.ratings.enter',
  SKILLS_RATINGS_UPDATE: 'skills.ratings.update',

  // ============================================
  // Attendance Dashboard (v21)
  // ============================================
  ATTENDANCE_DASHBOARD_VIEW: 'attendance.dashboard.view',
  ATTENDANCE_STATS_VIEW: 'attendance.stats.view',

  // ============================================
  // Student Attendance (v21)
  // ============================================
  ATTENDANCE_STUDENT_VIEW: 'attendance.student.view',
  ATTENDANCE_STUDENT_MARK: 'attendance.student.mark',
  ATTENDANCE_STUDENT_UPDATE: 'attendance.student.update',
  ATTENDANCE_STUDENT_DELETE: 'attendance.student.delete',
  ATTENDANCE_STUDENT_EXPORT: 'attendance.student.export',
  ATTENDANCE_STUDENT_HISTORY: 'attendance.student.history',

  // ============================================
  // Staff Attendance (v21)
  // ============================================
  ATTENDANCE_STAFF_VIEW: 'attendance.staff.view',
  ATTENDANCE_STAFF_MARK: 'attendance.staff.mark',
  ATTENDANCE_STAFF_UPDATE: 'attendance.staff.update',
  ATTENDANCE_STAFF_DELETE: 'attendance.staff.delete',
  ATTENDANCE_STAFF_EXPORT: 'attendance.staff.export',

  // ============================================
  // Finance - Bank Details (v23)
  // ============================================
  FINANCE_BANK_VIEW: 'finance.bank.view',
  FINANCE_BANK_UPDATE: 'finance.bank.update',

  // ============================================
  // Finance - Fee Items (v23)
  // ============================================
  FINANCE_FEE_ITEMS_VIEW: 'finance.fee-items.view',
  FINANCE_FEE_ITEMS_CREATE: 'finance.fee-items.create',
  FINANCE_FEE_ITEMS_UPDATE: 'finance.fee-items.update',
  FINANCE_FEE_ITEMS_DELETE: 'finance.fee-items.delete',

  // ============================================
  // Finance - Fee Structures (v23)
  // ============================================
  FINANCE_FEE_STRUCTURES_VIEW: 'finance.fee-structures.view',
  FINANCE_FEE_STRUCTURES_CREATE: 'finance.fee-structures.create',
  FINANCE_FEE_STRUCTURES_UPDATE: 'finance.fee-structures.update',
  FINANCE_FEE_STRUCTURES_DELETE: 'finance.fee-structures.delete',
  FINANCE_FEE_STRUCTURES_COPY: 'finance.fee-structures.copy',

  // ============================================
  // Roles (v24)
  // ============================================
  ROLES_VIEW: 'roles.view',
  ROLES_CREATE: 'roles.create',
  ROLES_UPDATE: 'roles.update',
  ROLES_DELETE: 'roles.delete',
  ROLES_PERMISSIONS_ASSIGN: 'roles.permissions.assign',

  // ============================================
  // User Roles (v24)
  // ============================================
  USER_ROLES_VIEW: 'user-roles.view',
  USER_ROLES_ASSIGN: 'user-roles.assign',
  USER_ROLES_REMOVE: 'user-roles.remove',

  // ============================================
  // Student Portal (v26)
  // ============================================
  STUDENT_DASHBOARD_VIEW: 'student.dashboard.view',
  STUDENT_BIO_VIEW: 'student.bio.view',
  STUDENT_RESULT_VIEW: 'student.result.view',
  STUDENT_RESULT_DOWNLOAD: 'student.result.download',

  // ============================================
  // CBT - Student (v27)
  // ============================================
  CBT_QUIZZES_VIEW: 'cbt.quizzes.view',
  CBT_QUIZZES_TAKE: 'cbt.quizzes.take',
  CBT_QUIZZES_SUBMIT: 'cbt.quizzes.submit',
  CBT_HISTORY_VIEW: 'cbt.history.view',
  CBT_RESULTS_VIEW: 'cbt.results.view',
  CBT_RESULTS_REVIEW: 'cbt.results.review',

  // ============================================
  // CBT - Admin (v27)
  // ============================================
  CBT_ADMIN_VIEW: 'cbt.admin.view',
  CBT_ADMIN_CREATE: 'cbt.admin.create',
  CBT_ADMIN_UPDATE: 'cbt.admin.update',
  CBT_ADMIN_DELETE: 'cbt.admin.delete',
  CBT_ADMIN_PUBLISH: 'cbt.admin.publish',
  CBT_ADMIN_UNPUBLISH: 'cbt.admin.unpublish',
  CBT_ADMIN_RESULTS_VIEW: 'cbt.admin.results.view',
  CBT_ADMIN_RESULTS_EXPORT: 'cbt.admin.results.export',
  CBT_ADMIN_RESULTS_GRADE: 'cbt.admin.results.grade',

  // ============================================
  // CBT - Questions (v27)
  // ============================================
  CBT_QUESTIONS_VIEW: 'cbt.questions.view',
  CBT_QUESTIONS_CREATE: 'cbt.questions.create',
  CBT_QUESTIONS_UPDATE: 'cbt.questions.update',
  CBT_QUESTIONS_DELETE: 'cbt.questions.delete',
  CBT_QUESTIONS_REORDER: 'cbt.questions.reorder',

  // ============================================
  // CBT - Links (v27)
  // ============================================
  CBT_LINKS_VIEW: 'cbt.links.view',
  CBT_LINKS_CREATE: 'cbt.links.create',
  CBT_LINKS_DELETE: 'cbt.links.delete',
} as const;

/**
 * Type for permission keys
 */
export type PermissionKey = typeof PERMISSIONS[keyof typeof PERMISSIONS];

/**
 * Get all permission values as an array
 * Useful for seeding in backend
 */
export const getAllPermissions = (): string[] => {
  return Object.values(PERMISSIONS);
};

/**
 * Permission groups for organizing in admin UI
 */
export const PERMISSION_GROUPS = {
  dashboard: {
    label: 'Dashboard',
    permissions: [
      PERMISSIONS.DASHBOARD_VIEW,
      PERMISSIONS.DASHBOARD_STATS_STUDENTS,
      PERMISSIONS.DASHBOARD_STATS_TEACHERS,
      PERMISSIONS.DASHBOARD_STATS_PARENTS,
    ],
  },
  sessions: {
    label: 'Sessions',
    permissions: [
      PERMISSIONS.SESSIONS_VIEW,
      PERMISSIONS.SESSIONS_CREATE,
      PERMISSIONS.SESSIONS_UPDATE,
      PERMISSIONS.SESSIONS_DELETE,
    ],
  },
  terms: {
    label: 'Terms',
    permissions: [
      PERMISSIONS.TERMS_VIEW,
      PERMISSIONS.TERMS_CREATE,
      PERMISSIONS.TERMS_UPDATE,
      PERMISSIONS.TERMS_DELETE,
    ],
  },
  classes: {
    label: 'Classes',
    permissions: [
      PERMISSIONS.CLASSES_VIEW,
      PERMISSIONS.CLASSES_CREATE,
      PERMISSIONS.CLASSES_UPDATE,
      PERMISSIONS.CLASSES_DELETE,
      PERMISSIONS.CLASS_ARMS_VIEW,
      PERMISSIONS.CLASS_ARMS_CREATE,
      PERMISSIONS.CLASS_ARMS_UPDATE,
      PERMISSIONS.CLASS_ARMS_DELETE,
      PERMISSIONS.CLASS_SECTIONS_VIEW,
      PERMISSIONS.CLASS_SECTIONS_CREATE,
      PERMISSIONS.CLASS_SECTIONS_UPDATE,
      PERMISSIONS.CLASS_SECTIONS_DELETE,
    ],
  },
  parents: {
    label: 'Parents',
    permissions: [
      PERMISSIONS.PARENTS_VIEW,
      PERMISSIONS.PARENTS_CREATE,
      PERMISSIONS.PARENTS_UPDATE,
      PERMISSIONS.PARENTS_DELETE,
    ],
  },
  students: {
    label: 'Students',
    permissions: [
      PERMISSIONS.STUDENTS_VIEW,
      PERMISSIONS.STUDENTS_CREATE,
      PERMISSIONS.STUDENTS_UPDATE,
      PERMISSIONS.STUDENTS_DELETE,
      PERMISSIONS.STUDENTS_EXPORT,
      PERMISSIONS.STUDENTS_BULK_UPLOAD_VIEW,
      PERMISSIONS.STUDENTS_BULK_UPLOAD_EXECUTE,
      PERMISSIONS.STUDENTS_PROMOTION_VIEW,
      PERMISSIONS.STUDENTS_PROMOTION_EXECUTE,
    ],
  },
  staff: {
    label: 'Staff',
    permissions: [
      PERMISSIONS.STAFF_VIEW,
      PERMISSIONS.STAFF_CREATE,
      PERMISSIONS.STAFF_UPDATE,
      PERMISSIONS.STAFF_DELETE,
      PERMISSIONS.STAFF_ROLES_ASSIGN,
    ],
  },
  subjects: {
    label: 'Subjects',
    permissions: [
      PERMISSIONS.SUBJECTS_VIEW,
      PERMISSIONS.SUBJECTS_CREATE,
      PERMISSIONS.SUBJECTS_UPDATE,
      PERMISSIONS.SUBJECTS_DELETE,
    ],
  },
  assignments: {
    label: 'Assignments',
    permissions: [
      PERMISSIONS.SUBJECT_ASSIGNMENTS_VIEW,
      PERMISSIONS.SUBJECT_ASSIGNMENTS_CREATE,
      PERMISSIONS.SUBJECT_ASSIGNMENTS_UPDATE,
      PERMISSIONS.SUBJECT_ASSIGNMENTS_DELETE,
      PERMISSIONS.TEACHER_ASSIGNMENTS_VIEW,
      PERMISSIONS.TEACHER_ASSIGNMENTS_CREATE,
      PERMISSIONS.TEACHER_ASSIGNMENTS_UPDATE,
      PERMISSIONS.TEACHER_ASSIGNMENTS_DELETE,
      PERMISSIONS.CLASS_TEACHERS_VIEW,
      PERMISSIONS.CLASS_TEACHERS_CREATE,
      PERMISSIONS.CLASS_TEACHERS_UPDATE,
      PERMISSIONS.CLASS_TEACHERS_DELETE,
    ],
  },
  assessment: {
    label: 'Assessment',
    permissions: [
      PERMISSIONS.ASSESSMENT_COMPONENTS_VIEW,
      PERMISSIONS.ASSESSMENT_COMPONENTS_CREATE,
      PERMISSIONS.ASSESSMENT_COMPONENTS_UPDATE,
      PERMISSIONS.ASSESSMENT_COMPONENTS_DELETE,
      PERMISSIONS.ASSESSMENT_STRUCTURES_VIEW,
      PERMISSIONS.ASSESSMENT_STRUCTURES_CREATE,
      PERMISSIONS.ASSESSMENT_STRUCTURES_UPDATE,
      PERMISSIONS.ASSESSMENT_STRUCTURES_DELETE,
      PERMISSIONS.ASSESSMENT_GRADE_SCALES_VIEW,
      PERMISSIONS.ASSESSMENT_GRADE_SCALES_CREATE,
      PERMISSIONS.ASSESSMENT_GRADE_SCALES_UPDATE,
      PERMISSIONS.ASSESSMENT_GRADE_SCALES_DELETE,
    ],
  },
  results: {
    label: 'Results',
    permissions: [
      PERMISSIONS.RESULTS_ENTRY_VIEW,
      PERMISSIONS.RESULTS_ENTRY_ENTER,
      PERMISSIONS.RESULTS_ENTRY_SAVE,
      PERMISSIONS.RESULTS_BULK_VIEW,
      PERMISSIONS.RESULTS_BULK_GENERATE,
      PERMISSIONS.RESULTS_BULK_DOWNLOAD,
      PERMISSIONS.RESULTS_CHECK,
      PERMISSIONS.RESULT_PIN_VIEW,
      PERMISSIONS.RESULT_PIN_CREATE,
      PERMISSIONS.RESULT_PIN_BULK_CREATE,
      PERMISSIONS.RESULT_PIN_EXPORT,
    ],
  },
  attendance: {
    label: 'Attendance',
    permissions: [
      PERMISSIONS.ATTENDANCE_DASHBOARD_VIEW,
      PERMISSIONS.ATTENDANCE_STUDENT_VIEW,
      PERMISSIONS.ATTENDANCE_STUDENT_MARK,
      PERMISSIONS.ATTENDANCE_STUDENT_UPDATE,
      PERMISSIONS.ATTENDANCE_STUDENT_DELETE,
      PERMISSIONS.ATTENDANCE_STUDENT_EXPORT,
      PERMISSIONS.ATTENDANCE_STAFF_VIEW,
      PERMISSIONS.ATTENDANCE_STAFF_MARK,
      PERMISSIONS.ATTENDANCE_STAFF_UPDATE,
      PERMISSIONS.ATTENDANCE_STAFF_DELETE,
      PERMISSIONS.ATTENDANCE_STAFF_EXPORT,
    ],
  },
  finance: {
    label: 'Finance',
    permissions: [
      PERMISSIONS.FINANCE_BANK_VIEW,
      PERMISSIONS.FINANCE_BANK_UPDATE,
      PERMISSIONS.FINANCE_FEE_ITEMS_VIEW,
      PERMISSIONS.FINANCE_FEE_ITEMS_CREATE,
      PERMISSIONS.FINANCE_FEE_ITEMS_UPDATE,
      PERMISSIONS.FINANCE_FEE_ITEMS_DELETE,
      PERMISSIONS.FINANCE_FEE_STRUCTURES_VIEW,
      PERMISSIONS.FINANCE_FEE_STRUCTURES_CREATE,
      PERMISSIONS.FINANCE_FEE_STRUCTURES_UPDATE,
      PERMISSIONS.FINANCE_FEE_STRUCTURES_DELETE,
    ],
  },
  roles: {
    label: 'Roles & Permissions',
    permissions: [
      PERMISSIONS.ROLES_VIEW,
      PERMISSIONS.ROLES_CREATE,
      PERMISSIONS.ROLES_UPDATE,
      PERMISSIONS.ROLES_DELETE,
      PERMISSIONS.ROLES_PERMISSIONS_ASSIGN,
      PERMISSIONS.USER_ROLES_VIEW,
      PERMISSIONS.USER_ROLES_ASSIGN,
      PERMISSIONS.USER_ROLES_REMOVE,
    ],
  },
  cbt: {
    label: 'CBT',
    permissions: [
      PERMISSIONS.CBT_ADMIN_VIEW,
      PERMISSIONS.CBT_ADMIN_CREATE,
      PERMISSIONS.CBT_ADMIN_UPDATE,
      PERMISSIONS.CBT_ADMIN_DELETE,
      PERMISSIONS.CBT_ADMIN_PUBLISH,
      PERMISSIONS.CBT_QUESTIONS_VIEW,
      PERMISSIONS.CBT_QUESTIONS_CREATE,
      PERMISSIONS.CBT_QUESTIONS_UPDATE,
      PERMISSIONS.CBT_QUESTIONS_DELETE,
      PERMISSIONS.CBT_ADMIN_RESULTS_VIEW,
      PERMISSIONS.CBT_ADMIN_RESULTS_EXPORT,
    ],
  },
  settings: {
    label: 'Settings',
    permissions: [
      PERMISSIONS.SETTINGS_SCHOOL_VIEW,
      PERMISSIONS.SETTINGS_SCHOOL_UPDATE,
      PERMISSIONS.SETTINGS_RESULT_PAGE_VIEW,
      PERMISSIONS.SETTINGS_RESULT_PAGE_UPDATE,
    ],
  },
} as const;
