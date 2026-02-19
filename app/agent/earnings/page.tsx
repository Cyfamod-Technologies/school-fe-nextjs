'use client';

import React, { useState, useEffect } from 'react';
import { agentApi } from '@/lib/agents';

interface Commission {
  id: string;
  referral_code: string;
  amount: number;
  status: string;
  payment_count: number;
  school_name?: string;
  created_at: string;
  paid_at?: string;
}

export default function AgentEarningsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stats, setStats] = useState({
    total_earnings: 0,
    pending_earnings: 0,
    paid_earnings: 0,
    total_commissions: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('all'); // all, pending, approved, paid

  const fetchCommissions = async () => {
    try {
      const response = await agentApi.getCommissionHistory();
      if (response.ok) {
        const data = await response.json();
        setCommissions(data.commissions || []);
        setStats(data.stats || {});
      } else {
        setError('Failed to load commissions');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, []);

  const filteredCommissions = commissions.filter((c) => {
    if (filter === 'all') return true;
    return c.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return '⏳';
      case 'approved':
        return '✓';
      case 'paid':
        return '💰';
      case 'rejected':
        return '✗';
      default:
        return '○';
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading earnings...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Commission History</h1>
          <p className="text-gray-600">
            Track your earnings and commission status
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">
              Total Earnings
            </p>
            <p className="text-3xl font-bold text-gray-900">
              ₦{(stats.total_earnings / 1000).toFixed(1)}k
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">
              Pending Earnings
            </p>
            <p className="text-3xl font-bold text-yellow-600">
              ₦{(stats.pending_earnings / 1000).toFixed(1)}k
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">
              Paid Earnings
            </p>
            <p className="text-3xl font-bold text-green-600">
              ₦{(stats.paid_earnings / 1000).toFixed(1)}k
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">
              Total Commissions
            </p>
            <p className="text-3xl font-bold text-blue-600">
              {stats.total_commissions}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {['all', 'pending', 'approved', 'paid'].map((tabFilter) => (
            <button
              key={tabFilter}
              onClick={() => setFilter(tabFilter)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                filter === tabFilter
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {tabFilter.charAt(0).toUpperCase() + tabFilter.slice(1)}
            </button>
          ))}
        </div>

        {/* Commissions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredCommissions.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              {filter === 'all'
                ? 'No commissions yet. Generate referral codes to start earning!'
                : `No ${filter} commissions`}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Referral Code
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      School
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Payment #
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Date
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredCommissions.map((commission) => (
                    <tr key={commission.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                          {commission.referral_code}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {commission.school_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                          Payment {commission.payment_count}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-green-600">
                          ₦{(commission.amount / 1000).toFixed(1)}k
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            commission.status
                          )}`}
                        >
                          {getStatusIcon(commission.status)}{' '}
                          {commission.status?.charAt(0).toUpperCase() +
                            commission.status?.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {commission.status === 'paid' && commission.paid_at
                          ? `Paid: ${formatDate(commission.paid_at)}`
                          : formatDate(commission.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Additional Info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            How Commission Works
          </h3>
          <p className="text-blue-800 text-sm">
            You earn commission on the first school payment made through your
            referral code. Commissions are paid out monthly after approval. To
            request a payout, you must have at least ₦5,000 in available
            earnings.
          </p>
        </div>
      </div>
    </div>
  );
}
