"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listSessions, type Session } from "@/lib/sessions";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import { API_ROUTES, resolveBackendUrl } from "@/lib/config";
import { getCookie } from "@/lib/cookies";

interface Filters {
  sessionId: string;
  classId: string;
  classArmId: string;
}

const initialFilters: Filters = {
  sessionId: "",
  classId: "",
  classArmId: "",
};

const buildQueryString = (filters: Filters, autoPrint: boolean) => {
  const params = new URLSearchParams();
  params.set("session_id", filters.sessionId);
  params.set("school_class_id", filters.classId);
  if (filters.classArmId) {
    params.set("class_arm_id", filters.classArmId);
  }
  if (autoPrint) {
    params.set("autoprint", "1");
  }
  return params.toString();
};

export default function SessionResultsPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [status, setStatus] = useState<string>("");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    listSessions()
      .then((data) => setSessions(data))
      .catch((error) => {
        console.error("Unable to load sessions", error);
      });

    listClasses()
      .then((data) => setClasses(data))
      .catch((error) => {
        console.error("Unable to load classes", error);
      });
  }, []);

  useEffect(() => {
    if (!filters.classId) {
      setClassArms([]);
      return;
    }

    listClassArms(filters.classId)
      .then((arms) => {
        setClassArms(arms);
        if (!arms.find((arm) => `${arm.id}` === filters.classArmId)) {
          setFilters((prev) => ({ ...prev, classArmId: "" }));
        }
      })
      .catch((error) => {
        console.error("Unable to load class arms", error);
      });
  }, [filters.classId, filters.classArmId]);

  const canGenerate = useMemo(
    () => Boolean(filters.sessionId && filters.classId),
    [filters.classId, filters.sessionId],
  );

  const parseErrorResponse = async (response: Response): Promise<string> => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const payload = await response.json();
        if (
          payload &&
          typeof payload === "object" &&
          "message" in payload &&
          typeof payload.message === "string"
        ) {
          return payload.message;
        }
      } catch (error) {
        console.error("Unable to parse session print JSON error", error);
      }
      return "Unable to load session results.";
    }

    const text = await response.text().catch(() => "");
    return text.trim() || `Unable to load session results (${response.status}).`;
  };

  const openPreview = async (autoPrint = false) => {
    if (!canGenerate) {
      const message = "Select a session and class to continue.";
      setStatus(message);
      window.alert(message);
      return;
    }

    setStatus("");
    const endpoint = `${resolveBackendUrl(API_ROUTES.resultsSessionPrint)}?${buildQueryString(filters, autoPrint)}`;
    const token = getCookie("token");

    if (!token) {
      const message =
        "Your session token is missing. Please log in again before printing.";
      setStatus(message);
      window.alert(message);
      return;
    }

    setProcessing(true);
    try {
      const response = await fetch(endpoint, {
        headers: {
          Accept: "text/html",
          "X-Requested-With": "XMLHttpRequest",
          Authorization: `Bearer ${token}`,
        },
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(await parseErrorResponse(response));
      }

      const html = await response.text();
      const printWindow = window.open("", "_blank");

      if (!printWindow) {
        throw new Error(
          "Unable to open result window. Please allow pop-ups for this site.",
        );
      }

      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Unable to load session results. Please try again.";
      console.error("Session result printing failed", error);
      setStatus(message);
      window.alert(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Session Result Printing</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Students</li>
          <li>Session Result Printing</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Print Full Session Results</h3>
              <p className="text-muted mb-0">
                Generate the separate cumulative first-to-third-term result
                sheet for every student in the selected class.
              </p>
            </div>
          </div>

          {status ? (
            <div className="alert alert-warning" role="alert">
              {status}
            </div>
          ) : null}

          <div className="row">
            <div className="col-lg-4 col-12 form-group">
              <label htmlFor="session-result-session">Session</label>
              <select
                id="session-result-session"
                className="form-control"
                value={filters.sessionId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    sessionId: event.target.value,
                  }))
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

            <div className="col-lg-4 col-12 form-group">
              <label htmlFor="session-result-class">Class</label>
              <select
                id="session-result-class"
                className="form-control"
                value={filters.classId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    classId: event.target.value,
                    classArmId: "",
                  }))
                }
              >
                <option value="">Select class</option>
                {classes.map((schoolClass) => (
                  <option key={schoolClass.id} value={schoolClass.id}>
                    {schoolClass.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="col-lg-4 col-12 form-group">
              <label htmlFor="session-result-arm">Class Arm</label>
              <select
                id="session-result-arm"
                className="form-control"
                value={filters.classArmId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    classArmId: event.target.value,
                  }))
                }
                disabled={!filters.classId}
              >
                <option value="">All arms</option>
                {classArms.map((arm) => (
                  <option key={arm.id} value={arm.id}>
                    {arm.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="d-flex flex-wrap align-items-center mt-3" style={{ gap: 12 }}>
            <button
              type="button"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
              onClick={() => openPreview(false)}
              disabled={!canGenerate || processing}
            >
              {processing ? "Preparing..." : "Open Preview"}
            </button>
            <button
              type="button"
              className="btn-fill-lg bg-blue-dark btn-hover-yellow"
              onClick={() => openPreview(true)}
              disabled={!canGenerate || processing}
            >
              Export PDF
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
