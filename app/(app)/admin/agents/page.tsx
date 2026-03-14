'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/agents';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

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
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, suspended
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewingAgent, setReviewingAgent] = useState<Agent | null>(null);

  useEffect(() => {
    const userRole = (user?.role || '').toLowerCase();
    if (!authLoading && user && userRole !== 'super_admin' && userRole !== 'admin') {
      router.replace('/v10/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchAgents = async () => {
    try {
      const response = await adminApi.getPendingAgents();
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || []);
      } else {
        setError('Failed to load agents. Access denied.');
      }
    } catch (err) {
      setError('An error occurred while fetching agents.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchAgents();
    }
  }, [user]);

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
        return 'badge-warning';
      case 'approved':
        return 'badge-success';
      case 'rejected':
        return 'badge-danger';
      case 'suspended':
        return 'badge-secondary';
      default:
        return 'badge-info';
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
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  const pendingCount = agents.filter((a) => a.status === 'pending').length;

  return (
    <>
      {/* Breadcrumbs */}
      <div className="breadcrumbs-area">
        <h3>Partner Program</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Partners</li>
        </ul>
      </div>

      <div className="card dashboard-card-one pd-b-20 mg-b-20">
        <div className="card-body">
          <div className="heading-layout1 mg-b-17">
            <div className="item-title">
              <h3>Partner Agents</h3>
            </div>
          </div>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {pendingCount > 0 && (
            <div className="alert alert-warning" role="alert">
              <i className="fas fa-exclamation-triangle mr-2" />
              {pendingCount} agent(s) awaiting approval
            </div>
          )}

          {/* Filter Tabs */}
          <div className="mb-4">
            <div className="btn-group" role="group">
              {['pending', 'approved', 'rejected', 'suspended', 'all'].map((tabFilter) => (
                <button
                  key={tabFilter}
                  onClick={() => setFilter(tabFilter)}
                  className={`btn btn-lg ${filter === tabFilter ? 'btn-primary' : 'btn-outline-primary'}`}
                >
                  {tabFilter.charAt(0).toUpperCase() + tabFilter.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="table-responsive">
            <table className="table display data-table text-nowrap">
              <thead>
                <tr>
                  <th style={{ fontSize: '1.4rem' }}>Agent Name</th>
                  <th style={{ fontSize: '1.4rem' }}>Contact</th>
                  <th style={{ fontSize: '1.4rem' }}>Bank Account</th>
                  <th style={{ fontSize: '1.4rem' }}>Status</th>
                  <th style={{ fontSize: '1.4rem' }}>Registered</th>
                  <th style={{ fontSize: '1.4rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '1.4rem' }}>
                {filteredAgents.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4">No {filter} agents found.</td>
                  </tr>
                ) : (
                  filteredAgents.map((agent) => (
                    <tr key={agent.id}>
                      <td>{agent.full_name}</td>
                      <td>
                        <div>{agent.email}</div>
                        <div className="text-muted" style={{ fontSize: '1.2rem' }}>{agent.phone}</div>
                      </td>
                      <td>
                        <div>{agent.bank_account_number?.slice(-4)}****</div>
                        <div className="text-muted" style={{ fontSize: '1.1rem' }}>{agent.bank_name}</div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusColor(agent.status)}`} style={{ padding: '8px 12px', fontWeight: 600, textTransform: 'capitalize' }}>
                          {agent.status}
                        </span>
                      </td>
                      <td>{formatDate(agent.created_at)}</td>
                      <td>
                        <button 
                          className="btn-fill-sm text-light bg-dodger-blue"
                          style={{ border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px 12px' }}
                          onClick={() => setReviewingAgent(agent)}
                        >
                          Review
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Review Modal */}
      {reviewingAgent && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Review Agent</h5>
                <button type="button" className="close" onClick={() => setReviewingAgent(null)}>
                  <span>&times;</span>
                </button>
              </div>
              <div className="modal-body">
                <dl className="row">
                  <dt className="col-sm-4">Full Name</dt>
                  <dd className="col-sm-8">{reviewingAgent.full_name}</dd>

                  <dt className="col-sm-4">Email</dt>
                  <dd className="col-sm-8">{reviewingAgent.email}</dd>

                  <dt className="col-sm-4">Bank</dt>
                  <dd className="col-sm-8">{reviewingAgent.bank_name}</dd>

                  <dt className="col-sm-4">Account</dt>
                  <dd className="col-sm-8">{reviewingAgent.bank_account_number}</dd>
                </dl>
              </div>
              <div className="modal-footer">
                {reviewingAgent.status === 'pending' && (
                  <>
                    <button 
                      className="btn btn-success" 
                      onClick={() => handleApproveAgent(reviewingAgent.id)}
                      disabled={!!processingId}
                    >
                      {processingId === reviewingAgent.id ? 'Processing...' : 'Approve'}
                    </button>
                    <button 
                      className="btn btn-danger" 
                      onClick={() => handleRejectAgent(reviewingAgent.id)}
                      disabled={!!processingId}
                    >
                      Reject
                    </button>
                  </>
                )}
                <button className="btn btn-secondary" onClick={() => setReviewingAgent(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
