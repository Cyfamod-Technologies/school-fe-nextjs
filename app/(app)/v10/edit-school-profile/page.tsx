"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { resolveBackendUrl } from "@/lib/config";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { updateSchoolProfile } from "@/lib/school";

interface FormState {
  name: string;
  email: string;
  phone: string;
  address: string;
  student_portal_link: string;
  term_school_opened_days: string;
  current_session_id: string;
  current_term_id: string;
  skill_categories_separate_by_class: boolean;
  skill_types_separate_by_class: boolean;
}

const initialFormState: FormState = {
  name: "",
  email: "",
  phone: "",
  address: "",
  student_portal_link: "",
  term_school_opened_days: "",
  current_session_id: "",
  current_term_id: "",
  skill_categories_separate_by_class: false,
  skill_types_separate_by_class: false,
};

export default function EditSchoolProfilePage() {
  const router = useRouter();
  const { schoolContext, refreshSchoolContext, refreshAuth } = useAuth();

  const [form, setForm] = useState<FormState>(initialFormState);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [termsBySession, setTermsBySession] = useState<Record<string, Term[]>>(
    {},
  );
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [signatureFile, setSignatureFile] = useState<File | null>(null);
  const [removeSignature, setRemoveSignature] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const school = schoolContext.school;

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => {
        console.error("Unable to load sessions", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load sessions. Please try again.",
        );
      });
  }, []);

  const loadTerms = useCallback(
    async (sessionId: string) => {
      if (!sessionId || termsBySession[sessionId]) {
        return;
      }
      setLoading(true);
      try {
        const terms = await listTermsBySession(sessionId);
        setTermsBySession((prev) => ({
          ...prev,
          [sessionId]: terms,
        }));
      } catch (err) {
        console.error("Unable to load terms", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load terms for the selected session.",
        );
      } finally {
        setLoading(false);
      }
    },
    [termsBySession],
  );

  useEffect(() => {
    listSessions()
      .then(setSessions)
      .catch((err) => {
        console.error("Unable to load sessions", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load sessions. Please try again.",
        );
      });
  }, []);

  useEffect(() => {
    if (!school) {
      return;
    }

    setForm({
      name: school.name ?? "",
      email: school.email ?? "",
      phone: `${school.phone ?? ""}`,
      address: school.address ?? "",
      student_portal_link: school.student_portal_link ?? "",
      term_school_opened_days:
        school.term_school_opened_days !== null &&
        school.term_school_opened_days !== undefined
          ? `${school.term_school_opened_days}`
          : "",
      current_session_id: school.current_session_id
        ? `${school.current_session_id}`
        : "",
      current_term_id: school.current_term_id
        ? `${school.current_term_id}`
        : "",
      skill_categories_separate_by_class: Boolean(
        school.skill_categories_separate_by_class,
      ),
      skill_types_separate_by_class: Boolean(
        school.skill_types_separate_by_class,
      ),
    });

    const sessionId = school.current_session_id
      ? `${school.current_session_id}`
      : "";

    if (sessionId) {
      loadTerms(sessionId).catch((err) => console.error(err));
    }

    setRemoveSignature(false);
    setLogoFile(null);
    setSignatureFile(null);
  }, [school, loadTerms]);

  useEffect(() => {
    if (form.current_session_id) {
      loadTerms(form.current_session_id).catch((err) =>
        console.error("Unable to load terms", err),
      );
    }
  }, [form.current_session_id, loadTerms]);

  const handleFieldChange = (
    key: keyof FormState,
    value: string,
  ) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
      ...(key === "current_session_id"
        ? { current_term_id: "" }
        : null),
    }));
  };

  const handleBooleanChange = (key: keyof FormState, value: boolean) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const existingLogoUrl = useMemo(() => {
    if (!school?.logo_url) {
      return null;
    }
    return resolveBackendUrl(school.logo_url);
  }, [school?.logo_url]);

  const existingSignatureUrl = useMemo(() => {
    if (!school?.signature_url) {
      return null;
    }
    return resolveBackendUrl(String(school.signature_url));
  }, [school?.signature_url]);

  const currentSessionTerms =
    termsBySession[form.current_session_id] ?? [];

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateSchoolProfile({
        ...form,
        logo: logoFile,
        signature: signatureFile,
        removeSignature: removeSignature && !signatureFile,
      });

      await refreshSchoolContext();
      await refreshAuth();

      router.push("/v10/profile");
    } catch (err) {
      console.error("Failed to update school profile", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update school profile.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Edit School Profile</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Edit Profile</li>
        </ul>
      </div>

      {error ? (
        <div id="error-container" className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Edit School Profile</h3>
                </div>
                <div className="dropdown">
                  <a
                    className="dropdown-toggle"
                    href="#"
                    role="button"
                    data-toggle="dropdown"
                    aria-expanded="false"
                  >
                    ...
                  </a>

                  <div className="dropdown-menu dropdown-menu-right">
                    <button className="dropdown-item" type="button">
                      <i className="fas fa-times text-orange-red" />
                      Close
                    </button>
                    <Link className="dropdown-item" href="/v10/profile">
                      <i className="fas fa-eye text-dark-pastel-green" />
                      View
                    </Link>
                  </div>
                </div>
              </div>

              <form
                id="school-profile-form"
                className="new-added-form"
                onSubmit={handleSubmit}
              >
                <div className="row">
                  <div className="col-xl-6 col-lg-6 col-12 form-group">
                    <label htmlFor="school-name">School Name *</label>
                    <input
                      id="school-name"
                      type="text"
                      className="form-control"
                      value={form.name}
                      onChange={(event) =>
                        handleFieldChange("name", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-xl-6 col-lg-6 col-12 form-group">
                    <label htmlFor="school-email">Email *</label>
                    <input
                      id="school-email"
                      type="email"
                      className="form-control"
                      value={form.email}
                      onChange={(event) =>
                        handleFieldChange("email", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-xl-6 col-lg-6 col-12 form-group">
                    <label htmlFor="school-phone">Phone *</label>
                    <input
                      id="school-phone"
                      type="text"
                      className="form-control"
                      value={form.phone}
                      onChange={(event) =>
                        handleFieldChange("phone", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="school-address">Address *</label>
                    <textarea
                      id="school-address"
                      className="textarea form-control"
                      rows={4}
                      value={form.address}
                      onChange={(event) =>
                        handleFieldChange("address", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="student-portal-link">Student Portal Link</label>
                    <input
                      id="student-portal-link"
                      type="url"
                      className="form-control"
                      value={form.student_portal_link}
                      onChange={(event) =>
                        handleFieldChange(
                          "student_portal_link",
                          event.target.value,
                        )
                      }
                      placeholder="https://portal.example.com"
                    />
                    <small className="form-text text-muted">
                      This link is shown on result scratch cards.
                    </small>
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="term-school-opened-days">
                      No. of School Days in Term
                    </label>
                    <input
                      id="term-school-opened-days"
                      type="number"
                      min="1"
                      max="366"
                      className="form-control"
                      value={form.term_school_opened_days}
                      onChange={(event) =>
                        handleFieldChange(
                          "term_school_opened_days",
                          event.target.value,
                        )
                      }
                      placeholder="e.g. 92"
                    />
                    <small className="form-text text-muted">
                      If left empty, this will not show on result pages.
                    </small>
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="school-logo">School Logo</label>
                    <input
                      id="school-logo"
                      type="file"
                      className="form-control-file"
                      accept="image/*"
                      onChange={(event) =>
                        setLogoFile(event.target.files?.[0] ?? null)
                      }
                    />
                    {existingLogoUrl ? (
                      <p className="mt-2">
                        Current Logo:{" "}
                        <a href={existingLogoUrl} target="_blank" rel="noreferrer">
                          <Image
                            src={existingLogoUrl}
                            alt="Current logo"
                            width={80}
                            height={40}
                            style={{ width: "auto", height: "auto" }}
                            unoptimized
                            loader={passthroughLoader}
                          />
                        </a>
                      </p>
                    ) : null}
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="school-signature">School Signature</label>
                    <input
                      id="school-signature"
                      type="file"
                      className="form-control-file"
                      accept="image/*"
                      onChange={(event) => {
                        setSignatureFile(event.target.files?.[0] ?? null);
                        setRemoveSignature(false);
                      }}
                    />
                    {existingSignatureUrl && !removeSignature ? (
                      <div className="mt-2">
                        <a
                          href={existingSignatureUrl}
                          target="_blank"
                          rel="noreferrer"
                        >
                          View current signature
                        </a>
                        <div>
                          <button
                            type="button"
                            className="btn btn-sm btn-outline-danger mt-2"
                            onClick={() => {
                              setSignatureFile(null);
                              setRemoveSignature(true);
                            }}
                          >
                            Remove Signature
                          </button>
                        </div>
                      </div>
                    ) : null}
                    {removeSignature ? (
                      <p className="text-danger mt-2">Signature will be removed.</p>
                    ) : null}
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="current-session">Current Session</label>
                    <select
                      id="current-session"
                      className="form-control"
                      value={form.current_session_id}
                      onChange={(event) =>
                        handleFieldChange("current_session_id", event.target.value)
                      }
                    >
                      <option value="">Select session</option>
                      {sessions.map((session) => (
                        <option key={session.id} value={session.id}>
                          {session.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="current-term">Current Term</label>
                    <select
                      id="current-term"
                      className="form-control"
                      value={form.current_term_id}
                      onChange={(event) =>
                        handleFieldChange("current_term_id", event.target.value)
                      }
                      disabled={
                        !form.current_session_id || loading
                      }
                    >
                      <option value="">Select term</option>
                      {currentSessionTerms.map((term) => (
                        <option key={term.id} value={term.id}>
                          {term.name}
                        </option>
                      ))}
                    </select>
                    <small className="form-text text-muted">
                      Selecting a session filters the available terms to keep them
                      in sync.
                    </small>
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label className="d-block">Skill Scope</label>
                    <div className="form-check mb-2">
                      <input
                        id="skill-categories-separate-by-class"
                        className="form-check-input"
                        type="checkbox"
                        checked={form.skill_categories_separate_by_class}
                        onChange={(event) =>
                          handleBooleanChange(
                            "skill_categories_separate_by_class",
                            event.target.checked,
                          )
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="skill-categories-separate-by-class"
                      >
                        Separate skill categories by class
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        id="skill-types-separate-by-class"
                        className="form-check-input"
                        type="checkbox"
                        checked={form.skill_types_separate_by_class}
                        onChange={(event) =>
                          handleBooleanChange(
                            "skill_types_separate_by_class",
                            event.target.checked,
                          )
                        }
                      />
                      <label
                        className="form-check-label"
                        htmlFor="skill-types-separate-by-class"
                      >
                        Separate skills by class
                      </label>
                    </div>
                    <small className="form-text text-muted">
                      Leave these off to keep categories and skills shared across
                      the whole school.
                    </small>
                  </div>
                  <div className="col-12 form-group mg-t-8">
                    <button
                      type="submit"
                      className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                      disabled={submitting}
                    >
                      {submitting ? "Saving..." : "Save"}
                    </button>
                    <Link
                      href="/v10/profile"
                      className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                    >
                      Cancel
                    </Link>
                  </div>
                </div>
              </form>
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
  const passthroughLoader: ImageLoader = ({ src }) => src;
