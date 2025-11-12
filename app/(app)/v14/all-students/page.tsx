"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";
import { listSessions, type Session } from "@/lib/sessions";
import { listClasses, type SchoolClass } from "@/lib/classes";
import {
  listClassArms,
  type ClassArm,
} from "@/lib/classArms";
import {
  listClassArmSections,
  type ClassArmSection,
} from "@/lib/classArmSections";
import {
  listStudents,
  type StudentListResponse,
  type StudentSummary,
} from "@/lib/students";
import { resolveBackendUrl } from "@/lib/config";

const passthroughLoader: ImageLoader = ({ src }) => src;

interface FilterState {
  search: string;
  current_session_id: string;
  school_class_id: string;
  class_arm_id: string;
  class_section_id: string;
}

const initialFilters: FilterState = {
  search: "",
  current_session_id: "",
  school_class_id: "",
  class_arm_id: "",
  class_section_id: "",
};

export default function AllStudentsPage() {
  const [filters, setFilters] = useState<FilterState>(initialFilters);
  const [sortBy, setSortBy] = useState<string>("last_name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(10);

  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [classSections, setClassSections] = useState<ClassArmSection[]>([]);

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
        school_class_id: filters.school_class_id || undefined,
        class_arm_id: filters.class_arm_id || undefined,
        class_section_id: filters.class_section_id || undefined,
      });
      setData(response);
      setStudents(Array.isArray(response.data) ? response.data : []);
      setError(null);
    } catch (err) {
      console.error("Unable to load students", err);
      setError(
        err instanceof Error ? err.message : "Unable to load students.",
      );
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
    listClasses()
      .then(setClasses)
      .catch((err) => console.error("Unable to load classes", err));
  }, []);

  useEffect(() => {
    if (!filters.school_class_id) {
      setClassArms([]);
      setClassSections([]);
      setFilters((prev) => ({
        ...prev,
        class_arm_id: "",
        class_section_id: "",
      }));
      return;
    }

    listClassArms(filters.school_class_id)
      .then((arms) => {
        setClassArms(arms);
        if (!arms.find((arm) => `${arm.id}` === filters.class_arm_id)) {
          setFilters((prev) => ({
            ...prev,
            class_arm_id: "",
            class_section_id: "",
          }));
          setClassSections([]);
        }
      })
      .catch((err) =>
        console.error("Unable to load class arms for filter", err),
      );
  }, [filters.school_class_id, filters.class_arm_id, filters.class_section_id]);

  useEffect(() => {
    if (!filters.school_class_id || !filters.class_arm_id) {
      setClassSections([]);
      setFilters((prev) => ({
        ...prev,
        class_section_id: "",
      }));
      return;
    }

    listClassArmSections(filters.school_class_id, filters.class_arm_id)
      .then((sections) => {
        setClassSections(sections);
        if (!sections.find((section) => `${section.id}` === filters.class_section_id)) {
          setFilters((prev) => ({
            ...prev,
            class_section_id: "",
          }));
        }
      })
      .catch((err) =>
        console.error("Unable to load class sections for filter", err),
      );
  }, [filters.school_class_id, filters.class_arm_id, filters.class_section_id]);

  useEffect(() => {
    fetchStudents().catch((err) =>
      console.error("Unable to fetch students", err),
    );
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

  const summary = useMemo(() => {
    if (!data) {
      return "";
    }
    const from = data.from ?? 0;
    const to = data.to ?? 0;
    const total = data.total ?? 0;
    if (total === 0) {
      return "";
    }
    return `Showing ${from}-${to} of ${total} students`;
  }, [data]);

  const totalPages = data?.last_page ?? 1;

  const renderSortIndicator = (column: string) => {
    if (sortBy !== column) {
      return null;
    }
    return sortDirection === "asc" ? " ▲" : " ▼";
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Student Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>All Students</li>
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
              <h3>All Students</h3>
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
                  onClick={() => fetchStudents().catch(() => undefined)}
                >
                  <i className="fas fa-redo-alt text-orange-peel" />
                  Refresh
                </button>
              </div>
            </div>
          </div>

          <div className="row mb-3">
            <div className="col-lg-3 col-12 form-group">
              <label htmlFor="student-search">Search</label>
              <input
                id="student-search"
                type="text"
                className="form-control"
                placeholder="Search students..."
                value={filters.search}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    search: event.target.value,
                  }))
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    setPage(1);
                    fetchStudents().catch(() => undefined);
                  }
                }}
              />
            </div>
            <div className="col-lg-2 col-12 form-group">
              <label htmlFor="filter-session">Session</label>
              <select
                id="filter-session"
                className="form-control"
                value={filters.current_session_id}
                onChange={(event) => {
                  setPage(1);
                  setFilters((prev) => ({
                    ...prev,
                    current_session_id: event.target.value,
                  }));
                }}
              >
                <option value="">All Sessions</option>
                {sessions.map((session) => (
                  <option key={session.id} value={session.id}>
                    {session.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-2 col-12 form-group">
              <label htmlFor="filter-class">Class</label>
              <select
                id="filter-class"
                className="form-control"
                value={filters.school_class_id}
                onChange={(event) => {
                  setPage(1);
                  setFilters((prev) => ({
                    ...prev,
                    school_class_id: event.target.value,
                    class_arm_id: "",
                    class_section_id: "",
                  }));
                }}
              >
                <option value="">All Classes</option>
                {classes.map((_class) => (
                  <option key={_class.id} value={_class.id}>
                    {_class.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-2 col-12 form-group">
              <label htmlFor="filter-class-arm">Class Arm</label>
              <select
                id="filter-class-arm"
                className="form-control"
                value={filters.class_arm_id}
                onChange={(event) => {
                  setPage(1);
                  setFilters((prev) => ({
                    ...prev,
                    class_arm_id: event.target.value,
                    class_section_id: "",
                  }));
                }}
                disabled={!filters.school_class_id || classArms.length === 0}
              >
                <option value="">All Arms</option>
                {classArms.map((arm) => (
                  <option key={arm.id} value={arm.id}>
                    {arm.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-2 col-12 form-group">
              <label htmlFor="filter-class-section">Section</label>
              <select
                id="filter-class-section"
                className="form-control"
                value={filters.class_section_id}
                onChange={(event) => {
                  setPage(1);
                  setFilters((prev) => ({
                    ...prev,
                    class_section_id: event.target.value,
                  }));
                }}
                disabled={!filters.school_class_id || classSections.length === 0}
              >
                <option value="">All Sections</option>
                {classSections.map((section) => (
                  <option key={section.id} value={section.id}>
                    {section.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-1 col-12 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-outline-secondary w-100"
                onClick={() => {
                  setPage(1);
                  setFilters(initialFilters);
                  setClassArms([]);
                  setClassSections([]);
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div className="d-flex justify-content-between align-items-center mb-3">
            <div>
              <Link
                href="/v14/add-student"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              >
                Add Student
              </Link>
            </div>
            <div className="d-flex align-items-center">
              <span className="mr-2">Rows per page:</span>
              <select
                className="form-control"
                value={perPage}
                onChange={(event) => {
                  setPerPage(Number(event.target.value));
                  setPage(1);
                }}
              >
                {[10, 25, 50, 100].map((value) => (
                  <option key={value} value={value}>
                    {value}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th onClick={() => toggleSort("admission_no")} className="sortable">
                    Admission No{renderSortIndicator("admission_no")}
                  </th>
                  <th />
                  <th onClick={() => toggleSort("last_name")} className="sortable">
                    Name{renderSortIndicator("last_name")}
                  </th>
                  <th onClick={() => toggleSort("school_class_id")} className="sortable">
                    Class{renderSortIndicator("school_class_id")}
                  </th>
                  <th>Parent</th>
                  <th>Session</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={8} className="text-center">
                      Loading students…
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="text-center">
                      No students found.
                    </td>
                  </tr>
                ) : (
                  students.map((student) => {
                    const fullName = [student.first_name, student.middle_name, student.last_name]
                      .filter(Boolean)
                      .join(" ");
                    const className = student.school_class?.name ?? "N/A";
                    const armName =
                      student.class_arm?.name ??
                      student.school_class?.class_arm?.name ??
                      "";
                    const parentName = student.parent
                      ? `${student.parent.first_name ?? ""} ${student.parent.last_name ?? ""}`.trim() ||
                        student.parent.phone ||
                        "N/A"
                      : "N/A";
                    const sessionName = student.session?.name ?? "N/A";
                    const photoSrc = student.photo_url
                      ? resolveBackendUrl(student.photo_url)
                      : "/assets/img/figure/student.png";
                    return (
                      <tr key={student.id}>
                        <td>{student.admission_no ?? "N/A"}</td>
                        <td>
                          <Image
                            src={photoSrc}
                            alt={fullName || "Student photo"}
                            width={40}
                            height={40}
                            loader={passthroughLoader}
                            unoptimized
                            style={{
                              borderRadius: "50%",
                              objectFit: "cover",
                            }}
                          />
                        </td>
                        <td>{fullName || "N/A"}</td>
                        <td>
                          {className}
                          {armName ? ` - ${armName}` : ""}
                        </td>
                        <td>{parentName}</td>
                        <td>{sessionName}</td>
                        <td className="text-capitalize">
                          {student.status ?? "Active"}
                        </td>
                        <td>
                          <div className="d-flex gap-2">
                            <Link
                              href={`/v14/student-details?id=${student.id}`}
                              className="btn btn-sm btn-outline-primary mr-1"
                            >
                              View
                            </Link>
                            <Link
                              href={`/v14/edit-student?id=${student.id}`}
                              className="btn btn-sm btn-outline-secondary"
                            >
                              Edit
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="d-flex justify-content-between align-items-center mt-3">
            <div>{summary}</div>
            <div>
              <nav aria-label="Students pagination">
                <ul className="pagination mb-0">
                  <li className={`page-item ${page <= 1 ? "disabled" : ""}`}>
                    <button
                      type="button"
                      className="page-link"
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                      disabled={page <= 1}
                    >
                      «
                    </button>
                  </li>
                  {Array.from({ length: totalPages }).map((_, index) => {
                    const pageNumber = index + 1;
                    return (
                      <li
                        key={pageNumber}
                        className={`page-item ${pageNumber === page ? "active" : ""}`}
                      >
                        <button
                          type="button"
                          className="page-link"
                          onClick={() => setPage(pageNumber)}
                        >
                          {pageNumber}
                        </button>
                      </li>
                    );
                  })}
                  <li
                    className={`page-item ${
                      page >= totalPages ? "disabled" : ""
                    }`}
                  >
                    <button
                      type="button"
                      className="page-link"
                      onClick={() =>
                        setPage((prev) =>
                          Math.min(totalPages, prev + 1),
                        )
                      }
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
      </div>
    </>
  );
}
