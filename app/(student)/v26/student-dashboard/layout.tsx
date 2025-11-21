"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  StudentAuthProvider,
  useStudentAuth,
} from "@/contexts/StudentAuthContext";
import { useEffect, useState } from "react";
import { OnboardingVideo } from "@/components/layout/OnboardingVideo";

function StudentGuard({ children }: { children: React.ReactNode }) {
  const { student, loading, logout } = useStudentAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    if (!loading && !student) {
      router.push("/student-login");
    }
  }, [loading, student, router]);

  if (loading || !student) {
    return (
      <div className="d-flex justify-content-center align-items-center" style={{ minHeight: "60vh" }}>
        Loading student dashboard…
      </div>
    );
  }

  const links = [
    { href: "/v26/student-dashboard", label: "Dashboard" },
    { href: "/v26/student-dashboard/bio-data", label: "Bio-data" },
    { href: "/v26/student-dashboard/my-result", label: "My Result" },
  ];

  return (
    <div className="row">
      <aside className="col-lg-3 col-12 mb-4">
        <div className="card height-auto">
          <div className="card-body">
            <h4 className="item-title mb-3">Welcome, {student.first_name}</h4>
            <ul className="nav flex-column student-nav">
              {links.map((link) => (
                <li key={link.href} className="nav-item">
                  <Link
                    href={link.href}
                    className={`nav-link ${
                      pathname === link.href ? "active font-weight-bold" : ""
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="text-muted small mb-0">Admission No: {student.admission_no}</p>
            <button
              type="button"
              className="btn btn-outline-danger btn-sm mt-3"
              onClick={async () => {
                if (signingOut) return;
                setSigningOut(true);
                await logout();
                setSigningOut(false);
                router.push("/student-login");
              }}
              disabled={signingOut}
            >
              {signingOut ? "Signing out…" : "Logout"}
            </button>
          </div>
        </div>
      </aside>
      <section className="col-lg-9 col-12">{children}</section>
    </div>
  );
}

export default function StudentDashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <StudentAuthProvider>
      <StudentGuard>{children}</StudentGuard>
      <OnboardingVideo />
    </StudentAuthProvider>
  );
}
