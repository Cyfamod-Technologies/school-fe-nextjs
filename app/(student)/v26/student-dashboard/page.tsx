"use client";

import { useStudentAuth } from "@/contexts/StudentAuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useEffect } from "react";

export default function StudentDashboardHome() {
  const { student, loading } = useStudentAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !student) {
      router.push("/student-login");
    }
  }, [loading, student, router]);

  if (loading || !student) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-muted mb-0">Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  const subjects = Array.isArray(student.subjects) ? student.subjects : [];

  const summaryCards = useMemo(
    () => [
      {
        label: "Current Session",
        value: student.current_session?.name ?? "Not set",
        icon: "flaticon-calendar",
        accent: "bg-light-green",
      },
      {
        label: "Current Term",
        value: student.current_term?.name ?? "Not set",
        icon: "flaticon-open-book",
        accent: "bg-skyblue",
      },
      {
        label: "Class",
        value: student.school_class?.name ?? "Not assigned",
        icon: "flaticon-classmates",
        accent: "bg-yellow",
      },
      {
        label: "Class Arm",
        value: student.class_arm?.name ?? "General",
        icon: "flaticon-multiple-users-silhouette",
        accent: "bg-light-magenta",
      },
      {
        label: "Subjects",
        value: subjects.length,
        icon: "flaticon-books",
        accent: "bg-light-sea-green",
      },
    ],
    [student, subjects.length],
  );

  const profileItems = [
    { label: "Admission No", value: student.admission_no },
    { label: "Session", value: student.current_session?.name ?? "Not set" },
    { label: "Term", value: student.current_term?.name ?? "Not set" },
    { label: "Class", value: student.school_class?.name ?? "Not set" },
    { label: "Class Arm", value: student.class_arm?.name ?? "Not set" },
  ];

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Student Dashboard</h3>
        <ul>
          <li>
            <Link href="/v26/student-dashboard">Home</Link>
          </li>
          <li>Student Dashboard</li>
        </ul>
      </div>

      <div className="row">
        {summaryCards.map((card) => (
          <div className="col-xl-2 col-lg-3 col-md-4 col-6 mb-4" key={card.label}>
            <div className={`dashboard-summery-one ${card.accent}`}>
              <div className="row align-items-center">
                <div className="col-6">
                  <div className="item-icon">
                    <i className={card.icon} aria-hidden="true" />
                  </div>
                </div>
                <div className="col-6 text-right">
                  <div className="item-number">
                    <span>{card.value}</span>
                  </div>
                  <div className="item-title">{card.label}</div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row mt-3">
        <div className="col-xl-4 col-lg-5 col-12 mb-4">
          <div className="card height-auto">
            <div className="card-body">
              <div className="heading-layout1 mb-3">
                <div className="item-title">
                  <h3>My Profile</h3>
                </div>
                <Link
                  href="/v26/student-dashboard/bio-data"
                  className="btn btn-sm btn-outline-primary"
                >
                  Update Bio-data
                </Link>
              </div>
              <ul className="list-unstyled mb-0">
                {profileItems.map((item) => (
                  <li
                    key={item.label}
                    className="d-flex justify-content-between align-items-center py-2 border-bottom"
                  >
                    <span className="text-muted small">{item.label}</span>
                    <span className="font-weight-bold text-dark">
                      {item.value ?? "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>

        <div className="col-xl-8 col-lg-7 col-12 mb-4">
          <div className="card height-auto">
            <div className="card-body">
              <div className="heading-layout1 mb-3 d-flex justify-content-between align-items-center">
                <div className="item-title">
                  <h3>Subjects</h3>
                  <p className="text-muted mb-0">
                    Subjects assigned to your current class.
                  </p>
                </div>
                <span className="badge badge-pill badge-primary">
                  {subjects.length} in total
                </span>
              </div>
              {subjects.length > 0 ? (
                <div className="d-flex flex-wrap" style={{ gap: "0.5rem" }}>
                  {subjects.map((subject) => (
                    <span
                      key={subject.id}
                      className="badge badge-pill badge-info mr-2 mb-2 px-3 py-2"
                    >
                      {subject.name}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-muted mb-0">
                  Subjects will appear here once assigned to your class.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="row">
        <div className="col-12">
          <div className="card height-auto">
            <div className="card-body d-flex flex-wrap align-items-center justify-content-between">
              <div>
                <h4>Quick Actions</h4>
                <p className="text-muted mb-0">
                  Update your information or view your results using a valid pin.
                </p>
              </div>
              <div className="d-flex flex-wrap">
                <Link
                  href="/v26/student-dashboard/bio-data"
                  className="btn btn-outline-secondary mr-3 mb-2"
                >
                  Update Bio-data
                </Link>
                <Link
                  href="/v26/student-dashboard/my-result"
                  className="btn btn-gradient-yellow btn-hover-bluedark mb-2"
                >
                  View Results
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
