'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agentApi } from '@/lib/agents';

interface DashboardData {
  agent: {
    full_name: string;
    status: string;
  };
  referrals: {
    total: number;
    visited: number;
    registered: number;
    paid: number;
    conversion_rate: number;
  };
  earnings: {
    total: number;
    pending: number;
    approved: number;
    paid: number;
    available_for_payout: number;
    min_payout_threshold: number;
    can_request_payout: boolean;
  };
  recent_referrals: unknown[];
}

interface RecentReferral {
  id: string;
  referralCode: string;
  schoolName: string;
  status: string;
  createdAt: string;
}

const DEFAULT_DASHBOARD: DashboardData = {
  agent: {
    full_name: 'Agent',
    status: 'pending',
  },
  referrals: {
    total: 0,
    visited: 0,
    registered: 0,
    paid: 0,
    conversion_rate: 0,
  },
  earnings: {
    total: 0,
    pending: 0,
    approved: 0,
    paid: 0,
    available_for_payout: 0,
    min_payout_threshold: 5000,
    can_request_payout: false,
  },
  recent_referrals: [],
};

const toNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const normalizeDashboard = (payload: unknown): DashboardData => {
  const root = asRecord(payload);
  const source = asRecord(root.data ?? root);

  const agent = asRecord(source.agent);
  const referrals = asRecord(source.referrals);
  const earnings = asRecord(source.earnings);
  const recentReferrals = source.recent_referrals;

  return {
    agent: {
      full_name:
        typeof agent.full_name === 'string' && agent.full_name.trim() !== ''
          ? agent.full_name
          : DEFAULT_DASHBOARD.agent.full_name,
      status:
        typeof agent.status === 'string' && agent.status.trim() !== ''
          ? agent.status
          : DEFAULT_DASHBOARD.agent.status,
    },
    referrals: {
      total: toNumber(referrals.total),
      visited: toNumber(referrals.visited),
      registered: toNumber(referrals.registered),
      paid: toNumber(referrals.paid),
      conversion_rate: toNumber(referrals.conversion_rate),
    },
    earnings: {
      total: toNumber(earnings.total),
      pending: toNumber(earnings.pending),
      approved: toNumber(earnings.approved),
      paid: toNumber(earnings.paid),
      available_for_payout: toNumber(earnings.available_for_payout),
      min_payout_threshold: toNumber(
        earnings.min_payout_threshold,
        DEFAULT_DASHBOARD.earnings.min_payout_threshold,
      ),
      can_request_payout: Boolean(earnings.can_request_payout),
    },
    recent_referrals: Array.isArray(recentReferrals)
      ? recentReferrals
      : Array.isArray(asRecord(recentReferrals).data)
      ? (asRecord(recentReferrals).data as unknown[])
      : [],
  };
};

const formatNumber = (value: number): string => value.toLocaleString('en-NG');

