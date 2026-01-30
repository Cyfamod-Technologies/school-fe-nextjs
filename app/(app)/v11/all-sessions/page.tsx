"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  listSessions,
  removeSession,
  type Session,
} from "@/lib/sessions";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionGate } from "@/components/PermissionGate";
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

export default function AllSessionsPage() {
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

  const canCreateSession = isAdmin || hasPermission(PERMISSIONS.SESSIONS_CREATE);
  const canUpdateSession = isAdmin || hasPermission(PERMISSIONS.SESSIONS_UPDATE);
  const canDeleteSession = isAdmin || hasPermission(PERMISSIONS.SESSIONS_DELETE);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await listSessions();
      setSessions(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to load sessions.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSessions().catch((err) =>
      console.error("Unable to load sessions", err),
    );
  }, [fetchSessions]);

  const onDelete = async (session: Session) => {
    if (!window.confirm(`Delete session "${session.name}"?`)) {
      return;
    }
    try {
      await removeSession(session.id);
      await fetchSessions();
    } catch (err) {
      alert(
        err instanceof Error ? err.message : "Unable to delete session.",
      );
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Academic Sessions</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>All Sessions</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>All Academic Sessions</h3>
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
                <button className="dropdown-item" type="button" onClick={fetchSessions}>
                  <i className="fas fa-redo-alt text-orange-peel" />
                  Refresh
                </button>
              </div>
            </div>
          </div>
          <div className="text-right mb-3">
            {canCreateSession && (
              <Link
                href="/v11/add-session"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              >
                Add New Session
              </Link>
            )}
          </div>

          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table display data-table text-nowrap">
              <thead>
                <tr>
                  <th>#</th>
                  <th>Session Name</th>
                  <th>Start Date</th>
                  <th>End Date</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={5} className="text-center">
                      Loading sessions…
                    </td>
                  </tr>
                ) : sessions.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center">
                      No sessions found.
                    </td>
                  </tr>
                ) : (
                  sessions.map((session, index) => (
                    <tr key={session.id}>
                      <td>{index + 1}</td>
                      <td>{session.name}</td>
                      <td>{formatDate(session.start_date)}</td>
                      <td>{formatDate(session.end_date)}</td>
                      <td>
                        <div className="d-flex gap-2">
                          {canUpdateSession && (
                            <Link
                              className="btn btn-sm btn-outline-primary"
                              href={`/v11/edit-session?id=${session.id}`}
                            >
                              Edit
                            </Link>
                          )}
                          {canDeleteSession && (
                            <button
                              className="btn btn-sm btn-outline-danger"
                              type="button"
                              onClick={() => onDelete(session)}
                            >
                              Delete
                            </button>
                          )}
                          {!canUpdateSession && !canDeleteSession && (
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
