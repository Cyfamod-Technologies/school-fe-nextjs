"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/lib/apiClient";
import { publicWebsitePreviewUrl } from "@/lib/config";
import { userHasRole } from "@/lib/roleChecks";
import {
  createDefaultSchoolWebsite,
  getGoLiveStatus,
  getPreviewLink,
  getSchoolWebsite,
  GoLiveCooldownError,
  GoLiveDomainNotReadyError,
  requestGoLive,
  saveSchoolWebsite,
  THEME_OPTIONS,
  type GoLiveRequest,
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

const STATUS_DOT_COLOR: Record<SchoolWebsiteStatus | "unconfigured", string> = {
  unconfigured: "#adb5bd",
  draft: "#ffc107",
  published: "#16a34a",
  unpublished: "#dc3545",
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

  const [activeTab, setActiveTab] = useState<
    "branding" | "homepage" | "about" | "admissions" | "contact" | "programmes"
  >("branding");
  const [showPublishConfirm, setShowPublishConfirm] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<
    { type: "highlight" | "programme"; index: number } | null
  >(null);
  const [justMoved, setJustMoved] = useState<
    { type: "highlight" | "programme"; id: string } | null
  >(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const [goLiveRequest, setGoLiveRequest] = useState<GoLiveRequest | null>(
    null,
  );
  const [goLiveLoading, setGoLiveLoading] = useState(true);
  const [goLiveActionLoading, setGoLiveActionLoading] = useState(false);
  const [goLiveError, setGoLiveError] = useState<string | null>(null);
  const [showGoLiveConfirm, setShowGoLiveConfirm] = useState(false);

  useEffect(() => {
    if (!school) {
      return;
    }

    let cancelled = false;

    getGoLiveStatus()
      .then((request) => {
        if (!cancelled) {
          setGoLiveRequest(request);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          console.error("Failed to load Go Live status", error);
          setGoLiveError(
            error instanceof Error
              ? error.message
              : "Unable to check Go Live status. Please refresh the page.",
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setGoLiveLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [school]);

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

  const updateAbout = (
    key: "eyebrow" | "title" | "description" | "imageUrl" | "mission" | "vision",
    value: string,
  ) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            about: {
              ...prev.about,
              [key]: key === "imageUrl" ? value || null : value,
            },
          }
        : prev,
    );
  };

  const updateAdmissions = (
    key: "eyebrow" | "title" | "description",
    value: string,
  ) => {
    setForm((prev) =>
      prev
        ? { ...prev, admissions: { ...prev.admissions, [key]: value } }
        : prev,
    );
  };

  const updateAdmissionsAction = (
    key: "label" | "href",
    value: string,
  ) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            admissions: {
              ...prev.admissions,
              action: { ...prev.admissions.action, [key]: value },
            },
          }
        : prev,
    );
  };

  const updateContact = (
    key: "address" | "phone" | "email" | "mapUrl",
    value: string,
  ) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            contact: {
              ...prev.contact,
              [key]: key === "mapUrl" ? value || null : value,
            },
          }
        : prev,
    );
  };

  const updateSocialLink = (
    platform: "facebook" | "instagram" | "linkedin" | "youtube" | "x",
    value: string,
  ) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            socialLinks: {
              ...prev.socialLinks,
              [platform]: value || null,
            },
          }
        : prev,
    );
  };

  const updateHighlight = (
    index: number,
    key: "title" | "description" | "iconUrl",
    value: string,
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      const items = [...prev.highlights];
      items[index] = {
        ...items[index],
        [key]: key === "iconUrl" ? value || null : value,
      };
      return { ...prev, highlights: items };
    });
  };

  const addHighlight = () => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            highlights: [
              ...prev.highlights,
              { id: crypto.randomUUID(), title: "", description: "", iconUrl: null },
            ],
          }
        : prev,
    );
  };

  const removeHighlight = (index: number) => {
    setForm((prev) => {
      if (!prev || prev.highlights.length <= 1) return prev;
      return {
        ...prev,
        highlights: prev.highlights.filter((_, i) => i !== index),
      };
    });
  };

  const moveHighlight = (index: number, direction: "up" | "down") => {
    setForm((prev) => {
      if (!prev) return prev;
      const items = [...prev.highlights];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= items.length) return prev;
      [items[index], items[target]] = [items[target], items[index]];
      setJustMoved({ type: "highlight", id: items[target].id });
      setTimeout(() => setJustMoved(null), 900);
      return { ...prev, highlights: items };
    });
  };

  const updateProgramme = (
    index: number,
    key: "name" | "summary" | "imageUrl",
    value: string,
  ) => {
    setForm((prev) => {
      if (!prev) return prev;
      const items = [...prev.programmes];
      items[index] = {
        ...items[index],
        [key]: key === "imageUrl" ? value || null : value,
      };
      return { ...prev, programmes: items };
    });
  };

  const addProgramme = () => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            programmes: [
              ...prev.programmes,
              { id: crypto.randomUUID(), name: "", summary: "", imageUrl: null },
            ],
          }
        : prev,
    );
  };

  const removeProgramme = (index: number) => {
    setForm((prev) => {
      if (!prev || prev.programmes.length <= 1) return prev;
      return {
        ...prev,
        programmes: prev.programmes.filter((_, i) => i !== index),
      };
    });
  };

  const moveProgramme = (index: number, direction: "up" | "down") => {
    setForm((prev) => {
      if (!prev) return prev;
      const items = [...prev.programmes];
      const target = direction === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= items.length) return prev;
      [items[index], items[target]] = [items[target], items[index]];
      setJustMoved({ type: "programme", id: items[target].id });
      setTimeout(() => setJustMoved(null), 900);
      return { ...prev, programmes: items };
    });
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

  const updateEnabledSection = (
    key: keyof SchoolWebsitePayload["enabledSections"],
    value: boolean,
  ) => {
    setForm((prev) =>
      prev
        ? {
            ...prev,
            enabledSections: { ...prev.enabledSections, [key]: value },
          }
        : prev,
    );
  };

  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => setToastMessage(null), 2500);
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
      // Main Banner (hero) isn't optional -- there's no UI to turn it off,
      // so force it true here too in case an older record was saved with
      // it false before that control was removed.
      enabledSections: { ...form.enabledSections, hero: true },
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

  const handleGoLiveClick = () => {
    setGoLiveError(null);
    setShowGoLiveConfirm(true);
  };

  const submitGoLiveRequest = async () => {
    setGoLiveActionLoading(true);
    setGoLiveError(null);
    try {
      const request = await requestGoLive();
      setGoLiveRequest(request);
      showToast(
        goLiveRequest
          ? "Resent -- we have notified our team again."
          : "Go Live request sent -- we will notify you once your website is live.",
      );
    } catch (error) {
      console.error("Failed to request Go Live", error);
      if (error instanceof GoLiveDomainNotReadyError) {
        setGoLiveError(error.message);
      } else if (error instanceof GoLiveCooldownError) {
        setGoLiveError(
          "You will be able to resend 48 hours after your last request.",
        );
      } else if (error instanceof ApiError && error.status === 409) {
        // Already activated server-side (e.g. approved moments ago) --
        // refresh instead of showing a stale action failure.
        getGoLiveStatus()
          .then(setGoLiveRequest)
          .catch(() => undefined);
      } else {
        setGoLiveError(
          error instanceof Error
            ? error.message
            : "Unable to submit your Go Live request. Please try again.",
        );
      }
    } finally {
      setGoLiveActionLoading(false);
    }
  };

  const handleConfirmGoLive = () => {
    setShowGoLiveConfirm(false);
    submitGoLiveRequest();
  };

  const handleResendGoLive = () => {
    submitGoLiveRequest();
  };

  // Publish always saves the current form state and goes live immediately,
  // so every click gets a confirmation -- not just when there are unsaved
  // changes -- to guard against accidental publishes in general.
  const handlePublishClick = () => {
    setShowPublishConfirm(true);
  };

  const handleConfirmPublish = () => {
    setShowPublishConfirm(false);
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
              <div className="heading-layout1" style={{ flexWrap: "wrap", rowGap: 12 }}>
                <div className="item-title">
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 12,
                      fontSize: 12,
                      color: "#6c757d",
                    }}
                  >
                    <span
                      className="d-inline-flex align-items-center"
                      style={{ gap: 6 }}
                      title={
                        publishedAt
                          ? `Last published ${new Date(publishedAt).toLocaleString("en-NG", { timeZone: "Africa/Lagos" })}`
                          : undefined
                      }
                    >
                      <span
                        aria-hidden="true"
                        style={{
                          width: 7,
                          height: 7,
                          borderRadius: "50%",
                          background: STATUS_DOT_COLOR[status],
                          display: "inline-block",
                        }}
                      />
                      {STATUS_LABELS[status]}
                    </span>
                    {goLiveError ? (
                      <span style={{ color: "#dc2626" }}>{goLiveError}</span>
                    ) : goLiveLoading ? (
                      <span>Checking Go Live…</span>
                    ) : goLiveRequest === null ? (
                      <span>Not live yet.</span>
                    ) : goLiveRequest.status === "activated" ? null : goLiveRequest.shouldEscalate ? (
                      <span>
                        No response yet? Email{" "}
                        <a href="mailto:contact@cyfamod.com">
                          contact@cyfamod.com
                        </a>
                        .
                      </span>
                    ) : (
                      <span>Pending review.</span>
                    )}
                  </div>
                </div>
                <div
                  className="d-flex align-items-center"
                  style={{ gap: 8, flexWrap: "wrap" }}
                >
                  <button
                    type="button"
                    className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                    style={{ padding: "8px 20px", fontSize: 13 }}
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
                  {goLiveRequest?.status === "activated" && school?.custom_domain ? (
                    <a
                      href={`https://${school.custom_domain}`}
                      target="_blank"
                      rel="noreferrer"
                      className="btn-fill-lg bg-blue-dark btn-hover-yellow d-inline-flex align-items-center"
                      style={{ padding: "8px 20px", fontSize: 13, gap: 8 }}
                    >
                      <span className="live-dot" aria-hidden="true" />
                      View Website
                    </a>
                  ) : null}
                  {!goLiveLoading && goLiveRequest?.status !== "activated" ? (
                    goLiveRequest === null ? (
                      <button
                        type="button"
                        className="go-live-cta"
                        onClick={handleGoLiveClick}
                        disabled={goLiveActionLoading}
                      >
                        {goLiveActionLoading ? "Submitting…" : "Go Live"}
                      </button>
                    ) : !goLiveRequest.shouldEscalate ? (
                      goLiveRequest.canResend ? (
                        <button
                          type="button"
                          className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                          style={{ padding: "8px 20px", fontSize: 13 }}
                          onClick={handleResendGoLive}
                          disabled={goLiveActionLoading}
                        >
                          {goLiveActionLoading ? "Resending…" : "Resend"}
                        </button>
                      ) : (
                        <span className="text-muted" style={{ fontSize: 13 }}>
                          Resend in 48h.
                        </span>
                      )
                    ) : null
                  ) : null}
                </div>
              </div>

              {previewError ? (
                <div className="alert alert-danger mt-3" role="alert">
                  {previewError}
                </div>
              ) : null}

              <style jsx>{`
                .live-dot {
                  width: 8px;
                  height: 8px;
                  border-radius: 50%;
                  background: #16a34a;
                  animation: live-pulse 1.6s ease-in-out infinite;
                }
                @keyframes live-pulse {
                  0%,
                  100% {
                    opacity: 1;
                    box-shadow: 0 0 0 0 rgba(22, 163, 74, 0.5);
                  }
                  50% {
                    opacity: 0.5;
                    box-shadow: 0 0 0 4px rgba(22, 163, 74, 0);
                  }
                }
                .go-live-cta {
                  display: inline-block;
                  border: none;
                  border-radius: 4px;
                  color: #172033;
                  font-weight: 700;
                  letter-spacing: 0.5px;
                  padding: 8px 24px;
                  font-size: 13px;
                  cursor: pointer;
                  background: #ffae01;
                  animation: go-live-attention 2.2s ease-in-out infinite;
                }
                .go-live-cta:disabled {
                  cursor: default;
                  opacity: 0.7;
                  animation: none;
                }
                @keyframes go-live-attention {
                  0%,
                  100% {
                    opacity: 1;
                  }
                  50% {
                    opacity: 0.72;
                  }
                }
              `}</style>

              <form
                id="website-management-form"
                className="new-added-form"
                onSubmit={handleSubmit}
              >
                <div
                  className="d-flex flex-wrap"
                  style={{ gap: 8, borderBottom: "1px solid #e2e8f0", paddingBottom: "1rem" }}
                >
                  {(
                    [
                      ["branding", "Branding"],
                      ["homepage", "Homepage"],
                      ["about", "About"],
                      ["admissions", "Admissions"],
                      ["programmes", "Programmes"],
                      ["contact", "Contact"],
                    ] as const
                  ).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      className="btn-fill-sm"
                      style={
                        activeTab === key
                          ? { color: "#fff", background: "#172033", fontWeight: 700 }
                          : { color: "#172033", background: "#f1f5f9", fontWeight: 700 }
                      }
                      onClick={() => setActiveTab(key)}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <style>{`
                  #website-management-form label:not(.custom-control-label) {
                    font-weight: 600;
                    color: #172033;
                  }
                `}</style>
                <p className="text-muted mt-3 mb-0" style={{ fontSize: "13px" }}>
                  All fields are required unless marked (optional).
                </p>

                <div style={{ display: activeTab === "branding" ? "block" : "none" }}>
                <div className="row">
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="website-theme-key">Website Theme</label>
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
                <div className="row">
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="branding-primary-color">Primary Colour</label>
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
                      Secondary Colour
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
                </div>

                <div style={{ display: activeTab === "homepage" ? "block" : "none" }}>
                <div className="row">
                  <div className="col-lg-4 col-12 form-group">
                    <label htmlFor="header-welcome-text">Welcome Text</label>
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
                    <label htmlFor="header-utility-text">Utility Text</label>
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
                    <label htmlFor="header-tagline">Tagline</label>
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

                <div className="row">
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="hero-eyebrow">Eyebrow</label>
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
                    <label htmlFor="hero-title">Title</label>
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
                    <label htmlFor="hero-description">Description</label>
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
                    <label htmlFor="hero-image-url">
                      Hero Image URL <span style={{ fontWeight: 400, color: "#6c757d" }}>(optional)</span>
                    </label>
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
                      Primary Action Label
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
                      Primary Action Link
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
                      Secondary Action Label
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
                      Secondary Action Link
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
                    <label>Trust Items</label>
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
                      Info Card Label
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
                      Info Card Title
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
                      Info Card Description
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
                </div>

                <div style={{ display: activeTab === "about" ? "block" : "none" }}>
                <div className="d-flex align-items-center justify-content-end mt-4">
                  <label
                    htmlFor="enabled-section-about"
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  >
                    <span style={{ fontWeight: 600, color: "#212529" }}>
                      Show About section
                    </span>
                    <input
                      type="checkbox"
                      className="permission-checkbox"
                      id="enabled-section-about"
                      checked={form.enabledSections.about}
                      onChange={(event) =>
                        updateEnabledSection("about", event.target.checked)
                      }
                    />
                  </label>
                </div>
                <div
                  className="row"
                  style={
                    form.enabledSections.about
                      ? undefined
                      : { opacity: 0.5, pointerEvents: "none" }
                  }
                >
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="about-eyebrow">Eyebrow</label>
                    <input
                      id="about-eyebrow"
                      type="text"
                      className="form-control"
                      value={form.about.eyebrow}
                      onChange={(event) =>
                        updateAbout("eyebrow", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="about-title">Title</label>
                    <input
                      id="about-title"
                      type="text"
                      className="form-control"
                      value={form.about.title}
                      onChange={(event) =>
                        updateAbout("title", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-12 form-group">
                    <label htmlFor="about-description">Description</label>
                    <textarea
                      id="about-description"
                      className="textarea form-control"
                      rows={4}
                      value={form.about.description}
                      onChange={(event) =>
                        updateAbout("description", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-12 form-group">
                    <label htmlFor="about-image-url">
                      About Image URL <span style={{ fontWeight: 400, color: "#6c757d" }}>(optional)</span>
                    </label>
                    <input
                      id="about-image-url"
                      type="url"
                      className="form-control"
                      value={form.about.imageUrl ?? ""}
                      onChange={(event) =>
                        updateAbout("imageUrl", event.target.value)
                      }
                      placeholder="https://example.com/about.jpg"
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="about-mission">Mission</label>
                    <textarea
                      id="about-mission"
                      className="textarea form-control"
                      rows={3}
                      value={form.about.mission}
                      onChange={(event) =>
                        updateAbout("mission", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="about-vision">Vision</label>
                    <textarea
                      id="about-vision"
                      className="textarea form-control"
                      rows={3}
                      value={form.about.vision}
                      onChange={(event) =>
                        updateAbout("vision", event.target.value)
                      }
                      required
                    />
                  </div>
                </div>
                </div>

                <div style={{ display: activeTab === "admissions" ? "block" : "none" }}>
                <div className="d-flex align-items-center justify-content-end mt-4">
                  <label
                    htmlFor="enabled-section-admissions"
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  >
                    <span style={{ fontWeight: 600, color: "#212529" }}>
                      Show Admissions section
                    </span>
                    <input
                      type="checkbox"
                      className="permission-checkbox"
                      id="enabled-section-admissions"
                      checked={form.enabledSections.admissions}
                      onChange={(event) =>
                        updateEnabledSection("admissions", event.target.checked)
                      }
                    />
                  </label>
                </div>
                <div
                  className="row"
                  style={
                    form.enabledSections.admissions
                      ? undefined
                      : { opacity: 0.5, pointerEvents: "none" }
                  }
                >
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="admissions-eyebrow">Eyebrow</label>
                    <input
                      id="admissions-eyebrow"
                      type="text"
                      className="form-control"
                      value={form.admissions.eyebrow}
                      onChange={(event) =>
                        updateAdmissions("eyebrow", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="admissions-title">Title</label>
                    <input
                      id="admissions-title"
                      type="text"
                      className="form-control"
                      value={form.admissions.title}
                      onChange={(event) =>
                        updateAdmissions("title", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-12 form-group">
                    <label htmlFor="admissions-description">Description</label>
                    <textarea
                      id="admissions-description"
                      className="textarea form-control"
                      rows={4}
                      value={form.admissions.description}
                      onChange={(event) =>
                        updateAdmissions("description", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="admissions-action-label">Action Label</label>
                    <input
                      id="admissions-action-label"
                      type="text"
                      className="form-control"
                      value={form.admissions.action.label}
                      onChange={(event) =>
                        updateAdmissionsAction("label", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="admissions-action-href">Action Link</label>
                    <input
                      id="admissions-action-href"
                      type="text"
                      className="form-control"
                      value={form.admissions.action.href}
                      onChange={(event) =>
                        updateAdmissionsAction("href", event.target.value)
                      }
                      required
                    />
                  </div>
                </div>
                </div>

                <div style={{ display: activeTab === "contact" ? "block" : "none" }}>
                <div className="d-flex align-items-center justify-content-end mt-4">
                  <label
                    htmlFor="enabled-section-contact"
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  >
                    <span style={{ fontWeight: 600, color: "#212529" }}>
                      Show Contact section
                    </span>
                    <input
                      type="checkbox"
                      className="permission-checkbox"
                      id="enabled-section-contact"
                      checked={form.enabledSections.contact}
                      onChange={(event) =>
                        updateEnabledSection("contact", event.target.checked)
                      }
                    />
                  </label>
                </div>
                <div
                  className="row"
                  style={
                    form.enabledSections.contact
                      ? undefined
                      : { opacity: 0.5, pointerEvents: "none" }
                  }
                >
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="contact-address">Address</label>
                    <input
                      id="contact-address"
                      type="text"
                      className="form-control"
                      value={form.contact.address}
                      onChange={(event) =>
                        updateContact("address", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="contact-phone">Phone</label>
                    <input
                      id="contact-phone"
                      type="text"
                      className="form-control"
                      value={form.contact.phone}
                      onChange={(event) =>
                        updateContact("phone", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="contact-email">Email</label>
                    <input
                      id="contact-email"
                      type="email"
                      className="form-control"
                      value={form.contact.email}
                      onChange={(event) =>
                        updateContact("email", event.target.value)
                      }
                      required
                    />
                  </div>
                  <div className="col-lg-6 col-12 form-group">
                    <label htmlFor="contact-map-url">
                      Map URL <span style={{ fontWeight: 400, color: "#6c757d" }}>(optional)</span>
                    </label>
                    <input
                      id="contact-map-url"
                      type="url"
                      className="form-control"
                      value={form.contact.mapUrl ?? ""}
                      onChange={(event) =>
                        updateContact("mapUrl", event.target.value)
                      }
                      placeholder="https://maps.google.com/..."
                    />
                  </div>
                </div>

                <h4
                  className="mb-0 mt-4"
                  style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "16px", letterSpacing: "0.02em" }}
                >
                  Social Links
                </h4>
                <div
                  className="row"
                  style={
                    form.enabledSections.contact
                      ? undefined
                      : { opacity: 0.5, pointerEvents: "none" }
                  }
                >
                  {(
                    [
                      ["facebook", "Facebook"],
                      ["instagram", "Instagram"],
                      ["linkedin", "LinkedIn"],
                      ["youtube", "YouTube"],
                      ["x", "X (Twitter)"],
                    ] as const
                  ).map(([platform, label]) => (
                    <div className="col-lg-4 col-12 form-group" key={platform}>
                      <label htmlFor={`social-${platform}`}>{label}</label>
                      <input
                        id={`social-${platform}`}
                        type="url"
                        className="form-control"
                        value={form.socialLinks[platform] ?? ""}
                        onChange={(event) =>
                          updateSocialLink(platform, event.target.value)
                        }
                        placeholder={`https://${platform === "x" ? "x" : platform}.com/yourschool`}
                      />
                    </div>
                  ))}
                </div>
                </div>

                <div style={{ display: activeTab === "programmes" ? "block" : "none" }}>
                <div className="d-flex align-items-center justify-content-end mt-4">
                  <label
                    htmlFor="enabled-section-programmes"
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  >
                    <span style={{ fontWeight: 600, color: "#212529" }}>
                      Show Programmes section
                    </span>
                    <input
                      type="checkbox"
                      className="permission-checkbox"
                      id="enabled-section-programmes"
                      checked={form.enabledSections.programmes}
                      onChange={(event) =>
                        updateEnabledSection("programmes", event.target.checked)
                      }
                    />
                  </label>
                </div>
                <div
                  style={
                    form.enabledSections.programmes
                      ? undefined
                      : { opacity: 0.5, pointerEvents: "none" }
                  }
                >
                  {form.programmes.map((programme, index) => (
                    <div
                      key={programme.id}
                      style={{
                        border:
                          justMoved?.type === "programme" &&
                          justMoved.id === programme.id
                            ? "2px solid #172033"
                            : "1px solid #e2e8f0",
                        borderRadius: 8,
                        padding: "1rem",
                        marginBottom: "0.75rem",
                        background:
                          justMoved?.type === "programme" &&
                          justMoved.id === programme.id
                            ? "#f1f5f9"
                            : undefined,
                        transition: "background 0.2s ease, border-color 0.2s ease",
                      }}
                    >
                      <div className="row">
                        <div className="col-lg-6 col-12 form-group">
                          <label htmlFor={`programme-name-${index}`}>Name</label>
                          <input
                            id={`programme-name-${index}`}
                            type="text"
                            className="form-control"
                            value={programme.name}
                            onChange={(event) =>
                              updateProgramme(index, "name", event.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="col-lg-6 col-12 form-group">
                          <label htmlFor={`programme-image-${index}`}>
                            Image URL <span style={{ fontWeight: 400, color: "#6c757d" }}>(optional)</span>
                          </label>
                          <input
                            id={`programme-image-${index}`}
                            type="url"
                            className="form-control"
                            value={programme.imageUrl ?? ""}
                            onChange={(event) =>
                              updateProgramme(index, "imageUrl", event.target.value)
                            }
                          />
                        </div>
                        <div className="col-12 form-group">
                          <label htmlFor={`programme-summary-${index}`}>Summary</label>
                          <textarea
                            id={`programme-summary-${index}`}
                            className="textarea form-control"
                            rows={2}
                            value={programme.summary}
                            onChange={(event) =>
                              updateProgramme(index, "summary", event.target.value)
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="d-flex justify-content-end" style={{ gap: 8 }}>
                        {form.programmes.length > 1 ? (
                          <>
                            <button
                              type="button"
                              className="btn-fill-sm"
                              style={{ color: "#172033", background: "#f1f5f9" }}
                              onClick={() =>
                                index === 0
                                  ? showToast("This is already at the top.")
                                  : moveProgramme(index, "up")
                              }
                            >
                              Move Up
                            </button>
                            <button
                              type="button"
                              className="btn-fill-sm"
                              style={{ color: "#172033", background: "#f1f5f9" }}
                              onClick={() =>
                                index === form.programmes.length - 1
                                  ? showToast("This is already at the bottom.")
                                  : moveProgramme(index, "down")
                              }
                            >
                              Move Down
                            </button>
                          </>
                        ) : null}
                        {index > 0 ? (
                          <button
                            type="button"
                            className="btn-fill-sm"
                            style={{ color: "#b91c1c", background: "#fee2e2" }}
                            onClick={() => setRemoveTarget({ type: "programme", index })}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-fill-sm"
                    style={{ color: "#172033", background: "#f1f5f9" }}
                    onClick={addProgramme}
                  >
                    + Add Programme
                  </button>
                </div>

                <hr className="mt-4" />

                <div className="d-flex align-items-center justify-content-between mt-4">
                  <h4 className="mb-0" style={{ fontWeight: "bold", textTransform: "uppercase", fontSize: "16px", letterSpacing: "0.02em" }}>Highlights</h4>
                  <label
                    htmlFor="enabled-section-highlights"
                    style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}
                  >
                    <span style={{ fontWeight: 600, color: "#212529" }}>
                      Show Highlights section
                    </span>
                    <input
                      type="checkbox"
                      className="permission-checkbox"
                      id="enabled-section-highlights"
                      checked={form.enabledSections.highlights}
                      onChange={(event) =>
                        updateEnabledSection("highlights", event.target.checked)
                      }
                    />
                  </label>
                </div>
                <div
                  style={
                    form.enabledSections.highlights
                      ? undefined
                      : { opacity: 0.5, pointerEvents: "none" }
                  }
                >
                  {form.highlights.map((highlight, index) => (
                    <div
                      key={highlight.id}
                      style={{
                        border:
                          justMoved?.type === "highlight" &&
                          justMoved.id === highlight.id
                            ? "2px solid #172033"
                            : "1px solid #e2e8f0",
                        borderRadius: 8,
                        padding: "1rem",
                        marginBottom: "0.75rem",
                        background:
                          justMoved?.type === "highlight" &&
                          justMoved.id === highlight.id
                            ? "#f1f5f9"
                            : undefined,
                        transition: "background 0.2s ease, border-color 0.2s ease",
                      }}
                    >
                      <div className="row">
                        <div className="col-lg-6 col-12 form-group">
                          <label htmlFor={`highlight-title-${index}`}>Title</label>
                          <input
                            id={`highlight-title-${index}`}
                            type="text"
                            className="form-control"
                            value={highlight.title}
                            onChange={(event) =>
                              updateHighlight(index, "title", event.target.value)
                            }
                            required
                          />
                        </div>
                        <div className="col-lg-6 col-12 form-group">
                          <label htmlFor={`highlight-icon-${index}`}>
                            Icon URL <span style={{ fontWeight: 400, color: "#6c757d" }}>(optional)</span>
                          </label>
                          <input
                            id={`highlight-icon-${index}`}
                            type="url"
                            className="form-control"
                            value={highlight.iconUrl ?? ""}
                            onChange={(event) =>
                              updateHighlight(index, "iconUrl", event.target.value)
                            }
                          />
                        </div>
                        <div className="col-12 form-group">
                          <label htmlFor={`highlight-description-${index}`}>
                            Description
                          </label>
                          <textarea
                            id={`highlight-description-${index}`}
                            className="textarea form-control"
                            rows={2}
                            value={highlight.description}
                            onChange={(event) =>
                              updateHighlight(index, "description", event.target.value)
                            }
                            required
                          />
                        </div>
                      </div>
                      <div className="d-flex justify-content-end" style={{ gap: 8 }}>
                        {form.highlights.length > 1 ? (
                          <>
                            <button
                              type="button"
                              className="btn-fill-sm"
                              style={{ color: "#172033", background: "#f1f5f9" }}
                              onClick={() =>
                                index === 0
                                  ? showToast("This is already at the top.")
                                  : moveHighlight(index, "up")
                              }
                            >
                              Move Up
                            </button>
                            <button
                              type="button"
                              className="btn-fill-sm"
                              style={{ color: "#172033", background: "#f1f5f9" }}
                              onClick={() =>
                                index === form.highlights.length - 1
                                  ? showToast("This is already at the bottom.")
                                  : moveHighlight(index, "down")
                              }
                            >
                              Move Down
                            </button>
                          </>
                        ) : null}
                        {index > 0 ? (
                          <button
                            type="button"
                            className="btn-fill-sm"
                            style={{ color: "#b91c1c", background: "#fee2e2" }}
                            onClick={() => setRemoveTarget({ type: "highlight", index })}
                          >
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  ))}
                  <button
                    type="button"
                    className="btn-fill-sm"
                    style={{ color: "#172033", background: "#f1f5f9" }}
                    onClick={addHighlight}
                  >
                    + Add Highlight
                  </button>
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
                    {goLiveRequest?.status === "activated" ? (
                      <>
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
                      </>
                    ) : (
                      <span className="text-muted" style={{ fontSize: 13 }}>
                        Publish becomes available once your website has gone
                        live.
                      </span>
                    )}
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

      {showPublishConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm publish"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1060,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
          onClick={() => setShowPublishConfirm(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 480,
              padding: "1.5rem",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h5 className="mb-3">Publish this website?</h5>
            <p className="mb-4">
              {hasUnsavedChanges
                ? "You have unsaved changes. Publishing will save them and make the website live immediately."
                : "This will make the website live immediately."}
            </p>
            <div className="d-flex justify-content-end" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn-fill-lg"
                style={{
                  color: "#172033",
                  background: "#f1f5f9",
                }}
                onClick={() => setShowPublishConfirm(false)}
                disabled={submittingStatus !== null}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                onClick={handleConfirmPublish}
                disabled={submittingStatus !== null}
              >
                {submittingStatus === "published" ? "Publishing…" : "Yes, publish"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showGoLiveConfirm ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm Go Live"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1060,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
          onClick={() => setShowGoLiveConfirm(false)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 480,
              padding: "1.5rem",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h5 className="mb-3">Go Live?</h5>
            <p className="mb-4">
              This makes your school&apos;s website publicly reachable
              online. We will review your request and notify you as soon as
              it is live.
            </p>
            <div className="d-flex justify-content-end" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn-fill-lg"
                style={{
                  color: "#172033",
                  background: "#f1f5f9",
                }}
                onClick={() => setShowGoLiveConfirm(false)}
                disabled={goLiveActionLoading}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                onClick={handleConfirmGoLive}
                disabled={goLiveActionLoading}
              >
                {goLiveActionLoading ? "Submitting…" : "Yes, go live"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toastMessage ? (
        <div
          role="status"
          aria-live="polite"
          style={{
            position: "fixed",
            top: 24,
            right: 24,
            zIndex: 1100,
            background: "#042954",
            color: "#fff",
            padding: "16px 24px",
            borderRadius: 8,
            fontSize: "16px",
            fontWeight: 600,
            borderLeft: "5px solid #fbd540",
            boxShadow: "0 12px 32px rgba(4, 41, 84, 0.35)",
            maxWidth: 360,
          }}
        >
          {toastMessage}
        </div>
      ) : null}

      {removeTarget ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirm remove"
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1060,
            background: "rgba(15, 23, 42, 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "2rem",
          }}
          onClick={() => setRemoveTarget(null)}
        >
          <div
            style={{
              background: "#fff",
              borderRadius: 12,
              width: "100%",
              maxWidth: 480,
              padding: "1.5rem",
            }}
            onClick={(event) => event.stopPropagation()}
          >
            <h5 className="mb-3">
              Remove this {removeTarget.type}?
            </h5>
            <p className="mb-4">
              This cannot be undone. The {removeTarget.type} will be removed
              once you save.
            </p>
            <div className="d-flex justify-content-end" style={{ gap: 8 }}>
              <button
                type="button"
                className="btn-fill-lg"
                style={{ color: "#172033", background: "#f1f5f9" }}
                onClick={() => setRemoveTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-fill-lg"
                style={{ color: "#fff", background: "#b91c1c" }}
                onClick={() => {
                  if (removeTarget.type === "highlight") {
                    removeHighlight(removeTarget.index);
                  } else {
                    removeProgramme(removeTarget.index);
                  }
                  setRemoveTarget(null);
                }}
              >
                Yes, remove
              </button>
            </div>
          </div>
        </div>
      ) : null}

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
