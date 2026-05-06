"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  fetchResultPageSettings,
  updateResultPageSettings,
  type ResultPageSettings,
} from "@/lib/resultPageSettings";

const defaultSettings: ResultPageSettings = {
  show_grade: true,
  show_position: true,
  show_class_average: true,
  show_lowest: true,
  show_highest: true,
  show_remarks: true,
  hide_student_identity: false,
  allow_shared_pin_access: false,
  enable_session_result_print: false,
  comment_mode: "manual",
  signatory_title: "principal",
};

export default function ResultPageSettingsPage() {
  const [settings, setSettings] =
    useState<ResultPageSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchResultPageSettings()
      .then((data) => {
        if (!active) return;
        setSettings(data);
      })
      .catch((error) => {
        console.error("Unable to load result page settings", error);
        if (active) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : "Unable to load result page settings.",
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const options = useMemo(
    () => [
      {
        key: "show_grade" as const,
        label: "Grade",
        hint: "Show subject grades and the final grade summary.",
      },
      {
        key: "show_position" as const,
        label: "Position",
        hint: "Show subject positions and overall class position.",
      },
      {
        key: "show_class_average" as const,
        label: "Class Average",
        hint: "Show class average in the table and summary.",
      },
      {
        key: "show_lowest" as const,
        label: "Lowest",
        hint: "Show the lowest score per subject.",
      },
      {
        key: "show_highest" as const,
        label: "Highest",
        hint: "Show the highest score per subject.",
      },
      {
        key: "show_remarks" as const,
        label: "Remarks",
        hint: "Show remarks derived from the grading scale.",
      },
      {
        key: "hide_student_identity" as const,
        label: "Hide Scratch Card Identity",
        hint: "Remove student name, admission number, gender, and class from printed scratch cards.",
      },
      {
        key: "allow_shared_pin_access" as const,
        label: "Shared Scratch Cards",
        hint: "Allow any active scratch card for the same session and term to unlock the logged-in student's own result.",
      },
      {
        key: "enable_session_result_print" as const,
        label: "Session Result Printing",
        hint: "Enable the separate session-result print page and sidebar link for schools that print cumulative first-to-third-term sheets.",
      },
    ],
    [],
  );

  const handleToggle = (
    key: Exclude<keyof ResultPageSettings, "comment_mode" | "signatory_title">,
  ) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setErrorMessage(null);
    setInfoMessage(null);
    try {
      setSaving(true);
      const saved = await updateResultPageSettings(settings);
      setSettings(saved);
      setInfoMessage("Result page settings updated successfully.");
    } catch (error) {
      console.error("Unable to save result page settings", error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to save result page settings.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Result Page Settings</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Settings</li>
          <li>Result Page</li>
        </ul>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Visibility Controls</h3>
            </div>
            <button
              type="button"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              onClick={handleSave}
              disabled={loading || saving}
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
          <p className="text-muted mb-3">
            Control scratch-card identity details and how result scratch cards can be used for this school.
          </p>
          {infoMessage ? (
            <div className="alert alert-info">{infoMessage}</div>
          ) : null}
          {errorMessage ? (
            <div className="alert alert-danger">{errorMessage}</div>
          ) : null}
          {loading ? (
            <div className="alert alert-info">Loading settings...</div>
          ) : null}

          <div className="row gutters-20">
            <div className="col-md-6 col-12 form-group">
              <label htmlFor="result-comment-mode">Result Comment Mode</label>
              <select
                id="result-comment-mode"
                className="form-control"
                value={settings.comment_mode}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    comment_mode:
                      event.target.value as ResultPageSettings["comment_mode"],
                  }))
                }
                disabled={loading || saving}
              >
                <option value="manual">Manual</option>
                <option value="range">Automatic</option>
              </select>
              <small className="form-text text-muted">
                Automatic uses score-based comments. Manual allows saved comment
                templates and custom edits per student.
              </small>
            </div>
            <div className="col-md-6 col-12 form-group">
              <label htmlFor="result-signatory-title">Main Result Signatory Title</label>
              <select
                id="result-signatory-title"
                className="form-control"
                value={settings.signatory_title}
                onChange={(event) =>
                  setSettings((prev) => ({
                    ...prev,
                    signatory_title: event.target.value as ResultPageSettings["signatory_title"],
                  }))
                }
                disabled={loading || saving}
              >
                <option value="principal">Principal</option>
                <option value="director">Director</option>
              </select>
              <small className="form-text text-muted">
                Controls the label shown for the signatory comment and signature on the main result sheet.
              </small>
            </div>
            {options.map((option) => (
              <div key={option.key} className="col-md-6 col-12 form-group">
                <div className="form-check">
                  <input
                    id={option.key}
                    type="checkbox"
                    className="form-check-input"
                    checked={settings[option.key]}
                    onChange={() => handleToggle(option.key)}
                    disabled={loading || saving}
                  />
                  <label className="form-check-label" htmlFor={option.key}>
                    {option.label}
                  </label>
                </div>
                <small className="form-text text-muted">{option.hint}</small>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
