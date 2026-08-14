"use client";

import { useCallback, useEffect, useState } from "react";
import {
  listMyDistributedResultPins,
  type ResultPin,
} from "@/lib/resultPins";

const formatDate = (value?: string | null) => {
  if (!value) return "No expiry";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "No expiry"
    : date.toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
};

const formatUsage = (pin: ResultPin) => {
  const used = Number(pin.use_count ?? 0);
  const limit = pin.max_usage == null ? null : Number(pin.max_usage);
  return limit && limit > 0 ? `${used} of ${limit} used` : `${used} used · Unlimited`;
};

const badgeClass = (status?: string) => {
  switch ((status ?? "").toLowerCase()) {
    case "active":
      return "badge badge-success";
    case "used":
    case "expired":
      return "badge badge-warning";
    case "disabled":
    case "revoked":
      return "badge badge-danger";
    default:
      return "badge badge-secondary";
  }
};

export default function StudentResultPinsPage() {
  const [pins, setPins] = useState<ResultPin[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadPins = useCallback(async () => {
    setLoading(true);
    try {
      setPins(await listMyDistributedResultPins());
      setError(null);
    } catch (loadError) {
      console.error("Unable to load distributed result PINs", loadError);
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Unable to load your result PINs.",
      );
      setPins([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPins();
  }, [loadPins]);

  const copyPin = async (pinCode?: string) => {
    if (!pinCode) return;
    try {
      await navigator.clipboard.writeText(pinCode);
      setFeedback("PIN copied successfully.");
    } catch {
      setFeedback(null);
      setError("Unable to copy the PIN. Please select and copy it manually.");
    }
  };

  return (
    <div className="card height-auto">
      <div className="card-body">
        <div className="heading-layout1 mb-3">
          <div className="item-title">
            <h3>Result PINs</h3>
            <p className="text-muted mb-0">
              PINs officially sent to your dashboard are shown here.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-outline-primary btn-sm"
            onClick={() => void loadPins()}
            disabled={loading}
          >
            Refresh
          </button>
        </div>

        {feedback ? (
          <div className="alert alert-success" role="alert">
            {feedback}
          </div>
        ) : null}
        {error ? (
          <div className="alert alert-danger" role="alert">
            {error}
          </div>
        ) : null}

        <div className="table-responsive">
          <table className="table display text-nowrap">
            <thead>
              <tr>
                <th>Session</th>
                <th>Term</th>
                <th>PIN</th>
                <th>Usage</th>
                <th>Status</th>
                <th>Expires</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7}>Loading result PINs…</td>
                </tr>
              ) : pins.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-muted">
                    No result PIN has been sent to your dashboard yet.
                  </td>
                </tr>
              ) : (
                pins.map((pin) => (
                  <tr key={String(pin.id)}>
                    <td>{pin.session?.name ?? "—"}</td>
                    <td>{pin.term?.name ?? "—"}</td>
                    <td><code>{pin.pin_code ?? "—"}</code></td>
                    <td>{formatUsage(pin)}</td>
                    <td>
                      <span className={badgeClass(pin.effective_status ?? pin.status)}>
                        {(pin.effective_status ?? pin.status ?? "active").replace("_", " ")}
                      </span>
                    </td>
                    <td>{formatDate(pin.expires_at)}</td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-outline-primary btn-sm"
                        onClick={() => void copyPin(pin.pin_code)}
                        disabled={!pin.pin_code}
                        aria-label={`Copy PIN for ${pin.session?.name ?? "session"} ${pin.term?.name ?? "term"}`}
                      >
                        Copy PIN
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
