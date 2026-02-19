'use client';

import React, { useState, useEffect } from 'react';
import { adminApi } from '@/lib/agents';

interface Payout {
  id: string;
  agent_name: string;
  amount: number;
  status: string;
  bank_account_number: string;
  bank_name: string;
  created_at: string;
  processed_at?: string;
  completed_at?: string;
}

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [stats, setStats] = useState({
    total_pending: 0,
    total_processing: 0,
    total_completed: 0,
    pending_amount: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending');
  const [selectedPayouts, setSelectedPayouts] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);
  const [revisingPayout, setRevisingPayout] = useState<Payout | null>(null);
  const [action, setAction] = useState<
    'approve' | 'process' | 'complete' | null
  >(null);

  const fetchPayouts = async () => {
    try {
      const response = await adminApi.getPayouts(filter);
      if (response.ok) {
        const data = await response.json();
        setPayouts(data.payouts || []);
        setStats(data.stats || {});
      } else {
        setError('Failed to load payouts');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, [filter]);

  const handleApprovePayout = async (payoutId: string) => {
    setProcessing(true);
    try {
      const response = await adminApi.approvePayout(payoutId);
      if (response.ok) {
        setPayouts(
          payouts.map((p) =>
            p.id === payoutId ? { ...p, status: 'approved' } : p
          )
        );
        setRevisingPayout(null);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to approve payout');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleProcessPayout = async (payoutId: string) => {
    setProcessing(true);
    try {
      const response = await adminApi.processPayout(payoutId);
      if (response.ok) {
        setPayouts(
          payouts.map((p) =>
            p.id === payoutId ? { ...p, status: 'processing' } : p
          )
        );
        setRevisingPayout(null);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to process payout');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleBulkApprove = async () => {
    if (selectedPayouts.length === 0) {
      setError('Please select at least one payout');
      return;
    }

    setProcessing(true);
    try {
      const response = await adminApi.bulkApprovePayouts(selectedPayouts);
      if (response.ok) {
        const approvedIds = new Set(selectedPayouts);
        setPayouts(
          payouts.map((p) =>
            approvedIds.has(p.id) ? { ...p, status: 'approved' } : p
          )
        );
        setSelectedPayouts([]);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to approve payouts');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessing(false);
    }
  };

  const handleSelectPayout = (id: string) => {
    setSelectedPayouts((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectedPayouts.length === payouts.length) {
      setSelectedPayouts([]);
    } else {
      setSelectedPayouts(payouts.map((p) => p.id));
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-blue-100 text-blue-800';
      case 'processing':
        return 'bg-purple-100 text-purple-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
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
      case 'processing':
        return '🔄';
      case 'completed':
        return '💳';
      case 'failed':
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
        <p className="text-gray-600">Loading payouts...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Payout Management</h1>
          <p className="text-gray-600">Review and process agent payout requests</p>
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
            <p className="text-gray-600 text-sm font-medium mb-2">Processing</p>
            <p className="text-3xl font-bold text-purple-600">
              {stats.total_processing}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Completed</p>
            <p className="text-3xl font-bold text-green-600">
              {stats.total_completed}
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">Total</p>
            <p className="text-3xl font-bold text-gray-900">
              {stats.total_pending +
                stats.total_processing +
                stats.total_completed}
            </p>
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {['pending', 'approved', 'processing', 'completed'].map(
            (tabFilter) => (
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
            )
          )}
        </div>

        {/* Bulk Actions */}
        {selectedPayouts.length > 0 && filter === 'pending' && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
            <p className="text-blue-900 font-medium">
              {selectedPayouts.length} selected
            </p>
            <button
              onClick={handleBulkApprove}
              disabled={processing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              {processing
                ? 'Approving...'
                : `Approve Selected (${selectedPayouts.length})`}
            </button>
          </div>
        )}

        {/* Payouts Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {payouts.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No {filter} payouts
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
                            selectedPayouts.length === payouts.length
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
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Bank Account
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Requested
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Completed
                    </th>
                    {(filter === 'pending' || filter === 'approved') && (
                      <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                        Actions
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-50">
                      {filter === 'pending' && (
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedPayouts.includes(payout.id)}
                            onChange={() => handleSelectPayout(payout.id)}
                            className="w-4 h-4"
                          />
                        </td>
                      )}
                      <td className="px-6 py-4 text-sm font-medium text-gray-900">
                        {payout.agent_name}
                      </td>
                      <td className="px-6 py-4">
                        <span className="font-semibold text-green-600">
                          ₦{(payout.amount / 1000).toFixed(1)}k
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {payout.bank_account_number?.slice(-4)}**** •{' '}
                        {payout.bank_name}
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            payout.status
                          )}`}
                        >
                          {getStatusIcon(payout.status)}{' '}
                          {payout.status?.charAt(0).toUpperCase() +
                            payout.status?.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(payout.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {payout.completed_at
                          ? formatDate(payout.completed_at)
                          : '-'}
                      </td>
                      {(filter === 'pending' || filter === 'approved') && (
                        <td className="px-6 py-4">
                          <button
                            onClick={() => setRevisingPayout(payout)}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Review
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

        {/* Review Modal */}
        {revisingPayout && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                Review Payout
              </h2>

              {/* Payout Details */}
              <div className="mb-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Agent</p>
                  <p className="font-medium text-gray-900">
                    {revisingPayout.agent_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Amount</p>
                  <p className="text-2xl font-bold text-green-600">
                    ₦{(revisingPayout.amount / 1000).toFixed(1)}k
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Bank Account</p>
                  <p className="font-medium text-gray-900">
                    {revisingPayout.bank_account_number?.slice(-4)}**** •{' '}
                    {revisingPayout.bank_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span
                    className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      revisingPayout.status
                    )}`}
                  >
                    {getStatusIcon(revisingPayout.status)}{' '}
                    {revisingPayout.status?.charAt(0).toUpperCase() +
                      revisingPayout.status?.slice(1)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-3">
                {revisingPayout.status === 'pending' && (
                  <button
                    onClick={() => handleApprovePayout(revisingPayout.id)}
                    disabled={processing}
                    className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {processing ? 'Approving...' : 'Approve'}
                  </button>
                )}
                {revisingPayout.status === 'approved' && (
                  <button
                    onClick={() => handleProcessPayout(revisingPayout.id)}
                    disabled={processing}
                    className="w-full bg-purple-600 text-white py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50"
                  >
                    {processing ? 'Processing...' : 'Mark as Processing'}
                  </button>
                )}
                <button
                  onClick={() => setRevisingPayout(null)}
                  className="w-full bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
