import { AssessmentComponent } from "@/lib/assessmentComponents";
import { StudentSummary } from "@/lib/students";

/**
 * Generate Excel file content as CSV (can be opened in Excel, Google Sheets, etc.)
 * This approach doesn't require any external dependencies
 */
export function generateAssessmentSheetCSV(
  students: StudentSummary[],
  assessmentComponents: AssessmentComponent[],
): string {
  // Sort components by order
  const sortedComponents = [...assessmentComponents].sort(
    (a, b) => (a.order || 0) - (b.order || 0),
  );

  // Create header row: Admission No, Name, then assessment components
  const headers = ["Admission No", "Name", ...sortedComponents.map((c) => c.name)];

  // Create data rows
  const rows = students.map((student) => {
    const name = [student.first_name, student.middle_name, student.last_name]
      .filter(Boolean)
      .join(" ")
      .trim();
    const admissionNo = student.admission_no || "";

    // Assessment component columns (empty for now, to be filled manually)
    const componentColumns = sortedComponents.map(() => "");

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
          const cellStr = String(cell || "");
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
    const csv = generateAssessmentSheetCSV(students, assessmentComponents);
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
