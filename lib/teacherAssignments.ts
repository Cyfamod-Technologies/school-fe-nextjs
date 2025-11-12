import { API_ROUTES } from "@/lib/config";
import { apiFetch } from "@/lib/apiClient";

export interface TeacherAssignmentItem {
  id?: string | number;
  subject_id?: string | number | null;
  school_class_id?: string | number | null;
  class_arm_id?: string | number | null;
  class_section_id?: string | number | null;
  session_id?: string | number | null;
  term_id?: string | number | null;
  [key: string]: unknown;
}

export interface TeacherAssignments {
  class_assignments: TeacherAssignmentItem[];
  subject_assignments: TeacherAssignmentItem[];
}

export async function getCurrentTeacherAssignments(
  sessionId: string | number,
  termId: string | number,
): Promise<TeacherAssignments> {
  try {
    const [classAssignmentsResponse, subjectAssignmentsResponse] = await Promise.all([
      apiFetch<any>(`${API_ROUTES.classTeachers}?session_id=${sessionId}&term_id=${termId}&per_page=500`),
      apiFetch<any>(`${API_ROUTES.subjectTeacherAssignments}?session_id=${sessionId}&term_id=${termId}&per_page=500`),
    ]);

    return {
      class_assignments: Array.isArray(classAssignmentsResponse?.data)
        ? classAssignmentsResponse.data
        : [],
      subject_assignments: Array.isArray(subjectAssignmentsResponse?.data)
        ? subjectAssignmentsResponse.data
        : [],
    };
  } catch (error) {
    console.error("Failed to fetch teacher assignments", error);
    return {
      class_assignments: [],
      subject_assignments: [],
    };
  }
}

export function getAssignedClassIds(assignments: TeacherAssignments): Set<string> {
  const classIds = new Set<string>();

  assignments.class_assignments.forEach((assignment) => {
    if (assignment.school_class_id) {
      classIds.add(String(assignment.school_class_id));
    }
  });

  assignments.subject_assignments.forEach((assignment) => {
    if (assignment.school_class_id) {
      classIds.add(String(assignment.school_class_id));
    }
  });

  return classIds;
}

export function getAssignedSubjectIds(assignments: TeacherAssignments): Set<string> {
  const subjectIds = new Set<string>();
  assignments.subject_assignments.forEach((assignment) => {
    if (assignment.subject_id) {
      subjectIds.add(String(assignment.subject_id));
    }
  });
  return subjectIds;
}

export function getAssignedClassArms(assignments: TeacherAssignments, classId: string): Set<string> {
  const armIds = new Set<string>();

  assignments.class_assignments
    .filter((a) => String(a.school_class_id) === classId)
    .forEach((a) => {
      if (a.class_arm_id) {
        armIds.add(String(a.class_arm_id));
      }
    });

  assignments.subject_assignments
    .filter((a) => String(a.school_class_id) === classId)
    .forEach((a) => {
      if (a.class_arm_id) {
        armIds.add(String(a.class_arm_id));
      }
    });

  return armIds;
}

export function hasAnyAssignments(assignments: TeacherAssignments): boolean {
  return (
    Array.isArray(assignments.class_assignments) && assignments.class_assignments.length > 0
  ) || (
    Array.isArray(assignments.subject_assignments) && assignments.subject_assignments.length > 0
  );
}
