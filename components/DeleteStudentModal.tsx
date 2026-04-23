"use client";

import React, { useState } from "react";
import {
  deleteStudent,
  deleteDependentRecords,
  StudentDelectionWithDependenciesError,
} from "@/lib/students";

interface DeleteStudentModalProps {
  isOpen: boolean;
  studentName?: string;
  studentId?: string | number;
  dependencies?: string[];
  onClose: () => void;
  onDeleteSuccess: () => void;
  onDeleteError: (error: string) => void;
}

export default function DeleteStudentModal({
  isOpen,
  studentName,
  studentId,
  dependencies = [],
  onClose,
  onDeleteSuccess,
  onDeleteError,
}: DeleteStudentModalProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteWithRecords, setDeleteWithRecords] = useState(false);
  const [deletingStatus, setDeletingStatus] = useState<string>("");
  const [error, setError] = useState<string>("");

  const handleDeleteWithRecords = async () => {
    if (!studentId) return;

    setIsDeleting(true);
    setDeleteWithRecords(true);
    setError("");
    setDeletingStatus("Deleting dependent records...");

    try {
      // First, delete all dependent records
      await deleteDependentRecords(studentId);
      setDeletingStatus("Deleting student record...");

      // Then delete the student
      await deleteStudent(studentId);

      setIsDeleting(false);
      onDeleteSuccess();
      onClose();
    } catch (err) {
      setIsDeleting(false);
      console.error("Unable to delete student with records", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unable to delete student.";
      setError(errorMessage);
      setDeletingStatus("");
    }
  };

  const handleDeleteOnly = async () => {
    if (!studentId) return;

    setIsDeleting(true);
    setDeleteWithRecords(false);
    setError("");
    setDeletingStatus("Deleting student record...");

    try {
      await deleteStudent(studentId);
      setIsDeleting(false);
      onDeleteSuccess();
      onClose();
    } catch (err) {
      setIsDeleting(false);
      console.error("Unable to delete student", err);
      const errorMessage =
        err instanceof Error ? err.message : "Unable to delete student.";
      setError(errorMessage);
      setDeletingStatus("");
    }
  };

  if (!isOpen) {
    return null;
  }

  const hasDependencies = dependencies && dependencies.length > 0;

  return (
    <div
      className={`modal fade${isOpen ? " show" : ""}`}
      role="dialog"
      style={{
        display: isOpen ? "block" : "none",
        backgroundColor: isOpen ? "rgba(0, 0, 0, 0.5)" : undefined,
      }}
      {...(isOpen ? {} : { "aria-hidden": true })}
    >
      <div className="modal-dialog modal-lg" role="document">
        <div className="modal-content">
          <div className="modal-header">
            <h5 className="modal-title">Delete Student</h5>
            <button
              type="button"
              className="close"
              aria-label="Close"
              onClick={onClose}
              disabled={isDeleting}
            >
              <span aria-hidden="true">&times;</span>
            </button>
          </div>

          <div className="modal-body">
            {error ? (
              <div className="alert alert-danger" role="alert">
                <strong>Error:</strong> {error}
              </div>
            ) : null}

            {deletingStatus ? (
              <div className="text-center py-4">
                <div
                  className="spinner-border text-primary mb-3"
                  role="status"
                >
                  <span className="sr-only">Loading...</span>
                </div>
                <p>{deletingStatus}</p>
              </div>
            ) : hasDependencies ? (
              <>
                <div className="alert alert-warning" role="alert">
                  <strong>Cannot Delete Student</strong>
                  <p className="mt-2 mb-0">
                    The student <strong>{studentName}</strong> has associated
                    records that must be removed before deletion:
                  </p>
                  <ul className="mt-2 mb-0">
                    {dependencies.map((dep, index) => (
                      <li key={index}>{dep}</li>
                    ))}
                  </ul>
                </div>

                <div className="alert alert-info" role="alert">
                  <strong>What would you like to do?</strong>
                  <p className="mt-2">
                    You can:
                    <br />
                    <strong>Option 1:</strong> Delete all associated records
                    along with the student
                    <br />
                    <strong>Option 2:</strong> Cancel and manually delete the
                    records first
                  </p>
                </div>
              </>
            ) : (
              <p>
                Are you sure you want to delete <strong>{studentName}</strong>?
                This action cannot be undone.
              </p>
            )}
          </div>

          <div className="modal-footer">
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={isDeleting}
            >
              {error ? "Close" : "Cancel"}
            </button>

            {!error ? (
              hasDependencies ? (
                <>
                  <button
                    type="button"
                    className="btn btn-danger"
                    onClick={handleDeleteWithRecords}
                    disabled={isDeleting}
                  >
                    {isDeleting ? "Deleting..." : "Delete Records & Student"}
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className="btn btn-danger"
                  onClick={handleDeleteOnly}
                  disabled={isDeleting}
                >
                  {isDeleting ? "Deleting..." : "Delete Student"}
                </button>
              )
            ) : null}

            {error && hasDependencies ? (
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleDeleteWithRecords}
                disabled={isDeleting}
              >
                {isDeleting ? "Retrying..." : "Retry"}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
