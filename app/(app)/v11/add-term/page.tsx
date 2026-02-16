"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { listSessions, type Session } from "@/lib/sessions";
import { createTerm, type TermPayload } from "@/lib/terms";

const TERM_NUMBER_OPTIONS = [
  { value: 1, label: "Term 1" },
  { value: 2, label: "Term 2" },
  { value: 3, label: "Term 3" },
] as const;

function toISODate(value: string) {
  if (!value) {
    return "";
  }
  const [year, month, day] = value.split("-");
  return `${year}-${month}-${day}`;
}

export default function AddTermPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [sessionId, setSessionId] = useState("");
  const [form, setForm] = useState<TermPayload>({
    name: "",
    term_number: 1,
    start_date: "",
    end_date: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    listSessions()
      .then((data) => {
        setSessions(data);
        if (data.length) {
          setSessionId(`${data[0].id}`);
        }
      })
      .catch((err) => {
        console.error("Unable to load sessions", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load sessions. Please try again.",
        );
      });
  }, []);

  const sessionOptions = useMemo(
    () =>
      sessions.map((session) => ({
        label: session.name,
        value: `${session.id}`,
      })),
    [sessions],
  );

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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

    try {
      setSubmitting(true);
      await createTerm(sessionId, {
        ...form,
        name: form.name.trim(),
        start_date: toISODate(form.start_date),
        end_date: toISODate(form.end_date),
      });
      router.push("/v11/all-terms");
    } catch (err) {
      console.error("Unable to create term", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create term. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Add Academic Term</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href="/v11/all-terms">All Terms</Link>
          </li>
          <li>Add Term</li>
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
              <h3>Create New Term</h3>
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
                  onChange={(event) => setSessionId(event.target.value)}
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
                  {TERM_NUMBER_OPTIONS.map((term) => (
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
                  {submitting ? "Saving…" : "Save Term"}
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