const formatNaira = (value: number): string =>
  `₦${value.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

const statusLabel = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const formatDate = (value: string): string => {
  if (!value) {
    return 'N/A';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const percentage = (part: number, whole: number): number => {
  if (whole <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (part / whole) * 100));
};

const badgeClassForStatus = (status: string): string => {
  const value = status.toLowerCase();
  if (value === 'paid' || value === 'approved' || value === 'active') {
    return 'badge badge-success';
  }
  if (value === 'registered' || value === 'visited') {
    return 'badge badge-info';
  }
  if (value === 'rejected' || value === 'suspended' || value === 'inactive') {
    return 'badge badge-danger';
  }
  return 'badge badge-warning';
};

export default function AgentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const recentReferrals = useMemo<RecentReferral[]>(
    () =>
      (data?.recent_referrals ?? []).map((entry, index) => {
        const row = asRecord(entry);
        const school = asRecord(row.school);
        const code = row.referral_code;
        const schoolName = school.name;
        const createdAt = row.created_at;
        const id = row.id;
        const status = row.status;

        return {
          id:
            typeof id === 'string' && id.trim() !== '' ? id : `referral-${index + 1}`,
          referralCode:
            typeof code === 'string' && code.trim() !== '' ? code : 'N/A',
          schoolName:
            typeof schoolName === 'string' && schoolName.trim() !== ''
              ? schoolName
              : 'School not attached',
          status:
            typeof status === 'string' && status.trim() !== '' ? status : 'pending',
          createdAt: typeof createdAt === 'string' ? createdAt : '',
        };
      }),
    [data?.recent_referrals],
  );

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token =
          localStorage.getItem('agentToken') ?? localStorage.getItem('agent_token');

        if (!token) {
          setError('Please log in to view your dashboard.');
          return;
        }

        const response = await agentApi.getDashboard();

        if (response.ok) {
          const result = await response.json();
          setData(normalizeDashboard(result));
          return;
        }

        if (response.status === 401) {
          localStorage.removeItem('agentToken');
          localStorage.removeItem('agent_token');
          localStorage.removeItem('agent');
          router.replace('/agent/login');
          return;
        }

        let message = 'Failed to load dashboard data.';
        try {
          const result = await response.json();
          if (typeof result?.message === 'string' && result.message.trim() !== '') {
            message = result.message;
          }
        } catch {
          // keep fallback message
        }
        setError(message);
      } catch {
        setError('An error occurred while loading dashboard.');
      } finally {
        setLoading(false);
      }
    };

    void fetchDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <>
        <div className="breadcrumbs-area">
          <h3>Agent Dashboard</h3>
          <ul>
            <li>
              <Link href="/agent/dashboard">Home</Link>
            </li>
            <li>Agent</li>
          </ul>
        </div>

        <div className="card height-auto">
          <div className="card-body">
            <div className="alert alert-danger mb-0 d-flex justify-content-between align-items-center">
              <span>{error}</span>
              <button
                type="button"
                className="btn btn-sm btn-outline-danger"
                onClick={() => router.push('/agent/login')}
              >
                Go to Login
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <div className="card height-auto">
        <div className="card-body">
          <p className="text-muted mb-0">No dashboard data available.</p>
        </div>
      </div>
    );
  }

  const agentStatus = data.agent.status.toLowerCase();
  const isApproved = agentStatus === 'approved';
  const conversionRate = toNumber(data.referrals.conversion_rate);
  const payoutUnlocked =
    data.earnings.available_for_payout >= data.earnings.min_payout_threshold;
  const payoutGap = Math.max(
    data.earnings.min_payout_threshold - data.earnings.available_for_payout,
    0,
  );

  const summaryCards = [
    {
      key: 'referrals',
      iconWrap: 'bg-light-blue',
      iconClass: 'flaticon-classmates text-blue',
      title: 'Total Referrals',
      value: formatNumber(data.referrals.total),
      note: `${formatNumber(data.referrals.registered)} schools registered`,
    },
    {
      key: 'conversion',
      iconWrap: 'bg-light-yellow',
      iconClass: 'flaticon-percentage-discount text-orange',
      title: 'Conversion Rate',
      value: `${conversionRate.toFixed(1)}%`,
      note: `${formatNumber(data.referrals.paid)} paying schools`,
    },
    {
      key: 'earnings',
      iconWrap: 'bg-light-green',
      iconClass: 'flaticon-money text-green',
      title: 'Total Earnings',
      value: formatNaira(data.earnings.total),
      note: 'Lifetime commissions',
    },
    {
      key: 'payout',
      iconWrap: payoutUnlocked ? 'bg-light-green' : 'bg-light-red',
      iconClass: payoutUnlocked ? 'flaticon-script text-green' : 'flaticon-script text-red',
      title: 'Available Balance',
      value: formatNaira(data.earnings.available_for_payout),
      note: payoutUnlocked
        ? 'Ready for payout request'
        : `Need ${formatNaira(payoutGap)} more`,
    },
  ];

  const funnelRows = [
    {
      key: 'visited',
      label: 'Visited',
      value: data.referrals.visited,
      rate: percentage(data.referrals.visited, data.referrals.total),
      barClass: 'bg-info',
    },
    {
      key: 'registered',
      label: 'Registered',
      value: data.referrals.registered,
      rate: percentage(data.referrals.registered, data.referrals.visited),
      barClass: 'bg-warning',
    },
    {
      key: 'paid',
      label: 'Paid',
      value: data.referrals.paid,
      rate: percentage(data.referrals.paid, data.referrals.registered),
      barClass: 'bg-success',
    },
  ];

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Agent Dashboard</h3>
        <ul>
          <li>
            <Link href="/agent/dashboard">Home</Link>
          </li>
          <li>Agent</li>
        </ul>
      </div>

      {!isApproved && (
        <div className="card height-auto mg-b-20">
          <div className="card-body">
            <div className="alert alert-warning mb-0">
              <strong>Account Under Review:</strong> Your account is being verified. You
              can continue generating referrals, but payout requests will open after
              approval.
            </div>
          </div>
        </div>
      )}

      <div className="row gutters-20">
        {summaryCards.map((card) => (
          <div key={card.key} className="col-xl-3 col-sm-6 col-12">
            <div className="dashboard-summery-one mg-b-20">
              <div className="row align-items-center">
                <div className="col-5">
                  <div className={`item-icon ${card.iconWrap}`}>
                    <i className={card.iconClass} />
                  </div>
                </div>
                <div className="col-7">
                  <div className="item-content">
                    <div className="item-title">{card.title}</div>
                    <div className="item-number">
                      <span>{card.value}</span>
                    </div>
                    <small className="d-block text-muted mt-1">{card.note}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      <div className="row gutters-20">
        <div className="col-12 col-xl-8 col-6-xxxl">
          <div className="card dashboard-card-one pd-b-20 mg-b-20">
            <div className="card-body">
              <div className="heading-layout1 mg-b-17">
                <div className="item-title">
                  <h3>Referral Funnel</h3>
                </div>
                <span className={badgeClassForStatus(data.agent.status)}>
                  {statusLabel(data.agent.status)}
                </span>
              </div>

              <p className="text-muted mb-4">
                Track the movement from referral visits to paid conversions.
              </p>

              {funnelRows.map((row) => (
                  <div key={row.key} className="mg-b-20">
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="text-dark-medium">{row.label}</span>
                    <span>
                      {formatNumber(row.value)} ({row.rate.toFixed(0)}%)
                    </span>
                  </div>
                  <div className="progress" style={{ height: '9px' }}>
                    <div
                      className={`progress-bar ${row.barClass}`}
                      role="progressbar"
                      style={{ width: `${row.rate}%` }}
                      aria-valuenow={row.rate}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card dashboard-card-one pd-b-20">
            <div className="card-body">
              <div className="heading-layout1 mg-b-17">
                <div className="item-title">
                  <h3>Recent Referrals</h3>
                </div>
                <Link href="/agent/referrals" className="text-orange-peel">
                  View All
                </Link>
              </div>

              <div className="table-responsive">
                <table className="table display data-table text-nowrap">
                  <thead>
                    <tr>
                      <th>Code</th>
                      <th>School</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentReferrals.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center text-muted">
                          No referrals yet.
                        </td>
                      </tr>
                    ) : (
                      recentReferrals.slice(0, 6).map((referral) => (
                        <tr key={referral.id}>
                          <td>{referral.referralCode}</td>
                          <td>{referral.schoolName}</td>
                          <td>
                            <span className={badgeClassForStatus(referral.status)}>
                              {statusLabel(referral.status)}
                            </span>
                          </td>
                          <td>{formatDate(referral.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-4 col-3-xxxl">
          <div className="card dashboard-card-three pd-b-20 mg-b-20">
            <div className="card-body">
              <div className="heading-layout1 mg-b-17">
                <div className="item-title">
                  <h3>Quick Actions</h3>
                </div>
              </div>

              <div className="d-flex flex-column">
                <Link href="/agent/referrals" className="btn-fill-md bg-orange-peel text-light mb-3 text-center">
                  Manage Referrals
                </Link>
                <Link href="/agent/earnings" className="btn-fill-md bg-light-sea-green text-light mb-3 text-center">
                  View Earnings
                </Link>
                <Link
                  href="/agent/payouts"
                  className={`btn-fill-md text-light mb-3 text-center ${
                    payoutUnlocked ? 'bg-dark-pastel-green' : 'bg-secondary'
                  }`}
                  aria-disabled={!payoutUnlocked}
                >
                  {payoutUnlocked ? 'Request Payout' : 'Payout Locked'}
                </Link>
              </div>

              <hr />

              <p className="mb-2">
                <strong>Status:</strong>{' '}
                <span className={badgeClassForStatus(data.agent.status)}>
                  {statusLabel(data.agent.status)}
                </span>
              </p>
              <p className="text-muted mb-0">
                {isApproved
                  ? 'Your account is active and ready to earn.'
                  : 'Awaiting admin approval before payouts become available.'}
              </p>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer-wrap-layout1" style={{ marginTop: '3rem' }}>
        <div className="copyright">
          © Copyrights <a href="#">Cyfamod Technologies</a> 2026. All rights
          reserved.
        </div>
      </footer>
    </>
  );
}
