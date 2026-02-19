'use client';

import React, { useEffect, useMemo, useState } from 'react';
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
  const possibleData = root.data;
  const source = asRecord(possibleData ?? root);

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
        DEFAULT_DASHBOARD.earnings.min_payout_threshold
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

type Tone = 'blue' | 'emerald' | 'amber' | 'cyan';

interface StatCardProps {
  title: string;
  value: string;
  subtitle: string;
  tone: Tone;
}

interface RecentReferral {
  id: string;
  referralCode: string;
  schoolName: string;
  status: string;
  createdAt: string;
}

const statusLabel = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const compactNaira = (amount: number): string =>
  `₦${new Intl.NumberFormat('en-NG', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(amount)}`;

const safeDate = (value: string): string => {
  if (!value) {
    return 'Unknown date';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Unknown date';
  }

  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const calcRate = (value: number, total: number): number => {
  if (total <= 0) {
    return 0;
  }
  return Math.max(0, Math.min(100, (value / total) * 100));
};

const toneClasses: Record<Tone, { ring: string; chip: string; value: string }> = {
  blue: {
    ring: 'border-sky-200',
    chip: 'bg-sky-100 text-sky-700',
    value: 'text-sky-700',
  },
  emerald: {
    ring: 'border-emerald-200',
    chip: 'bg-emerald-100 text-emerald-700',
    value: 'text-emerald-700',
  },
  amber: {
    ring: 'border-amber-200',
    chip: 'bg-amber-100 text-amber-700',
    value: 'text-amber-700',
  },
  cyan: {
    ring: 'border-cyan-200',
    chip: 'bg-cyan-100 text-cyan-700',
    value: 'text-cyan-700',
  },
};

function StatCard({ title, value, subtitle, tone }: StatCardProps) {
  const toneStyle = toneClasses[tone];
  return (
    <article className={`rounded-2xl border bg-white p-6 shadow-sm ${toneStyle.ring}`}>
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-semibold text-slate-600">{title}</p>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${toneStyle.chip}`}>
          Live
        </span>
      </div>
      <p className={`text-3xl font-bold ${toneStyle.value}`}>{value}</p>
      <p className="mt-2 text-xs text-slate-500">{subtitle}</p>
    </article>
  );
}

export default function AgentDashboard() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        } else if (response.status === 401) {
          localStorage.removeItem('agentToken');
          localStorage.removeItem('agent_token');
          localStorage.removeItem('agent');
          router.replace('/agent/login');
          return;
        } else {
          let message = 'Failed to load dashboard';
          try {
            const result = await response.json();
            if (typeof result?.message === 'string' && result.message.trim() !== '') {
              message = result.message;
            }
          } catch {
            // ignore parse error and keep fallback message
          }
          setError(message);
        }
      } catch {
        setError('An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-center">
          <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-sky-200 border-t-sky-600" />
          <p className="font-medium text-slate-600">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="max-w-7xl mx-auto">
          <div className="rounded-lg border-l-4 border-red-500 bg-red-50 p-6">
            <p className="font-medium text-red-700">{error}</p>
            {error.toLowerCase().includes('log in') && (
              <button
                type="button"
                onClick={() => router.push('/agent/login')}
                className="mt-4 inline-flex items-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                Go to login
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-7xl text-center text-gray-600">
          No data available
        </div>
      </div>
    );
  }

  const conversionRate = toNumber(data.referrals.conversion_rate);
  const agentStatus = data.agent.status.toLowerCase();
  const isApproved = agentStatus === 'approved';
  const payoutReady =
    data.earnings.available_for_payout >= data.earnings.min_payout_threshold;

  const recentReferrals = useMemo<RecentReferral[]>(
    () =>
      data.recent_referrals.map((entry, index) => {
        const row = asRecord(entry);
        const school = asRecord(row.school);

        const idValue = row.id;
        const referralCodeValue = row.referral_code;
        const schoolNameValue = school.name;
        const statusValue = row.status;
        const createdAtValue = row.created_at;

        return {
          id:
            typeof idValue === 'string' && idValue.trim() !== ''
              ? idValue
              : `row-${index}`,
          referralCode:
            typeof referralCodeValue === 'string' && referralCodeValue.trim() !== ''
              ? referralCodeValue
              : 'N/A',
          schoolName:
            typeof schoolNameValue === 'string' && schoolNameValue.trim() !== ''
              ? schoolNameValue
              : 'School not attached',
          status:
            typeof statusValue === 'string' && statusValue.trim() !== ''
              ? statusValue
              : 'pending',
          createdAt: typeof createdAtValue === 'string' ? createdAtValue : '',
        };
      }),
    [data.recent_referrals]
  );

  const funnelRows = [
    {
      label: 'Visited',
      value: data.referrals.visited,
      rate: calcRate(data.referrals.visited, data.referrals.total),
      barClass: 'bg-sky-500',
    },
    {
      label: 'Registered',
      value: data.referrals.registered,
      rate: calcRate(data.referrals.registered, data.referrals.visited),
      barClass: 'bg-amber-500',
    },
    {
      label: 'Paid',
      value: data.referrals.paid,
      rate: calcRate(data.referrals.paid, data.referrals.registered),
      barClass: 'bg-emerald-500',
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 px-4 py-8 md:px-6">
      <div className="mx-auto max-w-7xl space-y-6">
        <section className="rounded-2xl border border-sky-200 bg-white p-6 shadow-sm md:p-8">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="mb-2 text-sm font-semibold uppercase tracking-wide text-sky-700">
                Agent Workspace
              </p>
              <h1 className="mb-2 text-slate-900">Welcome back, {data.agent.full_name}</h1>
              <p className="max-w-2xl text-slate-600">
                View referral pipeline health, monitor commissions, and request payouts from one place.
              </p>
            </div>

            <div className="flex flex-col items-start gap-3 md:items-end">
              <span
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  isApproved
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-amber-100 text-amber-700'
                }`}
              >
                {statusLabel(agentStatus)}
              </span>
              <div className="flex flex-wrap gap-2">
                <Link
                  href="/agent/referrals"
                  className="rounded-lg border border-sky-200 bg-sky-50 px-4 py-2 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  Referrals
                </Link>
                <Link
                  href="/agent/earnings"
                  className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
                >
                  Earnings
                </Link>
              </div>
            </div>
          </div>

          {!isApproved && (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
              Your account is currently pending approval. Referral tracking is visible, but payout and full operations unlock after approval.
            </div>
          )}
        </section>

        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard
            title="Total Referrals"
            value={String(data.referrals.total)}
            subtitle={`${data.referrals.visited} visited • ${data.referrals.registered} registered`}
            tone="blue"
          />
          <StatCard
            title="Conversion Rate"
            value={`${conversionRate.toFixed(1)}%`}
            subtitle={`${data.referrals.paid} paid schools`}
            tone="amber"
          />
          <StatCard
            title="Total Earnings"
            value={compactNaira(data.earnings.total)}
            subtitle="All-time commissions"
            tone="emerald"
          />
          <StatCard
            title="Available Payout"
            value={compactNaira(data.earnings.available_for_payout)}
            subtitle={`Minimum payout: ${compactNaira(data.earnings.min_payout_threshold)}`}
            tone="cyan"
          />
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-slate-900">Referral Funnel</h2>
                <p className="text-sm text-slate-500">Performance by stage</p>
              </div>

              <div className="space-y-4">
                {funnelRows.map((row) => (
                  <div key={row.label}>
                    <div className="mb-1 flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-700">{row.label}</p>
                      <p className="text-sm font-semibold text-slate-800">
                        {row.value} <span className="text-slate-500">({row.rate.toFixed(0)}%)</span>
                      </p>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className={`h-full rounded-full ${row.barClass}`}
                        style={{ width: `${row.rate}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </article>

            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-6 flex items-center justify-between">
                <h2 className="text-slate-900">Earnings Breakdown</h2>
                <p className="text-sm text-slate-500">Commission status</p>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-700">Pending</p>
                  <p className="mt-2 text-2xl font-bold text-amber-800">
                    {compactNaira(data.earnings.pending)}
                  </p>
                </div>
                <div className="rounded-xl border border-sky-200 bg-sky-50 p-4">
                  <p className="text-sm font-semibold text-sky-700">Approved</p>
                  <p className="mt-2 text-2xl font-bold text-sky-800">
                    {compactNaira(data.earnings.approved)}
                  </p>
                </div>
                <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                  <p className="text-sm font-semibold text-emerald-700">Paid Out</p>
                  <p className="mt-2 text-2xl font-bold text-emerald-800">
                    {compactNaira(data.earnings.paid)}
                  </p>
                </div>
                <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4">
                  <p className="text-sm font-semibold text-cyan-700">Total Earnings</p>
                  <p className="mt-2 text-2xl font-bold text-cyan-800">
                    {compactNaira(data.earnings.total)}
                  </p>
                </div>
              </div>
            </article>
          </div>

          <aside className="space-y-6 lg:sticky lg:top-6 lg:h-fit">
            <article className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-slate-900">Quick Actions</h2>
              <div className="space-y-3">
                <Link
                  href="/agent/referrals"
                  className="block rounded-xl border border-sky-200 bg-sky-50 p-4 transition hover:bg-sky-100"
                >
                  <p className="font-semibold text-sky-800">Manage Referrals</p>
                  <p className="text-sm text-sky-700">Create and track referral links.</p>
                </Link>

                <Link
                  href="/agent/earnings"
                  className="block rounded-xl border border-emerald-200 bg-emerald-50 p-4 transition hover:bg-emerald-100"
                >
                  <p className="font-semibold text-emerald-800">View Earnings</p>
                  <p className="text-sm text-emerald-700">Inspect commission history.</p>
                </Link>

                {payoutReady ? (
                  <Link
                    href="/agent/payouts"
                    className="block rounded-xl border border-cyan-200 bg-cyan-50 p-4 transition hover:bg-cyan-100"
                  >
                    <p className="font-semibold text-cyan-800">Request Payout</p>
                    <p className="text-sm text-cyan-700">You can request payout right now.</p>
                  </Link>
                ) : (
                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <p className="font-semibold text-slate-700">Payout Locked</p>
                    <p className="text-sm text-slate-600">
                      Minimum required: {compactNaira(data.earnings.min_payout_threshold)}
                    </p>
                  </div>
                )}
              </div>
            </article>

            <article
              className={`rounded-2xl border p-6 shadow-sm ${
                isApproved
                  ? 'border-emerald-200 bg-emerald-50'
                  : 'border-amber-200 bg-amber-50'
              }`}
            >
              <p
                className={`text-sm font-semibold ${
                  isApproved ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                Account Status
              </p>
              <p
                className={`mt-2 ${
                  isApproved ? 'text-emerald-800' : 'text-amber-800'
                }`}
              >
                {isApproved
                  ? 'Your account is active. Keep growing your referral network.'
                  : 'Awaiting admin approval before full access is enabled.'}
              </p>
            </article>
          </aside>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-slate-900">Recent Referrals</h2>
            <Link href="/agent/referrals" className="text-sm font-semibold text-sky-700 hover:underline">
              View all
            </Link>
          </div>

          {recentReferrals.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
              No recent referrals yet. Create your first referral link to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full border-separate border-spacing-0 text-left">
                <thead>
                  <tr>
                    <th className="border-b border-slate-200 pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Referral Code
                    </th>
                    <th className="border-b border-slate-200 pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      School
                    </th>
                    <th className="border-b border-slate-200 pb-3 pr-4 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Status
                    </th>
                    <th className="border-b border-slate-200 pb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      Created
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentReferrals.slice(0, 6).map((referral) => (
                    <tr key={referral.id}>
                      <td className="border-b border-slate-100 py-3 pr-4 font-semibold text-slate-800">
                        {referral.referralCode}
                      </td>
                      <td className="border-b border-slate-100 py-3 pr-4 text-slate-700">
                        {referral.schoolName}
                      </td>
                      <td className="border-b border-slate-100 py-3 pr-4">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {statusLabel(referral.status)}
                        </span>
                      </td>
                      <td className="border-b border-slate-100 py-3 text-slate-600">
                        {safeDate(referral.createdAt)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
