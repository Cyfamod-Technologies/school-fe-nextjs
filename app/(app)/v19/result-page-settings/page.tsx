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
  comment_mode: "manual",
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
    ],
    [],
  );

  const handleToggle = (key: keyof ResultPageSettings) => {
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
            Toggle what appears on the printed result page for this school.
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
