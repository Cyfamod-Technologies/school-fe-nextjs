"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { useCallback, useMemo, useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { resolveBackendUrl } from "@/lib/config";
import {
  menuSections,
  sidebarQuickLinks,
} from "@/components/layout/Sidebar";
import { isTeacherUser } from "@/lib/roleChecks";

const DEFAULT_LOGO = "/assets/img/logo.png";
const DEFAULT_AVATAR = "/assets/img/figure/admin.jpg";

const passthroughLoader: ImageLoader = ({ src }) => src;

export function Menubar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, schoolContext, logout } = useAuth();
  const [searchTerm, setSearchTerm] = useState("");
  const [searchError, setSearchError] = useState<string | null>(null);
  const [searching, setSearching] = useState(false);

  const logoSrc = useMemo(() => {
    const customLogo = schoolContext.school?.logo_url;
    return customLogo ? resolveBackendUrl(customLogo) : DEFAULT_LOGO;
  }, [schoolContext.school?.logo_url]);

  const avatarSrc = useMemo(() => {
    const picture =
      (user as { avatar?: string | null })?.avatar ??
      (schoolContext.school as { logo_url?: string | null })?.logo_url;
    if (picture) {
      return resolveBackendUrl(picture);
    }
    return DEFAULT_AVATAR;
  }, [schoolContext.school, user]);

  const roleLabel = useMemo(() => {
    if (!user) {
      return "Administrator";
    }
    const directRole = (user as { role?: unknown }).role;
    if (typeof directRole === "string" && directRole.trim().length > 0) {
      return directRole.trim();
    }
    const roles = (user as { roles?: Array<{ name?: string | null }> }).roles;
    const derived = roles?.find((entry) => entry?.name)?.name?.trim();
    return derived && derived.length > 0 ? derived : "Administrator";
  }, [user]);

  const isTeacher = useMemo(() => isTeacherUser(user), [user]);

  const dashboardPath = useMemo(() => {
    return isTeacher ? "/v25/staff-dashboard" : "/v10/dashboard";
  }, [isTeacher]);

  // Profile link should point to teacher profile for teachers, admin profile otherwise
  const profileHref = useMemo(() => {
    return isTeacher ? "/v25/profile" : "/v10/profile";
  }, [isTeacher]);

  const searchableItems = useMemo(() => {
    const quickLinks = sidebarQuickLinks.map((link) => ({
      label: link.label,
      href: link.href,
    }));
    const sectionLinks = menuSections.flatMap((section) =>
      section.links.map((link) => ({
        label: `${section.label} › ${link.label}`,
        href: link.href,
      })),
    );
    return [...quickLinks, ...sectionLinks];
  }, []);

  // Simple natural language intent parser for the quick navigation
  const parseIntent = useCallback((input: string): string | null => {
    const t = input.toLowerCase().trim();
    // direct patterns
    const patterns: Array<[RegExp, string]> = [
      [/\b(add|create|register)\s+(student|pupil)\b/, "/v14/add-student"],
      [/\b(add|create|register)\s+(staff|teacher)\b/, "/v15/add-staff"],
      [/\b(view|list|all)\s+(students|pupils)\b/, "/v14/all-students"],
      [/\b(results?\s*entry)\b/, "/v19/results-entry"],
      [/\b(bulk\s+upload)\b/, "/v22/bulk-student-upload"],
      [/\b(assign\s+teachers?)\b/, "/v17/assign-teachers"],
      [/\b(assign\s+subjects?)\b/, "/v17/assign-subjects"],
      [/\b(profile|my profile|manage profile)\b/, isTeacher ? "/v25/profile" : "/v10/profile"],
      [/\b(dashboard)\b/, dashboardPath],
      [/\b(assessment\s*component|components|assessment settings)\b/, "/v19/assessment-components"],
      [/\b(grade\s*scale|grading)\b/, "/v19/grade-scales"],
      [/\b(attendance)\b/, "/v21/student-attendance"],
      [/\b(payment|subscription|paystack)\b/, "/settings/payment"],
    ];

    for (const [re, route] of patterns) {
      if (re.test(t)) {
        return route;
      }
    }

    // If user typed something like "I want to add student" try to extract key nouns
    if (/\badd\b/.test(t) && /\bstudent|pupil\b/.test(t)) return "/v14/add-student";
    if (/\badd\b/.test(t) && /\bstaff|teacher\b/.test(t)) return "/v15/add-staff";

    return null;
  }, [dashboardPath, isTeacher]);

  const handleSearchSubmit = useCallback(() => {
    const term = searchTerm.trim();
    if (!term) {
      setSearchError("Enter a keyword to search.");
      return;
    }

    // Try NLP intent parsing first
    const intentRoute = parseIntent(term);
    if (intentRoute) {
      setSearching(true);
      setSearchError(null);
      router.push(intentRoute);
      setSearchTerm("");
      setTimeout(() => setSearching(false), 250);
      return;
    }

    // Fallback: match by label
    const normalized = term.toLowerCase();
    const matches = searchableItems.filter((item) =>
      item.label.toLowerCase().includes(normalized),
    );
    if (!matches.length) {
      setSearchError("No matching pages found.");
      return;
    }
    setSearching(true);
    setSearchError(null);
    router.push(matches[0].href);
    setSearchTerm("");
    setTimeout(() => setSearching(false), 250);
  }, [router, searchTerm, searchableItems, parseIntent]);

  const handleLogout = useCallback(async () => {
    await logout();
    router.push("/login");
  }, [logout, router]);

  const toggleDesktopSidebar = useCallback(() => {
    const wrapper = document.getElementById("wrapper");
    if (!wrapper) {
      return;
    }
    wrapper.classList.toggle("sidebar-collapsed");
    if (wrapper.classList.contains("sidebar-collapsed-mobile")) {
      wrapper.classList.remove("sidebar-collapsed-mobile");
    }
  }, []);

  const toggleMobileSidebar = useCallback(() => {
    const wrapper = document.getElementById("wrapper");
    if (!wrapper) {
      return;
    }
    wrapper.classList.toggle("sidebar-collapsed-mobile");
    if (wrapper.classList.contains("sidebar-collapsed-mobile")) {
      wrapper.classList.remove("sidebar-collapsed");
    }
  }, []);

  useEffect(() => {
    const wrapper = document.getElementById("wrapper");
    if (!wrapper) {
      return;
    }
    wrapper.classList.remove("sidebar-collapsed-mobile");
  }, [pathname]);

  return (
    <div className="navbar navbar-expand-md header-menu-one bg-light">
      <div className="nav-bar-header-one">
        <div className="header-logo">
          <Link href={dashboardPath} className="d-flex align-items-center">
            <Image
              id="menubar-school-logo"
              src={logoSrc}
              alt="School logo"
              width={120}
              height={36}
              unoptimized
              priority
              loader={passthroughLoader}
            />
          </Link>
        </div>
        <div className="toggle-button sidebar-toggle">
          <button
            type="button"
            className="item-link"
            onClick={toggleDesktopSidebar}
            aria-label="Toggle sidebar"
          >
            <span className="btn-icon-wrap">
              <span />
              <span />
              <span />
            </span>
          </button>
        </div>
      </div>
      <div className="d-md-none mobile-nav-bar">
        <button
          className="navbar-toggler pulse-animation"
          type="button"
          data-toggle="collapse"
          data-target="#mobile-navbar"
          aria-expanded="false"
        >
          <i className="far fa-arrow-alt-circle-down" />
        </button>
        <button
          type="button"
          className="navbar-toggler sidebar-toggle-mobile"
          onClick={toggleMobileSidebar}
          aria-label="Toggle sidebar"
        >
          <i className="fas fa-bars" />
        </button>
      </div>
      <div className="header-main-menu collapse navbar-collapse" id="mobile-navbar">
        <ul className="navbar-nav">
          <li className="navbar-item header-search-bar">
            <div className="input-group stylish-input-group">
              <span className="input-group-addon">
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  disabled={searching}
                  aria-label="Search navigation"
                >
                  <span className="flaticon-search" aria-hidden="true" />
                </button>
              </span>
              <input
                type="text"
                className="form-control"
                placeholder="Find Something . . ."
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  if (searchError) {
                    setSearchError(null);
                  }
                }}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    handleSearchSubmit();
                  }
                }}
                aria-label="Quick navigation search"
                aria-describedby={
                  searchError ? "global-search-feedback" : undefined
                }
              />
              {searchError ? (
                <small
                  id="global-search-feedback"
                  className="text-warning d-block mt-1"
                  role="status"
                >
                  {searchError}
                </small>
              ) : searching ? (
                <small className="text-muted d-block mt-1" role="status">
                  Searching…
                </small>
              ) : null}
            </div>
          </li>
        </ul>
        <ul className="navbar-nav">
          <li className="navbar-item dropdown header-admin">
            <button
              className="navbar-nav-link dropdown-toggle"
              type="button"
              data-toggle="dropdown"
              aria-expanded="false"
            >
              <div className="admin-title">
                <h5 className="item-title">{user?.name ?? "Authenticated User"}</h5>
                <span>{roleLabel}</span>
              </div>
              <div className="admin-img">
                <Image
                  src={avatarSrc}
                  alt="Account avatar"
                  width={40}
                  height={40}
                  unoptimized
                  loader={passthroughLoader}
                />
              </div>
            </button>
            <div className="dropdown-menu dropdown-menu-right">
              <div className="item-header">
                <h6 className="item-title">{user?.name ?? "Account"}</h6>
              </div>
              <div className="item-content">
                <ul className="settings-list">
                  <li>
                    <Link href={profileHref} className="d-flex align-items-center">
                      <i className="flaticon-user" />
                      <span className="ml-2">My Profile</span>
                    </Link>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="d-flex align-items-center"
                      onClick={handleLogout}
                    >
                      <i className="flaticon-turn-off" />
                      <span className="ml-2">Log Out</span>
                    </button>
                  </li>
                </ul>
              </div>
            </div>
          </li>
        </ul>
      </div>
    </div>
  );
}
