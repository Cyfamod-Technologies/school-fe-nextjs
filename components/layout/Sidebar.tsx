"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { useCallback, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { resolveBackendUrl } from "@/lib/config";

const DEFAULT_LOGO = "/assets/img/logo1.png";
const passthroughLoader: ImageLoader = ({ src }) => src;

interface MenuLink {
  label: string;
  href: string;
}

interface MenuSection {
  label: string;
  icon: string;
  links: MenuLink[];
}

const menuSections: MenuSection[] = [
  {
    label: "Management",
    icon: "flaticon-technological",
    links: [
      { label: "Session", href: "/v11/all-sessions" },
      { label: "Term", href: "/v11/all-terms" },
      { label: "Subject", href: "/v16/all-subjects" },
      { label: "Result Pin", href: "/v19/pins" },
    ],
  },
  {
    label: "Parent",
    icon: "flaticon-couple",
    links: [
      { label: "View Parent", href: "/v13/all-parents" },
      { label: "Add Parent", href: "/v13/add-parent" },
    ],
  },
  {
    label: "Staff",
    icon: "flaticon-multiple-users-silhouette",
    links: [
      { label: "View Staff", href: "/v15/all-staff" },
      { label: "Add Staff", href: "/v15/add-staff" },
    ],
  },
  {
    label: "Classes",
    icon: "flaticon-maths-class-materials-cross-of-a-pencil-and-a-ruler",
    links: [
      { label: "Class", href: "/v12/all-classes" },
      { label: "Class Arm", href: "/v12/all-class-arms" },
      // { label: "Class Section", href: "/v12/all-class-arm-sections" },
    ],
  },
  {
    label: "Assign",
    icon: "flaticon-maths-class-materials-cross-of-a-pencil-and-a-ruler",
    links: [
      { label: "Subject to Class", href: "/v17/assign-subjects" },
      { label: "Teachers to Subject", href: "/v17/assign-teachers" },
      { label: "Teachers to Class", href: "/v18/assign-class-teachers" },
    ],
  },
  {
    label: "Student",
    icon: "flaticon-classmates",
    links: [
      { label: "View Student", href: "/v14/all-students" },
      { label: "Add Student", href: "/v14/add-student" },
      { label: "Result Entry", href: "/v19/results-entry" },
      { label: "Bulk Upload", href: "/v22/bulk-student-upload" },
      { label: "Student Promotion", href: "/v20/student-promotion" },
      { label: "Promotion Reports", href: "/v20/promotion-reports" },
    ],
  },
  {
    label: "Attendance",
    icon: "flaticon-checklist",
    links: [
      { label: "Student Attendance", href: "/v21/student-attendance" },
      { label: "Staff Attendance", href: "/v21/staff-attendance" },
      { label: "Attendance Reports", href: "/v21/attendance-dashboard" },
    ],
  },
  {
    label: "Settings",
    icon: "flaticon-settings",
    links: [
      { label: "Grading-Scale", href: "/v19/grade-scales" },
      { label: "Skills", href: "/v19/skills" },
      {
        label: "Assessment-component",
        href: "/v19/assessment-components",
      },
      { label: "Academic-Rollover", href: "/v20/academic-rollover" },
      { label: "School-settings", href: "/v10/profile" },
    ],
  },
  {
    label: "Fee Management",
    icon: "flaticon-planet-earth",
    links: [
      { label: "Fee Structure", href: "/v23/fee-structure" },
      { label: "Bank Details", href: "/v23/bank-details" },
    ],
  },
  {
    label: "RBAC",
    icon: "flaticon-technological",
    links: [
      { label: "Roles", href: "/v24/roles" },
      { label: "User Roles", href: "/v24/user-roles" },
    ],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  const { schoolContext } = useAuth();
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

  const isLinkActive = (href: string) =>
    pathname === href || pathname.startsWith(`${href}/`);

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
          <Link href="/v10/dashboard" className="d-flex align-items-center">
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
          <li className={`nav-item ${isLinkActive("/v10/dashboard") ? "open" : ""}`}>
            <Link href="/v10/dashboard" className="nav-link">
              <i className="flaticon-dashboard" />
              <span>Dashboard</span>
            </Link>
          </li>

          {menuSections.map((section) => {
            const active = isSectionActive(section);
            const open = openSections[section.label] ?? active;
            return (
              <li
                key={section.label}
                className={`nav-item sidebar-nav-item ${
                  open ? "open active" : ""
                }`}
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

          <li className={`nav-item ${isLinkActive("/v10/profile") ? "open" : ""}`}>
            <Link href="/v10/profile" className="nav-link">
              <i className="flaticon-classmates" />
              <span>Account</span>
            </Link>
          </li>
        </ul>
      </div>
    </div>
  );
}
