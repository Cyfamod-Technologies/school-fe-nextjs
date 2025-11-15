"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";
import {
  listClassArmSections,
  type ClassArmSection,
} from "@/lib/classArmSections";

interface Filters {
  sessionId: string;
  termId: string;
  classId: string;
  classArmId: string;
  classSectionId: string;
}

const initialFilters: Filters = {
  sessionId: "",
  termId: "",
  classId: "",
  classArmId: "",
  classSectionId: "",
};

const buildQueryString = (filters: Filters, autoPrint: boolean) => {
  const params = new URLSearchParams();
  params.set("session_id", filters.sessionId);
  params.set("term_id", filters.termId);
  params.set("school_class_id", filters.classId);
  if (filters.classArmId) {
    params.set("class_arm_id", filters.classArmId);
  }
  // Class section is intentionally omitted from bulk result filters for now.
  if (autoPrint) {
    params.set("autoprint", "1");
  }
  return params.toString();
};

export default function BulkResultsPage() {
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [termsCache, setTermsCache] = useState<Record<string, Term[]>>({});
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [classSections, setClassSections] = useState<ClassArmSection[]>([]);
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
    if (!filters.sessionId || termsCache[filters.sessionId]) {
      return;
    }
    listTermsBySession(filters.sessionId)
      .then((terms) => {
        setTermsCache((prev) => ({
          ...prev,
          [filters.sessionId]: terms,
        }));
      })
      .catch((error) => {
        console.error("Unable to load terms", error);
      });
  }, [filters.sessionId, termsCache]);

  useEffect(() => {
    if (!filters.classId) {
      return;
    }

    listClassArms(filters.classId)
      .then((arms) => {
        setClassArms(arms);
        if (!arms.find((arm) => `${arm.id}` === filters.classArmId)) {
          setFilters((prev) => ({ ...prev, classArmId: "", classSectionId: "" }));
          setClassSections([]);
        }
      })
      .catch((error) => {
        console.error("Unable to load class arms", error);
      });
  }, [filters.classId, filters.classArmId]);

  useEffect(() => {
    // Class sections are not used in bulk result filters for now.
    return;
  }, [filters.classId, filters.classArmId, filters.classSectionId]);

  const terms = useMemo(() => {
    if (!filters.sessionId) {
      return [];
    }
    return termsCache[filters.sessionId] ?? [];
  }, [filters.sessionId, termsCache]);

  const canGenerate = Boolean(filters.sessionId && filters.termId && filters.classId);

  const parseErrorResponse = async (response: Response): Promise<string> => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      try {
        const payload = await response.json();
        if (payload && typeof payload === "object" && "message" in payload && typeof payload.message === "string") {
          return payload.message;
        }
      } catch (error) {
        console.error("Unable to parse bulk print JSON error", error);
      }
      return "Unable to load bulk results.";
    }
    const text = await response.text().catch(() => "");
    if (text.trim().length > 0) {
      const trimmed = text.trim();
      if (/^<\s*(!DOCTYPE|html)/i.test(trimmed)) {
        if (response.status === 422) {
          return "Results have not been added for the selected class in this session/term.";
        }
        return "Unable to prepare bulk results. Please ensure results exist and try again.";
      }
      return trimmed;
    }
    if (response.status === 403) {
      return "You do not have permission to print results for this class.";
    }
    if (response.status === 401) {
      return "Your session has expired. Please log in again.";
    }
    return `Unable to load bulk results (${response.status}).`;
  };

  const openPreview = async (autoPrint = false) => {
    if (!canGenerate) {
      const message = "Select a session, term, and class to continue.";
      setStatus(message);
      window.alert(message);
      return;
    }
    setStatus("");
    const query = buildQueryString(filters, autoPrint);
    const url = `/v19/print-bulk-results?${query}`;
    setProcessing(true);
    try {
      const response = await fetch(url, {
        headers: {
          Accept: "text/html",
          "X-Requested-With": "XMLHttpRequest",
        },
        credentials: "include",
      });
      if (!response.ok) {
        const errorMessage = await parseErrorResponse(response);
        throw new Error(errorMessage);
      }
      const html = await response.text();
      const printWindow = window.open("", "_blank");
      if (!printWindow) {
        throw new Error("Unable to open result window. Please allow pop-ups for this site.");
      }
      printWindow.document.open();
      printWindow.document.write(html);
      printWindow.document.close();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load bulk results. Please try again.";
      console.error("Bulk result printing failed", error);
      setStatus(message);
      window.alert(message);
    } finally {
      setProcessing(false);
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Bulk Result Printing</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Students</li>
          <li>Bulk Result Printing</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Print Results for a Class</h3>
              <p className="text-muted mb-0">
                Select the academic context below to generate one page per student. Use Export PDF to trigger the print dialog and save the compiled pages as a PDF file.
              </p>
            </div>
          </div>

          {status ? (
            <div className="alert alert-warning" role="alert">
              {status}
            </div>
          ) : null}

          <div className="row">
            <div className="col-lg-3 col-12 form-group">
              <label htmlFor="bulk-session">Session</label>
              <select
                id="bulk-session"
                className="form-control"
                value={filters.sessionId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    sessionId: event.target.value,
                    termId: "",
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
            <div className="col-lg-3 col-12 form-group">
              <label htmlFor="bulk-term">Term</label>
              <select
                id="bulk-term"
                className="form-control"
                value={filters.termId}
                onChange={(event) =>
                  setFilters((prev) => ({
                    ...prev,
                    termId: event.target.value,
                  }))
                }
                disabled={!filters.sessionId}
              >
                <option value="">Select term</option>
                {terms.map((term) => (
                  <option key={term.id} value={term.id}>
                    {term.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-3 col-12 form-group">
              <label htmlFor="bulk-class">Class</label>
              <select
                id="bulk-class"
                className="form-control"
                value={filters.classId}
                onChange={(event) => {
                  const nextClassId = event.target.value;
                  setFilters((prev) => ({
                    ...prev,
                    classId: nextClassId,
                    classArmId: "",
                    classSectionId: "",
                  }));
                  setClassArms([]);
                  setClassSections([]);
                }}
              >
                <option value="">Select class</option>
                {classes.map((klass) => (
                  <option key={klass.id} value={klass.id}>
                    {klass.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-lg-3 col-12 form-group">
              <label htmlFor="bulk-class-arm">Class Arm</label>
              <select
                id="bulk-class-arm"
                className="form-control"
                value={filters.classArmId}
                onChange={(event) => {
                  const nextArmId = event.target.value;
                  setFilters((prev) => ({
                    ...prev,
                    classArmId: nextArmId,
                    classSectionId: "",
                  }));
                  if (!nextArmId) {
                    setClassSections([]);
                  }
                }}
                disabled={!filters.classId || classArms.length === 0}
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

          <div className="row">
            {/* Class Section filter intentionally hidden for now */}
            <div className="col-lg-9 col-12 d-flex align-items-end justify-content-end">
              <div className="d-flex flex-wrap align-items-center">
                <button
                  type="button"
                  className="btn btn-outline-secondary mr-2"
                  onClick={() => {
                    setFilters(initialFilters);
                    setStatus("");
                  }}
                  disabled={processing}
                >
                  Reset
                </button>
                <button
                  type="button"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark mr-2"
                  onClick={() => void openPreview(false)}
                  disabled={!canGenerate || processing}
                >
                  {processing ? "Preparing…" : "Open Preview"}
                </button>
                <button
                  type="button"
                  className="btn-fill-lg btn-dark-pastel-green"
                  onClick={() => void openPreview(true)}
                  disabled={!canGenerate || processing}
                >
                  {processing ? "Please wait…" : "Export PDF"}
                </button>
              </div>
            </div>
          </div>

          <div className="alert alert-info mt-3" role="alert">
            Each student result occupies exactly one page in the generated view. When exporting, choose “Save as PDF” in the browser print dialog to keep that layout.
          </div>
        </div>
      </div>
    </>
  );
}
