"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listResults, type ResultRecord } from "@/lib/results";
import { isAdminUser } from "@/lib/roleChecks";
import { listSessions, type Session } from "@/lib/sessions";
import { listStudents, type StudentSummary } from "@/lib/students";
import { listAllSubjects, type Subject } from "@/lib/subjects";
import { listTermsBySession, type Term } from "@/lib/terms";

interface PerformanceFilters {
  sessionId: string;
  termId: string;
  classId: string;
  subjectId: string;
}

interface PerformanceRow {
  student: StudentSummary;
  score: number | null;
  position: number | null;
}

const emptyFilters: PerformanceFilters = {
  sessionId: "",
  termId: "",
  classId: "",
  subjectId: "",
};

const getStudentName = (student: StudentSummary) =>
  [student.first_name, student.middle_name, student.last_name]
    .filter(Boolean)
    .join(" ")
    .trim() || "Unnamed student";

const toFiniteNumber = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};

const resolveResultScore = (results: ResultRecord[]): number | null => {
  const summaryResult = results.find(
    (result) =>
      result.assessment_component_id === null ||
      result.assessment_component_id === undefined,
  );
  const summaryScore = toFiniteNumber(summaryResult?.total_score);
  if (summaryScore !== null) return summaryScore;

  const componentScores = results
    .filter(
      (result) =>
        result.assessment_component_id !== null &&
        result.assessment_component_id !== undefined,
    )
    .map((result) => toFiniteNumber(result.total_score))
    .filter((score): score is number => score !== null);

  return componentScores.length
    ? componentScores.reduce((sum, score) => sum + score, 0)
    : null;
};

const formatPosition = (position: number | null) => {
  if (position === null) return "—";
  const remainder100 = position % 100;
  if (remainder100 >= 11 && remainder100 <= 13) return `${position}th`;
  const suffix = position % 10 === 1 ? "st" : position % 10 === 2 ? "nd" : position % 10 === 3 ? "rd" : "th";
  return `${position}${suffix}`;
};

