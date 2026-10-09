"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { listAuditLogs, type FinanceAuditLogEntry } from "@/lib/financeReports";

const ACTION_LABELS: Record<string, string> = {
  "fee_assignment.created": "Fee assigned",
  "fee_assignment.updated": "Fee assignment updated",
  "fee_assignment.deleted": "Fee assignment removed",
  "bill.generated": "Bills generated",
  "payment.submitted": "Payment submitted",
  "payment.recorded": "Payment recorded",
  "payment.verified": "Payment verified",
  "payment.rejected": "Payment rejected",
  "payment.reversed": "Payment reversed",
  "payment.allocated": "Payment allocated",
  "fee_adjustment.applied": "Fee adjustment applied",
  "fee_adjustment.reversed": "Fee adjustment reversed",
};

export default function FinanceAuditLogPage() {
  const [logs, setLogs] = useState<FinanceAuditLogEntry[]>([]);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = useCallback(async (currentPage: number) => {
    setLoading(true);
    try {
      const result = await listAuditLogs({ page: currentPage });
      setLogs(result.data);
      setLastPage(result.last_page);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the audit trail.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(page);
  }, [page, load]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Finance Audit Trail</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Finance</li>
          <li>Audit Trail</li>
        </ul>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card height-auto">
        <div className="card-body">
          <p className="text-muted">
            Who did what to which financial record, and what it looked like
            before and after — for accountability and dispute resolution.
          </p>
          <table className="table table-bordered">
            <thead>
              <tr>
                <th>When</th>
                <th>Actor</th>
                <th>Action</th>
                <th>Subject</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center">
                    Loading...
                  </td>
                </tr>
              ) : logs.length ? (
                logs.map((log) => (
                  <>
                    <tr key={log.id}>
                      <td>{new Date(log.created_at).toLocaleString()}</td>
                      <td>
                        {log.actor_name ?? (log.actor_type === "system" ? "System" : "Unknown")}
                        <div className="text-muted small">{log.actor_type}</div>
                      </td>
                      <td>{ACTION_LABELS[log.action] ?? log.action}</td>
                      <td>{log.subject_type}</td>
                      <td>
                        {log.before || log.after ? (
                          <button
                            type="button"
                            className="btn btn-sm btn-link p-0"
                            onClick={() => setExpandedId(expandedId === log.id ? null : log.id)}
                          >
                            {expandedId === log.id ? "Hide" : "Details"}
                          </button>
                        ) : null}
                      </td>
                    </tr>
                    {expandedId === log.id ? (
                      <tr key={`${log.id}-detail`}>
                        <td colSpan={5} className="bg-light">
                          <div className="row">
                            <div className="col-md-6">
                              <strong className="small">Before</strong>
                              <pre className="small mb-0">
                                {JSON.stringify(log.before, null, 2) ?? "—"}
                              </pre>
                            </div>
                            <div className="col-md-6">
                              <strong className="small">After</strong>
                              <pre className="small mb-0">
                                {JSON.stringify(log.after, null, 2) ?? "—"}
                              </pre>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center">
                    Nothing recorded yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>

          {lastPage > 1 ? (
            <div className="d-flex justify-content-between align-items-center">
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setPage((prev) => prev - 1)}
                disabled={page <= 1}
              >
                Previous
              </button>
              <span className="text-muted small">
                Page {page} of {lastPage}
              </span>
              <button
                type="button"
                className="btn btn-sm btn-outline-secondary"
                onClick={() => setPage((prev) => prev + 1)}
                disabled={page >= lastPage}
              >
                Next
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </>
  );
}
