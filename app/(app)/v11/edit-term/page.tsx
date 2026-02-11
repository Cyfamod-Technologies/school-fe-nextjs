"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { listSessions, type Session } from "@/lib/sessions";
import {
  getTerm,
  updateTerm,
  type UpdateTermPayload,
} from "@/lib/terms";

const TERM_NUMBER_OPTIONS = [
  { value: 1, label: "Term 1" },
  { value: 2, label: "Term 2" },
  { value: 3, label: "Term 3" },
] as const;

function formatDateInput(value?: string | null) {
  if (!value) {
    return "";
  }
  const date = new Date(value);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const toISODate = (value: string) => value || "";

export default function EditTermPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const termId = searchParams.get("id");

  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [form, setForm] = useState<UpdateTermPayload>({
    name: "",
    term_number: 1,
    session: "",
    start_date: "",
    end_date: "",
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!termId) {
      router.replace("/v11/all-terms");
      return;
    }

    Promise.all([listSessions(), getTerm(termId)])
      .then(([sessionsResponse, term]) => {
        setSessions(sessionsResponse);
        if (!term) {
          throw new Error("Unable to load term details.");
        }

        const sessionValue =
          `${term.session_id ?? term.session ?? ""}` || "";
        const resolvedTermNumber =
          typeof term.term_number === "number" && term.term_number > 0
            ? term.term_number
            : 1;
        setSessionId(sessionValue);
        setForm({
          name: term.name ?? "",
          term_number: resolvedTermNumber,
          session: sessionValue,
          start_date: formatDateInput(term.start_date),
          end_date: formatDateInput(term.end_date),
        });
      })
      .catch((err) => {
        console.error("Unable to load term", err);
        setError(
          err instanceof Error ? err.message : "Unable to load term details.",
        );
      })
      .finally(() => setLoading(false));
  }, [router, termId]);

  const sessionOptions = useMemo(
    () =>
      sessions.map((session) => ({
        label: session.name,
        value: `${session.id}`,
      })),
    [sessions],
  );

  const termNumberOptions = useMemo(() => {
    const options = [...TERM_NUMBER_OPTIONS];
    if (!options.some((option) => option.value === form.term_number)) {
      options.push({
        value: form.term_number,
        label: `Term ${form.term_number}`,
      });
    }
    return options;
  }, [form.term_number]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!termId) {
      return;
    }

    setError(null);

    if (!sessionId) {
      setError("Please select a session.");
      return;
    }

    if (!form.name.trim()) {
      setError("Please enter a term name.");
      return;
    }

    if (!Number.isInteger(form.term_number) || form.term_number < 1) {
      setError("Please select a valid term slot.");
      return;
    }

    setSubmitting(true);
    try {
      await updateTerm(termId, {
        name: form.name.trim(),
        term_number: form.term_number,
        session: sessionId,
        start_date: toISODate(form.start_date),
        end_date: toISODate(form.end_date),
      });
      router.push("/v11/all-terms");
    } catch (err) {
      console.error("Unable to update term", err);
      setError(
        err instanceof Error ? err.message : "Unable to update term.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!termId) {
    return null;
  }

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Edit Academic Term</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href="/v11/all-terms">All Terms</Link>
          </li>
          <li>Edit Term</li>
        </ul>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Update Term Details</h3>
            </div>
          </div>

          <form className="new-added-form" onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-xl-6 col-lg-6 col-12 form-group">
                <label htmlFor="session-select">Session *</label>
                <select
                  id="session-select"
                  className="form-control"
                  value={sessionId}
                  onChange={(event) => {
                    const value = event.target.value;
                    setSessionId(value);
                    setForm((prev) => ({
                      ...prev,
                      session: value,
                    }));
                  }}
                  required
                >
                  <option value="">Select session</option>
                  {sessionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-6 col-lg-6 col-12 form-group">
                <label htmlFor="term-number">Term Slot *</label>
                <select
                  id="term-number"
                  className="form-control"
                  value={form.term_number}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      term_number: Number.parseInt(event.target.value, 10) || 1,
                    }))
                  }
                  required
                >
                  {termNumberOptions.map((term) => (
                    <option key={term.value} value={term.value}>
                      {term.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-xl-6 col-lg-6 col-12 form-group">
                <label htmlFor="term-name">Term Name *</label>
                <input
                  id="term-name"
                  type="text"
                  className="form-control"
                  value={form.name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, name: event.target.value }))
                  }
                  placeholder="e.g. Autumn Term"
                  maxLength={100}
                  required
                />
              </div>
              <div className="col-xl-6 col-lg-6 col-12 form-group">
                <label htmlFor="start-date">Start Date *</label>
                <input
                  id="start-date"
                  type="date"
                  className="form-control"
                  value={form.start_date}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      start_date: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="col-xl-6 col-lg-6 col-12 form-group">
                <label htmlFor="end-date">End Date *</label>
                <input
                  id="end-date"
                  type="date"
                  className="form-control"
                  value={form.end_date}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      end_date: event.target.value,
                    }))
                  }
                  required
                />
              </div>
              <div className="col-12 form-group mg-t-8">
                <button
                  type="submit"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save Changes"}
                </button>
                <Link
                  href="/v11/all-terms"
                  className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
