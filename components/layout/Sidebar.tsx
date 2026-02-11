"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { resolveBackendUrl } from "@/lib/config";
import { isTeacherUser } from "@/lib/roleChecks";

const DEFAULT_LOGO = "/assets/img/logo1.png";
const passthroughLoader: ImageLoader = ({ src }) => src;
const showEarlyYearsReport =
  process.env.NEXT_PUBLIC_EARLY_YEARS_REPORT === "1";

export interface MenuLink {
  id?: string;
  label: string;
  href: string;
  requiredPermissions?: string | string[];
  requiredRoles?: string | string[];
  excludeRoles?: string | string[];
  children?: MenuLink[];
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
      { label: "Session", href: "/v11/all-sessions", requiredPermissions: "sessions.view" },
      { label: "Term", href: "/v11/all-terms", requiredPermissions: "terms.view" },
      { label: "Subject", href: "/v16/all-subjects", requiredPermissions: "subjects.view" },
      {
        label: "Classes",
        href: "#",
        children: [
          { label: "Class", href: "/v12/all-classes", requiredPermissions: "classes.view" },
          { label: "Class Arm", href: "/v12/all-class-arms", requiredPermissions: "class-arms.view" },
        ],
      },
      { label: "Result Pin", href: "/v19/pins", requiredPermissions: "result.pin.view" },
    ],
  },
  {
    label: "Users",
    icon: "flaticon-multiple-users-silhouette",
    links: [
      {
        label: "Parent",
        href: "#",
        children: [
          { label: "View Parent", href: "/v13/all-parents", requiredPermissions: "parents.view" },
          { label: "Add Parent", href: "/v13/add-parent", requiredPermissions: "parents.create" },
        ],
      },
      {
        label: "Staff",
        href: "#",
        children: [
          { label: "View Staff", href: "/v15/all-staff", requiredPermissions: "staff.view" },
          { label: "Add Staff", href: "/v15/add-staff", requiredPermissions: "staff.create" },
        ],
      },
      {
        label: "Student",
        href: "#",
        excludeRoles: ["teacher"],
        children: [
          { label: "View Student", href: "/v14/all-students", requiredPermissions: "students.view" },
          { label: "Add Student", href: "/v14/add-student", requiredPermissions: "students.create" },
          { label: "Bulk Result Print", href: "/v14/bulk-results", requiredPermissions: "results.bulk.view", excludeRoles: "teacher" },
          { label: "Check Student Result", href: "/v14/check-result", requiredPermissions: "results.check", excludeRoles: "teacher" },
          { label: "Early Years Report", href: "/v14/early-years-report", requiredPermissions: "results.early-years.view", excludeRoles: "teacher" },
          { label: "Result Entry", href: "/v19/results-entry", requiredPermissions: "results.entry.view" },
          {
            label: "Class Skill Ratings",
            href: "/v14/class-skill-ratings",
            // Allow either skills.ratings.view (admins) or results.entry.enter (teachers) to see it
            requiredPermissions: ["skills.ratings.view", "results.entry.enter"],
          },
          { label: "Student Bulk Upload", href: "/v22/bulk-student-upload", requiredPermissions: "students.import" },
          { label: "Student Promotion", href: "/v20/student-promotion", requiredPermissions: "students.promote" },
          { label: "Promotion Reports", href: "/v20/promotion-reports", requiredPermissions: "promotions.history" },
        ],
      },
    ],
  },
  {
    label: "Assign",
    icon: "flaticon-settings-work-tool",
    links: [
      { label: "Subject to Class", href: "/v17/assign-subjects", requiredPermissions: "subject.assignments.view" },
      { label: "Teachers to Subject", href: "/v17/assign-teachers", requiredPermissions: "teacher.assignments.view" },
      { label: "Teachers to Class", href: "/v18/assign-class-teachers", requiredPermissions: "class-teachers.view" },
    ],
  },
  {
    label: "Student",
    icon: "flaticon-classmates",
    links: [
      { label: "View Student", href: "/v14/all-students", requiredPermissions: "students.view" },
      { label: "Add Student", href: "/v14/add-student", requiredPermissions: "students.create" },
      { label: "Bulk Result Print", href: "/v14/bulk-results", requiredPermissions: "results.bulk.view", excludeRoles: "teacher" },
      { label: "Check Student Result", href: "/v14/check-result", requiredPermissions: "results.check", excludeRoles: "teacher" },
      ...(showEarlyYearsReport
        ? [
            {
              label: "Early Years Report",
              href: "/v14/early-years-report",
              requiredPermissions: "results.early-years.view",
              excludeRoles: "teacher",
            },
          ]
        : []),
      {
        label: "Result Entry",
        href: "/v19/results-entry",
        requiredPermissions: [
          "results.entry.view",
          "results.entry.enter",
          "results.enter",
        ],
      },
      {
        label: "Class Skill Ratings",
        href: "/v14/class-skill-ratings",
        // Allow either skills.ratings.view (admins) or results.entry.enter (teachers) to see it
        requiredPermissions: ["skills.ratings.view", "results.entry.enter"],
      },
      { label: "Student Bulk Upload", href: "/v22/bulk-student-upload", requiredPermissions: "students.import" },
      { label: "Student Promotion", href: "/v20/student-promotion", requiredPermissions: "students.promote" },
      { label: "Promotion Reports", href: "/v20/promotion-reports", requiredPermissions: "promotions.history" },
    ],
  },
  {
    label: "Attendance",
    icon: "flaticon-checklist",
    links: [
      { label: "Student Attendance", href: "/v21/student-attendance", requiredPermissions: "attendance.student.view" },
      { label: "Staff Attendance", href: "/v21/staff-attendance", requiredPermissions: "attendance.staff.view" },
      { label: "Attendance Reports", href: "/v21/attendance-dashboard", requiredPermissions: "attendance.dashboard.view" },
    ],
  },
  {
    label: "CBT",
    icon: "flaticon-checklist",
    links: [
      { label: "Quiz Panel", href: "/v27/cbt/admin", requiredPermissions: "cbt.admin.view" },
      { label: "CBT Link", href: "/v27/cbt/admin/cbt-link", requiredPermissions: "cbt.links.view" },
    ],
  },
  {
    label: "Settings",
    icon: "flaticon-settings",
    links: [
      { id: "grading-scale", label: "Grading Scale & Result Page", href: "/v19/grade-scales", requiredPermissions: "assessment.grade-scales.view" },
      { id: "skills", label: "Skills", href: "/v19/skills", requiredPermissions: "skills.categories.view" },
      {
        id: "assessment-components",
        label: "Assessment Components",
        href: "/v19/assessment-components",
        requiredPermissions: "assessment.components.view",
      },
      {
        id: "assessment-structure",
        label: "Assessment Structure",
        href: "/v19/assessment-structures",
        requiredPermissions: "assessment.structures.view",
      },
      { id: "academic-rollover", label: "Academic-Rollover", href: "/v20/academic-rollover", requiredPermissions: "academic.rollover.view" },
      {
        label: "Roles & Permissions",
        href: "#",
        children: [
          { label: "Roles", href: "/v24/roles", requiredPermissions: "roles.view" },
          { label: "User Roles", href: "/v24/user-roles", requiredPermissions: "user-roles.view" },
        ],
      },
    ],
  },
  // {
  //   label: "Fee Management",
  //   icon: "flaticon-planet-earth",
  //   links: [
  //     { label: "Fee Structure", href: "/v23/fee-structure", requiredPermissions: "fees.structures" },
  //     { label: "Bank Details", href: "/v23/bank-details", requiredPermissions: "fees.bank-details" },
  //   ],
  // },
  {
    label: "School Settings",
    icon: "flaticon-settings",
    links: [
      { label: "School Settings", href: "/v10/profile", requiredRoles: ["admin"] },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { schoolContext, user, hasPermission } = useAuth();
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({});
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const isTeacher = isTeacherUser(user);

  const logoSrc = useMemo(() => {
    const customLogo = schoolContext.school?.logo_url;
    return customLogo ? resolveBackendUrl(customLogo) : DEFAULT_LOGO;
  }, [schoolContext.school?.logo_url]);

  const brandLines = useMemo(() => {
    const raw = schoolContext.school?.short_name ?? schoolContext.school?.name;
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      return ["SMS"];
    }
    const lines = value
      .split(/<br\s*\/?>/i)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
    return lines.length ? lines : ["SMS"];
  }, [schoolContext.school?.short_name, schoolContext.school?.name]);

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
    return isTeacherUser(user) ? "/v25/staff-dashboard" : "/v10/dashboard";
  }, [user]);

  const isAdminRole = useMemo(
    () =>
      roleSet.has("admin") ||
      roleSet.has("super_admin") ||
      roleSet.has("superadmin") ||
      roleSet.has("administrator"),
    [roleSet],
  );

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

  const filterLinks = useCallback(
    function filterLinksRecursively(links: MenuLink[]): MenuLink[] {
      return links
        .map((link) => {
          if (link.children && link.children.length > 0) {
            const visibleChildren = filterLinksRecursively(link.children);
            if (visibleChildren.length === 0) {
              return null;
            }
            if (!linkVisible(link)) {
              return null;
            }
            return { ...link, children: visibleChildren };
          }
          return linkVisible(link) ? link : null;
        })
        .filter(Boolean) as MenuLink[];
    },
    [linkVisible],
  );

  const filteredQuickLinks = useMemo(() => {
    return sidebarQuickLinks.filter(linkVisible);
  }, [linkVisible]);

  const filteredSections = useMemo(() => {
    return menuSections
      .filter((section) => {
        if (isAdminRole && section.label === "Student") {
          return false;
        }
        if (!isTeacher) {
          return true;
        }
        return section.label !== "Management" && section.label !== "Assign";
      })
      .map((section) => ({
        ...section,
        links: filterLinks(section.links),
      }))
      .filter((section) => section.links.length > 0);
  }, [filterLinks, isTeacher, isAdminRole]);

  const isSectionActive = useCallback(
    (section: MenuSection) => section.links.some((link) => isLinkActive(link.href)),
    [isLinkActive],
  );

  const isGroupActive = (group: MenuLink) =>
    (group.children ?? []).some((link) => isLinkActive(link.href));

  const toggleSection = useCallback((label: string) => {
    setOpenSections((prev) => {
      const section = filteredSections.find((s) => s.label === label);
      const active = section ? isSectionActive(section) : false;
      const hasExplicit = Object.prototype.hasOwnProperty.call(prev, label);
      const isCurrentlyOpen = (hasExplicit ? prev[label] : undefined) ?? active;
      const nextOpen = !isCurrentlyOpen;

      if (!nextOpen) {
        // Closing the currently open section: explicitly keep it closed.
        return { [label]: false };
      }

      // Opening a section: close all others so only this one stays open.
      return { [label]: true };
    });
  }, [filteredSections, isSectionActive]);

  return (
    <div
      className="sidebar-main sidebar-menu-one sidebar-expand-md sidebar-color"
      style={{ backgroundColor: "#042C54" }}
    >
      <div className="mobile-sidebar-header d-md-none">
        <div className="header-logo d-flex align-items-center">
          <Link href={dashboardPath} className="sidebar-brand-link d-flex align-items-center">
            <Image
              className="sidebar-school-logo"
              id="sidebar-school-logo"
              src={logoSrc}
              alt="Sidebar logo"
              width={64}
              height={20}
              unoptimized
              loader={passthroughLoader}
            />
            <span className="sidebar-brand-text">
              {brandLines.map((line, index) => (
                <span key={index}>
                  {index > 0 && <br />}
                  {line}
                </span>
              ))}
            </span>
          </Link>
        </div>
      </div>

      <div
        className="sidebar-menu-content"
        style={{ paddingTop: "var(--sidebar-menu-top-padding, 10px)" }}
      >
        <ul className="nav nav-sidebar-menu sidebar-toggle-view" style={{ paddingTop: 6 }}>
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

          {filteredSections.map((section, idx) => {
            const active = isSectionActive(section);
            const hasExplicitState = Object.keys(openSections).length > 0;
            const open = Object.prototype.hasOwnProperty.call(openSections, section.label)
              ? Boolean(openSections[section.label])
              : hasExplicitState
                ? false
                : active;
            const isFirstSection = idx === 0;
            return (
              <li
                key={section.label}
                className={`nav-item sidebar-nav-item ${open ? "open active" : ""}`}
                style={isFirstSection ? { borderTop: "none" } : undefined}
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
                  {section.links.map((link) => {
                    if (link.children && link.children.length > 0) {
                      const groupKey = `${section.label}:${link.label}`;
                      const groupOpen = Object.prototype.hasOwnProperty.call(openGroups, groupKey)
                        ? Boolean(openGroups[groupKey])
                        : isGroupActive(link);
                      return (
                        <li
                          key={groupKey}
                          className={`nav-item ${groupOpen ? "open active" : ""}`}
                        >
                          <a
                            href="#"
                            className="nav-link d-flex align-items-center justify-content-between"
                            onClick={(event) => {
                              event.preventDefault();
                              setOpenGroups((prev) => ({
                                ...prev,
                                [groupKey]: !groupOpen,
                              }));
                            }}
                          >
                            <span>{link.label}</span>
                            <i className={`fas fa-angle-${groupOpen ? "down" : "right"}`} />
                          </a>
                          <ul
                            className="nav sub-group-menu"
                            style={{ display: groupOpen ? "block" : "none", paddingLeft: 18 }}
                          >
                            {link.children.map((child) => (
                              <li
                                key={child.id || child.href}
                                className={`nav-item ${isLinkActive(child.href) ? "active" : ""}`}
                              >
                                <Link href={child.href} className="nav-link">
                                  {child.label}
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </li>
                      );
                    }

                    return (
                      <li
                        key={link.id || link.href}
                        className={`nav-item ${isLinkActive(link.href) ? "active" : ""}`}
                      >
                        <Link href={link.href} className="nav-link">
                          {link.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
