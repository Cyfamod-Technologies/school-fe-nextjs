'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agentApi } from '@/lib/agents';

interface PayoutRow {
  id: string;
  total_amount: number;
  status: string;
  payment_details: string;
  requested_at: string;
  processed_at: string;
  completed_at: string;
}

interface EarningsSnapshot {
  available_for_payout: number;
  min_payout_threshold: number;
  can_request_payout: boolean;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const extractApiErrorMessage = (payload: unknown, fallback: string): string => {
  const root = asRecord(payload);
  const errors = asRecord(root.errors);
  const payoutErrors = Array.isArray(errors.payout) ? errors.payout : [];
  const firstPayoutError = payoutErrors.find((entry) => typeof entry === 'string');
  if (typeof firstPayoutError === 'string' && firstPayoutError.trim() !== '') {
    return firstPayoutError;
  }

  const directMessage = asString(root.message, '');
  if (directMessage.trim() !== '') {
    return directMessage;
  }

  return fallback;
};

const formatNaira = (value: number): string =>
  `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

const formatDate = (value: string): string => {
  if (!value) {
    return 'N/A';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }
  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
};

const toStatusLabel = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const statusBadgeClass = (status: string): string => {
  const value = status.toLowerCase();
  if (value === 'completed') return 'badge badge-success';
  if (value === 'processing') return 'badge badge-info';
  if (value === 'approved') return 'badge badge-primary';
  if (value === 'pending') return 'badge badge-warning';
  if (value === 'failed') return 'badge badge-danger';
  return 'badge badge-secondary';
};

const parsePaymentDetails = (
  rawValue: string,
): { bank_name: string; account_name: string; account_number: string } => {
  if (!rawValue) {
    return { bank_name: '', account_name: '', account_number: '' };
  }

  try {
    const parsed = JSON.parse(rawValue) as Record<string, unknown>;
    return {
      bank_name: asString(parsed.bank_name, ''),
      account_name: asString(parsed.account_name, ''),
      account_number: asString(parsed.account_number, ''),
    };
  } catch {
    return { bank_name: '', account_name: '', account_number: '' };
  }
};

export default function AgentPayoutsPage() {
  const router = useRouter();
  const [payouts, setPayouts] = useState<PayoutRow[]>([]);
  const [earnings, setEarnings] = useState<EarningsSnapshot>({
    available_for_payout: 0,
    min_payout_threshold: 5000,
    can_request_payout: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requesting, setRequesting] = useState(false);

  const fetchPayoutsAndEarnings = useCallback(async () => {
    setLoading(true);
    try {
      const [dashboardResponse, payoutResponse] = await Promise.all([
        agentApi.getDashboard(),
        agentApi.getPayoutHistory(),
      ]);

      if (dashboardResponse.status === 401 || payoutResponse.status === 401) {
        localStorage.removeItem('agentToken');
        localStorage.removeItem('agent_token');
        localStorage.removeItem('agent');
        router.replace('/agent/login');
        return;
      }

      if (dashboardResponse.ok) {
        const payload = await dashboardResponse.json();
        const root = asRecord(payload);
        const source = asRecord(root.data ?? root);
        const earningsData = asRecord(source.earnings);

        setEarnings({
          available_for_payout: asNumber(earningsData.available_for_payout, 0),
          min_payout_threshold: asNumber(earningsData.min_payout_threshold, 5000),
          can_request_payout: Boolean(earningsData.can_request_payout),
        });
      }

      if (payoutResponse.ok) {
        const payload = await payoutResponse.json();
        const root = asRecord(payload);
        const rows = Array.isArray(root.data) ? (root.data as unknown[]) : [];

        const parsedRows = rows.map((entry, index) => {
          const row = asRecord(entry);
          return {
            id: asString(row.id, `payout-${index + 1}`),
            total_amount: asNumber(row.total_amount, asNumber(row.amount, 0)),
            status: asString(row.status, 'pending'),
            payment_details: asString(row.payment_details, ''),
            requested_at: asString(row.requested_at, asString(row.created_at, '')),
            processed_at: asString(row.processed_at, ''),
            completed_at: asString(row.completed_at, ''),
          };
        });
        setPayouts(parsedRows);
      } else {
        const payload = await payoutResponse.json().catch(() => ({}));
        const message =
          typeof payload?.message === 'string'
            ? payload.message
            : 'Failed to load payout history.';
        setError(message);
      }
    } catch {
      setError('Unable to load payout data right now.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchPayoutsAndEarnings();
  }, [fetchPayoutsAndEarnings]);

  const hasOpenPayoutRequest = useMemo(
    () => payouts.some((row) => ['pending', 'approved', 'processing'].includes(row.status.toLowerCase())),
    [payouts],
  );
  const thresholdGap = Math.max(
    earnings.min_payout_threshold - earnings.available_for_payout,
    0,
  );
  const meetsPayoutThreshold =
    earnings.can_request_payout ||
    earnings.available_for_payout >= earnings.min_payout_threshold;
  const canRequestPayout = meetsPayoutThreshold && !hasOpenPayoutRequest;
  const requestDisabledReason = hasOpenPayoutRequest
    ? 'You already have a payout request in progress. Wait until it is completed or failed.'
    : !meetsPayoutThreshold
    ? `Below payout threshold. You need ${formatNaira(thresholdGap)} more.`
    : null;

  const pendingAndProcessingTotal = useMemo(
    () =>
      payouts
        .filter((row) => ['pending', 'approved', 'processing'].includes(row.status.toLowerCase()))
        .reduce((sum, row) => sum + asNumber(row.total_amount, 0), 0),
    [payouts],
  );

  const completedTotal = useMemo(
    () =>
      payouts
        .filter((row) => row.status.toLowerCase() === 'completed')
        .reduce((sum, row) => sum + asNumber(row.total_amount, 0), 0),
    [payouts],
  );

  const handleRequestPayout = async () => {
    setRequesting(true);
    setError(null);

    try {
      const response = await agentApi.requestPayout();
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const message = extractApiErrorMessage(payload, 'Failed to request payout.');
        setError(message);
        return;
      }

      setShowRequestModal(false);
      await fetchPayoutsAndEarnings();
    } catch {
      setError('An error occurred while requesting payout.');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Payouts</h3>
        <ul>
          <li>
            <Link href="/agent/dashboard">Home</Link>
          </li>
          <li>Payouts</li>
        </ul>
      </div>

      <div className="row gutters-20">
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-green">
                  <i className="flaticon-money text-green" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">Available Balance</div>
                  <div className="item-number">
                    <span>{formatNaira(earnings.available_for_payout)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-yellow">
                  <i className="flaticon-script text-orange" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">Threshold</div>
                  <div className="item-number">
                    <span>{formatNaira(earnings.min_payout_threshold)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-blue">
                  <i className="flaticon-checklist text-blue" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">Pending / Processing</div>
                  <div className="item-number">
                    <span>{formatNaira(pendingAndProcessingTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-red">
                  <i className="flaticon-percentage-discount text-red" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">Completed</div>
                  <div className="item-number">
                    <span>{formatNaira(completedTotal)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card dashboard-card-one pd-b-20 mg-b-20">
        <div className="card-body">
          <div className="heading-layout1 mg-b-17">
            <div className="item-title">
              <h3>Payout History</h3>
            </div>
            <button
              type="button"
              className={`btn-fill-lmd text-light ${canRequestPayout ? 'bg-dark-pastel-green' : 'bg-secondary'}`}
              onClick={() => setShowRequestModal(true)}
              disabled={!canRequestPayout}
            >
              Request Payout
            </button>
          </div>

          <p className="text-muted mb-4">
            Submit payout requests once your available balance reaches the required threshold.
          </p>
          {requestDisabledReason && (
            <p className="text-muted mb-3">
              <small>{requestDisabledReason}</small>
            </p>
          )}

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="d-flex align-items-center justify-content-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table display data-table text-nowrap">
                <thead>
                  <tr>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Bank Details</th>
                    <th>Requested</th>
                    <th>Processed</th>
                    <th>Completed</th>
                  </tr>
                </thead>
                <tbody>
                  {payouts.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        No payout requests yet.
                      </td>
                    </tr>
                  ) : (
                    payouts.map((row) => {
                      const details = parsePaymentDetails(row.payment_details);
                      return (
                        <tr key={row.id}>
                          <td>{formatNaira(row.total_amount)}</td>
                          <td>
                            <span className={statusBadgeClass(row.status)}>
                              {toStatusLabel(row.status)}
                            </span>
                          </td>
                          <td>
                            {details.bank_name || details.account_number ? (
                              <>
                                <div>{details.bank_name || 'Bank not set'}</div>
                                <small className="text-muted">
                                  {details.account_name || 'Account name missing'}
                                  {details.account_number
                                    ? ` • ****${details.account_number.slice(-4)}`
                                    : ''}
                                </small>
                              </>
                            ) : (
                              <span className="text-muted">No bank details</span>
                            )}
                          </td>
                          <td>{formatDate(row.requested_at)}</td>
                          <td>{formatDate(row.processed_at)}</td>
                          <td>{formatDate(row.completed_at)}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="alert alert-light mt-4 mb-0">
            <strong>Payout Flow:</strong> Pending means waiting approval, approved/processing
            means transfer preparation, and completed means payout finalized to your bank account.
          </div>
        </div>
      </div>

      {showRequestModal && (
        <div
          className="position-fixed w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '460px' }}>
            <div className="card-body p-4">
              <div className="heading-layout1 mg-b-17">
                <div className="item-title">
                  <h3>Confirm Payout Request</h3>
                </div>
              </div>

              <p className="text-muted">
                This will request payout for your currently available balance.
              </p>
              <p className="mb-1">
                <strong>Available balance:</strong> {formatNaira(earnings.available_for_payout)}
              </p>
              <p className="mb-4">
                <strong>Minimum required:</strong> {formatNaira(earnings.min_payout_threshold)}
              </p>
              {requestDisabledReason && (
                <div className="alert alert-warning py-2" role="alert">
                  {requestDisabledReason}
                </div>
              )}
              {error && (
                <div className="alert alert-danger py-2" role="alert">
                  {error}
                </div>
              )}

              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-outline-secondary mr-2"
                  onClick={() => setShowRequestModal(false)}
                  disabled={requesting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-warning"
                  onClick={handleRequestPayout}
                  disabled={requesting || !canRequestPayout}
                >
                  {requesting ? 'Submitting...' : 'Confirm Request'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
