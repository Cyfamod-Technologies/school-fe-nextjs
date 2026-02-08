"use client";

import { useStudentAuth } from "@/contexts/StudentAuthContext";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useMemo, useEffect } from "react";

const styles = `
.student-dashboard-container {
  --sd-primary: #f0a70d;
  --sd-primary-strong: #f0a70d;
  --sd-primary-soft: #e1f1ff;
  --sd-accent: #ffae01;
  --sd-accent-strong: #f0a70d;
  --sd-ink: #0f172a;
  --sd-muted: #64748b;
  background: linear-gradient(135deg, #f8fafc 0%, #ffffff 100%);
  min-height: 100vh;
  padding-top: 2rem;
}

.dashboard-header {
  background: linear-gradient(135deg, var(--sd-primary-strong) 0%, var(--sd-primary) 100%);
  color: #111111;
  padding: 2rem;
  border-radius: 12px;
  margin-bottom: 2rem;
  box-shadow: 0 14px 35px rgba(240, 167, 13, 0.25);
}

.dashboard-header h1 {
  font-size: 2.5rem;
  font-weight: 700;
  margin-bottom: 0.5rem;
}

.dashboard-header p {
  font-size: 1.1rem;
  opacity: 0.9;
}

.summary-card {
  border: none;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  transition: all 0.3s ease;
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.summary-card:hover {
  transform: translateY(-5px);
  box-shadow: 0 15px 40px rgba(0, 0, 0, 0.15);
}

.summary-card-header {
  background: linear-gradient(135deg, var(--sd-primary-strong) 0%, #f0a70d 100%);
  color: #111111;
  padding: 1.5rem;
  display: flex;
  align-items: center;
  gap: 1rem;
}

.summary-card-icon {
  font-size: 2rem;
  width: 60px;
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(255, 255, 255, 0.2);
  border-radius: 12px;
}

.summary-card-content {
  padding: 1.5rem;
}

.summary-card-title {
  color: #111111;
  font-size: 0.9rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 0.5rem;
}

.summary-card-value {
  font-size: 1.8rem;
  font-weight: 700;
  color: #111111;
}

.profile-card {
  border: none;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.profile-card-header {
  background: linear-gradient(135deg, var(--sd-primary-strong) 0%, var(--sd-primary) 100%);
  color: #111111;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.profile-card-header h3 {
  font-size: 1.5rem;
  margin: 0;
}

.profile-avatar-wrapper {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 1.5rem 1.5rem 0 1.5rem;
}

.profile-avatar {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid var(--sd-primary);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
  background: #f1f5f9;
}

.profile-avatar-placeholder {
  width: 100px;
  height: 100px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--sd-primary-soft) 0%, #e2e8f0 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2.5rem;
  border: 4px solid var(--sd-primary);
  box-shadow: 0 4px 15px rgba(0, 0, 0, 0.15);
}

.profile-avatar-name {
  margin-top: 0.75rem;
  font-size: 1.1rem;
  font-weight: 700;
  color: var(--sd-ink);
  text-align: center;
}

.profile-card-body {
  padding: 1.5rem;
}

.profile-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 0;
  border-bottom: 1px solid #e2e8f0;
}

.profile-item:last-child {
  border-bottom: none;
}

.profile-label {
  color: var(--sd-muted);
  font-weight: 500;
  font-size: 0.95rem;
}

.profile-value {
  color: var(--sd-ink);
  font-weight: 700;
  font-size: 1rem;
}

.subjects-section {
  border: none;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
}

.subjects-section-header {
  background: linear-gradient(135deg, var(--sd-primary-strong) 0%, var(--sd-primary) 100%);
  color: #111111;
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.subjects-section-header h3 {
  font-size: 1.5rem;
  margin: 0;
}

.subject-description {
  color: #111111;
  font-size: 0.95rem;
  margin-top: 0.5rem;
}

.subjects-content {
  padding: 1.5rem;
}

.subject-badge {
  display: inline-block;
  background: #ffffff;
  color: #111111;
  padding: 0.6rem 1.2rem;
  border-radius: 20px;
  font-weight: 600;
  margin-right: 0.8rem;
  margin-bottom: 0.8rem;
  font-size: 0.95rem;
  box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
  transition: all 0.3s ease;
}

.subject-badge:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(102, 126, 234, 0.4);
}

.no-subjects-message {
  color: var(--sd-muted);
  font-size: 1rem;
  padding: 2rem;
  text-align: center;
  background: var(--sd-primary-soft);
  border-radius: 8px;
}

.quick-actions-section {
  border: none;
  border-radius: 12px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.08);
  overflow: hidden;
  margin-top: 2rem;
}

.quick-actions-header {
  background: linear-gradient(135deg, var(--sd-primary-strong) 0%, var(--sd-primary) 100%);
  color: #111111;
  padding: 1.5rem;
}

.quick-actions-body {
  padding: 1.5rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 1rem;
}

.quick-actions-text h4 {
  color: var(--sd-ink);
  margin: 0;
  font-weight: 700;
}

.quick-actions-text p {
  color: var(--sd-muted);
  margin: 0.5rem 0 0 0;
}

.action-buttons {
  display: flex;
  gap: 1rem;
  flex-wrap: wrap;
}

.btn-action {
  padding: 0.75rem 1.5rem;
  border-radius: 8px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.3s ease;
  border: none;
  cursor: pointer;
}

.btn-action-primary {
  background: linear-gradient(135deg, var(--sd-accent) 0%, var(--sd-accent-strong) 100%);
  color: #1a202c;
  box-shadow: 0 8px 18px rgba(240, 167, 13, 0.35);
}

.btn-action-primary:hover {
  transform: translateY(-2px);
  box-shadow: 0 10px 22px rgba(240, 167, 13, 0.45);
}

.btn-action-secondary {
  background: #ffffff;
  color: var(--sd-primary);
  border: 2px solid var(--sd-primary);
}

.btn-action-secondary:hover {
  background: var(--sd-primary);
  color: white;
}

.breadcrumbs-area {
  margin-bottom: 2rem;
  color: var(--sd-ink);
}

.breadcrumbs-area h3 {
  color: var(--sd-ink);
  margin-bottom: 0.5rem;
}

.breadcrumbs-area ul {
  background: transparent;
  padding: 0;
}

@media (max-width: 768px) {
  .dashboard-header h1 {
    font-size: 2rem;
  }

  .summary-card-header {
    padding: 1rem;
  }

  .profile-item {
    flex-direction: column;
    align-items: flex-start;
    gap: 0.5rem;
  }

  .quick-actions-body {
    flex-direction: column;
    align-items: stretch;
  }

  .action-buttons {
    flex-direction: column;
  }

  .btn-action {
    width: 100%;
    text-align: center;
  }
}
`;

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

  // Get unique subjects to avoid duplicates
  const uniqueSubjects = useMemo(() => {
    if (!Array.isArray(student.subjects)) return [];
    const seen = new Set<string>();
    return student.subjects.filter((subject) => {
      if (seen.has(subject.id)) return false;
      seen.add(subject.id);
      return true;
    });
  }, [student.subjects]);

  const summaryCards = useMemo(
    () => [
      {
        label: "Current Session",
        value: student.current_session?.name ?? "Not set",
        icon: "📅",
      },
      {
        label: "Current Term",
        value: student.current_term?.name ?? "Not set",
        icon: "📚",
      },
      {
        label: "Class",
        value: student.school_class?.name ?? "Not assigned",
        icon: "👥",
      },
      {
        label: "Class Arm",
        value: student.class_arm?.name ?? "General",
        icon: "👨‍🎓",
      },
      {
        label: "Subjects",
        value: uniqueSubjects.length,
        icon: "📖",
      },
    ],
    [student, uniqueSubjects.length],
  );

  const profileItems = [
    { label: "Admission No", value: student.admission_no },
    { label: "Full Name", value: `${student.first_name} ${student.middle_name ?? ""} ${student.last_name}`.trim() },
    { label: "Session", value: student.current_session?.name ?? "Not set" },
    { label: "Term", value: student.current_term?.name ?? "Not set" },
    { label: "Class", value: student.school_class?.name ?? "Not set" },
    { label: "Class Arm", value: student.class_arm?.name ?? "Not set" },
  ];

  return (
    <>
      <style>{styles}</style>
      <div className="student-dashboard-container">
        <div className="container-fluid">
          <div className="breadcrumbs-area">
            <h3>Welcome back, {student.first_name}!</h3>
            <ul>
              <li>
                <Link href="/v26/student-dashboard">Dashboard</Link>
              </li>
              <li>Home</li>
            </ul>
          </div>

          {/* Summary Cards */}
          <div className="row">
            {summaryCards.map((card) => (
              <div key={card.label} className="col-lg-2 col-md-4 col-sm-6 col-12">
                <div className="summary-card">
                  <div className="summary-card-header">
                    <div className="summary-card-icon">{card.icon}</div>
                    <div>
                      <div className="summary-card-title">{card.label}</div>
                      <div className="summary-card-value">{card.value}</div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Main Content Row */}
          <div className="row mt-4">
            {/* Profile Card */}
            <div className="col-lg-5 col-md-12 mb-4">
              <div className="profile-card">
                <div className="profile-card-header">
                  <h3>My Profile</h3>
                  <Link
                    href="/v26/student-dashboard/bio-data"
                    className="btn btn-light btn-sm"
                    style={{ fontWeight: 600 }}
                  >
                    ✎ Edit
                  </Link>
                </div>
                <div className="profile-card-body">
                  {/* Profile Avatar */}
                  <div className="profile-avatar-wrapper">
                    {student.photo_url ? (
                      <img
                        src={student.photo_url}
                        alt={`${student.first_name}'s photo`}
                        className="profile-avatar"
                      />
                    ) : (
                      <div className="profile-avatar-placeholder">
                        {student.first_name?.charAt(0)?.toUpperCase() ?? "👤"}
                      </div>
                    )}
                    <p className="profile-avatar-name">
                      {`${student.first_name} ${student.middle_name ?? ""} ${student.last_name}`.trim()}
                    </p>
                  </div>

                  {profileItems.map((item) => (
                    <div key={item.label} className="profile-item">
                      <span className="profile-label">{item.label}</span>
                      <span className="profile-value">{item.value ?? "—"}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Subjects Card */}
            <div className="col-lg-7 col-md-12 mb-4">
              <div className="subjects-section">
                <div className="subjects-section-header">
                  <div>
                    <h3>Your Subjects</h3>
                    <p className="subject-description">
                      Subjects assigned to your current class
                    </p>
                  </div>
                  <span
                    className="badge badge-light"
                    style={{ fontSize: "1rem", padding: "0.5rem 1rem" }}
                  >
                    {uniqueSubjects.length} Total
                  </span>
                </div>
                <div className="subjects-content">
                  {uniqueSubjects.length > 0 ? (
                    <div style={{ display: "flex", flexWrap: "wrap" }}>
                      {uniqueSubjects.map((subject) => (
                        <span key={subject.id} className="subject-badge">
                          {subject.name}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <div className="no-subjects-message">
                      📭 Subjects will appear here once assigned to your class
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="quick-actions-section">
            <div className="quick-actions-header">
              <h4 style={{ margin: 0 }}>Quick Actions</h4>
            </div>
            <div className="quick-actions-body">
              <div className="quick-actions-text">
                <h4>More Options</h4>
                <p>Update your information or view your results</p>
              </div>
              <div className="action-buttons">
                <Link
                  href="/v26/student-dashboard/bio-data"
                  className="btn-action btn-action-secondary"
                >
                  Update Bio-data
                </Link>
                <Link
                  href="/v26/student-dashboard/my-result"
                  className="btn-action btn-action-primary"
                >
                  View Results
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer-wrap-layout1" style={{ marginTop: "3rem" }}>
        <div className="copyright">
          © Copyrights <a href="#">Cyfamod Technologies</a> 2026. All rights
          reserved.
        </div>
      </footer>
    </>
  );
}
