"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menubar } from "@/components/layout/Menubar";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingVideo } from "@/components/layout/OnboardingVideo";
import { useAuth } from "@/contexts/AuthContext";
import { useMemo } from "react";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const isTeacherUser = useMemo(() => {
    if (!user) {
      return false;
    }
    const normalizedRole = String((user as { role?: string | null }).role ?? "").toLowerCase();
    if (normalizedRole.includes("teacher")) {
      return true;
    }
    const roles = (user as { roles?: Array<{ name?: string | null }> }).roles;
    if (Array.isArray(roles)) {
      return roles.some((role) =>
        String(role?.name ?? "").toLowerCase().includes("teacher"),
      );
    }
    return false;
  }, [user]);

  const defaultDashboardPath = isTeacherUser ? "/v25/staff-dashboard" : "/v10/dashboard";

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    // Enforce role-aware routing inside the authenticated app segment.
    // Teachers should stay on /v25/*, while non-teacher staff/admin stay on /v10–/v24 routes.
    const currentPath = pathname || "/";
    const isTeacherArea = currentPath.startsWith("/v25");

    const requiresRedirect =
      (!isTeacherUser && isTeacherArea) ||
      (isTeacherUser && !isTeacherArea);

    if (requiresRedirect && currentPath !== defaultDashboardPath) {
      router.replace(defaultDashboardPath);
    }
  }, [loading, user, router, pathname, isTeacherUser, defaultDashboardPath]);

  useEffect(() => {
    if (loading || !user) {
      return;
    }
    const preloader = document.getElementById("preloader");
    if (!preloader) {
      return;
    }
    preloader.classList.add("loaded");
    const timer = window.setTimeout(() => {
      preloader.remove();
    }, 300);
    return () => window.clearTimeout(timer);
  }, [loading, user]);

  if (!user) {
    return loading ? (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    ) : null;
  }

  return (
    <div id="wrapper" className="wrapper bg-ash">
      <div id="preloader" />
      <Menubar />
      <div className="dashboard-page-one">
        <Sidebar />
        <div className="dashboard-content-one">{children}</div>
      </div>
      <OnboardingVideo />
    </div>
  );
}
