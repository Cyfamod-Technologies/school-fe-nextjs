"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { getSession, updateSession } from "@/lib/sessions";

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

function toISO(value: string) {
  if (!value) {
    return "";
  }
  const [year, month, day] = value.split("-");
  return `${year}-${month}-${day}`;
}

export default function EditSessionPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");

  const [formState, setFormState] = useState({
    name: "",
    start_date: "",
    end_date: "",
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      router.replace("/v11/all-sessions");
      return;
    }

    setLoading(true);
    setError(null);

    getSession(sessionId)
      .then((session) => {
        setFormState({
          name: session.name ?? "",
          start_date: formatDateInput(session.start_date),
          end_date: formatDateInput(session.end_date),
        });
      })
      .catch((err) => {
        setError(
          err instanceof Error ? err.message : "Unable to load session.",
        );
      })
      .finally(() => setLoading(false));
  }, [router, sessionId]);

  const updateField = (key: "name" | "start_date" | "end_date", value: string) => {
    setFormState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId) {
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await updateSession(sessionId, {
        name: formState.name,
        start_date: toISO(formState.start_date),
        end_date: toISO(formState.end_date),
      });
      window.alert("Session updated successfully!");
      router.push("/v11/all-sessions");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to update session.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!sessionId) {
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
        <h3>Edit Academic Session</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href="/v11/all-sessions">All Sessions</Link>
          </li>
          <li>Edit Session</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Update Session Details</h3>
            </div>
          </div>

          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}

          <form id="edit-session-form" onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-xl-6 col-lg-6 col-12 form-group">
                <label htmlFor="session-name">Session Name *</label>
                <input
                  id="session-name"
                  type="text"
                  className="form-control"
                  required
                  value={formState.name}
                  onChange={(event) => updateField("name", event.target.value)}
                />
              </div>
              <div className="col-xl-3 col-lg-3 col-12 form-group">
                <label htmlFor="start-date">Start Date *</label>
                <input
                  id="start-date"
                  type="date"
                  className="form-control"
                  required
                  value={formState.start_date}
                  onChange={(event) =>
                    updateField("start_date", event.target.value)
                  }
                />
              </div>
              <div className="col-xl-3 col-lg-3 col-12 form-group">
                <label htmlFor="end-date">End Date *</label>
                <input
                  id="end-date"
                  type="date"
                  className="form-control"
                  required
                  value={formState.end_date}
                  onChange={(event) =>
                    updateField("end_date", event.target.value)
                  }
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
                  href="/v11/all-sessions"
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
