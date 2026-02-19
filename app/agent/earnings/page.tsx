'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agentApi } from '@/lib/agents';

interface CommissionRow {
  id: string;
  referral_code: string;
  school_name: string;
  payment_number: number;
  commission_amount: number;
  status: string;
  created_at: string;
  updated_at: string;
}

type FilterStatus = 'all' | 'pending' | 'approved' | 'paid';

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
  if (value === 'paid') return 'badge badge-success';
  if (value === 'approved') return 'badge badge-info';
  if (value === 'pending') return 'badge badge-warning';
  if (value === 'rejected') return 'badge badge-danger';
  return 'badge badge-secondary';
};

export default function AgentEarningsPage() {
  const router = useRouter();
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');

  const fetchCommissions = useCallback(async () => {
    try {
      const response = await agentApi.getCommissionHistory();

      if (response.status === 401) {
        localStorage.removeItem('agentToken');
        localStorage.removeItem('agent_token');
        localStorage.removeItem('agent');
        router.replace('/agent/login');
        return;
      }

      if (!response.ok) {
        let message = 'Failed to load commissions.';
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore parse failure
        }
        setError(message);
        return;
      }

      const payload = await response.json();
      const root = asRecord(payload);
      const rows = Array.isArray(root.data) ? (root.data as unknown[]) : [];

      const parsedRows = rows.map((entry, index) => {
        const row = asRecord(entry);
        const referral = asRecord(row.referral);
        const school = asRecord(row.school);

        return {
          id: asString(row.id, `commission-${index + 1}`),
          referral_code: asString(row.referral_code, asString(referral.referral_code, 'N/A')),
          school_name: asString(school.name, 'N/A'),
          payment_number: asNumber(row.payment_number, asNumber(row.payment_count, 0)),
          commission_amount: asNumber(row.commission_amount, asNumber(row.amount, 0)),
          status: asString(row.status, 'pending'),
          created_at: asString(row.created_at, ''),
          updated_at: asString(row.updated_at, ''),
        };
      });

      setCommissions(parsedRows);
    } catch {
      setError('Unable to load earnings history.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchCommissions();
  }, [fetchCommissions]);

  const filteredCommissions = useMemo(() => {
    if (filter === 'all') {
      return commissions;
    }
    return commissions.filter((row) => row.status.toLowerCase() === filter);
  }, [commissions, filter]);

  const stats = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let paid = 0;

    commissions.forEach((row) => {
      const amount = asNumber(row.commission_amount, 0);
      const status = row.status.toLowerCase();
      if (status === 'pending') pending += amount;
      if (status === 'approved') approved += amount;
      if (status === 'paid') paid += amount;
    });

    return {
      total: pending + approved + paid,
      pending,
      approved,
      paid,
      count: commissions.length,
    };
  }, [commissions]);

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Earnings</h3>
        <ul>
          <li>
            <Link href="/agent/dashboard">Home</Link>
          </li>
          <li>Earnings</li>
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
                  <div className="item-title">Total Earnings</div>
                  <div className="item-number">
                    <span>{formatNaira(stats.total)}</span>
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
                  <div className="item-title">Pending</div>
                  <div className="item-number">
                    <span>{formatNaira(stats.pending)}</span>
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
                  <div className="item-title">Approved</div>
                  <div className="item-number">
                    <span>{formatNaira(stats.approved)}</span>
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
                  <div className="item-title">Paid</div>
                  <div className="item-number">
                    <span>{formatNaira(stats.paid)}</span>
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
              <h3>Commission History</h3>
            </div>
            <div className="d-flex flex-wrap">
              {(['all', 'pending', 'approved', 'paid'] as FilterStatus[]).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setFilter(item)}
                  className={`btn btn-sm mr-2 mb-2 ${
                    filter === item ? 'btn-warning' : 'btn-outline-secondary'
                  }`}
                >
                  {item.charAt(0).toUpperCase() + item.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <p className="text-muted mb-4">
            Earnings are generated from qualified referral payments and move through approval
            before payout.
          </p>

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
                    <th>Referral Code</th>
                    <th>School</th>
                    <th>Payment #</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCommissions.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        No {filter === 'all' ? '' : filter + ' '}commissions found.
                      </td>
                    </tr>
                  ) : (
                    filteredCommissions.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <code>{row.referral_code}</code>
                        </td>
                        <td>{row.school_name}</td>
                        <td>Payment {row.payment_number}</td>
                        <td>{formatNaira(row.commission_amount)}</td>
                        <td>
                          <span className={statusBadgeClass(row.status)}>
                            {toStatusLabel(row.status)}
                          </span>
                        </td>
                        <td>
                          {row.status.toLowerCase() === 'paid'
                            ? formatDate(row.updated_at)
                            : formatDate(row.created_at)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          <div className="alert alert-light mt-4 mb-0">
            <strong>How Commissions Work:</strong> Qualified school payments create commissions,
            approved commissions become payout-eligible, and payouts are requested from the
            Payouts page after threshold is met.
          </div>
        </div>
      </div>
    </>
  );
}
