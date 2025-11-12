"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { resolveBackendUrl } from "@/lib/config";

const DEFAULT_LOGO = "/assets/img/logo1.png";
const passthroughLoader: ImageLoader = ({ src }) => src;

export interface MenuLink {
  id?: string;
  label: string;
  href: string;
  requiredPermissions?: string | string[];
  requiredRoles?: string | string[];
  excludeRoles?: string | string[];
}

export interface MenuSection {
  label: string;
  icon: string;
  links: MenuLink[];
}

export interface SidebarQuickLink extends MenuLink {
  id: string;
  icon: string;
}

export const sidebarQuickLinks: SidebarQuickLink[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    href: "/v10/dashboard",
    icon: "flaticon-dashboard",
    requiredPermissions: "dashboard.view",
    excludeRoles: ["teacher"],
  },
  {
    id: "staff-dashboard",
    label: "Dashboard",
    href: "/v25/staff-dashboard",
    icon: "flaticon-dashboard",
    requiredRoles: ["teacher"],
  },
  {
    id: "profile",
    label: "My Profile",
    href: "/v25/profile",
    icon: "flaticon-user",
    requiredPermissions: "profile.view",
    requiredRoles: ["teacher"],
  },
];

export const menuSections: MenuSection[] = [
  {
    label: "Management",
    icon: "flaticon-technological",
    links: [
      { label: "Session", href: "/v11/all-sessions", requiredPermissions: "sessions.manage" },
      { label: "Term", href: "/v11/all-terms", requiredPermissions: "sessions.manage" },
      { label: "Subject", href: "/v16/all-subjects", requiredPermissions: "subjects.manage" },
      { label: "Result Pin", href: "/v19/pins", requiredPermissions: "result.pin.manage" },
    ],
  },
  {
    label: "Parent",
    icon: "flaticon-couple",
    links: [
      { label: "View Parent", href: "/v13/all-parents", requiredPermissions: "parents.view" },
      { label: "Add Parent", href: "/v13/add-parent", requiredPermissions: "parents.manage" },
    ],
  },
  {
    label: "Staff",
    icon: "flaticon-multiple-users-silhouette",
    links: [
      { label: "View Staff", href: "/v15/all-staff", requiredPermissions: "staff.view" },
      { label: "Add Staff", href: "/v15/add-staff", requiredPermissions: "staff.create" },
    ],
  },
  {
    label: "Classes",
    icon: "flaticon-maths-class-materials-cross-of-a-pencil-and-a-ruler",
    links: [
      { label: "Class", href: "/v12/all-classes", requiredPermissions: "classes.manage" },
      { label: "Class Arm", href: "/v12/all-class-arms", requiredPermissions: "classes.manage" },
      // { label: "Class Section", href: "/v12/all-class-arm-sections" },
    ],
  },
  {
    label: "Assign",
    icon: "flaticon-settings-work-tool",
    links: [
      { label: "Subject to Class", href: "/v17/assign-subjects", requiredPermissions: "subject.assignments" },
      { label: "Teachers to Subject", href: "/v17/assign-teachers", requiredPermissions: "subject.assignments" },
      { label: "Teachers to Class", href: "/v18/assign-class-teachers", requiredPermissions: "subject.assignments" },
    ],
  },
  {
    label: "Student",
    icon: "flaticon-classmates",
    links: [
      { label: "View Student", href: "/v14/all-students", requiredPermissions: "students.view" },
      { label: "Add Student", href: "/v14/add-student", requiredPermissions: "students.create" },
      { label: "Result Entry", href: "/v19/results-entry", requiredPermissions: "results.enter" },
      { label: "Bulk Upload", href: "/v22/bulk-student-upload", requiredPermissions: "students.import" },
      { label: "Student Promotion", href: "/v20/student-promotion", requiredPermissions: "students.promote" },
      { label: "Promotion Reports", href: "/v20/promotion-reports", requiredPermissions: "promotions.history" },
    ],
  },
  {
    label: "Attendance",
    icon: "flaticon-checklist",
    links: [
      { label: "Student Attendance", href: "/v21/student-attendance", requiredPermissions: "attendance.students" },
      { label: "Staff Attendance", href: "/v21/staff-attendance", requiredPermissions: "staff.attendance" },
      { label: "Attendance Reports", href: "/v21/attendance-dashboard", requiredPermissions: "attendance.students" },
    ],
  },
  {
    label: "Settings",
    icon: "flaticon-settings",
    links: [
      { label: "Grading-Scale", href: "/v19/grade-scales", requiredPermissions: "assessment.manage" },
      { label: "Skills", href: "/v19/skills", requiredPermissions: "skills.manage" },
      {
        label: "Assessment-component",
        href: "/v19/assessment-components",
        requiredPermissions: "assessment.manage",
      },
      { label: "Academic-Rollover", href: "/v20/academic-rollover", requiredPermissions: "sessions.manage" },
    ],
  },
  {
    label: "Fee Management",
    icon: "flaticon-planet-earth",
    links: [
      { label: "Fee Structure", href: "/v23/fee-structure", requiredPermissions: "fees.structures" },
      { label: "Bank Details", href: "/v23/bank-details", requiredPermissions: "fees.bank-details" },
    ],
  },
  {
    label: "RBAC",
    icon: "flaticon-technological",
    links: [
      { label: "Roles", href: "/v24/roles", requiredPermissions: "roles.view" },
      { label: "User Roles", href: "/v24/user-roles", requiredPermissions: "users.assignRoles" },
    ],
  },
  {
    label: "School Settings",
    icon: "flaticon-settings",
    links: [
      { label: "School Settings", href: "/v10/profile" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { schoolContext, user, hasPermission } = useAuth();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});

  const logoSrc = useMemo(() => {
    const customLogo = schoolContext.school?.logo_url;
    return customLogo ? resolveBackendUrl(customLogo) : DEFAULT_LOGO;
  }, [schoolContext.school?.logo_url]);

  const brandText = (() => {
    const value = schoolContext.school?.short_name ?? schoolContext.school?.name;
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
    return "SMS";
  })();

  const roleSet = useMemo(() => {
    const roles = new Set<string>();
    if (typeof user?.role === "string" && user.role.trim().length > 0) {
      roles.add(user.role.toLowerCase());
    }
    if (Array.isArray(user?.roles)) {
      user.roles.forEach((role) => {
        if (role?.name) {
          roles.add(role.name.toLowerCase());
        }
      });
    }
    return roles;
  }, [user]);

  const dashboardPath = useMemo(() => {
    const normalizedRole = String(user?.role ?? "").toLowerCase();
    const isTeacher =
      normalizedRole.includes("teacher") ||
      (Array.isArray(user?.roles)
        ? user?.roles.some((role) =>
            String(role?.name ?? "").toLowerCase().includes("teacher"),
          )
        : false);
    return isTeacher ? "/v25/staff-dashboard" : "/v10/dashboard";
  }, [user]);

  const isLinkActive = useCallback(
    (href: string) => pathname === href || pathname.startsWith(`${href}/`),
    [pathname],
  );

  const linkVisible = useCallback(
    (link: MenuLink) => {
      // If a link requires permissions and the current user doesn't have them,
      // allow users with admin-like roles to still see the link in the sidebar.
      if (link.requiredPermissions && !hasPermission(link.requiredPermissions)) {
        const isAdminRole =
          roleSet.has("admin") || roleSet.has("superadmin") || roleSet.has("administrator");
        if (!isAdminRole) {
          return false;
        }
      }
      if (link.excludeRoles) {
        const excludedRoles = Array.isArray(link.excludeRoles)
          ? link.excludeRoles
          : [link.excludeRoles];
        if (excludedRoles.some((roleName) =>
          roleSet.has(String(roleName).toLowerCase()),
        )) {
          return false;
        }
      }
      if (!link.requiredRoles) {
        return true;
      }
      const requiredRoles = Array.isArray(link.requiredRoles)
        ? link.requiredRoles
        : [link.requiredRoles];
      return requiredRoles.some((roleName) =>
        roleSet.has(String(roleName).toLowerCase()),
      );
    },
    [hasPermission, roleSet],
  );

  const filteredQuickLinks = useMemo(() => {
    return sidebarQuickLinks.filter(linkVisible);
  }, [linkVisible]);

  const filteredSections = useMemo(() => {
    return menuSections
      .map((section) => ({
        ...section,
        links: section.links.filter(linkVisible),
      }))
      .filter((section) => section.links.length > 0);
  }, [linkVisible]);

  const isSectionActive = (section: MenuSection) =>
    section.links.some((link) => isLinkActive(link.href));

  const toggleSection = useCallback((label: string) => {
    setOpenSections((prev) => {
      const isCurrentlyOpen = prev[label] ?? false;
      if (isCurrentlyOpen) {
        const next = { ...prev };
        delete next[label];
        return next;
      }
      return { [label]: true };
    });
  }, []);

  return (
    <div
      className="sidebar-main sidebar-menu-one sidebar-expand-md sidebar-color"
      style={{ backgroundColor: "#042C54" }}
    >
      <div className="mobile-sidebar-header d-md-none">
        <div className="header-logo d-flex align-items-center">
          <Link href={dashboardPath} className="d-flex align-items-center">
            <Image
              id="sidebar-school-logo"
              src={logoSrc}
              alt="Sidebar logo"
              width={120}
              height={36}
              unoptimized
              style={{
                height: "auto",
                width: "auto",
                marginRight: 6,
              }}
              loader={passthroughLoader}
            />
            <span className="sidebar-brand-text font-weight-bold text-primary">
              {brandText}
            </span>
          </Link>
        </div>
      </div>

      <div className="sidebar-menu-content">
        <ul className="nav nav-sidebar-menu sidebar-toggle-view">
          {filteredQuickLinks.map((link) => (
            <li
              key={link.id}
              className={`nav-item ${isLinkActive(link.href) ? "open active" : ""}`}
            >
              <Link href={link.href} className="nav-link">
                <i className={link.icon} />
                <span>{link.label}</span>
              </Link>
            </li>
          ))}

          {filteredSections.map((section) => {
            const active = isSectionActive(section);
            const open = openSections[section.label] ?? active;
            return (
              <li
                key={section.label}
                className={`nav-item sidebar-nav-item ${open ? "open active" : ""}`}
              >
                <a
                  href="#"
                  className="nav-link"
                  onClick={(event) => {
                    event.preventDefault();
                    toggleSection(section.label);
                  }}
                >
                  <i className={section.icon} />
                  <span>{section.label}</span>
                </a>
                <ul
                  className="nav sub-group-menu"
                  style={{ display: open ? "block" : "none" }}
                >
                  {section.links.map((link) => (
                    <li
                      key={link.href}
                      className={`nav-item ${isLinkActive(link.href) ? "active" : ""}`}
                    >
                      <Link href={link.href} className="nav-link">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
