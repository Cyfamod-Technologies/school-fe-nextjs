"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchTeacherDashboard,
  type TeacherAssignmentSummary,
  type TeacherDashboardResponse,
} from "@/lib/staff";
import { fetchSchoolContext, type SchoolContext } from "@/lib/schoolContext";
import { useAuth } from "@/contexts/AuthContext";
import { isTeacherUser } from "@/lib/roleChecks";

const iconClasses = [
  "flaticon-classmates",
  "flaticon-books",
  "flaticon-open-book",
  "flaticon-maths-class-materials-cross-of-a-pencil-and-a-ruler",
];

const formatLabel = (label: string | null | undefined): string =>
  label && label.trim().length > 0 ? label : "Not specified";

export default function StaffDashboardPage() {
  const { user, hasPermission } = useAuth();
  const [data, setData] = useState<TeacherDashboardResponse | null>(null);
  const [schoolContext, setSchoolContext] = useState<SchoolContext | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const isTeacher = isTeacherUser(user);
  const canViewDashboard = isTeacher;

  useEffect(() => {
    if (!canViewDashboard) {
      setLoading(false);
      return;
    }

    let isMounted = true;
    setLoading(true);
    setError(null);

    void Promise.all([fetchTeacherDashboard(), fetchSchoolContext()])
      .then(([dashboard, context]) => {
        if (!isMounted) {
          return;
        }
        setData(dashboard);
        setSchoolContext(context);
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        console.error("Unable to load staff dashboard", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load teacher dashboard. Please try again.",
        );
        setData(null);
        setSchoolContext(null);
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [canViewDashboard]);

  const assignments = data?.assignments ?? [];

  const teacherRoleLabel = useMemo(() => {
    if (!data) {
      return "Teacher";
    }
    const direct = data.teacher.role;
    if (typeof direct === "string" && direct.trim().length > 0) {
      return direct;
    }
    const userRole = (data.teacher.user as { role?: unknown } | undefined)?.role;
    if (typeof userRole === "string" && userRole.trim().length > 0) {
      return userRole;
    }
    return "Teacher";
  }, [data]);

  const summaryCards = useMemo(() => {
    if (!data) {
      return [];
    }

    return [
      {
        label: "Assigned Classes",
        value: data.stats.classes,
        icon: "flaticon-multiple-users-silhouette",
        accent: "bg-light-green",
      },
      {
        label: "Subjects",
        value: data.stats.subjects,
        icon: "flaticon-open-book",
        accent: "bg-skyblue",
      },
      {
        label: "Profile",
        value: formatLabel(teacherRoleLabel),
        icon: "flaticon-user",
        accent: "bg-yellow",
        isText: true,
      },
    ];
  }, [data]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Staff Dashboard</h3>
        <ul>
          <li>
            <Link href="/v25/staff-dashboard">Home</Link>
          </li>
          <li>Staff Dashboard</li>
        </ul>
      </div>

      {!canViewDashboard ? (
        <div className="alert alert-warning" role="alert">
          You do not have permission to view the staff dashboard. Please contact your
          administrator if you need access.
        </div>
      ) : null}

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <div className="card-body text-center">
            <div className="spinner-border text-primary mb-3" role="status" aria-hidden="true" />
            <p className="text-muted mb-0">Loading staff dashboard…</p>
          </div>
        </div>
      ) : null}

      {!loading && data ? (
        <>
          {schoolContext ? (
            <div className="row mb-3">
              <div className="col-12">
                <div className="alert alert-secondary d-flex justify-content-between align-items-center mb-0" role="status">
                  <div>
                    <strong>Current Session:</strong>{" "}
                    {schoolContext.current_session?.name ?? "Not set"}
                    {" · "}
                    <strong>Current Term:</strong>{" "}
                    {schoolContext.current_term?.name ?? "Not set"}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          <div className="row">
            {summaryCards.map((card, index) => (
              <div className="col-lg-4 col-md-6 col-12" key={card.label}>
                <div className={`dashboard-summery-one ${card.accent}`}>
                  <div className="row align-items-center">
                    <div className="col-6">
                      <div className="item-icon">
                        <i className={card.icon} aria-hidden="true" />
                      </div>
                    </div>
                    <div className="col-6 text-right">
                      {card.isText ? (
                        <div className="item-title">{card.value}</div>
                      ) : (
                        <>
                          <div className="item-number">
                            <span>{card.value}</span>
                          </div>
                          <div className="item-title">{card.label}</div>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="row mt-4">
            <div className="col-xl-4 col-lg-5 col-12">
              <div className="card height-auto">
                <div className="card-body">
                  <div className="heading-layout1 mb-3">
                    <div className="item-title">
                      <h3>Teacher Profile</h3>
                    </div>
                    <Link
                      href="/v25/profile"
                      className="btn btn-sm btn-outline-primary"
                    >
                      Manage Profile
                    </Link>
                  </div>
                  <ul className="list-group list-group-flush small">
                    <li className="list-group-item d-flex justify-content-between align-items-center">
                      <span>Name</span>
                      <span className="font-weight-bold text-dark">
                        {data.teacher.full_name ?? data.teacher.user?.name ?? "—"}
                      </span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center">
                      <span>Email</span>
                      <span className="text-muted">{data.teacher.email ?? data.teacher.user?.email ?? "—"}</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center">
                      <span>Phone</span>
                      <span className="text-muted">{data.teacher.phone ?? data.teacher.user?.phone ?? "—"}</span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center">
                      <span>Role</span>
                      <span className="text-muted">
                        {formatLabel(teacherRoleLabel)}
                      </span>
                    </li>
                    <li className="list-group-item d-flex justify-content-between align-items-center">
                      <span>Address</span>
                      <span className="text-muted text-right">
                        {formatLabel(data.teacher.address)}
                      </span>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="col-xl-8 col-lg-7 col-12">
              <div className="card height-auto">
                <div className="card-body">
                  <div className="heading-layout1 mb-3">
                    <div className="item-title">
                      <h3>Assigned Classes & Subjects</h3>
                    </div>
                    <div className="dropdown">
                      <a
                        className="dropdown-toggle"
                        href="#"
                        role="button"
                        data-toggle="dropdown"
                        aria-expanded="false"
                      >
                        
                      </a>
                      <div className="dropdown-menu dropdown-menu-right">
                        <Link className="dropdown-item" href="/v17/assign-teachers">
                          <i className="fas fa-retweet text-orange-peel" />
                          Manage Assignments
                        </Link>
                      </div>
                    </div>
                  </div>

                  {assignments.length === 0 ? (
                    <div className="alert alert-info mb-0" role="alert">
                      No classes have been assigned to you yet. Please contact your administrator if this is unexpected.
                    </div>
                  ) : (
                    <div className="row">
                      {assignments.map((assignment, index) => (
                        <AssignmentCard
                          assignment={assignment}
                          key={assignment.context_key}
                          iconClass={iconClasses[index % iconClasses.length]}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </>
  );
}

function AssignmentCard({
  assignment,
  iconClass,
}: {
  assignment: TeacherAssignmentSummary;
  iconClass: string;
}) {
  return (
    <div className="col-md-6 mb-3">
      <div className="card dashboard-card-one">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title d-flex align-items-center">
              <span className="mr-2 text-primary">
                <i className={iconClass} aria-hidden="true" />
              </span>
              <div>
                <h5 className="mb-0">
                  {assignment.class?.name ?? "Unassigned Class"}
                </h5>
                <small className="text-muted">
                  {assignment.class_arm?.name ?? "General"} •{" "}
                  {assignment.class_section?.name ?? "All Sections"}
                </small>
              </div>
            </div>
          </div>
          <div className="text-muted small mb-2">
            Session: {assignment.session?.name ?? "—"}
          </div>
          <div>
            <strong className="d-block mb-2">Subjects</strong>
            {assignment.subjects.length === 0 ? (
              <span className="badge badge-light">No subjects linked</span>
            ) : (
              <ul className="list-unstyled mb-0">
                {assignment.subjects.map((subject) => (
                  <li key={subject.id} className="d-flex align-items-center mb-1">
                    <span className="badge badge-primary mr-2">
                      {subject.code ?? "SUB"}
                    </span>
                    <span>{subject.name ?? "Unnamed Subject"}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
