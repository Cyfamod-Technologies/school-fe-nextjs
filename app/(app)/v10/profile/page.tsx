"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { resolveBackendUrl } from "@/lib/config";

export default function SchoolProfilePage() {
  const { user, schoolContext, loading, refreshSchoolContext } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    refreshSchoolContext().catch((err) => {
      setError(
        err instanceof Error
          ? err.message
          : "Unable to refresh school context.",
      );
    });
  }, [refreshSchoolContext]);

  const school = schoolContext.school;

  const logoSrc = school?.logo_url
    ? resolveBackendUrl(String(school.logo_url))
    : "/assets/img/logo.png";

  const signatureSrc = school?.signature_url
    ? resolveBackendUrl(String(school.signature_url))
    : null;

  const passthroughLoader: ImageLoader = ({ src }) => src;

  const schoolNameLines = useMemo(() => {
    const raw = school?.name ?? "";
    const value = typeof raw === "string" ? raw.trim() : "";
    if (!value) {
      return ["N/A"];
    }
    // Support manual line breaks via <br>, <br/>, or <br /> in the name field.
    return value
      .split(/<br\s*\/?>/i)
      .map((part) => part.trim())
      .filter((part) => part.length > 0);
  }, [school?.name]);

  const adminRole =
    user != null
      ? (() => {
          const directRole = (user as { role?: unknown }).role;
          if (typeof directRole === "string" && directRole.trim().length > 0) {
            return directRole.trim();
          }
          const roles = (user as { roles?: { name?: string | null }[] }).roles;
          const derived = roles?.find((entry) => entry?.name)?.name?.trim();
          return derived && derived.length > 0 ? derived : "N/A";
        })()
      : "N/A";

  if (loading && !school) {
    return (
      <div className="d-flex align-items-center justify-content-center flex-column min-vh-100">
        <div className="spinner-border text-primary mb-3" role="status">
          <span className="sr-only">Loading...</span>
        </div>
        <p className="text-muted">Loading school profile…</p>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>School Profile</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Profile</li>
        </ul>
      </div>

      {error ? (
        <div id="error-container" className="alert alert-danger" role="alert">
          Failed to load profile data: {error}
        </div>
      ) : null}

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>School Profile</h3>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <button
                    type="button"
                    className="btn btn-sm btn-outline-secondary"
                    onClick={() =>
                      refreshSchoolContext().catch((err) =>
                        setError(
                          err instanceof Error
                            ? err.message
                            : "Unable to refresh school data.",
                        ),
                      )
                    }
                  >
                    Refresh
                  </button>
                  <Link
                    className="btn btn-sm btn-outline-primary"
                    href="/v10/edit-school-profile"
                  >
                    Edit
                  </Link>
                </div>
              </div>
              <div className="user-details-box">
                <div className="item-img d-flex align-items-center">
                  <Image
                    id="school-logo"
                    src={logoSrc}
                    alt="school logo"
                    width={160}
                    height={70}
                    unoptimized
                    style={{
                      maxHeight: "70px",
                      width: "auto",
                      marginRight: "20px",
                    }}
                    loader={passthroughLoader}
                  />
                  {signatureSrc ? (
                    <Image
                      id="school-signature"
                      src={signatureSrc}
                      alt="school signature"
                      width={160}
                      height={70}
                      unoptimized
                      style={{ maxHeight: "70px", width: "auto" }}
                      loader={passthroughLoader}
                    />
                  ) : null}
                </div>
                <div className="item-content">
                  <div className="info-table table-responsive">
                    <table className="table text-nowrap">
                      <tbody>
                        <tr>
                          <td>School Name:</td>
                          <td
                            id="school-name"
                            className="font-medium text-dark-medium"
                          >
                            {schoolNameLines.map((line, index) => (
                              <span key={index}>
                                {index > 0 && <br />}
                                {line}
                              </span>
                            ))}
                          </td>
                        </tr>
                        <tr>
                          <td>Address:</td>
                          <td
                            id="school-address"
                            className="font-medium text-dark-medium"
                          >
                            {school?.address ?? "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td>Email:</td>
                          <td
                            id="school-email"
                            className="font-medium text-dark-medium"
                          >
                            {school?.email ?? "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td>Phone:</td>
                          <td
                            id="school-phone"
                            className="font-medium text-dark-medium"
                          >
                            {school?.phone ?? "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td>Current Session:</td>
                          <td
                            id="school-current-session"
                            className="font-medium text-dark-medium"
                          >
                            {schoolContext.current_session?.name ?? "Not set"}
                          </td>
                        </tr>
                        <tr>
                          <td>Current Term:</td>
                          <td
                            id="school-current-term"
                            className="font-medium text-dark-medium"
                          >
                            {schoolContext.current_term?.name ?? "Not set"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12-xxxl col-xl-7">
          <div className="card account-settings-box">
            <div className="card-body">
              <div className="heading-layout1 mg-b-20">
                <div className="item-title">
                  <h3>School Admin Details</h3>
                </div>
                <div className="d-flex flex-wrap gap-2">
                  <Link
                    className="btn btn-sm btn-outline-primary"
                    href="/v10/edit-admin-profile"
                  >
                    Edit
                  </Link>
                </div>
              </div>
              <div className="user-details-box">
                <div className="item-content">
                  <div className="info-table table-responsive">
                    <table className="table text-nowrap">
                      <tbody>
                        <tr>
                          <td>Name:</td>
                          <td
                            id="admin-name"
                            className="font-medium text-dark-medium"
                          >
                            {user?.name ?? "N/A"}
                          </td>
                        </tr>
                        <tr>
                          <td>User Type:</td>
                          <td
                            id="admin-role"
                            className="font-medium text-dark-medium"
                          >
                            {adminRole}
                          </td>
                        </tr>
                        <tr>
                          <td>E-mail:</td>
                          <td
                            id="admin-email"
                            className="font-medium text-dark-medium"
                          >
                            {user?.email ?? "N/A"}
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer-wrap-layout1">
        <div className="copyright">
          © Copyrights <a href="#">Cyfamod Technologies</a> 2026. All rights
          reserved.
        </div>
      </footer>
    </>
  );
}
