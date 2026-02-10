"use client";

import { useStudentAuth } from "@/contexts/StudentAuthContext";
import { useRouter } from "next/navigation";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  StudentResultEntry,
  StudentSessionOption,
  listStudentSessions,
  previewStudentResult,
} from "@/lib/studentResults";
import { resolveBackendUrl } from "@/lib/config";
import { getCookie } from "@/lib/cookies";

export default function StudentMyResultPage() {
  const { student, loading } = useStudentAuth();
  const router = useRouter();
  const [sessions, setSessions] = useState<StudentSessionOption[]>([]);
  const [selectedSession, setSelectedSession] = useState("");
  const [selectedTerm, setSelectedTerm] = useState("");
  const [pin, setPin] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [printProcessing, setPrintProcessing] = useState(false);
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

  const handlePrintResult = useCallback(async () => {
    if (!selectedSession || !selectedTerm) {
      setError("Select session and term before printing.");
      return;
    }

    setPrintProcessing(true);
    setError(null);

    try {
      const token = getCookie("student_token");
      if (!token) {
        setError("Your session has expired. Please log in again.");
        return;
      }

      const params = new URLSearchParams();
      params.set("session_id", selectedSession);
      params.set("term_id", selectedTerm);

      const endpoint = resolveBackendUrl(
        `/api/v1/student/results/download?${params.toString()}`,
      );

      const response = await fetch(endpoint, {
        headers: {
          Accept: "text/html",
          "X-Requested-With": "XMLHttpRequest",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        let errorMessage = "Unable to load printable result.";
        const contentType = response.headers.get("content-type") || "";

        if (contentType.includes("application/json")) {
          try {
            const errorData = await response.json();
            errorMessage = errorData.message || errorMessage;
          } catch {
            // fall back
          }
        } else if (response.status === 401) {
          errorMessage = "Your session has expired. Please log in again.";
        } else if (response.status === 404) {
          errorMessage = "No results found for the selected session and term.";
        } else {
          const text = await response.text().catch(() => "");
          if (text.trim().length > 0 && !/^<\s*(!DOCTYPE|html)/i.test(text.trim())) {
            errorMessage = text.trim();
          }
        }

        throw new Error(errorMessage);
      }

      const html = await response.text();
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        setError("Unable to open print window. Please allow pop-ups for this site.");
        return;
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (err) {
      console.error("Unable to print result", err);
      setError(
        err instanceof Error ? err.message : "Unable to load printable result.",
      );
    } finally {
      setPrintProcessing(false);
    }
  }, [selectedSession, selectedTerm]);

  return (
    <>
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
            {/* <h4 className="mb-3">Result Summary</h4> */}
            <div className="d-flex justify-content-end mb-3">
              <button
                type="button"
                className="btn btn-outline-primary d-inline-flex align-items-center justify-content-center"
                disabled={printProcessing}
                onClick={handlePrintResult}
                style={{
                  minWidth: 240,
                  padding: "0.95rem 2rem",
                  fontSize: "1.1rem",
                  fontWeight: 700,
                  borderRadius: "0.5rem",
                }}
              >
                {printProcessing ? "Loading…" : "Print Result"}
              </button>
            </div>
            {/* Results content intentionally hidden; print-only view requested. */}
          </div>
        ) : null}
      </div>
    </div>

    <footer className="footer-wrap-layout1" style={{ marginTop: "3rem" }}>
      <div className="copyright">
        © Copyrights <a href="#">Cyfamod Technologies</a> 2026. All rights
        reserved.
      </div>
    </footer>
    </>
  );
}
