'use client';

import React, { useState, useEffect } from 'react';
import { adminApi } from '@/lib/agents';

interface Commission {
  id: string;
  agent_name: string;
  referral_code: string;
  amount: number;
  status: string;
  school_name?: string;
  payment_count: number;
  created_at: string;
}

export default function AdminCommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [stats, setStats] = useState({
    total_pending: 0,
    total_approved: 0,
    total_paid: 0,
    pending_amount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending');
  const [selectedCommissions, setSelectedCommissions] = useState<string[]>([]);
  const [approving, setApproving] = useState(false);

  const fetchCommissions = async () => {
    try {
      const response = await adminApi.getCommissions(filter);
      if (response.ok) {
        const data = await response.json();
        setCommissions(data.commissions || []);
        setStats(data.stats || {});
      } else {
        setError('Failed to load commissions');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCommissions();
  }, [filter]);

  const handleApproveCommission = async (commissionId: string) => {
    setApproving(true);
    try {
      const response = await adminApi.approveCommission(commissionId);
      if (response.ok) {
        setCommissions(
          commissions.map((c) =>
            c.id === commissionId ? { ...c, status: 'approved' } : c
          )
        );
        setSelectedCommissions(
          selectedCommissions.filter((id) => id !== commissionId)
        );
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to approve commission');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setApproving(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedCommissions.length === 0) {
      setError('Please select at least one commission');
      return;
    }

    setApproving(true);
    try {
      const response = await adminApi.bulkApproveCommissions(
        selectedCommissions
      );
      if (response.ok) {
        const approvedIds = new Set(selectedCommissions);
        setCommissions(
          commissions.map((c) =>
            approvedIds.has(c.id) ? { ...c, status: 'approved' } : c
          )
        );
        setSelectedCommissions([]);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to approve commissions');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setApproving(false);
    }
  };

  const handleSelectCommission = (id: string) => {
    setSelectedCommissions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedCommissions.length === commissions.length) {
      setSelectedCommissions([]);
    } else {
      setSelectedCommissions(commissions.map((c) => c.id));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'paid':
        return 'bg-blue-100 text-blue-800';
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
        <p className="text-gray-600">Loading commissions...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">
            Commission Management
          </h1>
          <p className="text-gray-600">Review and approve agent commissions</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">
              Pending Approval
            </p>
            <p className="text-3xl font-bold text-yellow-600">
              {stats.total_pending}
            </p>
            <p className="text-xs text-gray-600 mt-1">
              ₦{(stats.pending_amount / 1000).toFixed(1)}k
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Approved</p>
            <p className="text-3xl font-bold text-green-600">
              {stats.total_approved}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Paid Out</p>
            <p className="text-3xl font-bold text-blue-600">
              {stats.total_paid}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">
              Total Commissions
            </p>
            <p className="text-3xl font-bold text-gray-900">
              {stats.total_pending + stats.total_approved + stats.total_paid}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {['pending', 'approved', 'paid'].map((tabFilter) => (
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

        {/* Bulk Actions */}
        {selectedCommissions.length > 0 && filter === 'pending' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <p className="text-blue-900 font-medium">
              {selectedCommissions.length} selected
            </p>
            <button
              onClick={handleBulkApprove}
              disabled={approving}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {approving
                ? 'Approving...'
                : `Approve Selected (${selectedCommissions.length})`}
            </button>
          </div>
        )}

        {/* Commissions Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {commissions.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No {filter} commissions
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    {filter === 'pending' && (
                      <th className="px-6 py-3 text-left">
                        <input
                          type="checkbox"
                          checked={
                            selectedCommissions.length === commissions.length
                          }
                          onChange={handleSelectAll}
                          className="w-4 h-4"
                        />
                      </th>
                    )}
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Agent
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Referral
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      School
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Payment #
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Date
                    </th>
                    {filter === 'pending' && (
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {commissions.map((commission) => (
                    <tr key={commission.id} className="hover:bg-gray-50">
                      {filter === 'pending' && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedCommissions.includes(commission.id)}
                            onChange={() =>
                              handleSelectCommission(commission.id)
                            }
                            className="w-4 h-4"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {commission.agent_name}
                      </td>
                      <td className="px-6 py-4">
                        <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                          {commission.referral_code}
                        </code>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {commission.school_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-green-600">
                          ₦{(commission.amount / 1000).toFixed(1)}k
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-xs">
                          #{commission.payment_count}
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
                        {formatDate(commission.created_at)}
                      </td>
                      {filter === 'pending' && (
                        <td className="px-6 py-4">
                          <button
                            onClick={() =>
                              handleApproveCommission(commission.id)
                            }
                            disabled={approving}
                            className="text-green-600 hover:underline text-sm disabled:opacity-50"
                          >
                            Approve
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
