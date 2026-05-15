"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { PermissionGate } from "@/components/PermissionGate";
import { PERMISSIONS } from "@/lib/permissionKeys";
import { listSessions, type Session } from "@/lib/sessions";
import {
  listStudents,
  type StudentListResponse,
  type StudentSummary,
} from "@/lib/students";
import { resolveBackendUrl } from "@/lib/config";

const passthroughLoader: ImageLoader = ({ src }) => src;

const EXIT_STATUSES = [
  { value: "graduated,withdrawn,inactive", label: "All Exit Types" },
  { value: "graduated", label: "Graduated" },
  { value: "withdrawn", label: "Withdrawn" },
  { value: "inactive", label: "Inactive" },
];

const STATUS_BADGE: Record<string, string> = {
  graduated: "badge badge-success",
  withdrawn: "badge badge-warning",
  inactive: "badge badge-secondary",
};

interface FilterState {
  search: string;
  current_session_id: string;
  status: string;
}

const initialFilters: FilterState = {
  search: "",
  current_session_id: "",
  status: "graduated,withdrawn,inactive",
};

export default function ExitedStudentsPage() {
  const { user } = useAuth();
  void user;
  const searchParams = useSearchParams();

  const perPageOptions = [10, 25, 50, 100];
  const initialPage = (() => {
    const parsed = Number(searchParams.get("page"));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1;
  })();
  const initialPerPage = (() => {
    const parsed = Number(searchParams.get("per_page"));
    return perPageOptions.includes(parsed) ? parsed : 25;
  })();

  const [filters, setFilters] = useState<FilterState>(() => ({
    search: searchParams.get("search") ?? "",
    current_session_id: searchParams.get("current_session_id") ?? "",
    status: searchParams.get("status") ?? "graduated,withdrawn,inactive",
  }));
  const [page, setPage] = useState(initialPage);
  const [perPage, setPerPage] = useState(initialPerPage);
  const [sortBy, setSortBy] = useState(searchParams.get("sortBy") || "last_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">(
    searchParams.get("sortDirection") === "desc" ? "desc" : "asc",
  );

  const [sessions, setSessions] = useState<Session[]>([]);
  const [data, setData] = useState<StudentListResponse | null>(null);
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const response = await listStudents({
        page,
        per_page: perPage,
        sortBy,
        sortDirection,
        search: filters.search || undefined,
        current_session_id: filters.current_session_id || undefined,
        status: filters.status || "graduated,withdrawn,inactive",
      });
      setData(response);
      setStudents(Array.isArray(response.data) ? response.data : []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load exit records.");
      setStudents([]);
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [filters, page, perPage, sortBy, sortDirection]);

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => console.error("Unable to load sessions", err));
  }, []);

  useEffect(() => {
    fetchStudents().catch(() => undefined);
  }, [fetchStudents]);

  const toggleSort = (column: string) => {
    setPage(1);
    if (sortBy === column) {
      setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const renderSortIndicator = (column: string) => {
    if (sortBy !== column) return null;
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  const summary = useMemo(() => {
    if (!data) return "";
    const from = data.from ?? 0;
    const to = data.to ?? 0;
    const total = data.total ?? 0;
    if (total === 0) return "";
    return `Showing ${from}–${to} of ${total} record${total === 1 ? "" : "s"}`;
  }, [data]);

  const totalPages = data?.last_page ?? 1;

  const buildStudentLink = useCallback(
    (basePath: string, studentId: number | string) => {
      const params = new URLSearchParams();
      params.set("id", String(studentId));
      if (filters.search.trim()) params.set("search", filters.search.trim());
      if (filters.current_session_id) params.set("current_session_id", filters.current_session_id);
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      return `${basePath}?${params.toString()}`;
    },
    [filters, page, perPage],
  );

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Student Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Exit Records</li>
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
              <h3>Exit Records</h3>
              <small className="text-muted">
                Graduated, withdrawn, and inactive students
              </small>
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
                <button
                  className="dropdown-item"
                  type="button"
                  onClick={() => fetchStudents().catch(() => undefined)}
                >
                  <i className="fas fa-redo-alt text-orange-peel" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="row mb-3">
            <div className="col-lg-4 col-12 form-group">
              <label htmlFor="exit-search">Search by name or admission number</label>
              <input
                id="exit-search"
                type="text"
                className="form-control"
                placeholder="e.g. John Doe or NC001/2024"
                value={filters.search}
                onChange={(e) =>
                  setFilters((prev) => ({ ...prev, search: e.target.value }))
                }
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setPage(1);
                    fetchStudents().catch(() => undefined);
                  }
                }}
              />
            </div>

            <div className="col-lg-3 col-12 form-group">
              <label htmlFor="exit-session">Last Session</label>
              <select
                id="exit-session"
                className="form-control"
                value={filters.current_session_id}
                onChange={(e) => {
                  setPage(1);
                  setFilters((prev) => ({ ...prev, current_session_id: e.target.value }));
                }}
              >
                <option value="">All Sessions</option>
                {sessions.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-3 col-12 form-group">
              <label htmlFor="exit-status">Exit Type</label>
              <select
                id="exit-status"
                className="form-control"
                value={filters.status}
                onChange={(e) => {
                  setPage(1);
                  setFilters((prev) => ({ ...prev, status: e.target.value }));
                }}
              >
                {EXIT_STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-2 col-12 d-flex align-items-end form-group">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setPage(1);
                  setFilters(initialFilters);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          {/* Rows per page + summary */}
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="d-flex align-items-center gap-2">
              <span className="mr-2">Rows per page:</span>
              <select
                className="form-control"
                style={{ width: "auto" }}
                value={perPage}
                onChange={(e) => {
                  setPerPage(Number(e.target.value));
                  setPage(1);
                }}
              >
                {perPageOptions.map((v) => (
                  <option key={v} value={v}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-muted small">{summary}</div>
          </div>

          {/* Table */}
          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>#</th>
                  <th
                    onClick={() => toggleSort("admission_no")}
                    className="sortable"
                  >
                    Admission No{renderSortIndicator("admission_no")}
                  </th>
                  <th />
                  <th
                    onClick={() => toggleSort("last_name")}
                    className="sortable"
                  >
                    Name{renderSortIndicator("last_name")}
                  </th>
                  <th>Last Class</th>
                  <th>Last Session</th>
                  <th>Exit Type</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center">
                      Loading…
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center">
                      No exit records found.
                    </td>
                  </tr>
                ) : (
                  students.map((student, index) => {
                    const fullName = [
                      student.first_name,
                      student.middle_name,
                      student.last_name,
                    ]
                      .filter(Boolean)
                      .join(" ");
                    const className = student.school_class?.name ?? "—";
                    const armName =
                      student.class_arm?.name ??
                      student.school_class?.class_arm?.name ??
                      "";
                    const sessionName = student.session?.name ?? "—";
                    const status = (student.status ?? "inactive").toLowerCase();
                    const badgeClass =
                      STATUS_BADGE[status] ?? "badge badge-secondary";
                    const photoSrc = student.photo_url
                      ? resolveBackendUrl(student.photo_url)
                      : "/assets/img/figure/student.png";

                    return (
                      <tr key={student.id}>
                        <td>
                          {(page - 1) * perPage + index + 1}
                        </td>
                        <td>{student.admission_no ?? "—"}</td>
                        <td>
                          <Image
                            src={photoSrc}
                            alt={fullName || "Student photo"}
                            width={40}
                            height={40}
                            loader={passthroughLoader}
                            unoptimized
                            style={{ borderRadius: "50%", objectFit: "cover" }}
                          />
                        </td>
                        <td>{fullName || "—"}</td>
                        <td>
                          {className}
                          {armName ? ` - ${armName}` : ""}
                        </td>
                        <td>{sessionName}</td>
                        <td>
                          <span className={badgeClass} style={{ textTransform: "capitalize" }}>
                            {status}
                          </span>
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Link
                              href={buildStudentLink("/v14/student-details", student.id)}
                              className="btn btn-sm btn-outline-primary mr-1"
                            >
                              View
                            </Link>
                            <PermissionGate permission={PERMISSIONS.STUDENTS_UPDATE}>
                              <Link
                                href={buildStudentLink("/v14/edit-student", student.id)}
                                className="btn btn-sm btn-outline-secondary"
                              >
                                Edit
                              </Link>
                            </PermissionGate>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="d-flex flex-column flex-md-row justify-content-between align-items-start align-items-md-center mt-3" style={{ gap: "0.75rem" }}>
            <div>{summary}</div>
            <nav aria-label="Exit records pagination">
              <ul className="pagination mb-0" style={{ flexWrap: "wrap" }}>
                <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page <= 1}
                  >
                    «
                  </button>
                </li>
                {Array.from({ length: totalPages }).map((_, i) => {
                  const p = i + 1;
                  return (
                    <li key={p} className={`page-item ${p === page ? "active" : ""}`}>
                      <button
                        type="button"
                        className="page-link"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </button>
                    </li>
                  );
                })}
                <li className={`page-item ${page >= totalPages ? "disabled" : ""}`}>
                  <button
                    type="button"
                    className="page-link"
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page >= totalPages}
                  >
                    »
                  </button>
                </li>
              </ul>
            </nav>
          </div>
        </div>
      </div>
    </>
  );
}
