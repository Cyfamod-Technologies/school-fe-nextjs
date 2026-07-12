import { AssessmentComponent } from "@/lib/assessmentComponents";
import { ResultRecord } from "@/lib/results";
import { StudentSummary } from "@/lib/students";

interface AssessmentSheetColumn {
  componentId: string;
  subjectId: string | null;
  heading: string;
}

/**
 * Generate Excel file content as CSV (can be opened in Excel, Google Sheets, etc.)
 * This approach doesn't require any external dependencies
 */
export function generateAssessmentSheetCSV(
  students: StudentSummary[],
  assessmentComponents: AssessmentComponent[],
  results: ResultRecord[] = [],
): string {
  // Sort components by order
  const sortedComponents = [...assessmentComponents].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  // A component can be assigned to several subjects. Keep each subject/component
  // combination separate so, for example, English CA is not confused with Maths CA.
  const columns = sortedComponents.flatMap<AssessmentSheetColumn>((component) => {
    const subjects = Array.isArray(component.subjects) ? component.subjects : [];

    if (subjects.length === 0) {
      return [{
        componentId: String(component.id),
        subjectId: null,
        heading: component.name,
      }];
    }

    return [...subjects]
      .sort((a, b) => String(a.name).localeCompare(String(b.name)))
      .map((subject) => ({
        componentId: String(component.id),
        subjectId: String(subject.id),
        heading: `${subject.name} - ${component.name}`,
      }));
  });

  const headers = ["Admission No", "Name", ...columns.map((column) => column.heading)];

  const scoreLookup = new Map<string, number>();
  results.forEach((result) => {
    if (result.assessment_component_id === null || result.assessment_component_id === undefined) {
      return;
    }

    scoreLookup.set(
      [result.student_id, result.subject_id, result.assessment_component_id]
        .map(String)
        .join(":"),
      result.total_score,
    );
  });

  // Create data rows
  const rows = students.map((student) => {
    const name = [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const admissionNo = student.admission_no || "";

    const componentColumns = columns.map((column) => {
      if (column.subjectId !== null) {
        return scoreLookup.get(
          [student.id, column.subjectId, column.componentId].map(String).join(":"),
        ) ?? "";
      }

      const matchingResult = results.find(
        (result) =>
          String(result.student_id) === String(student.id) &&
          String(result.assessment_component_id) === column.componentId,
      );
      return matchingResult?.total_score ?? "";
    });

    return [admissionNo, name, ...componentColumns];
  });

  // Combine headers and rows
  const allRows = [headers, ...rows];

  // Convert to CSV format
  const csv = allRows
    .map((row) =>
      row
        .map((cell) => {
          // Escape cells containing commas or quotes
          const cellStr = String(cell ?? "");
          if (cellStr.includes(",") || cellStr.includes('"')) {
            return `"${cellStr.replace(/"/g, '""')}"`;
          }
          return cellStr;
        })
        .join(","),
    )
    .join("\n");

  return csv;
}

/**
 * Download CSV file (compatible with Excel)
 */
export function downloadCSVFile(
  content: string,
  filename: string = "assessment_sheet.csv",
): void {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);

  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.visibility = "hidden";

  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Clean up the URL
  URL.revokeObjectURL(url);
}

/**
 * Export assessment sheet - main function to be called from components
 */
export function exportAssessmentSheet(
  students: StudentSummary[],
  assessmentComponents: AssessmentComponent[],
  results: ResultRecord[] = [],
  filename?: string,
): void {
  if (!students || students.length === 0) {
    throw new Error("No students to export");
  }

  if (!assessmentComponents || assessmentComponents.length === 0) {
    throw new Error("No assessment components found");
  }

  try {
    // Always use CSV to ensure reliable download
    const csv = generateAssessmentSheetCSV(students, assessmentComponents, results);
    const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    downloadCSVFile(
      csv,
      filename || `assessment_sheet_${timestamp}.csv`,
    );
  } catch (error) {
    console.error("Failed to export assessment sheet:", error);
    throw error;
  }
}
