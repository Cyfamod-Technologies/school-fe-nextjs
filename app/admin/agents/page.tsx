'use client';

import React, { useState, useEffect } from 'react';
import { adminApi } from '@/lib/agents';

interface Agent {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: string;
  bank_account_number: string;
  bank_name: string;
  created_at: string;
  approved_at?: string;
}

export default function AdminAgentsPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, suspended
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewingAgent, setReviewingAgent] = useState<Agent | null>(null);

  const fetchAgents = async () => {
    try {
      const response = await adminApi.getPendingAgents();
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      } else {
        setError('Failed to load agents');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAgents();
  }, []);

  const handleApproveAgent = async (agentId: string) => {
    setProcessingId(agentId);
    try {
      const response = await adminApi.approveAgent(agentId);
      if (response.ok) {
        setAgents(
          agents.map((a) =>
            a.id === agentId ? { ...a, status: 'approved' } : a
          )
        );
        setReviewingAgent(null);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to approve agent');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const handleRejectAgent = async (agentId: string) => {
    setProcessingId(agentId);
    try {
      const response = await adminApi.rejectAgent(agentId);
      if (response.ok) {
        setAgents(
          agents.map((a) =>
            a.id === agentId ? { ...a, status: 'rejected' } : a
          )
        );
        setReviewingAgent(null);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to reject agent');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const handleSuspendAgent = async (agentId: string) => {
    setProcessingId(agentId);
    try {
      const response = await adminApi.suspendAgent(agentId);
      if (response.ok) {
        setAgents(
          agents.map((a) =>
            a.id === agentId ? { ...a, status: 'suspended' } : a
          )
        );
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to suspend agent');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredAgents = agents.filter((a) => {
    if (filter === 'all') return true;
    return a.status === filter;
  });

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'approved':
        return 'bg-green-100 text-green-800';
      case 'rejected':
        return 'bg-red-100 text-red-800';
      case 'suspended':
        return 'bg-red-50 text-red-700';
      default:
        return 'bg-gray-100 text-gray-800';
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
        <p className="text-gray-600">Loading agents...</p>
      </div>
    );
  }

  const pendingCount = agents.filter((a) => a.status === 'pending').length;

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Agent Management</h1>
          <p className="text-gray-600">
            Review and approve agent registrations
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Alert */}
        {pendingCount > 0 && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-md">
            <p className="text-yellow-800 font-medium">
              ⚠ {pendingCount} pending agent(s) awaiting approval
            </p>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="mb-6 flex gap-2 flex-wrap">
          {['pending', 'approved', 'rejected', 'suspended', 'all'].map(
            (tabFilter) => {
              const count = agents.filter((a) => a.status === tabFilter).length;
              return (
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
                  {tabFilter !== 'all' && ` (${count})`}
                </button>
              );
            }
          )}
        </div>

        {/* Agents Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {filteredAgents.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No {filter} agents
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Agent Name
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Contact
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Bank Account
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Registered
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {filteredAgents.map((agent) => (
                    <tr key={agent.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <p className="font-medium text-gray-900">
                          {agent.full_name}
                        </p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{agent.email}</div>
                        <div>{agent.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        <div>{agent.bank_account_number?.slice(-4)}****</div>
                        <div className="text-xs">{agent.bank_name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            agent.status
                          )}`}
                        >
                          {agent.status?.charAt(0).toUpperCase() +
                            agent.status?.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">
                        {formatDate(agent.created_at)}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <button
                            onClick={() => setReviewingAgent(agent)}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Review
                          </button>
                          {agent.status === 'approved' && (
                            <button
                              onClick={() => handleSuspendAgent(agent.id)}
                              disabled={processingId === agent.id}
                              className="text-red-600 hover:underline text-sm disabled:opacity-50"
                            >
                              Suspend
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Review Modal */}
        {reviewingAgent && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-8">
              <h2 className="text-2xl font-bold mb-6 text-gray-900">
                Review Agent
              </h2>

              {/* Agent Details */}
              <div className="mb-6 space-y-4">
                <div>
                  <p className="text-sm text-gray-600">Full Name</p>
                  <p className="font-medium text-gray-900">
                    {reviewingAgent.full_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">
                    {reviewingAgent.email}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-medium text-gray-900">
                    {reviewingAgent.phone}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Bank Account</p>
                  <p className="font-medium text-gray-900">
                    {reviewingAgent.bank_account_number?.slice(-4)}**** •{' '}
                    {reviewingAgent.bank_name}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Status</p>
                  <span
                    className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                      reviewingAgent.status
                    )}`}
                  >
                    {reviewingAgent.status?.charAt(0).toUpperCase() +
                      reviewingAgent.status?.slice(1)}
                  </span>
                </div>
              </div>

              {/* Actions */}
              {reviewingAgent.status === 'pending' && (
                <div className="flex gap-3">
                  <button
                    onClick={() => handleApproveAgent(reviewingAgent.id)}
                    disabled={processingId === reviewingAgent.id}
                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
                  >
                    {processingId === reviewingAgent.id ? 'Approving...' : 'Approve'}
                  </button>
                  <button
                    onClick={() => handleRejectAgent(reviewingAgent.id)}
                    disabled={processingId === reviewingAgent.id}
                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 disabled:opacity-50"
                  >
                    {processingId === reviewingAgent.id ? 'Rejecting...' : 'Reject'}
                  </button>
                </div>
              )}
              <div className="flex gap-3 mt-4">
                <button
                  onClick={() => setReviewingAgent(null)}
                  className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
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
