"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menubar } from "@/components/layout/Menubar";
import { Sidebar } from "@/components/layout/Sidebar";
import { OnboardingVideo } from "@/components/layout/OnboardingVideo";
import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) {
      return;
    }
    if (!user) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    }
  }, [loading, user, router, pathname]);

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