export default function ViewPerformancePage() {
  const router = useRouter();
  const { user, loading: authLoading, schoolContext } = useAuth();
  const admin = isAdminUser(user);
  const [filters, setFilters] = useState<PerformanceFilters>(emptyFilters);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [rows, setRows] = useState<PerformanceRow[]>([]);
  const [loadingFilters, setLoadingFilters] = useState(true);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user && !admin) {
      router.replace("/v10/dashboard");
    }
  }, [admin, authLoading, router, user]);

  useEffect(() => {
    if (!admin) return;

    setLoadingFilters(true);
    Promise.all([listSessions(), listClasses(), listAllSubjects()])
      .then(([sessionItems, classItems, subjectItems]) => {
        setSessions(sessionItems);
        setClasses(classItems);
        setSubjects(subjectItems);

        const currentSessionId = schoolContext.current_session_id
          ? String(schoolContext.current_session_id)
          : "";
        setFilters((previous) => ({
          ...previous,
          sessionId: previous.sessionId || currentSessionId,
        }));
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load performance filters.");
      })
      .finally(() => setLoadingFilters(false));
  }, [admin, schoolContext.current_session_id]);

  useEffect(() => {
    setTerms([]);
    if (!filters.sessionId || !admin) return;

    listTermsBySession(filters.sessionId)
      .then((items) => {
        setTerms(items);
        const currentTermId = schoolContext.current_term_id
          ? String(schoolContext.current_term_id)
          : "";
        if (currentTermId && items.some((item) => String(item.id) === currentTermId)) {
          setFilters((previous) =>
            previous.termId ? previous : { ...previous, termId: currentTermId },
          );
        }
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load terms.");
      });
  }, [admin, filters.sessionId, schoolContext.current_term_id]);

  const selectedSession = sessions.find((item) => String(item.id) === filters.sessionId);
  const selectedTerm = terms.find((item) => String(item.id) === filters.termId);
  const selectedClass = classes.find((item) => String(item.id) === filters.classId);
  const selectedSubject = subjects.find((item) => String(item.id) === filters.subjectId);

  const loadPerformance = useCallback(async () => {
    const viewingAllTerms = filters.termId === "all";
    const viewingAllSubjects = filters.subjectId === "all";
    if (
      !filters.sessionId ||
      !filters.classId ||
      !filters.subjectId ||
      !filters.termId
    ) {
      setError("Select a session, term, class, and subject to view performance.");
      return;
    }

    setLoading(true);
    setLoaded(false);
    setError(null);

    try {
      const studentItems: StudentSummary[] = [];
      let studentPage = 1;
      let hasMoreStudents = true;
      while (hasMoreStudents) {
        const response = await listStudents({
          page: studentPage,
          per_page: 1000,
          sortBy: "last_name",
          sortDirection: "asc",
          school_class_id: filters.classId,
        });
        studentItems.push(...(response.data ?? []));
        hasMoreStudents = studentPage < (response.last_page || 1);
        studentPage += 1;
      }

      const resultItems: ResultRecord[] = [];
      let resultPage = 1;
      let hasMoreResults = true;
      while (hasMoreResults) {
        const response = await listResults({
          page: resultPage,
          per_page: 1000,
          session_id: filters.sessionId,
          term_id: viewingAllTerms ? undefined : filters.termId,
          school_class_id: filters.classId,
          subject_id: viewingAllSubjects ? undefined : filters.subjectId,
        });
        resultItems.push(...(response.data ?? []));
        hasMoreResults = resultPage < (response.last_page || 1);
        resultPage += 1;
      }

      const resultsByStudent = new Map<string, ResultRecord[]>();
      resultItems.forEach((result) => {
        const key = String(result.student_id);
        resultsByStudent.set(key, [...(resultsByStudent.get(key) ?? []), result]);
      });

      const nextRows = studentItems.map((student) => {
        const studentResults = resultsByStudent.get(String(student.id)) ?? [];
        const summaryResult = studentResults.find(
          (result) => result.assessment_component_id === null || result.assessment_component_id === undefined,
        );
        let score: number | null;
        let storedPosition: number | null = null;

        if (viewingAllTerms || viewingAllSubjects) {
          const resultsByTermAndSubject = new Map<string, ResultRecord[]>();
          studentResults.forEach((result) => {
            const key = `${String(result.term_id)}:${String(result.subject_id)}`;
            resultsByTermAndSubject.set(key, [
              ...(resultsByTermAndSubject.get(key) ?? []),
              result,
            ]);
          });

          const scoresByTerm = new Map<string, number[]>();
          resultsByTermAndSubject.forEach((entries) => {
            const subjectScore = resolveResultScore(entries);
            if (subjectScore === null) return;
            const termId = String(entries[0]?.term_id ?? "");
            scoresByTerm.set(termId, [...(scoresByTerm.get(termId) ?? []), subjectScore]);
          });

          const termAverages = Array.from(scoresByTerm.values())
            .filter((scores) => scores.length > 0)
            .map((scores) => scores.reduce((sum, item) => sum + item, 0) / scores.length);
          score = termAverages.length
            ? termAverages.reduce((sum, average) => sum + average, 0) / termAverages.length
            : null;
        } else {
          score = resolveResultScore(studentResults);
          storedPosition = toFiniteNumber(
            summaryResult?.position_in_subject ??
              studentResults.find(
                (result) => toFiniteNumber(result.position_in_subject) !== null,
              )?.position_in_subject,
          );
        }

        return {
          student,
          score: score === null ? null : Math.round(score * 100) / 100,
          position: storedPosition && storedPosition > 0 ? Math.trunc(storedPosition) : null,
        } satisfies PerformanceRow;
      });

      const rankedRows = nextRows
        .filter((row) => row.score !== null)
        .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
      let previousScore: number | null = null;
      let previousPosition = 0;
      rankedRows.forEach((row, index) => {
        if (previousScore === null || row.score !== previousScore) {
          previousPosition = index + 1;
          previousScore = row.score;
        }
        if (row.position === null) row.position = previousPosition;
      });

      nextRows.sort((a, b) => {
        if (a.position === null && b.position !== null) return 1;
        if (a.position !== null && b.position === null) return -1;
        if (a.position !== b.position) return (a.position ?? 0) - (b.position ?? 0);
        if (a.score !== b.score) return (b.score ?? -1) - (a.score ?? -1);
        return getStudentName(a.student).localeCompare(getStudentName(b.student));
      });

      setRows(nextRows);
      setLoaded(true);
    } catch (cause) {
      setRows([]);
      setError(cause instanceof Error ? cause.message : "Unable to load student performance.");
    } finally {
      setLoading(false);
    }
  }, [filters]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void loadPerformance();
  };

  const scoredStudents = useMemo(() => rows.filter((row) => row.score !== null), [rows]);
  const classAverage = useMemo(() => {
    if (!scoredStudents.length) return null;
    return scoredStudents.reduce((sum, row) => sum + (row.score ?? 0), 0) / scoredStudents.length;
  }, [scoredStudents]);

  const reset = () => {
    setFilters({
      ...emptyFilters,
      sessionId: schoolContext.current_session_id ? String(schoolContext.current_session_id) : "",
    });
    setRows([]);
    setLoaded(false);
    setError(null);
  };

  if (authLoading || !admin) {
    return (
      <div className="d-flex align-items-center justify-content-center p-5">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>View Performance</h3>
        <ul>
          <li><Link href="/v10/dashboard">Home</Link></li>
          <li>Students</li>
          <li>View Performance</li>
        </ul>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title"><h3>Student Performance</h3></div>
          </div>

          <form className="row" onSubmit={handleSubmit}>
            <div className="col-xl-2 col-lg-3 col-md-6 form-group">
              <label>Session</label>
              <select
                className="form-control"
                value={filters.sessionId}
                disabled={loadingFilters}
                onChange={(event) => {
                  setFilters((previous) => ({ ...previous, sessionId: event.target.value, termId: "" }));
                  setRows([]);
                  setLoaded(false);
                }}
              >
                <option value="">Select Session</option>
                {sessions.map((session) => <option key={session.id} value={session.id}>{session.name}</option>)}
              </select>
            </div>
            <div className="col-xl-2 col-lg-3 col-md-6 form-group">
              <label>Term</label>
              <select
                className="form-control"
                value={filters.termId}
                disabled={!filters.sessionId}
                onChange={(event) => setFilters((previous) => ({ ...previous, termId: event.target.value }))}
              >
                <option value="">Select Term</option>
                <option value="all">All Terms</option>
                {terms.map((term) => <option key={term.id} value={term.id}>{term.name}</option>)}
              </select>
            </div>
            <div className="col-xl-2 col-lg-3 col-md-6 form-group">
              <label>Class</label>
              <select
                className="form-control"
                value={filters.classId}
                disabled={loadingFilters}
                onChange={(event) => setFilters((previous) => ({ ...previous, classId: event.target.value }))}
              >
                <option value="">Select Class</option>
                {classes.map((schoolClass) => <option key={schoolClass.id} value={schoolClass.id}>{schoolClass.name}</option>)}
              </select>
            </div>
            <div className="col-xl-2 col-lg-3 col-md-6 form-group">
              <label>Subject</label>
              <select
                className="form-control"
                value={filters.subjectId}
                disabled={loadingFilters}
                onChange={(event) => setFilters((previous) => ({ ...previous, subjectId: event.target.value }))}
              >
                <option value="">Select Subject</option>
                <option value="all">All Subjects</option>
                {subjects.map((subject) => <option key={subject.id} value={subject.id}>{subject.name}</option>)}
              </select>
            </div>
            <div className="col-xl-2 col-lg-12 form-group d-flex align-items-end">
              <button type="submit" className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark mr-2" disabled={loading || loadingFilters}>
                {loading ? "Loading…" : "View Performance"}
              </button>
              <button type="button" className="btn btn-outline-secondary" onClick={reset} disabled={loading}>Reset</button>
            </div>
          </form>

          {loaded ? (
            <>
              <div className="performance-summary mb-4">
                <div><span>Class</span><strong>{selectedClass?.name ?? "—"}</strong></div>
                <div>
                  <span>Performance</span>
                  <strong>
                    {filters.subjectId === "all"
                      ? filters.termId === "all"
                        ? "Overall Class · All Terms"
                        : "Overall Class"
                      : filters.termId === "all"
                        ? `${selectedSubject?.name ?? "Subject"} · All Terms`
                        : selectedSubject?.name ?? "—"}
                  </strong>
                </div>
                <div><span>Students Scored</span><strong>{scoredStudents.length} / {rows.length}</strong></div>
                <div><span>Class Average</span><strong>{classAverage === null ? "—" : classAverage.toFixed(2)}</strong></div>
              </div>

              <p className="text-muted mb-3">
                {selectedSession?.name}
                {filters.termId === "all" ? " · All Terms" : ` · ${selectedTerm?.name ?? ""}`}
              </p>

              <div className="table-responsive">
                <table className="table display data-table text-nowrap performance-table">
                  <thead>
                    <tr>
                      <th>Adm No.</th>
                      <th>Student Name</th>
                      <th>Score</th>
                      <th>Position</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.student.id}>
                        <td>{row.student.admission_no || "—"}</td>
                        <td>{getStudentName(row.student)}</td>
                        <td>{row.score === null ? "—" : row.score.toFixed(2)}</td>
                        <td><span className="position-badge">{formatPosition(row.position)}</span></td>
                      </tr>
                    ))}
                    {!rows.length ? (
                      <tr><td colSpan={4} className="text-center p-5">No students were found for the selected class.</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </>
          ) : (
            <div className="text-center text-muted p-5">
              Select the session, term, class, and subject to view student positions.
            </div>
          )}
        </div>
      </div>

      <style jsx>{`
        .performance-summary {
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 12px;
        }
        .performance-summary > div {
          background: #f6f8fb;
          border: 1px solid #e4e9f0;
          border-radius: 8px;
          padding: 14px 16px;
        }
        .performance-summary span {
          color: #7a8594;
          display: block;
          font-size: 12px;
          margin-bottom: 4px;
        }
        .performance-summary strong { color: #042c54; font-size: 16px; }
        .position-badge { color: #042c54; font-weight: 800; }
        .performance-table th { font-weight: 700; }
        @media (max-width: 991px) {
          .performance-summary { grid-template-columns: repeat(2, minmax(0, 1fr)); }
        }
        @media (max-width: 575px) {
          .performance-summary { grid-template-columns: 1fr; }
        }
      `}</style>
    </>
  );
}
