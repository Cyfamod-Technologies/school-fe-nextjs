/* Permission catalog - one entry per permission key */
export interface PermissionActionEntry {
  function: string;
  description: string;
  permission: string;
}

export const PERMISSION_ACTIONS: PermissionActionEntry[] = [
  // Dashboard
  { function: "View Dashboard", description: "Access dashboard page", permission: "dashboard.view" },
  { function: "View Student Stats", description: "See student statistics", permission: "dashboard.stats.students" },
  { function: "View Teacher Stats", description: "See teacher statistics", permission: "dashboard.stats.teachers" },
  { function: "View Parent Stats", description: "See parent statistics", permission: "dashboard.stats.parents" },
  
  // Profile
  { function: "View Profile", description: "View own profile", permission: "profile.view" },
  { function: "Edit Admin Profile", description: "Update admin profile", permission: "admin.profile.update" },
  
  // School Settings
  { function: "View School Settings", description: "View school settings", permission: "settings.school.view" },
  { function: "Edit School Settings", description: "Update school name, logo, signature", permission: "settings.school.update" },
  { function: "Set Current Session", description: "Set active session", permission: "settings.school.session.update" },
  { function: "Set Current Term", description: "Set active term", permission: "settings.school.term.update" },
  
  // Sessions
  { function: "View Sessions", description: "List all sessions", permission: "sessions.view" },
  { function: "Create Session", description: "Create new session", permission: "sessions.create" },
  { function: "Edit Session", description: "Modify session details", permission: "sessions.update" },
  { function: "Delete Session", description: "Remove a session", permission: "sessions.delete" },
  
  // Terms
  { function: "View Terms", description: "List all terms", permission: "terms.view" },
  { function: "Create Term", description: "Create new term", permission: "terms.create" },
  { function: "Edit Term", description: "Modify term details", permission: "terms.update" },
  { function: "Delete Term", description: "Remove a term", permission: "terms.delete" },
  
  // Classes
  { function: "View Classes", description: "List all classes", permission: "classes.view" },
  { function: "Create Class", description: "Create new class", permission: "classes.create" },
  { function: "Edit Class", description: "Modify class details", permission: "classes.update" },
  { function: "Delete Class", description: "Remove a class", permission: "classes.delete" },
  
  // Class Arms
  { function: "View Class Arms", description: "List all class arms", permission: "class-arms.view" },
  { function: "Create Class Arm", description: "Create new class arm", permission: "class-arms.create" },
  { function: "Edit Class Arm", description: "Modify class arm", permission: "class-arms.update" },
  { function: "Delete Class Arm", description: "Remove a class arm", permission: "class-arms.delete" },
  
  // Class Sections
  { function: "View Sections", description: "List all sections", permission: "class-sections.view" },
  { function: "Create Section", description: "Create new section", permission: "class-sections.create" },
  { function: "Edit Section", description: "Modify section", permission: "class-sections.update" },
  { function: "Delete Section", description: "Remove a section", permission: "class-sections.delete" },
  
  // Parents
  { function: "View Parents", description: "List and search parents", permission: "parents.view" },
  { function: "Create Parent", description: "Create new parent record", permission: "parents.create" },
  { function: "Edit Parent", description: "Modify parent details", permission: "parents.update" },
  { function: "Delete Parent", description: "Remove a parent", permission: "parents.delete" },
  
  // Students
  { function: "View Students", description: "List, search, and filter students", permission: "students.view" },
  { function: "Create Student", description: "Create new student record", permission: "students.create" },
  { function: "Edit Student", description: "Modify student details", permission: "students.update" },
  { function: "Delete Student", description: "Remove a student", permission: "students.delete" },
  { function: "Export Students", description: "Export to CSV/Excel", permission: "students.export" },
  
  // Bulk Results
  { function: "View Bulk Results", description: "Access bulk results page", permission: "results.bulk.view" },
  { function: "Generate Results", description: "Generate bulk result sheets", permission: "results.bulk.generate" },
  { function: "Download Results", description: "Download result PDFs", permission: "results.bulk.download" },
  { function: "Print Results", description: "Print result sheets", permission: "results.bulk.print" },
  { function: "Check Result", description: "View individual result", permission: "results.check" },
  
  // Skills & Ratings
  { function: "View Skill Ratings", description: "View class skills", permission: "skills.ratings.view" },
  { function: "Enter Skill Ratings", description: "Enter/update ratings", permission: "skills.ratings.enter" },
  { function: "Save Ratings", description: "Save skill ratings", permission: "skills.ratings.update" },
  
  // Early Years Results
  { function: "View Early Years", description: "Access early years page", permission: "results.early-years.view" },
  { function: "Generate EY Report", description: "Generate early years reports", permission: "results.early-years.generate" },
  
  // Staff
  { function: "View Staff", description: "List and search staff", permission: "staff.view" },
  { function: "Create Staff", description: "Create new staff record", permission: "staff.create" },
  { function: "Edit Staff", description: "Modify staff details", permission: "staff.update" },
  { function: "Delete Staff", description: "Remove a staff member", permission: "staff.delete" },
  { function: "Assign Staff Roles", description: "Assign roles to staff", permission: "staff.roles.assign" },
  { function: "Edit Staff Roles", description: "Change staff roles", permission: "staff.roles.update" },
  
  // Subjects
  { function: "View Subjects", description: "List all subjects", permission: "subjects.view" },
  { function: "Create Subject", description: "Create new subject", permission: "subjects.create" },
  { function: "Edit Subject", description: "Modify subject details", permission: "subjects.update" },
  { function: "Delete Subject", description: "Remove a subject", permission: "subjects.delete" },
  
  // Subject Assignments
  { function: "View Subject Assignments", description: "List subject assignments", permission: "subject.assignments.view" },
  { function: "Create Subject Assignment", description: "Assign subject to class", permission: "subject.assignments.create" },
  { function: "Edit Subject Assignment", description: "Modify assignment", permission: "subject.assignments.update" },
  { function: "Delete Subject Assignment", description: "Remove assignment", permission: "subject.assignments.delete" },
  
  // Teacher Assignments
  { function: "View Teacher Assignments", description: "List teacher assignments", permission: "teacher.assignments.view" },
  { function: "Create Teacher Assignment", description: "Assign teacher to subject", permission: "teacher.assignments.create" },
  { function: "Edit Teacher Assignment", description: "Modify assignment", permission: "teacher.assignments.update" },
  { function: "Delete Teacher Assignment", description: "Remove assignment", permission: "teacher.assignments.delete" },
  
  // Class Teachers
  { function: "View Class Teachers", description: "List class teacher assignments", permission: "class-teachers.view" },
  { function: "Assign Class Teacher", description: "Assign teacher to class", permission: "class-teachers.create" },
  { function: "Edit Class Teacher", description: "Modify assignment", permission: "class-teachers.update" },
  { function: "Remove Class Teacher", description: "Remove assignment", permission: "class-teachers.delete" },
  
  // Assessment Components
  { function: "View Components", description: "List assessment components", permission: "assessment.components.view" },
  { function: "Create Component", description: "Create new component", permission: "assessment.components.create" },
  { function: "Edit Component", description: "Modify component", permission: "assessment.components.update" },
  { function: "Delete Component", description: "Remove component", permission: "assessment.components.delete" },
  { function: "Link to CBT", description: "Link component to CBT quiz", permission: "assessment.components.cbt-link" },
  
  // Assessment Structures
  { function: "View Structures", description: "List component structures", permission: "assessment.structures.view" },
  { function: "Create Structure", description: "Create new structure", permission: "assessment.structures.create" },
  { function: "Edit Structure", description: "Modify structure", permission: "assessment.structures.update" },
  { function: "Delete Structure", description: "Remove structure", permission: "assessment.structures.delete" },
  
  // CBT Assessment Links
  { function: "View CBT Links", description: "View linked CBT quizzes", permission: "assessment.cbt-link.view" },
  { function: "Create CBT Link", description: "Link component to quiz", permission: "assessment.cbt-link.create" },
  { function: "Delete CBT Link", description: "Remove CBT link", permission: "assessment.cbt-link.delete" },
  
  // Grade Scales
  { function: "View Grade Scales", description: "List grade scales", permission: "assessment.grade-scales.view" },
  { function: "Create Grade Scale", description: "Create new grade range", permission: "assessment.grade-scales.create" },
  { function: "Edit Grade Scale", description: "Modify grade range", permission: "assessment.grade-scales.update" },
  { function: "Delete Grade Scale", description: "Remove grade range", permission: "assessment.grade-scales.delete" },
  { function: "Set Active Scale", description: "Set school's active scale", permission: "assessment.grade-scales.set-active" },
  
  // Result PINs
  { function: "View PINs", description: "List result PINs", permission: "result.pin.view" },
  { function: "Create PIN", description: "Generate PIN for student", permission: "result.pin.create" },
  { function: "Bulk Create PINs", description: "Generate PINs for class", permission: "result.pin.bulk-create" },
  { function: "Invalidate PIN", description: "Revoke a PIN", permission: "result.pin.invalidate" },
  { function: "Export PINs", description: "Export PINs to file", permission: "result.pin.export" },
  
  // Result Page Settings
  { function: "View Result Settings", description: "View result page settings", permission: "settings.result-page.view" },
  { function: "Edit Result Settings", description: "Modify result settings", permission: "settings.result-page.update" },
  
  // Results Entry
  { function: "View Results Entry", description: "Access results entry page", permission: "results.entry.view" },
  { function: "Enter Scores", description: "Input student scores", permission: "results.entry.enter" },
  { function: "Save Results", description: "Save entered results", permission: "results.entry.save" },
  
  // Skill Categories
  { function: "View Skill Categories", description: "List categories", permission: "skills.categories.view" },
  { function: "Create Skill Category", description: "Create skill category", permission: "skills.categories.create" },
  { function: "Edit Skill Category", description: "Modify category", permission: "skills.categories.update" },
  { function: "Delete Skill Category", description: "Remove category", permission: "skills.categories.delete" },
  
  // Skill Types
  { function: "View Skill Types", description: "List skill types", permission: "skills.types.view" },
  { function: "Create Skill Type", description: "Create skill type", permission: "skills.types.create" },
  { function: "Edit Skill Type", description: "Modify skill type", permission: "skills.types.update" },
  { function: "Delete Skill Type", description: "Remove skill type", permission: "skills.types.delete" },
  
  // Student Promotion
  { function: "View Promotion", description: "Access promotion page", permission: "students.promotion.view" },
  { function: "Execute Promotion", description: "Promote students", permission: "students.promotion.execute" },
  { function: "Bulk Promote", description: "Promote multiple students", permission: "students.promotion.bulk" },
  { function: "View Promotion Reports", description: "View promotion reports", permission: "students.promotion.reports.view" },
  { function: "Export Promotion Reports", description: "Export promotion data", permission: "students.promotion.reports.export" },
  
  // Academic Rollover
  { function: "View Rollover", description: "Access rollover page", permission: "academic.rollover.view" },
  { function: "Execute Rollover", description: "Perform academic rollover", permission: "academic.rollover.execute" },
  
  // Attendance Dashboard
  { function: "View Attendance Dashboard", description: "Access attendance overview", permission: "attendance.dashboard.view" },
  { function: "View Attendance Stats", description: "See attendance statistics", permission: "attendance.stats.view" },
  
  // Student Attendance
  { function: "View Student Attendance", description: "View student attendance", permission: "attendance.student.view" },
  { function: "Mark Student Attendance", description: "Mark student attendance", permission: "attendance.student.mark" },
  { function: "Edit Student Attendance", description: "Modify attendance record", permission: "attendance.student.update" },
  { function: "Delete Student Attendance", description: "Remove attendance record", permission: "attendance.student.delete" },
  { function: "Export Student Attendance", description: "Export attendance data", permission: "attendance.student.export" },
  { function: "View Attendance History", description: "View attendance history", permission: "attendance.student.history" },
  
  // Staff Attendance
  { function: "View Staff Attendance", description: "View staff attendance", permission: "attendance.staff.view" },
  { function: "Mark Staff Attendance", description: "Mark staff attendance", permission: "attendance.staff.mark" },
  { function: "Edit Staff Attendance", description: "Modify attendance record", permission: "attendance.staff.update" },
  { function: "Delete Staff Attendance", description: "Remove attendance record", permission: "attendance.staff.delete" },
  { function: "Export Staff Attendance", description: "Export staff attendance", permission: "attendance.staff.export" },
  
  // Bulk Student Upload
  { function: "View Bulk Upload", description: "Access bulk upload page", permission: "students.bulk-upload.view" },
  { function: "Upload File", description: "Upload CSV/Excel file", permission: "students.bulk-upload.upload" },
  { function: "Preview Data", description: "Preview import data", permission: "students.bulk-upload.preview" },
  { function: "Execute Import", description: "Run bulk import", permission: "students.bulk-upload.execute" },
  { function: "Download Template", description: "Get import template", permission: "students.bulk-upload.template" },
  
  // Finance - Bank
  { function: "View Bank Details", description: "View school bank info", permission: "finance.bank.view" },
  { function: "Edit Bank Details", description: "Modify bank information", permission: "finance.bank.update" },
  
  // Finance - Fee Items
  { function: "View Fee Items", description: "List fee items", permission: "finance.fee-items.view" },
  { function: "Create Fee Item", description: "Create new fee item", permission: "finance.fee-items.create" },
  { function: "Edit Fee Item", description: "Modify fee item", permission: "finance.fee-items.update" },
  { function: "Delete Fee Item", description: "Remove fee item", permission: "finance.fee-items.delete" },
  
  // Finance - Fee Structures
  { function: "View Fee Structures", description: "List fee structures", permission: "finance.fee-structures.view" },
  { function: "Create Fee Structure", description: "Create fee structure", permission: "finance.fee-structures.create" },
  { function: "Edit Fee Structure", description: "Modify structure", permission: "finance.fee-structures.update" },
  { function: "Delete Fee Structure", description: "Remove structure", permission: "finance.fee-structures.delete" },
  { function: "Copy Fee Structure", description: "Duplicate structure", permission: "finance.fee-structures.copy" },
  
  // RBAC - Roles
  { function: "View Roles", description: "List all roles", permission: "roles.view" },
  { function: "Create Role", description: "Create new role", permission: "roles.create" },
  { function: "Edit Role", description: "Modify role", permission: "roles.update" },
  { function: "Delete Role", description: "Remove role", permission: "roles.delete" },
  { function: "Assign Permissions", description: "Set role permissions", permission: "roles.permissions.assign" },
  
  // RBAC - User Roles
  { function: "View User Roles", description: "List user role assignments", permission: "user-roles.view" },
  { function: "Assign User Role", description: "Assign role to user", permission: "user-roles.assign" },
  { function: "Remove User Role", description: "Remove role from user", permission: "user-roles.remove" },
  
  // Staff Portal
  { function: "View Staff Dashboard", description: "Access staff dashboard", permission: "staff.dashboard.view" },
  { function: "View Assigned Classes", description: "See teaching assignments", permission: "staff.classes.view" },
  { function: "View Assigned Subjects", description: "See subject assignments", permission: "staff.subjects.view" },
  { function: "View Staff Profile", description: "View own staff profile", permission: "staff.profile.view" },
  { function: "Edit Staff Profile", description: "Update own staff profile", permission: "staff.profile.update" },
  
  // Student Portal
  { function: "View Student Dashboard", description: "Access student dashboard", permission: "student.dashboard.view" },
  { function: "View Bio Data", description: "View personal info", permission: "student.bio.view" },
  { function: "View My Result", description: "Access own result page", permission: "student.result.view" },
  { function: "Download My Result", description: "Download result PDF", permission: "student.result.download" },
  
  // CBT - Student
  { function: "View Available Quizzes", description: "List available tests", permission: "cbt.quizzes.view" },
  { function: "Take Quiz", description: "Start and answer quiz", permission: "cbt.quizzes.take" },
  { function: "Submit Quiz", description: "Submit quiz answers", permission: "cbt.quizzes.submit" },
  { function: "View Quiz History", description: "View quiz attempts", permission: "cbt.history.view" },
  { function: "View Quiz Result", description: "View quiz result", permission: "cbt.results.view" },
  { function: "Review Answers", description: "Review quiz answers", permission: "cbt.results.review" },
  
  // CBT - Admin
  { function: "View All Quizzes", description: "List and filter all quizzes", permission: "cbt.admin.view" },
  { function: "Create Quiz", description: "Create new quiz", permission: "cbt.admin.create" },
  { function: "Edit Quiz", description: "Modify quiz details", permission: "cbt.admin.update" },
  { function: "Delete Quiz", description: "Remove quiz", permission: "cbt.admin.delete" },
  { function: "Publish Quiz", description: "Make quiz live", permission: "cbt.admin.publish" },
  { function: "Unpublish Quiz", description: "Take quiz offline", permission: "cbt.admin.unpublish" },
  { function: "View Quiz Results", description: "View all quiz results", permission: "cbt.admin.results.view" },
  { function: "Export Quiz Results", description: "Export results data", permission: "cbt.admin.results.export" },
  { function: "Grade Quiz Attempt", description: "Manual grading", permission: "cbt.admin.results.grade" },
  
  // CBT - Questions
  { function: "View Questions", description: "List quiz questions", permission: "cbt.questions.view" },
  { function: "Create Question", description: "Create new question", permission: "cbt.questions.create" },
  { function: "Edit Question", description: "Modify question", permission: "cbt.questions.update" },
  { function: "Delete Question", description: "Remove question", permission: "cbt.questions.delete" },
  { function: "Reorder Questions", description: "Change question order", permission: "cbt.questions.reorder" },
  
  // CBT - Links
  { function: "View CBT Links", description: "View component links", permission: "cbt.links.view" },
  { function: "Create CBT Link", description: "Link quiz to component", permission: "cbt.links.create" },
  { function: "Delete CBT Link", description: "Remove link", permission: "cbt.links.delete" },
];
