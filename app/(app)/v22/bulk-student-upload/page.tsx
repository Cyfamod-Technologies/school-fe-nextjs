"use client";

import Link from "next/link";
import {
  DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  BulkPreviewFailure,
  BulkPreviewRow,
  BulkPreviewSummary,
  previewStudentBulkUpload,
  downloadStudentTemplate,
  commitStudentBulkUpload,
  TemplateDownloadParams,
  BulkUploadParams,
} from "@/lib/studentBulkUpload";
import { listSessions, Session } from "@/lib/sessions";
import { listClasses, SchoolClass } from "@/lib/classes";
import { listClassArms, ClassArm } from "@/lib/classArms";

type FeedbackKind = "success" | "info" | "warning" | "danger";

interface FeedbackState {
  type: FeedbackKind;
  message: string;
}

interface PreviewState {
  batchId: string;
  rows: BulkPreviewRow[];
  summary: BulkPreviewSummary | null;
  expiresAt: string | null;
}

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

export default function BulkStudentUploadPage() {
  // Step 1: Selection state
  const [sessions, setSessions] = useState<Session[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [classArms, setClassArms] = useState<ClassArm[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(true);
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingClassArms, setLoadingClassArms] = useState(false);

  const [selectedSessionId, setSelectedSessionId] = useState<string>("");
  const [selectedClassId, setSelectedClassId] = useState<string>("");
  const [selectedClassArmId, setSelectedClassArmId] = useState<string>("");

  // Step 2: Upload state
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [preview, setPreview] = useState<PreviewState | null>(null);
  const [validationFailure, setValidationFailure] = useState<BulkPreviewFailure | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewCardRef = useRef<HTMLDivElement | null>(null);

  // Derived state
  const canDownloadTemplate = !!selectedSessionId && !!selectedClassId && !!selectedClassArmId;
  const currentStep = useMemo(() => {
    if (!canDownloadTemplate) return 1;
    if (!selectedFile && !preview) return 2;
    if (preview) return 3;
    return 2;
  }, [canDownloadTemplate, selectedFile, preview]);

  const selectedSession = useMemo(
    () => sessions.find((s) => String(s.id) === selectedSessionId),
    [sessions, selectedSessionId]
  );
  const selectedClass = useMemo(
    () => classes.find((c) => String(c.id) === selectedClassId),
    [classes, selectedClassId]
  );
  const selectedClassArm = useMemo(
    () => classArms.find((a) => String(a.id) === selectedClassArmId),
    [classArms, selectedClassArmId]
  );

  // Load sessions on mount
  useEffect(() => {
    const loadSessions = async () => {
      setLoadingSessions(true);
      try {
        const data = await listSessions();
        setSessions(data);
      } catch (error) {
        console.error("Failed to load sessions", error);
        setFeedback({
          type: "danger",
          message: "Unable to load sessions. Please refresh the page.",
        });
      } finally {
        setLoadingSessions(false);
      }
    };
    loadSessions();
  }, []);

  // Load classes on mount
  useEffect(() => {
    const loadClasses = async () => {
      setLoadingClasses(true);
      try {
        const data = await listClasses();
        setClasses(data);
      } catch (error) {
        console.error("Failed to load classes", error);
      } finally {
        setLoadingClasses(false);
      }
    };
    loadClasses();
  }, []);

  // Load class arms when class changes
  useEffect(() => {
    if (!selectedClassId) {
      setClassArms([]);
      setSelectedClassArmId("");
      return;
    }

    const loadClassArms = async () => {
      setLoadingClassArms(true);
      setSelectedClassArmId("");
      try {
        const data = await listClassArms(selectedClassId);
        setClassArms(data);
      } catch (error) {
        console.error("Failed to load class arms", error);
        setClassArms([]);
      } finally {
        setLoadingClassArms(false);
      }
    };
    loadClassArms();
  }, [selectedClassId]);

  useEffect(() => {
    if (!preview) return;
    previewCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [preview]);

  const summaryItems = useMemo(() => {
    if (!preview?.summary) {
      return [];
    }
    return [
      { label: "Total Rows", value: preview.summary.total_rows ?? 0 },
      { label: "Unique Sessions", value: preview.summary.sessions ?? 0 },
      { label: "Unique Classes", value: preview.summary.classes ?? 0 },
    ];
  }, [preview?.summary]);

  const resetUploadState = useCallback(() => {
    setSelectedFile(null);
    setPreview(null);
    setValidationFailure(null);
    setFeedback(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, []);

  const resetAllState = useCallback(() => {
    resetUploadState();
    setSelectedSessionId("");
    setSelectedClassId("");
    setSelectedClassArmId("");
  }, [resetUploadState]);

  const getUploadParams = useCallback((): BulkUploadParams => ({
    session_id: selectedSessionId || undefined,
    class_id: selectedClassId || undefined,
    class_arm_id: selectedClassArmId || undefined,
  }), [selectedSessionId, selectedClassId, selectedClassArmId]);

  const handleDownloadTemplate = useCallback(async () => {
    setFeedback(null);
    try {
      setDownloadingTemplate(true);
      const params: TemplateDownloadParams = getUploadParams();
      const blob = await downloadStudentTemplate(params);
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      
      // Create descriptive filename
      const sessionName = selectedSession?.name?.replace(/[^a-zA-Z0-9]/g, "-") || "session";
      const className = selectedClass?.name?.replace(/[^a-zA-Z0-9]/g, "-") || "class";
      const armName = selectedClassArm?.name?.replace(/[^a-zA-Z0-9]/g, "-") || "arm";
      anchor.download = `student-upload-${sessionName}-${className}-${armName}-${new Date().toISOString().slice(0, 10)}.csv`;
      
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
      setFeedback({
        type: "success",
        message: "Template downloaded! Fill in the student details and upload the file below.",
      });
    } catch (error) {
      setFeedback({
        type: "danger",
        message: error instanceof Error ? error.message : "Unable to download template.",
      });
    } finally {
      setDownloadingTemplate(false);
    }
  }, [getUploadParams, selectedSession, selectedClass, selectedClassArm]);

  const handleFileChosen = (file: File) => {
    if (!file.name.toLowerCase().endsWith(".csv")) {
      setFeedback({
        type: "warning",
        message: "Only CSV files are supported. Please choose a .csv file.",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setFeedback({
        type: "warning",
        message: "File is larger than 5MB. Split it and try again.",
      });
      return;
    }
    setSelectedFile(file);
    setFeedback({
      type: "info",
      message: 'File selected. Click "Upload & Preview" to validate.',
    });
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleFileChosen(file);
    }
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) {
      handleFileChosen(file);
    }
  };

  const handleDragEnter = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  };

  const handleUploadPreview = async () => {
    if (!selectedFile) {
      setFeedback({
        type: "warning",
        message: "Please choose a CSV file before uploading.",
      });
      return;
    }

    setUploading(true);
    setFeedback({
      type: "info",
      message: "Validating file. Please wait...",
    });
    setValidationFailure(null);
    setPreview(null);

    try {
      const params = getUploadParams();
      const result = await previewStudentBulkUpload(selectedFile, params);
      if (!result.ok) {
        setValidationFailure(result.error);
        setFeedback({
          type: "danger",
          message: result.error.message,
        });
        return;
      }
      setPreview({
        batchId: result.data.batchId,
        rows: result.data.previewRows,
        summary: result.data.summary,
        expiresAt: result.data.expiresAt,
      });
      setValidationFailure(null);
      setFeedback({
        type: "success",
        message: "Validation successful! Review the preview and confirm to import all students.",
      });
    } catch (error) {
      setFeedback({
        type: "danger",
        message: error instanceof Error ? error.message : "Unable to validate file.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleConfirmUpload = async () => {
    if (!preview?.batchId) {
      setFeedback({
        type: "warning",
        message: "Upload a file and preview the data before confirming.",
      });
      return;
    }
    setConfirming(true);
    setFeedback({
      type: "info",
      message: "Creating students. This may take a moment...",
    });

    try {
      const result = await commitStudentBulkUpload(preview.batchId);
      // Keep the success message visible instead of clearing feedback immediately.
      setSelectedFile(null);
      setPreview(null);
      setValidationFailure(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      setFeedback({
        type: "success",
        message: result.message ?? `Upload complete! ${result.summary?.total_processed ?? 0} students were created.`,
      });
    } catch (error) {
      setFeedback({
        type: "danger",
        message: error instanceof Error ? error.message : "Bulk upload failed. Please retry.",
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleDownloadErrorLog = () => {
    const errorCsv = validationFailure?.errorCsv;
    if (!errorCsv) {
      setFeedback({
        type: "info",
        message: "No error log available.",
      });
      return;
    }
    try {
      const byteCharacters = atob(errorCsv);
      const byteNumbers = new Array(byteCharacters.length);
      for (let index = 0; index < byteCharacters.length; index += 1) {
        byteNumbers[index] = byteCharacters.charCodeAt(index);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "text/csv" });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `bulk-upload-errors-${new Date().toISOString().slice(0, 19)}.csv`;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
      URL.revokeObjectURL(url);
    } catch {
      setFeedback({
        type: "danger",
        message: "Unable to download the error log. Please try again.",
      });
    }
  };

  const previewRows = useMemo(() => preview?.rows ?? [], [preview?.rows]);
  const validationErrors = validationFailure?.errors ?? [];

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Bulk Student Upload</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Students</li>
          <li>Bulk Upload</li>
        </ul>
      </div>

      {/* Progress Steps */}
      <div className="bulk-upload-progress mb-4">
        <div className={`progress-step ${currentStep >= 1 ? "active" : ""} ${currentStep > 1 ? "completed" : ""}`}>
          <div className="step-number">
            {currentStep > 1 ? <i className="fas fa-check" /> : "1"}
          </div>
          <div className="step-label">Select Class</div>
        </div>
        <div className="progress-line" />
        <div className={`progress-step ${currentStep >= 2 ? "active" : ""} ${currentStep > 2 ? "completed" : ""}`}>
          <div className="step-number">
            {currentStep > 2 ? <i className="fas fa-check" /> : "2"}
          </div>
          <div className="step-label">Download & Upload</div>
        </div>
        <div className="progress-line" />
        <div className={`progress-step ${currentStep >= 3 ? "active" : ""}`}>
          <div className="step-number">3</div>
          <div className="step-label">Review & Confirm</div>
        </div>
      </div>

      <div className="row">
        {/* Step 1: Selection Card */}
        <div className="col-lg-4">
          <div className="card height-auto mb-4">
            <div className="card-body">
              <div className="step-card-header">
                <div className="step-badge">Step 1</div>
                <h4>Select Target Class</h4>
                <p className="text-muted mb-0">
                  Choose the session, class, and arm where students will be enrolled.
                </p>
              </div>

              <div className="form-group mt-4">
                <label htmlFor="session-select" className="form-label-lg">
                  <i className="fas fa-calendar-alt mr-2" />
                  Academic Session
                </label>
                <select
                  id="session-select"
                  className="form-control form-control-lg"
                  value={selectedSessionId}
                  onChange={(e) => setSelectedSessionId(e.target.value)}
                  disabled={loadingSessions}
                >
                  <option value="">
                    {loadingSessions ? "Loading sessions..." : "-- Select Session --"}
                  </option>
                  {sessions.map((session) => (
                    <option key={session.id} value={String(session.id)}>
                      {session.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="class-select" className="form-label-lg">
                  <i className="fas fa-chalkboard mr-2" />
                  Class
                </label>
                <select
                  id="class-select"
                  className="form-control form-control-lg"
                  value={selectedClassId}
                  onChange={(e) => setSelectedClassId(e.target.value)}
                  disabled={loadingClasses || !selectedSessionId}
                >
                  <option value="">
                    {loadingClasses ? "Loading classes..." : "-- Select Class --"}
                  </option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={String(cls.id)}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group mb-0">
                <label htmlFor="arm-select" className="form-label-lg">
                  <i className="fas fa-users mr-2" />
                  Class Arm
                </label>
                <select
                  id="arm-select"
                  className="form-control form-control-lg"
                  value={selectedClassArmId}
                  onChange={(e) => setSelectedClassArmId(e.target.value)}
                  disabled={loadingClassArms || !selectedClassId}
                >
                  <option value="">
                    {loadingClassArms ? "Loading arms..." : "-- Select Arm --"}
                  </option>
                  {classArms.map((arm) => (
                    <option key={arm.id} value={String(arm.id)}>
                      {arm.name}
                    </option>
                  ))}
                </select>
              </div>

              {canDownloadTemplate && (
                <div className="selection-summary mt-4">
                  <div className="selection-summary-header">
                    <i className="fas fa-check-circle text-success mr-2" />
                    Selected Target
                  </div>
                  <div className="selection-summary-body">
                    <div className="summary-item">
                      <span className="label">Session:</span>
                      <span className="value">{selectedSession?.name}</span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Class:</span>
                      <span className="value">{selectedClass?.name}</span>
                    </div>
                    <div className="summary-item">
                      <span className="label">Arm:</span>
                      <span className="value">{selectedClassArm?.name}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Quick Guide Card */}
          <div className="card height-auto mb-4">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h4>
                    <i className="fas fa-lightbulb text-warning mr-2" />
                    Quick Guide
                  </h4>
                </div>
              </div>
              <ol className="bulk-upload-steps">
                <li>Select the session, class, and arm above.</li>
                <li>Download the pre-configured template.</li>
                <li>Fill in student &amp; guardian details.</li>
                <li>Upload the file to validate.</li>
                <li>Review and confirm the upload.</li>
              </ol>
              <div className="alert alert-info small mb-0">
                <i className="fas fa-info-circle mr-2" />
                The template is customized for your selected class. No need to fill in session or class IDs!
              </div>
            </div>
          </div>
        </div>

        {/* Step 2: Template & Upload Card */}
        <div className="col-lg-8">
          <div className="card height-auto mb-4">
            <div className="card-body">
              <div className="step-card-header">
                <div className="step-badge">Step 2</div>
                <h4>Download Template & Upload</h4>
              </div>

              {!canDownloadTemplate ? (
                <div className="template-locked-state">
                  <div className="locked-icon">
                    <i className="fas fa-lock" />
                  </div>
                  <h5>Select a Class First</h5>
                  <p className="text-muted">
                    Please complete Step 1 by selecting a session, class, and arm to unlock the template download.
                  </p>
                </div>
              ) : (
                <>
                  {feedback && (
                    <div className={`alert alert-${feedback.type}`} role="alert">
                      {feedback.type === "success" && <i className="fas fa-check-circle mr-2" />}
                      {feedback.type === "danger" && <i className="fas fa-exclamation-circle mr-2" />}
                      {feedback.type === "warning" && <i className="fas fa-exclamation-triangle mr-2" />}
                      {feedback.type === "info" && <i className="fas fa-info-circle mr-2" />}
                      {feedback.message}
                    </div>
                  )}

                  <div className="template-download-section">
                    <div className="template-info">
                      <div className="template-icon">
                        <i className="fas fa-file-csv" />
                      </div>
                      <div className="template-details">
                        <h5>Student Upload Template</h5>
                        <p className="text-muted mb-0">
                          Pre-configured for <strong>{selectedClass?.name} - {selectedClassArm?.name}</strong> 
                          {" "}({selectedSession?.name})
                        </p>
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                      onClick={() => handleDownloadTemplate().catch(() => undefined)}
                      disabled={downloadingTemplate}
                    >
                      {downloadingTemplate ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true" />
                          Downloading...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-download mr-2" />
                          Download Template
                        </>
                      )}
                    </button>
                  </div>

                  <hr className="my-4" />

                  <div
                    className={`bulk-upload-dropzone${isDragOver ? " dragover" : ""}`}
                    onDragEnter={handleDragEnter}
                    onDragOver={handleDragEnter}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                  >
                    <div className="icon">
                      <i className="fas fa-cloud-upload-alt" />
                    </div>
                    <p className="lead mb-1">Drag & drop your completed CSV here</p>
                    <p className="text-muted small mb-3">
                      Only .csv files are supported. Maximum size 5MB.
                    </p>
                    <button
                      type="button"
                      className="btn-fill-md btn-outline-primary"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <i className="fas fa-folder-open mr-2" />
                      Choose File
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,text/csv"
                      className="d-none"
                      onChange={handleFileInputChange}
                    />
                    {selectedFile && (
                      <div className="selected-file-info mt-3">
                        <i className="fas fa-file-csv mr-2" />
                        <span>{selectedFile.name}</span>
                        <span className="file-size">({formatBytes(selectedFile.size)})</span>
                      </div>
                    )}
                  </div>

                  <div className="upload-actions mt-4">
                    <button
                      type="button"
                      className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark mr-3"
                      onClick={() => handleUploadPreview().catch(() => undefined)}
                      disabled={uploading || !selectedFile}
                    >
                      {uploading ? (
                        <>
                          <span className="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true" />
                          Validating...
                        </>
                      ) : (
                        <>
                          <i className="fas fa-upload mr-2" />
                          Upload & Preview
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn-fill-lg btn-light text-dark"
                      onClick={resetUploadState}
                    >
                      <i className="fas fa-redo mr-2" />
                      Reset
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Step 3: Preview Card */}
      {preview && (
        <div ref={previewCardRef} id="bulk-preview-card" className="card height-auto mb-4">
          <div className="card-body">
            <div className="step-card-header d-flex justify-content-between align-items-start">
              <div>
                <div className="step-badge step-badge-success">Step 3</div>
                <h4>Review & Confirm</h4>
                <p className="text-muted mb-0">
                  Review the parsed data below. Click "Confirm Upload" to create all students.
                </p>
              </div>
              <div className="d-flex align-items-center">
                {preview.expiresAt && (
                  <span className="text-muted small mr-3">
                    <i className="fas fa-clock mr-1" />
                    Expires: {formatDateTime(preview.expiresAt)}
                  </span>
                )}
                <button
                  type="button"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  onClick={() => handleConfirmUpload().catch(() => undefined)}
                  disabled={confirming}
                >
                  {confirming ? (
                    <>
                      <span className="spinner-border spinner-border-sm mr-2" role="status" aria-hidden="true" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <i className="fas fa-check mr-2" />
                      Confirm Upload
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="row mt-4">
              <div className="col-lg-3">
                <div className="upload-summary-card">
                  <h5>
                    <i className="fas fa-chart-bar mr-2" />
                    Upload Summary
                  </h5>
                  <ul className="upload-summary-list">
                    {summaryItems.map((item) => (
                      <li key={item.label}>
                        <span>{item.label}</span>
                        <span className="value">{item.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="col-lg-9">
                <div className="table-responsive">
                  <table className="table display text-nowrap bulk-preview-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Admission No</th>
                        <th>Session</th>
                        <th>Class</th>
                        <th>Parent Email</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.length ? (
                        previewRows.map((row, index) => (
                          <tr key={`preview-${index}`}>
                            <td>{index + 1}</td>
                            <td>{row.name ?? ""}</td>
                            <td>{row.admission_no ?? ""}</td>
                            <td>{row.session ?? ""}</td>
                            <td>
                              {[row.class, row.class_arm]
                                .filter(Boolean)
                                .join(" / ")}
                            </td>
                            <td>{row.parent_email ?? ""}</td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td colSpan={6} className="text-center text-muted">
                            No preview rows available.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Validation Errors Card */}
      {validationFailure && (
        <div className="card height-auto mb-4 border-danger">
          <div className="card-body">
            <div className="step-card-header d-flex justify-content-between align-items-start">
              <div>
                <h4 className="text-danger">
                  <i className="fas fa-exclamation-triangle mr-2" />
                  Validation Issues
                </h4>
                <p className="text-muted mb-0">
                  Fix the issues below and re-upload the file.
                </p>
              </div>
              <button
                type="button"
                className="btn-fill-lg btn-outline-danger"
                onClick={handleDownloadErrorLog}
              >
                <i className="fas fa-file-csv mr-2" />
                Download Error Log
              </button>
            </div>

            <div className="table-responsive mt-3">
              <table className="table display text-nowrap">
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Column</th>
                    <th>Error Message</th>
                  </tr>
                </thead>
                <tbody>
                  {validationErrors.length ? (
                    validationErrors.map((error, index) => (
                      <tr key={`error-${index}`}>
                        <td>
                          <span className="badge badge-danger">{error.row ?? "-"}</span>
                        </td>
                        <td>{error.column ?? "-"}</td>
                        <td>{error.message ?? "-"}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={3} className="text-center text-muted">
                        No specific errors were provided.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .bulk-upload-progress {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0;
          padding: 1.5rem;
          background: white;
          border-radius: 12px;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
        }

        .progress-step {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 0.5rem;
        }

        .step-number {
          width: 44px;
          height: 44px;
          border-radius: 50%;
          background: #e2e8f0;
          color: #64748b;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          transition: all 0.3s ease;
        }

        .progress-step.active .step-number {
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
        }

        .progress-step.completed .step-number {
          background: #22c55e;
          color: white;
        }

        .step-label {
          font-size: 0.95rem;
          font-weight: 600;
          color: #64748b;
        }

        .progress-step.active .step-label {
          color: #1e293b;
        }

        .progress-line {
          width: 80px;
          height: 3px;
          background: #e2e8f0;
          margin: 0 1rem;
          margin-bottom: 1.5rem;
        }

        .step-card-header {
          margin-bottom: 1rem;
        }

        .step-card-header h4 {
          margin: 0.5rem 0 0.25rem;
          font-size: 1.25rem;
          font-weight: 600;
        }

        .step-badge {
          display: inline-block;
          background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%);
          color: white;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          padding: 0.25rem 0.75rem;
          border-radius: 20px;
        }

        .step-badge-success {
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
        }

        .form-label-lg {
          font-size: 1rem;
          font-weight: 600;
          color: #1e293b;
          margin-bottom: 0.5rem;
          display: flex;
          align-items: center;
        }

        .form-label-lg i {
          color: #6366f1;
        }

        .selection-summary {
          background: #f0fdf4;
          border: 1px solid #bbf7d0;
          border-radius: 10px;
          padding: 1rem;
        }

        .selection-summary-header {
          font-weight: 600;
          color: #166534;
          margin-bottom: 0.75rem;
          font-size: 0.95rem;
        }

        .selection-summary-body .summary-item {
          display: flex;
          justify-content: space-between;
          padding: 0.375rem 0;
          border-bottom: 1px dashed #bbf7d0;
        }

        .selection-summary-body .summary-item:last-child {
          border-bottom: none;
        }

        .selection-summary-body .label {
          color: #64748b;
          font-size: 0.9rem;
        }

        .selection-summary-body .value {
          font-weight: 600;
          color: #1e293b;
          font-size: 0.9rem;
        }

        .template-locked-state {
          text-align: center;
          padding: 3rem 2rem;
          background: #f8fafc;
          border-radius: 12px;
          border: 2px dashed #e2e8f0;
        }

        .locked-icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: #e2e8f0;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 1.5rem;
        }

        .locked-icon i {
          font-size: 2rem;
          color: #94a3b8;
        }

        .template-locked-state h5 {
          font-size: 1.25rem;
          font-weight: 600;
          color: #475569;
          margin-bottom: 0.5rem;
        }

        .template-download-section {
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: #f8fafc;
          border-radius: 12px;
          padding: 1.25rem;
          border: 1px solid #e2e8f0;
        }

        .template-info {
          display: flex;
          align-items: center;
          gap: 1rem;
        }

        .template-icon {
          width: 56px;
          height: 56px;
          border-radius: 12px;
          background: linear-gradient(135deg, #22c55e 0%, #16a34a 100%);
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .template-icon i {
          font-size: 1.5rem;
          color: white;
        }

        .template-details h5 {
          margin: 0 0 0.25rem;
          font-size: 1.1rem;
          font-weight: 600;
        }

        .bulk-upload-dropzone {
          border: 2px dashed #e2e8f0;
          border-radius: 12px;
          padding: 2.5rem;
          text-align: center;
          transition: all 0.2s ease;
          background: #fafafa;
        }

        .bulk-upload-dropzone:hover,
        .bulk-upload-dropzone.dragover {
          border-color: #6366f1;
          background: #f5f3ff;
        }

        .bulk-upload-dropzone .icon {
          margin-bottom: 1rem;
        }

        .bulk-upload-dropzone .icon i {
          font-size: 3rem;
          color: #94a3b8;
        }

        .bulk-upload-dropzone.dragover .icon i {
          color: #6366f1;
        }

        .bulk-upload-dropzone .lead {
          font-size: 1.1rem;
          font-weight: 600;
          color: #1e293b;
        }

        .selected-file-info {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: #e0f2fe;
          color: #0369a1;
          padding: 0.5rem 1rem;
          border-radius: 8px;
          font-size: 0.95rem;
        }

        .selected-file-info .file-size {
          color: #64748b;
        }

        .upload-actions {
          display: flex;
          align-items: center;
        }

        .upload-summary-card {
          background: #f8fafc;
          border-radius: 12px;
          padding: 1.25rem;
          border: 1px solid #e2e8f0;
        }

        .upload-summary-card h5 {
          font-size: 1rem;
          font-weight: 600;
          margin-bottom: 1rem;
          color: #1e293b;
        }

        .upload-summary-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }

        .upload-summary-list li {
          display: flex;
          justify-content: space-between;
          padding: 0.625rem 0;
          border-bottom: 1px solid #e2e8f0;
          font-size: 0.95rem;
        }

        .upload-summary-list li:last-child {
          border-bottom: none;
        }

        .upload-summary-list li .value {
          font-weight: 700;
          color: #6366f1;
        }

        .bulk-upload-steps {
          padding-left: 1.25rem;
          margin: 1rem 0;
        }

        .bulk-upload-steps li {
          margin-bottom: 0.625rem;
          font-size: 0.95rem;
          color: #475569;
        }

        :global(.bulk-preview-table thead th) {
          background: #f1f5f9;
          font-weight: 600;
          font-size: 0.9rem;
        }

        @media (max-width: 768px) {
          .bulk-upload-progress {
            flex-direction: column;
            gap: 1rem;
          }

          :global(.bulk-preview-table th:nth-child(3)),
          :global(.bulk-preview-table td:nth-child(3)),
          :global(.bulk-preview-table th:nth-child(5)),
          :global(.bulk-preview-table td:nth-child(5)) {
            display: none;
          }

          .progress-line {
            width: 3px;
            height: 30px;
            margin: 0;
          }

          .template-download-section {
            flex-direction: column;
            gap: 1rem;
            text-align: center;
          }

          .template-info {
            flex-direction: column;
          }
        }
      `}</style>
    </>
  );
}

function formatBytes(bytes: number): string {
  if (!bytes) return "0 Bytes";
  const units = ["Bytes", "KB", "MB", "GB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(2)} ${units[exponent]}`;
}

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString();
}
