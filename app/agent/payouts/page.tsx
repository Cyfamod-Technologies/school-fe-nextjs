'use client';

import React, { useState, useEffect } from 'react';
import { agentApi } from '@/lib/agents';

interface Payout {
  id: string;
  amount: number;
  status: string;
  bank_account_number: string;
  bank_name: string;
  created_at: string;
  processed_at?: string;
  completed_at?: string;
}

export default function AgentPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [agentData, setAgentData] = useState({
    available_payout_amount: 0,
    total_pending_payouts: 0,
    total_paid_payouts: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [showRequestModal, setShowRequestModal] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [minPayoutThreshold] = useState(5000);

  const fetchPayouts = async () => {
    try {
      const dashboardResponse = await agentApi.getDashboard();
      if (dashboardResponse.ok) {
        const dashboardData = await dashboardResponse.json();
        setAgentData({
          available_payout_amount:
            dashboardData.available_for_payout || 0,
          total_pending_payouts: dashboardData.pending_payouts || 0,
          total_paid_payouts: dashboardData.paid_payouts || 0,
        });
      }

      const payoutResponse = await agentApi.getPayoutHistory();
      if (payoutResponse.ok) {
        const data = await payoutResponse.json();
        setPayouts(data.payouts || []);
      } else {
        setError('Failed to load payouts');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayouts();
  }, []);

  const handleRequestPayout = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseFloat(requestAmount);

    if (!amount || amount <= 0) {
      setError('Please enter a valid amount');
      return;
    }

    if (amount < minPayoutThreshold) {
      setError(
        `Minimum payout amount is ₦${(minPayoutThreshold / 1000).toFixed(1)}k`
      );
      return;
    }

    if (amount > agentData.available_payout_amount) {
      setError('Amount exceeds available balance');
      return;
    }

    setRequesting(true);
    setError(null);

    try {
      const response = await agentApi.requestPayout(amount * 100); // Convert to cents
      if (response.ok) {
        const data = await response.json();
        setPayouts([data.payout, ...payouts]);
        setRequestAmount('');
        setShowRequestModal(false);
        setAgentData((prev) => ({
          ...prev,
          available_payout_amount:
            prev.available_payout_amount - amount * 100,
        }));
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to request payout');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setRequesting(false);
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

  const canRequestPayout = agentData.available_payout_amount >= minPayoutThreshold;

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
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Payout History</h1>
            <p className="text-gray-600">
              Manage your payout requests and track payments
            </p>
          </div>
          <button
            onClick={() => setShowRequestModal(true)}
            disabled={!canRequestPayout}
            className={`px-6 py-3 rounded-lg font-medium transition ${
              canRequestPayout
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-300 text-gray-500 cursor-not-allowed'
            }`}
          >
            Request Payout
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Request Modal */}
        {showRequestModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-6">Request Payout</h2>
              <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-600 font-medium">
                  Available Balance
                </p>
                <p className="text-2xl font-bold text-blue-900">
                  ₦{(agentData.available_payout_amount / 1000).toFixed(1)}k
                </p>
              </div>
              <form onSubmit={handleRequestPayout}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payout Amount (₦)
                  </label>
                  <input
                    type="number"
                    value={requestAmount}
                    onChange={(e) => setRequestAmount(e.target.value)}
                    placeholder="Minimum ₦5,000"
                    step="100"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-green-500"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Minimum: ₦{(minPayoutThreshold / 1000).toFixed(1)}k
                  </p>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={requesting}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {requesting ? 'Processing...' : 'Request'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowRequestModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">
              Available for Payout
            </p>
            <p className="text-3xl font-bold text-green-600">
              ₦{(agentData.available_payout_amount / 1000).toFixed(1)}k
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">
              Pending Approval
            </p>
            <p className="text-3xl font-bold text-yellow-600">
              ₦{(agentData.total_pending_payouts / 1000).toFixed(1)}k
            </p>
          </div>
          <div className="bg-white rounded-lg shadow p-6">
            <p className="text-gray-600 text-sm font-medium mb-2">
              Total Paid Out
            </p>
            <p className="text-3xl font-bold text-blue-600">
              ₦{(agentData.total_paid_payouts / 1000).toFixed(1)}k
            </p>
          </div>
        </div>

        {/* Payouts Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {payouts.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              <p className="mb-2">No payout requests yet.</p>
              <p className="text-sm">
                Request a payout once you have earned at least ₦5,000 in
                commissions.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Amount
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Bank Account
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Requested
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Completed
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {payouts.map((payout) => (
                    <tr key={payout.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <span className="font-semibold text-gray-900">
                          ₦{(payout.amount / 1000).toFixed(1)}k
                        </span>
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
                        <div>
                          {payout.bank_account_number?.slice(-4)}
                          {payout.bank_account_number && ' • '}
                          {payout.bank_name}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(payout.created_at)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {payout.completed_at
                          ? formatDate(payout.completed_at)
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Info Box */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">Payout Timeline</h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>
              • <strong>Pending:</strong> Your payout request is awaiting
              approval
            </li>
            <li>
              • <strong>Approved:</strong> Your request has been approved and
              will be processed
            </li>
            <li>
              • <strong>Processing:</strong> Funds are being transferred to your
              bank account
            </li>
            <li>
              • <strong>Completed:</strong> Payout has been sent to your bank
              account (1-3 business days)
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
