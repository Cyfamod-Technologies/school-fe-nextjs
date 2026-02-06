"use client";

import { useStudentAuth } from "@/contexts/StudentAuthContext";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  StudentResultEntry,
  StudentSessionOption,
  listStudentSessions,
  previewStudentResult,
} from "@/lib/studentResults";

export default function StudentMyResultPage() {
  const { student, loading } = useStudentAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<StudentSessionOption[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<StudentResultEntry[] | null>(null);

  useEffect(() => {
    if (!loading && !student) {
      router.push("/student-login");
    }
  }, [loading, student, router]);

  useEffect(() => {
    if (!student) {
      return;
    }
    setSessions([]);
    setSelectedSession("");
    setSelectedTerm("");
    void listStudentSessions()
      .then((data) => {
        setSessions(data);
        if (data.length > 0) {
          setSelectedSession(String(data[0].id));
          const firstTerm = data[0].terms?.[0];
          if (firstTerm) {
            setSelectedTerm(String(firstTerm.id));
          }
        }
      })
      .catch((sessionError) => {
        console.error("Unable to load student sessions", sessionError);
        setError(
          sessionError instanceof Error
            ? sessionError.message
            : "Unable to load sessions. Please try again.",
        );
      });
  }, [student]);

  const availableTerms = useMemo(() => {
    const session = sessions.find((entry) => String(entry.id) === selectedSession);
    return session?.terms ?? [];
  }, [sessions, selectedSession]);

  const componentHeaders = useMemo(() => {
    if (!results) {
      return [] as string[];
    }
    const labels: string[] = [];
    const seen = new Set<string>();
    results.forEach((row) => {
      row.components?.forEach((component) => {
        const label = (component.label ?? "").trim();
        if (label && !seen.has(label)) {
          seen.add(label);
          labels.push(label);
        }
      });
    });
    return labels;
  }, [results]);

  if (loading || !student) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-muted mb-0">Loading results…</p>
        </div>
      </div>
    );
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setResults(null);

    if (!selectedSession || !selectedTerm || !pin) {
      setError("Select a session, term, and enter a valid PIN.");
      return;
    }

    setSubmitting(true);
    try {
      const response = await previewStudentResult({
        session_id: selectedSession,
        term_id: selectedTerm,
        pin_code: pin,
      });
      setResults(response.results);
    } catch (previewError) {
      console.error("Unable to load student results", previewError);
      setError(
        previewError instanceof Error
          ? previewError.message
          : "Unable to fetch results. Please verify the PIN.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="card height-auto">
      <div className="card-body">
        <div className="heading-layout1 mb-4">
          <div className="item-title">
            <h3>My Result</h3>
            <p className="mb-0 text-muted">
              Select a session and term, then enter your PIN to view your results.
            </p>
          </div>
        </div>
        {error ? (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        ) : null}
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group col-md-4 col-12">
              <label htmlFor="student-session" className="text-dark-medium">
                Session
              </label>
              <select
                id="student-session"
                className="form-control"
                value={selectedSession}
                onChange={(event) => {
                  setSelectedSession(event.target.value);
                  const nextSession = sessions.find(
                    (item) => String(item.id) === event.target.value,
                  );
                  const defaultTerm = nextSession?.terms?.[0];
                  setSelectedTerm(defaultTerm ? String(defaultTerm.id) : "");
                }}
                required
              >
                <option value="">Select session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={String(session.id)}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group col-md-4 col-12">
              <label htmlFor="student-term" className="text-dark-medium">
                Term
              </label>
              <select
                id="student-term"
                className="form-control"
                value={selectedTerm}
                onChange={(event) => setSelectedTerm(event.target.value)}
                required
                disabled={!availableTerms.length}
              >
                <option value="">Select term</option>
                {availableTerms.map((term) => (
                  <option key={term.id} value={String(term.id)}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group col-md-4 col-12">
              <label htmlFor="student-pin" className="text-dark-medium">
                Result PIN
              </label>
              <input
                id="student-pin"
                type="text"
                className="form-control"
                value={pin}
                onChange={(event) => setPin(event.target.value)}
                placeholder="Enter PIN"
                required
              />
              <small className="form-text text-muted">
                Get your PIN from the school or portal admin before checking your result.
              </small>
            </div>
          </div>
          <button
            className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
            type="submit"
            disabled={submitting}
          >
            {submitting ? "Loading…" : "View Result"}
          </button>
        </form>

        {results ? (
          <div className="mt-4">
            <h4 className="mb-3">Result Summary</h4>
            <div className="d-flex justify-content-end mb-3">
              <button
                type="button"
                className="btn btn-outline-primary"
                onClick={() => {
                  if (!selectedSession || !selectedTerm) {
                    setError("Select session and term before printing.");
                    return;
                  }
                  const params = new URLSearchParams();
                  params.set("session_id", selectedSession);
                  params.set("term_id", selectedTerm);
                  // Pass token directly so the proxy route doesn't depend on cookie decryption
                  try {
                    const target = `${encodeURIComponent("student_token")}=`;
                    const parts = document.cookie.split(";");
                    for (const part of parts) {
                      const trimmed = part.trim();
                      if (trimmed.startsWith(target)) {
                        const raw = decodeURIComponent(trimmed.slice(target.length));
                        params.set("_st", raw);
                        break;
                      }
                    }
                  } catch {
                    // ignore — route will try cookie fallback
                  }
                  const url = `/student/print-result?${params.toString()}`;
                  const printWindow = window.open(url, "_blank", "noopener,noreferrer");
                  if (!printWindow) {
                    setError("Unable to open print window. Please allow pop-ups.");
                  }
                }}
              >
                Print Result
              </button>
            </div>
            {results.length === 0 ? (
              <p className="text-muted mb-0">
                No results found for the selected session and term.
              </p>
            ) : (
              <div className="table-responsive">
                <table className="table display text-nowrap">
                  <thead>
                    <tr>
                      <th>Subject</th>
                      {componentHeaders.map((label) => (
                        <th key={label}>{label}</th>
                      ))}
                      <th>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {results.map((result, index) => {
                      const componentMap = new Map(
                        (result.components ?? []).map((component) => [
                          component.label ?? "",
                          component.score,
                        ]),
                      );
                      const componentScores = (result.components ?? [])
                        .map((component) =>
                          typeof component.score === "number"
                            ? component.score
                            : null,
                        )
                        .filter((score): score is number => score !== null);
                      const derivedTotal =
                        typeof result.total === "number"
                          ? result.total
                          : componentScores.length > 0
                          ? componentScores.reduce((sum, score) => sum + score, 0)
                          : null;

                      return (
                        <tr key={`${result.subject}-${index}`}>
                          <td>{result.subject ?? "—"}</td>
                          {componentHeaders.map((label) => {
                            const value = componentMap.has(label)
                              ? componentMap.get(label)
                              : null;
                            return (
                              <td key={`${result.subject}-${label}`}>
                                {value ?? "—"}
                              </td>
                            );
                          })}
                          <td>{derivedTotal ?? "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
