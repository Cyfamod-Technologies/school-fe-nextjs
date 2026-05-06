import { StudentSummary } from "@/lib/students";
import { downloadCSVFile } from "@/lib/assessmentSheetExport";

export interface BroadsheetSubject {
  id: number | string;
  name: string;
}

function escapeCsvCell(value: string): string {
  const str = String(value ?? "");
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function generateBroadsheetCSV(
  students: StudentSummary[],
  subjects: BroadsheetSubject[],
): string {
  const headers = [
    "S/NO",
    "ADM.NO",
    "NAME OF STUDENT",
    "SEX",
    ...subjects.map((s) => s.name.toUpperCase()),
    "NO. OF PASSES",
    "REMARK",
  ];

  const rows = students.map((student, index) => {
    const name = [student.last_name, student.first_name, student.middle_name]
      .filter(Boolean)
      .join(", ")
      .trim();
    const sex = ((student.gender as string) ?? "").charAt(0).toUpperCase();
    const subjectCells = subjects.map(() => "");
    return [
      String(index + 1),
      student.admission_no ?? "",
      name,
      sex,
      ...subjectCells,
      "",
      "",
    ];
  });

  return [headers, ...rows]
    .map((row) => row.map(escapeCsvCell).join(","))
    .join("\n");
}

export function exportBroadsheet(
  students: StudentSummary[],
  subjects: BroadsheetSubject[],
  filename?: string,
): void {
  if (!students || students.length === 0) {
    throw new Error("No students to export.");
  }
  if (!subjects || subjects.length === 0) {
    throw new Error("No subjects found for this class. Please assign subjects before exporting.");
  }
  const csv = generateBroadsheetCSV(students, subjects);
  downloadCSVFile(csv, filename ?? "broadsheet.csv");
}
