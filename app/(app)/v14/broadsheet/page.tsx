"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { listSessions, type Session } from "@/lib/sessions";
import { listTermsBySession, type Term } from "@/lib/terms";
import { listClasses, type SchoolClass } from "@/lib/classes";
import { listClassArms, type ClassArm } from "@/lib/classArms";

interface Filters {
  sessionId: string;
  termId: string;
  classId: string;
  armId: string;
}

const emptyFilters: Filters = {
  sessionId: "",
  termId: "",
  classId: "",
  armId: "",
};

const buildPreviewUrl = (filters: Filters) => {
  if (!filters.sessionId || !filters.termId || !filters.classId) return "";

  const params = new URLSearchParams({
    session_id: filters.sessionId,
    term_id: filters.termId,
    school_class_id: filters.classId,
    embedded: "1",
  });
  if (filters.armId) params.set("class_arm_id", filters.armId);
  return `/v14/print-broadsheet?${params.toString()}`;
};

export default function BroadsheetPage() {
  const { schoolContext } = useAuth();
  const searchParams = useSearchParams();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const initialFilters = useMemo<Filters>(() => ({
    sessionId: searchParams.get("session_id") ?? "",
    termId: searchParams.get("term_id") ?? "",
    classId: searchParams.get("school_class_id") ?? "",
    armId: searchParams.get("class_arm_id") ?? "",
  }), [searchParams]);

  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [terms, setTerms] = useState<Term[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [arms, setArms] = useState<ClassArm[]>([]);
  const [previewUrl, setPreviewUrl] = useState(() => buildPreviewUrl(initialFilters));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([listSessions(), listClasses()])
      .then(([sessionItems, classItems]) => {
        setSessions(sessionItems);
        setClasses(classItems);
        if (!initialFilters.sessionId && schoolContext.current_session_id) {
          setFilters((previous) => ({
            ...previous,
            sessionId: String(schoolContext.current_session_id),
          }));
        }
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load broadsheet filters.");
      });
  }, [initialFilters.sessionId, schoolContext.current_session_id]);

  useEffect(() => {
    if (!filters.sessionId) return;

    listTermsBySession(filters.sessionId)
      .then((items) => {
        setTerms(items);
        if (!initialFilters.termId && schoolContext.current_term_id) {
          const currentTermId = String(schoolContext.current_term_id);
          if (items.some((item) => String(item.id) === currentTermId)) {
            setFilters((previous) => ({ ...previous, termId: currentTermId }));
          }
        }
      })
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load terms.");
      });
  }, [filters.sessionId, initialFilters.termId, schoolContext.current_term_id]);

  useEffect(() => {
    if (!filters.classId) return;
    listClassArms(filters.classId)
      .then(setArms)
      .catch((cause) => {
        setError(cause instanceof Error ? cause.message : "Unable to load class arms.");
      });
  }, [filters.classId]);

  const viewBroadsheet = () => {
    const url = buildPreviewUrl(filters);
    if (!url) {
      setError("Select a session, term, and class to view the broadsheet.");
      return;
    }
    setError(null);
    setPreviewUrl(url);
  };

  const reset = () => {
    setFilters(emptyFilters);
    setTerms([]);
    setArms([]);
    setPreviewUrl("");
    setError(null);
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Student Management</h3>
        <ul>
          <li><Link href="/v10/dashboard">Home</Link></li>
          <li>Broadsheet</li>
        </ul>
      </div>

      {error ? <div className="alert alert-danger">{error}</div> : null}

      <div className="card height-auto broadsheet-page-card">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title"><h3>Broadsheet</h3></div>
          </div>

          <div className="row">
            <div className="col-lg-2 col-md-4 form-group">
              <label>Session</label>
              <select className="form-control" value={filters.sessionId} onChange={(event) => setFilters((old) => ({ ...old, sessionId: event.target.value, termId: "" }))}>
                <option value="">Select Session</option>
                {sessions.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-lg-2 col-md-4 form-group">
              <label>Term</label>
              <select className="form-control" value={filters.termId} disabled={!filters.sessionId} onChange={(event) => setFilters((old) => ({ ...old, termId: event.target.value }))}>
                <option value="">Select Term</option>
                {terms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-lg-3 col-md-4 form-group">
              <label>Class</label>
              <select className="form-control" value={filters.classId} onChange={(event) => setFilters((old) => ({ ...old, classId: event.target.value, armId: "" }))}>
                <option value="">Select Class</option>
                {classes.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-lg-2 col-md-4 form-group">
              <label>Class Arm</label>
              <select className="form-control" value={filters.armId} disabled={!filters.classId} onChange={(event) => setFilters((old) => ({ ...old, armId: event.target.value }))}>
                <option value="">All Arms</option>
                {arms.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div className="col-lg-3 col-md-8 form-group d-flex align-items-end">
              <button type="button" className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark mr-2" onClick={viewBroadsheet}>View</button>
              <button type="button" className="btn btn-outline-secondary mr-2" onClick={reset}>Reset</button>
              {previewUrl ? (
                <button type="button" className="btn btn-primary broadsheet-print-button" onClick={() => iframeRef.current?.contentWindow?.print()}>Print</button>
              ) : null}
            </div>
          </div>

          {previewUrl ? (
            <iframe
              ref={iframeRef}
              key={previewUrl}
              src={previewUrl}
              title="Broadsheet preview"
              className="broadsheet-preview"
            />
          ) : (
            <div className="text-center text-muted p-5">Select the filters above to view the broadsheet.</div>
          )}
        </div>
      </div>

      <style jsx>{`
        .broadsheet-preview {
          display: block;
          width: 100%;
          height: 72vh;
          min-height: 620px;
          border: 1px solid #e3e6ef;
          border-radius: 4px;
          background: #fff;
        }

        .broadsheet-print-button {
          min-width: 110px;
          padding: 12px 24px;
          font-size: 16px;
          font-weight: 700;
        }
      `}</style>
    </>
  );
}
