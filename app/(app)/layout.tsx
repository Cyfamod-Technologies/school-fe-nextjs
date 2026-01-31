"use client";

import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menubar } from "@/components/layout/Menubar";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingVideo } from "@/components/layout/OnboardingVideo";
import { AiChatWidget } from "@/components/ai/AiChatWidget";
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

  const isCbtStudentRoute = useMemo(() => {
    if (!pathname) {
      return false;
    }
    return pathname.startsWith("/v27/cbt") && !pathname.startsWith("/v27/cbt/admin");
  }, [pathname]);

  const handleBodyClick = useCallback(() => {
    const wrapper = document.getElementById("wrapper");
    if (wrapper?.classList.contains("sidebar-collapsed-mobile")) {
      wrapper.classList.remove("sidebar-collapsed-mobile");
    }
  }, []);

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user && !isCbtStudentRoute) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }
  }, [loading, user, router, pathname, isCbtStudentRoute]);

  useEffect(() => {
    if (loading || !user || isCbtStudentRoute) {
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

  if (!user && !isCbtStudentRoute) {
    return loading ? (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    ) : null;
  }

  if (isCbtStudentRoute) {
    return <>{children}</>;
  }

  return (
    <div id="wrapper" className="wrapper bg-ash">
      <div id="preloader" />
      <Menubar />
      <div className="dashboard-page-one">
        <Sidebar />
        <div className="dashboard-content-one" onClick={handleBodyClick}>
          {children}
        </div>
      </div>
      <OnboardingVideo />
      <AiChatWidget />
    </div>
  );
}
