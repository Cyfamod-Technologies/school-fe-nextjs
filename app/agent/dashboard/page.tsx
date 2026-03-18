'use client';

import { useEffect, useMemo, useState, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agentApi } from '@/lib/agents';

interface DashboardData {
  agent: {
    full_name: string;
    status: string;
    rejection_reason?: string;
  };
  referrals: {
    total: number;
    visited: number;
    registered: number;
    paid: number;
    registered_schools_total: number;
    paid_schools_total: number;
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
  registeredSchoolsCount: number;
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
    registered_schools_total: 0,
    paid_schools_total: 0,
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
      rejection_reason:
        typeof agent.rejection_reason === 'string' ? agent.rejection_reason : undefined,
    },
    referrals: {
      total: toNumber(referrals.total),
      visited: toNumber(referrals.visited),
      registered: toNumber(referrals.registered),
      paid: toNumber(referrals.paid),
      registered_schools_total: toNumber(referrals.registered_schools_total),
      paid_schools_total: toNumber(referrals.paid_schools_total),
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

const statusLabel = (value: string): string => {
  const s = value.toLowerCase();
  if (s === 'pending') return 'Account Under Review';
  if (s === 'inactive') return 'Account Inactive';
  return s.split('_').map(p => p.charAt(0).toUpperCase() + p.slice(1)).join(' ');
};

const formatDate = (value: string): string => {
  if (!value) return 'N/A';
  const date = new Date(value);
  return isNaN(date.getTime()) ? 'N/A' : new Intl.DateTimeFormat('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }).format(date);
};

const percentage = (part: number, whole: number): number => {
  if (whole <= 0) return 0;
  return Math.max(0, Math.min(100, (part / whole) * 100));
};

const badgeClassForStatus = (status: string): string => {
  const value = status.toLowerCase();
  if (value === 'approved' || value === 'active') return 'badge badge-success';
  if (value === 'pending') return 'badge badge-warning';
  if (value === 'suspended' || value === 'inactive' || value === 'rejected') return 'badge badge-danger';
  return 'badge badge-info';
};

export default function AgentDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const response = await agentApi.getDashboard();

      if (response.ok) {
        const result = await response.json();
        setData(normalizeDashboard(result));
        return;
      }

      if (response.status === 401) {
        localStorage.removeItem('agent_token');
        localStorage.removeItem('agent');
        router.replace('/agent/login');
        return;
      }

      setError('Failed to load dashboard data.');
    } catch {
      setError('An error occurred while loading dashboard.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchDashboard();
  }, [fetchDashboard]);

  const asString = (v: unknown, f = '') => typeof v === 'string' ? v : f;

  const recentReferrals = useMemo<RecentReferral[]>(
    () =>
      (data?.recent_referrals ?? []).map((entry, index) => {
        const row = asRecord(entry);
        return {
          id: typeof row.id === 'string' ? row.id : `ref-${index}`,
          referralCode: typeof row.referral_code === 'string' ? row.referral_code : 'N/A',
          registeredSchoolsCount: toNumber(row.registered_schools_count, 0),
          status: asString(row.status, 'pending'),
          createdAt: asString(row.created_at, ''),
        };
      }),
    [data],
  );

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card-body">
        <div className="alert alert-danger">{error || 'No data available'}</div>
      </div>
    );
  }

  const agentStatus = data.agent.status.toLowerCase();
  const isApproved = agentStatus === 'approved';
  const conversionRate = toNumber(data.referrals.conversion_rate);
  const payoutUnlocked = data.earnings.available_for_payout >= data.earnings.min_payout_threshold;
  const payoutGap = Math.max(data.earnings.min_payout_threshold - data.earnings.available_for_payout, 0);

  const summaryCards = [
    { key: 'ref', icon: 'flaticon-classmates', color: 'blue', title: 'Total Referrals', value: formatNumber(data.referrals.total), note: `${formatNumber(data.referrals.registered_schools_total)} registered` },
    { key: 'conv', icon: 'flaticon-percentage-discount', color: 'orange', title: 'Conversion Rate', value: `${conversionRate.toFixed(1)}%`, note: `${data.referrals.paid_schools_total} paying schools` },
    { key: 'earn', icon: 'flaticon-money', color: 'green', title: 'Total Earnings', value: formatNaira(data.earnings.total), note: 'Lifetime commission' },
    { key: 'bal', icon: 'flaticon-script', color: payoutUnlocked ? 'green' : 'red', title: 'Available Balance', value: formatNaira(data.earnings.available_for_payout), note: payoutUnlocked ? 'Ready for payout' : `Need ${formatNaira(payoutGap)} more` },
  ];

  return (
    <>
      <div className="breadcrumbs-area">
        <div className="d-flex align-items-center justify-content-between">
          <div>
            <h3>Agent Dashboard</h3>
            <ul>
              <li><Link href="/agent/dashboard">Home</Link></li>
              <li>Agent</li>
            </ul>
          </div>
          <div>
            <span className={badgeClassForStatus(data.agent.status)} style={{ fontSize: '1.4rem', padding: '10px 20px' }}>
              {isApproved ? 'Approved Partner' : statusLabel(data.agent.status)}
            </span>
          </div>
        </div>
      </div>

      {/* Account Status Banners */}
      {agentStatus === 'inactive' && (
        <div className="card height-auto mg-b-20 border-danger">
          <div className="card-body">
            <div className="alert alert-danger mb-0">
              <i className="fa fa-user-slash mr-2" />
              <strong>Account Inactive:</strong> Your account has been marked as inactive. 
              {data.agent.rejection_reason && (
                <div className="mt-2 pl-4">
                  <strong>Reason:</strong> {data.agent.rejection_reason}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {agentStatus === 'suspended' && (
        <div className="card height-auto mg-b-20 border-secondary">
          <div className="card-body">
            <div className="alert alert-secondary mb-0">
              <i className="fa fa-pause-circle mr-2" />
              <strong>Account Suspended:</strong> Your account has been temporarily suspended. Please contact support for more information.
            </div>
          </div>
        </div>
      )}

      {agentStatus === 'pending' && (
        <div className="card height-auto mg-b-20">
          <div className="card-body">
            <div className="alert alert-warning mb-0">
              <i className="fa fa-clock mr-2" />
              <strong>Account Under Review:</strong> Your profile is currently being verified. You can generate referrals, but payout requests will be enabled after approval.
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
                  <div className={`item-icon bg-light-${card.color}`}>
                    <i className={`${card.icon} text-${card.color}`} />
                  </div>
                </div>
                <div className="col-7">
                  <div className="item-content">
                    <div className="item-title">{card.title}</div>
                    <div className="item-number"><span>{card.value}</span></div>
                    <small className="d-block text-muted mt-1">{card.note}</small>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {data.earnings.pending > 0 && (
        <div className="alert alert-info mg-b-20">
          <i className="fa fa-info-circle mr-2" />
          You have <strong>{formatNaira(data.earnings.pending)}</strong> in pending commissions. 
          New commissions undergo a mandatory <strong>72-hour verification window</strong> before they move to your available balance.
        </div>
      )}

      <div className="row gutters-20">
        <div className="col-12 col-xl-6">
          <div className="card dashboard-card-one pd-b-20 mg-b-20">
            <div className="card-body">
              <div className="heading-layout1 mg-b-17">
                <div className="item-title"><h3>Referral Funnel</h3></div>
              </div>
              <p className="text-muted mb-4">Track signups and the conversion to paying schools.</p>
              
              {data.referrals.registered_schools_total === 0 ? (
                <div className="text-center py-5">
                  <div className="item-icon bg-light-blue mg-b-15 mx-auto" style={{ width: '70px', height: '70px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <i className="flaticon-classmates text-blue" style={{ fontSize: '2.5rem' }} />
                  </div>
                  <h4 className="mg-b-5">No signups yet</h4>
                  <p className="text-muted" style={{ fontSize: '1.4rem' }}>Share your unique link to start building your network!</p>
                </div>
              ) : (
                <>
                  <div className="mg-b-20">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-dark-medium" style={{ fontSize: '1.4rem' }}>Total Signups</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: 600 }}>{formatNumber(data.referrals.registered_schools_total)}</span>
                    </div>
                    <div className="progress" style={{ height: '9px' }}>
                      <div className="progress-bar bg-warning" style={{ width: '100%' }} />
                    </div>
                  </div>
                  <div className="mg-b-20">
                    <div className="d-flex justify-content-between mb-2">
                      <span className="text-dark-medium" style={{ fontSize: '1.4rem' }}>Paying Schools</span>
                      <span style={{ fontSize: '1.4rem', fontWeight: 600 }}>{formatNumber(data.referrals.paid_schools_total)} ({percentage(data.referrals.paid_schools_total, data.referrals.registered_schools_total).toFixed(0)}%)</span>
                    </div>
                    <div className="progress" style={{ height: '9px' }}>
                      <div className="progress-bar bg-success" style={{ width: `${percentage(data.referrals.paid_schools_total, data.referrals.registered_schools_total)}%` }} />
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="col-12 col-xl-6">
          <div className="card dashboard-card-one pd-b-20 mg-b-20">
            <div className="card-body">
              <div className="heading-layout1 mg-b-17">
                <div className="item-title"><h3>Recent Referrals</h3></div>
                <Link href="/agent/referrals" className="text-orange-peel">View All</Link>
              </div>
              <div className="table-responsive">
                <table className="table display data-table">
                  <thead><tr><th>Code</th><th>Schools</th><th>Status</th><th>Date</th></tr></thead>
                  <tbody>
                    {recentReferrals.length === 0 ? (
                      <tr><td colSpan={4} className="text-center text-muted py-4">No referrals yet.</td></tr>
                    ) : (
                      recentReferrals.slice(0, 6).map((ref) => (
                        <tr key={ref.id}>
                          <td>{ref.referralCode}</td>
                          <td>{formatNumber(ref.registeredSchoolsCount)}</td>
                          <td><span className={badgeClassForStatus(ref.status)}>{statusLabel(ref.status)}</span></td>
                          <td>{formatDate(ref.createdAt)}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>

      <footer className="footer-wrap-layout1" style={{ marginTop: '3rem' }}>
        <div className="copyright">© Copyrights <a href="#">Cyfamod Technologies</a> 2026. All rights reserved.</div>
      </footer>
    </>
  );
}
