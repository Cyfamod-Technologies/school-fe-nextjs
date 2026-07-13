"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import { listAllSubjects, type Subject } from "@/lib/subjects";
import {
  listAssessmentComponents,
  type AssessmentComponent,
} from "@/lib/assessmentComponents";
import { listStudents, type StudentSummary } from "@/lib/students";
import { listResults, type ResultRecord } from "@/lib/results";
import { downloadCSVFile } from "@/lib/assessmentSheetExport";

interface Filters {
  sessionId: string;
  termId: string;
  classId: string;
  armId: string;
  subjectId: string;
}

const emptyFilters: Filters = {
  sessionId: "",
  termId: "",
  classId: "",
  armId: "",
  subjectId: "",
};

const escapeCsvCell = (value: unknown) => {
  const text = String(value ?? "");
  return text.includes(",") || text.includes('"') || text.includes("\n")
    ? `"${text.replace(/"/g, '""')}"`
    : text;
};

const studentName = (student: StudentSummary) =>
  [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();

export default function AssessmentSheetPage() {
  const { schoolContext } = useAuth();
  const searchParams = useSearchParams();
  const [filters, setFilters] = useState<Filters>(() => ({
    sessionId: searchParams.get("session_id") ?? "",
    termId: searchParams.get("term_id") ?? "",
    classId: searchParams.get("class_id") ?? "",
    armId: searchParams.get("arm_id") ?? "",
    subjectId: searchParams.get("subject_id") ?? "",
  }));
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [results, setResults] = useState<ResultRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([listSessions(), listClasses(), listAllSubjects()])
      .then(([sessionItems, classItems, subjectItems]) => {
        setSessions(sessionItems);
        setClasses(classItems);
        setSubjects(subjectItems);

        const currentSessionId = schoolContext.current_session_id
          ? String(schoolContext.current_session_id)
          : "";
        if (currentSessionId && !searchParams.get("session_id")) {
          setFilters((previous) => ({ ...previous, sessionId: currentSessionId }));
        }
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load assessment-sheet filters.");
      });
  }, [schoolContext.current_session_id, searchParams]);

  useEffect(() => {
    setTerms([]);
    if (!filters.sessionId) return;

    listTermsBySession(filters.sessionId)
      .then((items) => {
        setTerms(items);
        const currentTermId = schoolContext.current_term_id
          ? String(schoolContext.current_term_id)
          : "";
        if (
          currentTermId &&
          !searchParams.get("term_id") &&
          items.some((item) => String(item.id) === currentTermId)
        ) {
          setFilters((previous) => ({ ...previous, termId: currentTermId }));
        }
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load terms.");
      });
  }, [filters.sessionId, schoolContext.current_term_id, searchParams]);

  useEffect(() => {
    setArms([]);
    if (!filters.classId) return;
    listClassArms(filters.classId)
      .then(setArms)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load class arms.");
      });
  }, [filters.classId]);

  const selectedSession = sessions.find((item) => String(item.id) === filters.sessionId);
  const selectedTerm = terms.find((item) => String(item.id) === filters.termId);
  const selectedClass = classes.find((item) => String(item.id) === filters.classId);
  const selectedArm = arms.find((item) => String(item.id) === filters.armId);
  const selectedSubject = subjects.find((item) => String(item.id) === filters.subjectId);

  const sortedComponents = useMemo(
    () => [...components].sort((a, b) => (a.order ?? 0) - (b.order ?? 0)),
    [components],
  );

  const scoreLookup = useMemo(() => {
    const lookup = new Map<string, number>();
    results.forEach((result) => {
      if (result.assessment_component_id === null || result.assessment_component_id === undefined) return;
      lookup.set(
        [result.student_id, result.assessment_component_id].map(String).join(":"),
        Number(result.total_score),
      );
    });
    return lookup;
  }, [results]);

  const totalLookup = useMemo(() => {
    const lookup = new Map<string, number>();
    students.forEach((student) => {
      const total = sortedComponents.reduce(
        (sum, component) =>
          sum + (scoreLookup.get([student.id, component.id].map(String).join(":")) ?? 0),
        0,
      );
      lookup.set(String(student.id), total);
    });
    return lookup;
  }, [scoreLookup, sortedComponents, students]);

  const loadSheet = useCallback(async () => {
    if (!filters.sessionId || !filters.termId || !filters.classId || !filters.subjectId) {
      setError("Select a session, term, class, and subject to view the assessment sheet.");
      return;
    }

    setLoading(true);
    setError(null);
    setLoaded(false);
    try {
      const componentResponse = await listAssessmentComponents({
        subject_id: filters.subjectId,
        per_page: 100,
      });

      const allStudents: StudentSummary[] = [];
      let studentPage = 1;
      let moreStudents = true;
      while (moreStudents) {
        const response = await listStudents({
          page: studentPage,
          per_page: 1000,
          sortBy: "last_name",
          sortDirection: "asc",
          current_session_id: filters.sessionId,
          school_class_id: filters.classId,
          class_arm_id: filters.armId || undefined,
        });
        allStudents.push(...(Array.isArray(response.data) ? response.data : []));
        moreStudents = studentPage < (response.last_page || 1);
        studentPage += 1;
      }

      const allResults: ResultRecord[] = [];
      let resultPage = 1;
      let moreResults = true;
      while (moreResults) {
        const response = await listResults({
          page: resultPage,
          per_page: 1000,
          session_id: filters.sessionId,
          term_id: filters.termId,
          school_class_id: filters.classId,
          class_arm_id: filters.armId || undefined,
          subject_id: filters.subjectId,
        });
        allResults.push(...(Array.isArray(response.data) ? response.data : []));
        moreResults = resultPage < (response.last_page || 1);
        resultPage += 1;
      }

      setComponents(componentResponse.data ?? []);
      setStudents(allStudents);
      setResults(allResults);
      setLoaded(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load the assessment sheet.");
      setStudents([]);
      setResults([]);
      setComponents([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const exportSheet = () => {
    const headers = ["S/N", "Admission No", "Student Name", ...sortedComponents.map((item) => item.name), "Total"];
    const rows = students.map((student, index) => [
      index + 1,
      student.admission_no ?? "",
      studentName(student),
      ...sortedComponents.map((component) =>
        scoreLookup.get([student.id, component.id].map(String).join(":")) ?? "",
      ),
      totalLookup.get(String(student.id)) ?? 0,
    ]);
    const csv = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(",")).join("\n");
    const parts = ["assessment-sheet", selectedClass?.name, selectedArm?.name, selectedSubject?.name]
      .filter(Boolean)
      .map((part) => String(part).replace(/[^a-z0-9]+/gi, "-"));
    downloadCSVFile(csv, `${parts.join("_")}.csv`);
  };

  const reset = () => {
    setFilters(emptyFilters);
    setTerms([]);
    setArms([]);
    setStudents([]);
    setResults([]);
    setComponents([]);
    setLoaded(false);
    setError(null);
  };

  return (
    <>
      <div className="breadcrumbs-area assessment-no-print">
        <h3>Student Management</h3>
        <ul>
          <li><Link href="/v10/dashboard">Home</Link></li>
          <li>Assessment Sheet</li>
        </ul>
      </div>

      {error ? <div className="alert alert-danger assessment-no-print">{error}</div> : null}

      <div className="card height-auto assessment-sheet-card">
        <div className="card-body">
          <div className="heading-layout1 assessment-no-print">
            <div className="item-title"><h3>Assessment Sheet</h3></div>
          </div>

          <div className="row assessment-no-print">
            <div className="col-lg-2 col-md-4 form-group">
              <label>Session</label>
              <select className="form-control" value={filters.sessionId} onChange={(event) => setFilters((old) => ({ ...old, sessionId: event.target.value, termId: "" }))}>
                <option value="">Select Session</option>
                {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-lg-2 col-md-4 form-group">
              <label>Term</label>
              <select className="form-control" value={filters.termId} disabled={!filters.sessionId} onChange={(event) => setFilters((old) => ({ ...old, termId: event.target.value }))}>
                <option value="">Select Term</option>
                {terms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-lg-2 col-md-4 form-group">
              <label>Class</label>
              <select className="form-control" value={filters.classId} onChange={(event) => setFilters((old) => ({ ...old, classId: event.target.value, armId: "" }))}>
                <option value="">Select Class</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-lg-2 col-md-4 form-group">
              <label>Class Arm</label>
              <select className="form-control" value={filters.armId} disabled={!filters.classId} onChange={(event) => setFilters((old) => ({ ...old, armId: event.target.value }))}>
                <option value="">All Arms</option>
                {arms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-lg-2 col-md-4 form-group">
              <label>Subject</label>
              <select className="form-control" value={filters.subjectId} onChange={(event) => setFilters((old) => ({ ...old, subjectId: event.target.value }))}>
                <option value="">Select Subject</option>
                {subjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-lg-2 col-md-4 form-group d-flex align-items-end">
              <button type="button" className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark mr-2" onClick={loadSheet} disabled={loading}>
                {loading ? "Loading…" : "View"}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={reset}>Reset</button>
            </div>
          </div>

          {loaded ? (
            <div className="assessment-print-area">
              <div className="text-center assessment-sheet-heading">
                <h2>ASSESSMENT SHEET</h2>
                <h4>{selectedSubject?.name}</h4>
                <p>
                  {selectedClass?.name}{selectedArm ? ` ${selectedArm.name}` : ""} · {selectedTerm?.name} Term · {selectedSession?.name} Session
                </p>
              </div>

              <div className="assessment-actions assessment-no-print mb-3">
                <button type="button" className="btn btn-primary mr-2" onClick={() => window.print()} disabled={!students.length}>Print</button>
                <button type="button" className="btn btn-success" onClick={exportSheet} disabled={!students.length}>Export CSV</button>
              </div>

              {sortedComponents.length === 0 ? (
                <div className="alert alert-warning">No assessment components are configured for this subject.</div>
              ) : (
                <div className="table-responsive">
                  <table className="table table-bordered assessment-table">
                    <thead>
                      <tr>
                        <th>S/N</th>
                        <th>Admission No</th>
                        <th>Student Name</th>
                        {sortedComponents.map((component) => (
                          <th key={component.id}>{component.name}<small>/{Number(component.weight)}</small></th>
                        ))}
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {students.map((student, index) => (
                        <tr key={student.id}>
                          <td>{index + 1}</td>
                          <td className="identity-cell">{student.admission_no}</td>
                          <td className="identity-cell student-name-cell">{studentName(student)}</td>
                          {sortedComponents.map((component) => (
                            <td key={component.id}>
                              {scoreLookup.get([student.id, component.id].map(String).join(":")) ?? ""}
                            </td>
                          ))}
                          <td className="total-cell">{totalLookup.get(String(student.id)) ?? 0}</td>
                        </tr>
                      ))}
                      {!students.length ? (
                        <tr><td colSpan={sortedComponents.length + 4} className="text-center p-4">No students found for the selected class.</td></tr>
                      ) : null}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center text-muted p-5 assessment-no-print">Select the filters above to view an up-to-date assessment sheet.</div>
          )}
        </div>
      </div>

      <style jsx global>{`
        .assessment-sheet-heading h2 { font-size: 22px; font-weight: 800; margin-bottom: 5px; }
        .assessment-sheet-heading h4 { font-size: 18px; font-weight: 700; margin-bottom: 4px; }
        .assessment-sheet-heading p { font-size: 14px; margin-bottom: 18px; }
        .assessment-table { color: #111; }
        .assessment-table th { background: #162447; color: #fff; font-weight: 700; text-align: center; vertical-align: middle; white-space: nowrap; }
        .assessment-table th small { display: block; color: #fff; font-size: 10px; }
        .assessment-table td { text-align: center; vertical-align: middle; }
        .assessment-table .identity-cell { font-weight: 700; }
        .assessment-table .student-name-cell { min-width: 190px; text-align: left; }
        .assessment-table .total-cell { font-weight: 800; background: #f2f5fa; }
        @media print {
          @page { size: A4 landscape; margin: 8mm; }
          .assessment-no-print, .header-menu-one, .sidebar-main, .scrollUp { display: none !important; }
          .dashboard-page-one .dashboard-content-one { margin-left: 0 !important; padding: 0 !important; }
          .assessment-sheet-card, .assessment-sheet-card .card-body { box-shadow: none !important; border: 0 !important; padding: 0 !important; }
          .assessment-sheet-heading h2 { font-size: 18px; }
          .assessment-sheet-heading h4 { font-size: 14px; }
          .assessment-sheet-heading p { font-size: 11px; margin-bottom: 8px; }
          .assessment-table { width: 100%; font-size: 9px; }
          .assessment-table th, .assessment-table td { padding: 3px 4px !important; border: 1px solid #000 !important; }
          .assessment-table th { background: #fff !important; color: #000 !important; }
          .assessment-table th small { color: #000 !important; }
          .assessment-table .total-cell { background: #fff !important; }
        }
      `}</style>
    </>
  );
}
