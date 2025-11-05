"use client";

import { useCallback, useMemo } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";

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
  const { user, loading } = useAuth();

  const roleNames = useMemo(() => normalizeRoleNames(user), [user]);
  const isParent = roleNames.includes("parent");

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
        {[
          {
            icon: "flaticon-classmates",
            title: "Students",
            value: formatNumber(studentCount),
          },
          {
            icon: "flaticon-multiple-users-silhouette",
            title: "Teachers",
            value: formatNumber(teacherCount),
          },
          {
            icon: "flaticon-couple",
            title: "Parents",
            value: formatNumber(parentCount),
          },
        ].map((item) => (
          <div key={item.title} className="col-xl-3 col-sm-6 col-12">
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
                parents registered for your school. Keep the data up to date by
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
    </>
  );
}
