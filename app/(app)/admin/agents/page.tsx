'use client';

import React, { useState, useEffect, useMemo } from 'react';
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
  rejection_reason?: string;
}

export default function AdminAgentsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending'); // pending, approved, rejected, suspended, all
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [reviewingAgent, setReviewingAgent] = useState<Agent | null>(null);

  // Define valid state transitions for the modern State-Action UI
  const getAvailableActions = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case 'pending':
        return [
          { label: 'Approve', action: 'approve', color: 'btn-success', icon: 'fas fa-check' },
          { label: 'Reject', action: 'reject', color: 'btn-danger', icon: 'fas fa-times' }
        ];
      case 'approved':
        return [
          { label: 'Suspend', action: 'suspend', color: 'btn-warning', icon: 'fas fa-pause' },
          { label: 'Mark Inactive', action: 'reject', color: 'btn-secondary', icon: 'fas fa-user-slash' }
        ];
      case 'suspended':
      case 'inactive':
      case 'rejected':
        return [
          { label: 'Re-Activate', action: 'approve', color: 'btn-success', icon: 'fas fa-play' }
        ];
      default:
        return [];
    }
  };

  useEffect(() => {
    const userRole = (user?.role || '').toLowerCase();
    if (!authLoading && user && userRole !== 'super_admin' && userRole !== 'admin') {
      router.replace('/v10/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchAgents = async () => {
    try {
      const response = await adminApi.getPendingAgents(); // Note: backend pending endpoint usually returns all for admin filter
      if (response.ok) {
        const data = await response.json();
        setAgents(data.agents || data.data || []);
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

  const handleAction = async (agentId: string, action: string, reason?: string) => {
    setProcessingId(agentId);
    try {
      let response;
      if (action === 'approve') response = await adminApi.approveAgent(agentId);
      else if (action === 'reject') response = await adminApi.rejectAgent(agentId, reason);
      else if (action === 'suspend') response = await adminApi.suspendAgent(agentId);

      if (response?.ok) {
        const updatedAgent = await response.json();
        setAgents(agents.map(a => a.id === agentId ? { ...a, ...updatedAgent.agent } : a));
        setReviewingAgent(null);
      } else {
        setError(`Failed to ${action} agent.`);
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredAgents = useMemo(() => {
    if (filter === 'all') return agents;
    return agents.filter((a) => a.status?.toLowerCase() === filter.toLowerCase());
  }, [agents, filter]);

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    let badgeClass = 'badge-info';
    if (s === 'pending') badgeClass = 'badge-warning';
    if (s === 'approved') badgeClass = 'badge-success';
    if (s === 'rejected' || s === 'inactive') badgeClass = 'badge-danger';
    if (s === 'suspended') badgeClass = 'badge-secondary';

    return <span className={`badge ${badgeClass}`} style={{ padding: '8px 12px', fontWeight: 600, textTransform: 'capitalize' }}>{status}</span>;
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status"><span className="sr-only">Loading...</span></div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Partner Program</h3>
        <ul>
          <li><Link href="/v10/dashboard">Home</Link></li>
          <li>Partners</li>
        </ul>
      </div>

      <div className="card dashboard-card-one pd-b-20 mg-b-20">
        <div className="card-body">
          <div className="heading-layout1 mg-b-17">
            <div className="item-title"><h3>Partner Agents</h3></div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          {/* Filter Tabs */}
          <div className="mb-4">
            <div className="btn-group" role="group">
              {['pending', 'approved', 'suspended', 'rejected', 'all'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`btn btn-lg ${filter === f ? 'btn-primary' : 'btn-outline-primary'}`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
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
                  <th style={{ fontSize: '1.4rem' }}>Status</th>
                  <th style={{ fontSize: '1.4rem' }}>Registered</th>
                  <th style={{ fontSize: '1.4rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '1.4rem' }}>
                {filteredAgents.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4">No {filter} agents found.</td></tr>
                ) : (
                  filteredAgents.map((agent) => (
                    <tr key={agent.id}>
                      <td>{agent.full_name}</td>
                      <td>
                        <div>{agent.email}</div>
                        <div className="text-muted" style={{ fontSize: '1.2rem' }}>{agent.phone}</div>
                      </td>
                      <td>{getStatusBadge(agent.status)}</td>
                      <td>{new Date(agent.created_at).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className="btn-fill-sm text-light bg-dodger-blue"
                          style={{ border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px 12px' }}
                          onClick={() => setReviewingAgent(agent)}
                        >
                          Review / Actions
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

      {/* Modern Action Modal */}
      {reviewingAgent && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.5)' }}>
          <div className="modal-dialog modal-dialog-centered">
            <div className="modal-content">
              <div className="modal-header">
                <h5 className="modal-title">Agent Profile & Actions</h5>
                <button type="button" className="close" onClick={() => setReviewingAgent(null)}><span>&times;</span></button>
              </div>
              <div className="modal-body">
                <div className="mb-4">
                  <p className="mb-1 text-muted small">Account Status</p>
                  {getStatusBadge(reviewingAgent.status)}
                </div>
                <dl className="row">
                  <dt className="col-sm-4">Full Name</dt><dd className="col-sm-8">{reviewingAgent.full_name}</dd>
                  <dt className="col-sm-4">Email</dt><dd className="col-sm-8">{reviewingAgent.email}</dd>
                  <dt className="col-sm-4">Bank</dt><dd className="col-sm-8">{reviewingAgent.bank_name}</dd>
                  <dt className="col-sm-4">Account</dt><dd className="col-sm-8">{reviewingAgent.bank_account_number}</dd>
                </dl>
                
                <hr />
                <h6 className="mb-3">Available Actions</h6>
                <div className="d-flex gap-2 flex-wrap">
                  {getAvailableActions(reviewingAgent.status).map((btn) => (
                    <button
                      key={btn.action}
                      className={`btn ${btn.color} btn-lg mr-2`}
                      onClick={() => handleAction(reviewingAgent.id, btn.action)}
                      disabled={processingId === reviewingAgent.id}
                    >
                      <i className={`${btn.icon} mr-2`} />
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setReviewingAgent(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
