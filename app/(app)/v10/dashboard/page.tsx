"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { isAdminUser } from "@/lib/roleChecks";
import { listStudents } from "@/lib/students";

function normalizeRoleNames(user: ReturnType<typeof useAuth>["user"]): string[] {
  const roles: string[] = [];

  if (user) {
    if (typeof user.role === "string") {
      roles.push(user.role);
    }

    const rawRoles = (user as Record<string, unknown>)?.roles;
    if (Array.isArray(rawRoles)) {
      rawRoles.forEach((role) => {
        if (typeof role === "string") {
          roles.push(role);
        } else if (
          role &&
          typeof role === "object" &&
          "name" in role &&
          typeof (role as { name?: unknown }).name === "string"
        ) {
          roles.push((role as { name: string }).name);
        }
      });
    }
  }

  return roles
    .map((role) => role.toLowerCase())
    .filter((role, index, self) => role && self.indexOf(role) === index);
}

export default function DashboardPage() {
  const { user, loading, schoolContext } = useAuth();
  const [sessionStudentSummary, setSessionStudentSummary] = useState<{
    sessionId: string;
    total: number;
  } | null>(null);

  const roleNames = useMemo(() => normalizeRoleNames(user), [user]);
  const isParent = roleNames.includes("parent");
  const isAdmin = isAdminUser(user);

  const formatNumber = useCallback((value: number | undefined) => {
    if (typeof value !== "number" || Number.isNaN(value)) {
      return "0";
    }
    return value.toLocaleString();
  }, []);

  const linkedStudents = useMemo(() => {
    if (!user) {
      return 0;
    }
    if (typeof user.linked_students_count === "number") {
      return user.linked_students_count;
    }
    if (Array.isArray(user.parents)) {
      return user.parents.reduce<number>(
        (total, parent) => total + (parent?.students_count ?? 0),
        0,
      );
    }
    return 0;
  }, [user]);

  const studentCount = user?.student_count ?? 0;
  const parentCount = user?.parent_count ?? 0;
  const teacherCount = user?.teacher_count ?? 0;

  useEffect(() => {
    let cancelled = false;
    const sessionId = schoolContext.current_session_id;

    if (!sessionId) {
      return;
    }

    listStudents({
      page: 1,
      per_page: 1,
      current_session_id: String(sessionId),
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const total =
          typeof response.total === "number"
            ? response.total
            : Array.isArray(response.data)
              ? response.data.length
              : 0;
        setSessionStudentSummary({
          sessionId: String(sessionId),
          total,
        });
      })
      .catch((error) => {
        console.error("Unable to load current session student count", error);
        if (!cancelled) {
          setSessionStudentSummary({
            sessionId: String(sessionId),
            total: 0,
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [schoolContext.current_session_id]);

  const currentSessionName = schoolContext.current_session?.name?.trim();
  const currentTermName = schoolContext.current_term?.name?.trim();
  const currentSessionId = schoolContext.current_session_id
    ? String(schoolContext.current_session_id)
    : "";
  const sessionCountLoading =
    Boolean(currentSessionId) &&
    sessionStudentSummary?.sessionId !== currentSessionId;
  const sessionCardValue = !schoolContext.current_session_id
    ? "—"
    : sessionCountLoading
      ? "..."
      : formatNumber(sessionStudentSummary?.total ?? 0);

  const currentSessionStudentsHref = schoolContext.current_session_id
    ? `/v14/all-students?current_session_id=${encodeURIComponent(String(schoolContext.current_session_id))}`
    : "/v14/all-students";
  const sessionPerformanceParams = new URLSearchParams();
  if (schoolContext.current_session_id) {
    sessionPerformanceParams.set("session_id", String(schoolContext.current_session_id));
  }
  sessionPerformanceParams.set("term_id", "all");
  sessionPerformanceParams.set("subject_id", "all");
  const sessionPerformanceHref = `/v14/view-performance?${sessionPerformanceParams.toString()}`;

  const termPerformanceParams = new URLSearchParams();
  if (schoolContext.current_session_id) {
    termPerformanceParams.set("session_id", String(schoolContext.current_session_id));
  }
  if (schoolContext.current_term_id) {
    termPerformanceParams.set("term_id", String(schoolContext.current_term_id));
  }
  termPerformanceParams.set("subject_id", "all");
  const termPerformanceHref = `/v14/view-performance?${termPerformanceParams.toString()}`;

  const adminSummaryCards = [
    {
      key: "current-session-students",
      icon: "flaticon-calendar",
      title: currentSessionName ? `${currentSessionName} Students` : "Current Session Students",
      value: sessionCardValue,
      description: currentSessionName
        ? undefined
        : "Set a current session in School Settings to track this total.",
      href: currentSessionStudentsHref,
      actionLabel: "View students",
    },
    {
      key: "total-students",
      icon: "flaticon-classmates",
      title: "Total-Students",
      value: formatNumber(studentCount),
      href: "/v14/all-students",
      actionLabel: "View students",
    },
    {
      key: "total-teachers",
      icon: "flaticon-multiple-users-silhouette",
      title: "Teachers",
      value: formatNumber(teacherCount),
      href: "/v15/all-staff",
      actionLabel: "View staff",
    },
    {
      key: "total-parents",
      icon: "flaticon-couple",
      title: "Parents",
      value: formatNumber(parentCount),
      href: "/v13/all-parents",
      actionLabel: "View parents",
    },
    ...(isAdmin
      ? [
          {
            key: "best-student-term",
            icon: "flaticon-classmates",
            title: "Best Student · Term",
            value: currentTermName || "Current Term",
            description: "View the top-performing students for this term.",
            href: termPerformanceHref,
            actionLabel: "View ranking",
          },
          {
            key: "best-student-session",
            icon: "flaticon-calendar",
            title: "Best Student · Session",
            value: currentSessionName || "Current Session",
            description: "View the top-performing students across the session.",
            href: sessionPerformanceHref,
            actionLabel: "View ranking",
          },
        ]
      : []),
  ];

  const parentDashboard = (
    <div className="row gutters-20">
      <div className="col-xl-3 col-sm-6 col-12">
        <div className="dashboard-summery-one mg-b-20">
          <div className="row align-items-center">
            <div className="col-6">
              <div className="item-icon bg-light-green">
                <i className="flaticon-classmates text-green" />
              </div>
            </div>
            <div className="col-6">
              <div className="item-content">
                <div className="item-title">Students Linked</div>
                <div className="item-number">
                  <span>{linkedStudents}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="col-12">
        <div className="card height-auto">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>Your Learners</h3>
              </div>
            </div>
            <p className="text-muted mb-0">
              The students linked to your account appear here. If you expected a
              learner and do not see them, please contact the school
              administrator to connect the student to your profile.
            </p>
          </div>
        </div>
      </div>
    </div>
  );

  const adminDashboard = (
    <>
      <div className="row gutters-20">
        {adminSummaryCards.map((item) => (
          <div key={item.key ?? item.title} className="col-xl-3 col-sm-6 col-12">
            <div className="dashboard-summery-one mg-b-20">
              <div className="row align-items-center">
                <div className="col-6">
                  <div className="item-icon bg-light-green ">
                    <i className={item.icon} />
                  </div>
                </div>
                <div className="col-6">
                  <div className="item-content">
                    <div className="item-title">{item.title}</div>
                    <div className="item-number">
                      <span>{item.value}</span>
                    </div>
                    {item.description ? (
                      <small className="d-block text-muted mt-1">
                        {item.description}
                      </small>
                    ) : null}
                    <Link href={item.href} className="dashboard-card-link">
                      {item.actionLabel}
                      <span aria-hidden="true">→</span>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row gutters-20">
        <div className="col-12 col-xl-8 col-6-xxxl">
          <div className="card dashboard-card-one pd-b-20">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Quick Stats</h3>
                </div>
              </div>
              <p className="text-muted mb-0">
                These counts reflect the total number of students, teachers, and
                parents registered in your school. Keep the data up to date by
                managing enrolments and staff profiles.
              </p>
            </div>
          </div>
        </div>
        <div className="col-12 col-xl-4 col-3-xxxl">
          <div className="card dashboard-card-three pd-b-20">
            <div className="card-body">
              <div className="heading-layout1 mg-b-17">
                <div className="item-title">
                  <h3>Tips</h3>
                </div>
              </div>
              <p className="text-muted mb-0">
                Need to update these figures? Add new students, onboard teachers,
                or invite parents from the relevant management pages.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  );

  if (loading && !user) {
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
        <h3>{isParent ? "Parent Dashboard" : "Admin Dashboard"}</h3>
        <ul>
          <li>
            <Link href="/">Home</Link>
          </li>
          <li>{isParent ? "Parent" : "Admin"}</li>
        </ul>
      </div>

      {isParent ? parentDashboard : adminDashboard}

      <footer className="footer-wrap-layout1" style={{ marginTop: "3rem" }}>
        <div className="copyright">
          © Copyrights <a href="#">Cyfamod Technologies</a> 2026. All rights
          reserved.
        </div>
      </footer>

      <style jsx global>{`
        .dashboard-card-link {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          margin-top: 8px;
          padding: 4px 9px;
          border: 1px solid #d7e2ee;
          border-radius: 4px;
          background: #ffffff;
          color: #0d5ca6;
          font-size: 11px;
          font-weight: 700;
          line-height: 1.2;
          transition: background 0.2s ease, border-color 0.2s ease, color 0.2s ease;
        }

        .dashboard-card-link:hover {
          border-color: #0d5ca6;
          background: #0d5ca6;
          color: #ffffff;
        }
      `}</style>
    </>
  );
}
