"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { publicWebsitePreviewUrl, publicWebsiteUrl } from "@/lib/config";
import { userHasRole } from "@/lib/roleChecks";
import {
  createDefaultSchoolWebsite,
  getPreviewLink,
  getSchoolWebsite,
  saveSchoolWebsite,
  THEME_OPTIONS,
  type SchoolWebsite,
  type SchoolWebsitePayload,
  type SchoolWebsiteStatus,
} from "@/lib/schoolWebsite";

function toPayload(website: SchoolWebsite): SchoolWebsitePayload {
  const { id, schoolId, publishedAt, createdAt, updatedAt, ...payload } =
    website;
  void id;
  void schoolId;
  void publishedAt;
  void createdAt;
  void updatedAt;
  return payload;
}

const STATUS_LABELS: Record<SchoolWebsiteStatus | "unconfigured", string> = {
  unconfigured: "Not configured",
  draft: "Draft",
  published: "Published",
  unpublished: "Unpublished",
};

const STATUS_BADGE_CLASS: Record<SchoolWebsiteStatus | "unconfigured", string> = {
  unconfigured: "badge badge-secondary",
  draft: "badge badge-warning",
  published: "badge badge-success",
  unpublished: "badge badge-danger",
};

export default function WebsiteManagementPage() {
  const { user, schoolContext, hasPermission } = useAuth();
  const school = schoolContext.school;

  const isAdminUser =
    userHasRole(user, "admin") || userHasRole(user, "super_admin");
  const canView = isAdminUser && hasPermission("settings.school.view");
  const canManage = isAdminUser && hasPermission("settings.school.update");

  const [form, setForm] = useState<SchoolWebsitePayload | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<string | null>(null);
  const [status, setStatus] = useState<SchoolWebsiteStatus | "unconfigured">(
    "unconfigured",
  );
  const [publishedAt, setPublishedAt] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]> | null>(
    null,
  );
  const [submittingStatus, setSubmittingStatus] =
    useState<SchoolWebsiteStatus | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    if (!school) {
      return;
    }

    let cancelled = false;
    setLoading(true);
    setLoadError(null);

    getSchoolWebsite()
      .then((website) => {
        if (cancelled) {
          return;
        }

        if (website) {
          const payload = toPayload(website);
          setForm(payload);
          setSavedSnapshot(JSON.stringify(payload));
          setStatus(website.status);
          setPublishedAt(website.publishedAt);
        } else {
          const defaults = createDefaultSchoolWebsite(school);
          setForm(defaults);
          setSavedSnapshot(null);
          setStatus("unconfigured");
          setPublishedAt(null);
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load school website", error);
        setLoadError(
          error instanceof Error
            ? error.message
            : "Unable to load website settings. Please try again.",
        );
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [school]);

  const hasUnsavedChanges = useMemo(() => {
    if (!form) {
      return false;
    }
    return JSON.stringify(form) !== savedSnapshot;
  }, [form, savedSnapshot]);

  const publicUrl = publicWebsiteUrl(school?.slug ?? null);

  if (!canView) {
    return (
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <p className="mb-0">
                You do not have permission to view Website Management.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loading || !form) {
    return (
      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              {loadError ? (
                <div className="alert alert-danger" role="alert">
                  {loadError}
                </div>
              ) : (
                <p className="mb-0">Loading website settings…</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  const updateBranding = (key: "primaryColor" | "secondaryColor", value: string) => {
    setForm((prev) =>
      prev ? { ...prev, branding: { ...prev.branding, [key]: value } } : prev,
    );
  };

  const updateThemeKey = (value: string) => {
    setForm((prev) => (prev ? { ...prev, themeKey: value } : prev));
  };

  const updateHeader = (
    key: "welcomeText" | "utilityText" | "tagline",
    value: string,
  ) => {
    setForm((prev) =>
      prev ? { ...prev, header: { ...prev.header, [key]: value } } : prev,
    );
  };

  const updateHero = (
    key: "eyebrow" | "title" | "description" | "imageUrl",
    value: string,
  ) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            hero: {
              ...prev.hero,
              [key]: key === "imageUrl" ? value || null : value,
            },
          }
        : prev,
    );
  };

  const updateHeroAction = (
    which: "primaryAction" | "secondaryAction",
    key: "label" | "href",
    value: string,
  ) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            hero: {
              ...prev.hero,
              [which]: { ...prev.hero[which], [key]: value },
            },
          }
        : prev,
    );
  };

  const updateInfoCard = (
    key: "label" | "title" | "description",
    value: string,
  ) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            hero: {
              ...prev.hero,
              infoCard: { ...prev.hero.infoCard, [key]: value },
            },
          }
        : prev,
    );
  };

  const updateTrustItem = (index: number, value: string) => {
    setForm((prev) => {
      if (!prev) {
        return prev;
      }
      const items = [...prev.hero.trustItems];
      items[index] = value;
      return { ...prev, hero: { ...prev.hero, trustItems: items } };
    });
  };

  const fieldError = (key: string): string | null => {
    const messages = fieldErrors?.[key];
    return messages && messages.length > 0 ? messages[0] : null;
  };

  const handleSave = async (nextStatus: SchoolWebsiteStatus) => {
    if (!form) {
      return;
    }

    setSubmittingStatus(nextStatus);
    setSubmitError(null);
    setFieldErrors(null);
    setSuccessMessage(null);

    const trustItems = form.hero.trustItems
      .map((item) => item.trim())
      .filter(Boolean);

    if (trustItems.length === 0) {
      setSubmitError(
        "At least one trust item is required. Fill in at least one of the trust item fields.",
      );
      setSubmittingStatus(null);
      return;
    }

    const heroTitle = form.hero.title.trim() || school?.name || "Our School";
    const heroDescription = form.hero.description.trim();

    const payload: SchoolWebsitePayload = {
      ...form,
      hero: { ...form.hero, title: heroTitle, trustItems },
      seo: {
        ...form.seo,
        title: heroTitle,
        description: heroDescription || form.seo.description,
        imageUrl: form.hero.imageUrl,
      },
    };

    try {
      const saved = await saveSchoolWebsite(payload, nextStatus);
      const savedPayload = toPayload(saved);
      setForm(savedPayload);
      setSavedSnapshot(JSON.stringify(savedPayload));
      setStatus(saved.status);
      setPublishedAt(saved.publishedAt);
      setSuccessMessage(
        nextStatus === "published"
          ? "Website published."
          : nextStatus === "unpublished"
            ? "Website unpublished."
            : "Draft saved.",
      );
    } catch (error) {
      console.error("Failed to save school website", error);
      if (error instanceof ApiError && error.status === 422 && error.errors) {
        setFieldErrors(error.errors);
        setSubmitError("Please fix the highlighted fields and try again.");
      } else {
        setSubmitError(
          error instanceof Error
            ? error.message
            : "Unable to save website settings. Please try again.",
        );
      }
    } finally {
      setSubmittingStatus(null);
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    handleSave(status === "unconfigured" ? "draft" : status);
  };

  const handleOpenPreview = async () => {
    setPreviewError(null);

    if (hasUnsavedChanges) {
      setPreviewError(
        "You have unsaved changes -- Preview only shows what's already saved. Click \"Save as Draft\" first, then Preview.",
      );
      return;
    }

    setPreviewLoading(true);
    try {
      const link = await getPreviewLink();
      const embedUrl = publicWebsitePreviewUrl(school?.slug ?? null, link.url);
      if (!embedUrl) {
        throw new Error(
          "This school has no slug yet, so a preview link can't be built.",
        );
      }
      setPreviewUrl(embedUrl);
    } catch (error) {
      console.error("Failed to load preview link", error);
      setPreviewError(
        error instanceof Error
          ? error.message
          : "Unable to load a preview link. Save a draft first, then try again.",
      );
    } finally {
      setPreviewLoading(false);
    }
  };

  // Unlike Preview, Publish always saves the current form state -- it has
  // no stale-data risk to warn about. This is a deliberate confirmation
  // step instead: publishing goes live immediately, so a heads-up before
  // that happens (especially with edits still uncommitted to a draft) is
  // worth the extra click.
  const handlePublishClick = () => {
    if (
      hasUnsavedChanges &&
      !window.confirm(
        "You have unsaved changes. Publishing will save and make these changes live immediately -- continue?",
      )
    ) {
      return;
    }

    handleSave("published");
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Website Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Website Management</li>
        </ul>
      </div>

      {loadError ? (
        <div className="alert alert-danger" role="alert">
          {loadError}
        </div>
      ) : null}
      {submitError ? (
        <div className="alert alert-danger" role="alert">
          {submitError}
        </div>
      ) : null}
      {successMessage ? (
        <div className="alert alert-success" role="alert">
          {successMessage}
        </div>
      ) : null}

      <div className="row">
        <div className="col-12">
          <div className="card">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>
                    Website Status:{" "}
                    <span className={STATUS_BADGE_CLASS[status]}>
                      {STATUS_LABELS[status]}
                    </span>
                  </h3>
                  {publishedAt ? (
                    <p className="mb-0">
                      Last published {new Date(publishedAt).toLocaleString()}
                    </p>
                  ) : null}
                </div>
                <div className="d-flex align-items-center" style={{ gap: 8 }}>
                  <button
                    type="button"
                    className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                    onClick={handleOpenPreview}
                    disabled={previewLoading || status === "unconfigured"}
                    title={
                      status === "unconfigured"
                        ? "Save as Draft first, then Preview"
                        : "Shows the last saved draft, not unsaved changes"
                    }
                  >
                    {previewLoading ? "Loading Preview…" : "Preview"}
                  </button>
                  {publicUrl ? (
                    <a
                      href={publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                    >
                      View Public Website
                    </a>
                  ) : (
                    <p className="mb-0 text-muted">
                      Public website link unavailable (school has no slug yet).
                    </p>
                  )}
                </div>
              </div>

              {previewError ? (
                <div className="alert alert-danger mt-3" role="alert">
                  {previewError}
                </div>
              ) : null}

              <form
                id="website-management-form"
                className="new-added-form"
                onSubmit={handleSubmit}
              >
                <h4 className="mt-4">Theme</h4>
                <div className="row">
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="website-theme-key">Website Theme *</label>
                    <select
                      id="website-theme-key"
                      className="form-control"
                      value={form.themeKey}
                      onChange={(event) => updateThemeKey(event.target.value)}
                      required
                    >
                      {THEME_OPTIONS.map((option) => (
                        <option key={option.key} value={option.key}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    {fieldError("themeKey") ? (
                      <small className="text-danger">
                        {fieldError("themeKey")}
                      </small>
                    ) : null}
                  </div>
                </div>

                <h4 className="mt-4">Branding</h4>
                <div className="row">
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="branding-primary-color">Primary Colour *</label>
                    <div className="d-flex align-items-center">
                      <input
                        id="branding-primary-color"
                        type="color"
                        value={form.branding.primaryColor}
                        onChange={(event) =>
                          updateBranding("primaryColor", event.target.value)
                        }
                        style={{ width: 48, height: 38, marginRight: 8 }}
                      />
                      <input
                        type="text"
                        className="form-control"
                        value={form.branding.primaryColor}
                        onChange={(event) =>
                          updateBranding("primaryColor", event.target.value)
                        }
                        placeholder="#172033"
                        required
                      />
                    </div>
                    {fieldError("branding.primaryColor") ? (
                      <small className="text-danger">
                        {fieldError("branding.primaryColor")}
                      </small>
                    ) : null}
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="branding-secondary-color">
                      Secondary Colour *
                    </label>
                    <div className="d-flex align-items-center">
                      <input
                        id="branding-secondary-color"
                        type="color"
                        value={form.branding.secondaryColor}
                        onChange={(event) =>
                          updateBranding("secondaryColor", event.target.value)
                        }
                        style={{ width: 48, height: 38, marginRight: 8 }}
                      />
                      <input
                        type="text"
                        className="form-control"
                        value={form.branding.secondaryColor}
                        onChange={(event) =>
                          updateBranding("secondaryColor", event.target.value)
                        }
                        placeholder="#f97316"
                        required
                      />
                    </div>
                    {fieldError("branding.secondaryColor") ? (
                      <small className="text-danger">
                        {fieldError("branding.secondaryColor")}
                      </small>
                    ) : null}
                  </div>
                </div>

                <h4 className="mt-4">Header</h4>
                <div className="row">
                  <div className="col-lg-4 col-12 form-group">
                    <label htmlFor="header-welcome-text">Welcome Text *</label>
                    <input
                      id="header-welcome-text"
                      type="text"
                      className="form-control"
                      value={form.header.welcomeText}
                      onChange={(event) =>
                        updateHeader("welcomeText", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-4 col-12 form-group">
                    <label htmlFor="header-utility-text">Utility Text *</label>
                    <input
                      id="header-utility-text"
                      type="text"
                      className="form-control"
                      value={form.header.utilityText}
                      onChange={(event) =>
                        updateHeader("utilityText", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-4 col-12 form-group">
                    <label htmlFor="header-tagline">Tagline *</label>
                    <input
                      id="header-tagline"
                      type="text"
                      className="form-control"
                      value={form.header.tagline}
                      onChange={(event) =>
                        updateHeader("tagline", event.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                <h4 className="mt-4">Hero</h4>
                <div className="row">
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="hero-eyebrow">Eyebrow *</label>
                    <input
                      id="hero-eyebrow"
                      type="text"
                      className="form-control"
                      value={form.hero.eyebrow}
                      onChange={(event) =>
                        updateHero("eyebrow", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="hero-title">Title *</label>
                    <input
                      id="hero-title"
                      type="text"
                      className="form-control"
                      value={form.hero.title}
                      onChange={(event) => updateHero("title", event.target.value)}
                      required
                    />
                  </div>
                  <div className="col-12 form-group">
                    <label htmlFor="hero-description">Description *</label>
                    <textarea
                      id="hero-description"
                      className="textarea form-control"
                      rows={4}
                      value={form.hero.description}
                      onChange={(event) =>
                        updateHero("description", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-12 form-group">
                    <label htmlFor="hero-image-url">Hero Image URL</label>
                    <input
                      id="hero-image-url"
                      type="url"
                      className="form-control"
                      value={form.hero.imageUrl ?? ""}
                      onChange={(event) =>
                        updateHero("imageUrl", event.target.value)
                      }
                      placeholder="https://example.com/hero.jpg"
                    />
                    <small className="form-text text-muted">
                      Paste a publicly accessible image URL. Direct file uploads
                      will be added later.
                    </small>
                  </div>

                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="hero-primary-action-label">
                      Primary Action Label *
                    </label>
                    <input
                      id="hero-primary-action-label"
                      type="text"
                      className="form-control"
                      value={form.hero.primaryAction.label}
                      onChange={(event) =>
                        updateHeroAction(
                          "primaryAction",
                          "label",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="hero-primary-action-href">
                      Primary Action Link *
                    </label>
                    <input
                      id="hero-primary-action-href"
                      type="text"
                      className="form-control"
                      value={form.hero.primaryAction.href}
                      onChange={(event) =>
                        updateHeroAction(
                          "primaryAction",
                          "href",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="hero-secondary-action-label">
                      Secondary Action Label *
                    </label>
                    <input
                      id="hero-secondary-action-label"
                      type="text"
                      className="form-control"
                      value={form.hero.secondaryAction.label}
                      onChange={(event) =>
                        updateHeroAction(
                          "secondaryAction",
                          "label",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="hero-secondary-action-href">
                      Secondary Action Link *
                    </label>
                    <input
                      id="hero-secondary-action-href"
                      type="text"
                      className="form-control"
                      value={form.hero.secondaryAction.href}
                      onChange={(event) =>
                        updateHeroAction(
                          "secondaryAction",
                          "href",
                          event.target.value,
                        )
                      }
                      required
                    />
                  </div>

                  <div className="col-12 form-group">
                    <label>Trust Items *</label>
                    <div className="row">
                      {[0, 1, 2].map((index) => (
                        <div className="col-lg-4 col-12" key={index}>
                          <input
                            type="text"
                            className="form-control mb-2"
                            value={form.hero.trustItems[index] ?? ""}
                            onChange={(event) =>
                              updateTrustItem(index, event.target.value)
                            }
                            placeholder={`Trust item ${index + 1}`}
                          />
                        </div>
                      ))}
                    </div>
                    <small className="form-text text-muted">
                      At least one trust item is required. Empty items are
                      ignored when saving.
                    </small>
                  </div>

                  <div className="col-lg-4 col-12 form-group">
                    <label htmlFor="hero-info-card-label">
                      Info Card Label *
                    </label>
                    <input
                      id="hero-info-card-label"
                      type="text"
                      className="form-control"
                      value={form.hero.infoCard.label}
                      onChange={(event) =>
                        updateInfoCard("label", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-4 col-12 form-group">
                    <label htmlFor="hero-info-card-title">
                      Info Card Title *
                    </label>
                    <input
                      id="hero-info-card-title"
                      type="text"
                      className="form-control"
                      value={form.hero.infoCard.title}
                      onChange={(event) =>
                        updateInfoCard("title", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-4 col-12 form-group">
                    <label htmlFor="hero-info-card-description">
                      Info Card Description *
                    </label>
                    <input
                      id="hero-info-card-description"
                      type="text"
                      className="form-control"
                      value={form.hero.infoCard.description}
                      onChange={(event) =>
                        updateInfoCard("description", event.target.value)
                      }
                      required
                    />
                  </div>
                </div>

                {!canManage ? (
                  <p className="text-muted mt-3">
                    You have read-only access to Website Management and cannot
                    save changes.
                  </p>
                ) : (
                  <div className="col-12 form-group mg-t-8">
                    <button
                      type="submit"
                      className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                      disabled={submittingStatus !== null}
                    >
                      {submittingStatus === "draft"
                        ? "Saving…"
                        : "Save as Draft"}
                    </button>
                    <button
                      type="button"
                      className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                      disabled={submittingStatus !== null}
                      onClick={handlePublishClick}
                    >
                      {submittingStatus === "published"
                        ? "Publishing…"
                        : "Publish Website"}
                    </button>
                    {status === "published" ? (
                      <button
                        type="button"
                        className="btn-fill-lg bg-dark-pastel-green btn-hover-yellow"
                        disabled={submittingStatus !== null}
                        onClick={() => handleSave("unpublished")}
                      >
                        {submittingStatus === "unpublished"
                          ? "Unpublishing…"
                          : "Unpublish Website"}
                      </button>
                    ) : null}
                    {hasUnsavedChanges ? (
                      <span className="text-warning ml-2">
                        You have unsaved changes.
                      </span>
                    ) : null}
                  </div>
                )}
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

      {previewUrl ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Website preview"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1050,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
          onClick={() => setPreviewUrl(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 1100,
              height: "90vh",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <div
              className="d-flex align-items-center justify-content-between"
              style={{ padding: "0.75rem 1rem", borderBottom: "1px solid #e2e8f0" }}
            >
              <strong>Website Preview</strong>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setPreviewUrl(null)}
              >
                Close
              </button>
            </div>
            <iframe
              src={previewUrl}
              title="Website preview"
              style={{ flex: 1, border: 0, width: "100%" }}
            />
          </div>
        </div>
      ) : null}
    </>
  );
}
