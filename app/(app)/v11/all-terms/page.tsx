"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listSessions, type Session } from "@/lib/sessions";
import {
  deleteTerm,
  listTermsBySession,
  type Term,
} from "@/lib/terms";
import { useAuth } from "@/contexts/AuthContext";
import { PERMISSIONS } from "@/lib/permissionKeys";

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }
  const date = new Date(value);
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default function AllTermsPage() {
  const { hasPermission, user } = useAuth();
  
  // Check if user is admin (admins bypass permission checks)
  const isAdmin = useMemo(() => {
    const directRole = String((user as { role?: string | null })?.role ?? "").toLowerCase();
    if (directRole === "admin") {
      return true;
    }
    const roles = (user as { roles?: Array<{ name?: string | null }> })?.roles;
    if (Array.isArray(roles)) {
      return roles.some((role) => String(role?.name ?? "").toLowerCase() === "admin");
    }
    return false;
  }, [user]);

  const canCreateTerm = isAdmin || hasPermission(PERMISSIONS.TERMS_CREATE);
  const canUpdateTerm = isAdmin || hasPermission(PERMISSIONS.TERMS_UPDATE);
  const canDeleteTerm = isAdmin || hasPermission(PERMISSIONS.TERMS_DELETE);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listSessions()
      .then((data) => {
        setSessions(data);
        if (data.length) {
          setSelectedSessionId(`${data[0].id}`);
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

  const fetchTerms = useCallback(async (sessionId: string) => {
    setLoading(true);
    try {
      const data = await listTermsBySession(sessionId);
      setTerms(data);
    } catch (err) {
      console.error("Unable to load terms", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to load terms for this session.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedSessionId) {
      return;
    }
    fetchTerms(selectedSessionId).catch((err) =>
      console.error("Unable to fetch terms", err),
    );
  }, [selectedSessionId, fetchTerms]);

  const selectedSessionName = useMemo(() => {
    return (
      sessions.find((session) => `${session.id}` === selectedSessionId)?.name ??
      ""
    );
  }, [sessions, selectedSessionId]);

  const handleDelete = async (term: Term) => {
    if (
      !window.confirm(
        `Delete term "${term.name}" from session "${selectedSessionName}"?`,
      )
    ) {
      return;
    }
    try {
      await deleteTerm(term.id);
      await fetchTerms(selectedSessionId);
    } catch (err) {
      console.error("Unable to delete term", err);
      alert(
        err instanceof Error
          ? err.message
          : "Unable to delete term. Please try again.",
      );
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Academic Terms</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>All Terms</li>
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
              <h3>All Academic Terms</h3>
            </div>
            <div className="dropdown">
              <a
                className="dropdown-toggle"
                href="#"
                role="button"
                data-toggle="dropdown"
                aria-expanded="false"
              >
                ...
              </a>

              <div className="dropdown-menu dropdown-menu-right">
                <button className="dropdown-item" type="button">
                  <i className="fas fa-times text-orange-red" />
                  Close
                </button>
                <button
                  className="dropdown-item"
                  type="button"
                  onClick={() => {
                    if (selectedSessionId) {
                      setLoading(true);
                      fetchTerms(selectedSessionId).catch((err) => {
                        console.error("Unable to refresh terms", err);
                        alert(
                          err instanceof Error
                            ? err.message
                            : "Unable to refresh terms. Please try again.",
                        );
                      });
                    }
                  }}
                >
                  <i className="fas fa-redo-alt text-orange-peel" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-lg-6 col-12 form-group">
              <label htmlFor="session-select-filter">Select Session</label>
              <select
                id="session-select-filter"
                className="form-control"
                value={selectedSessionId}
                onChange={(event) => setSelectedSessionId(event.target.value)}
              >
                <option value="">Choose session</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-6 col-12 d-flex align-items-end justify-content-end">
              {canCreateTerm && (
                <Link
                  href="/v11/add-term"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                >
                  Add New Term
                </Link>
              )}
            </div>
          </div>

          <div className="table-responsive">
            <table className="table display data-table text-nowrap">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Slot</th>
                  <th>Term</th>
                  <th>Session</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {!selectedSessionId ? (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Select a session to view its terms.
                    </td>
                  </tr>
                ) : loading ? (
                  <tr>
                    <td colSpan={7} className="text-center">
                      Loading terms…
                    </td>
                  </tr>
                ) : terms.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center">
                      No terms found for this session.
                    </td>
                  </tr>
                ) : (
                  terms.map((term, index) => (
                    <tr key={term.id}>
                      <td>{index + 1}</td>
                      <td>{term.term_number ?? "—"}</td>
                      <td>{term.name}</td>
                      <td>{selectedSessionName || "—"}</td>
                      <td>{formatDate(term.start_date)}</td>
                      <td>{formatDate(term.end_date)}</td>
                      <td>
                        <div className="d-flex gap-2">
                          {canUpdateTerm && (
                            <Link
                              className="btn btn-sm btn-outline-primary"
                              href={`/v11/edit-term?id=${term.id}`}
                            >
                              Edit
                            </Link>
                          )}
                          {canDeleteTerm && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              type="button"
                              onClick={() => handleDelete(term)}
                            >
                              Delete
                            </button>
                          )}
                          {!canUpdateTerm && !canDeleteTerm && (
                            <span className="text-muted">No actions</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <footer className="footer-wrap-layout1">
        <div className="copyright">
          © Copyrights <a href="#">Cyfamod Technologies</a> 2026. All rights
          reserved.
        </div>
      </footer>
    </>
  );
}
