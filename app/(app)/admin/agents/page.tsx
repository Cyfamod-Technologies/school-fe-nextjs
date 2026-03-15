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
  const [filter, setFilter] = useState('pending'); // pending, approved, suspended, all
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [showRejectionInput, setShowRejectionInput] = useState(false);

  useEffect(() => {
    const userRole = (user?.role || '').toLowerCase();
    if (!authLoading && user && userRole !== 'super_admin' && userRole !== 'admin') {
      router.replace('/v10/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchAgents = async () => {
    setLoading(true);
    try {
      const response = await adminApi.listAgents(filter);
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
  }, [user, filter]);

  const handleAction = async (agentId: string, action: string) => {
    if (action === 'reject' && !rejectionReason) {
      setShowRejectionInput(true);
      return;
    }

    setProcessingId(agentId);
    try {
      let response;
      if (action === 'approve') response = await adminApi.approveAgent(agentId);
      else if (action === 'reject') response = await adminApi.rejectAgent(agentId, rejectionReason);
      else if (action === 'suspend') response = await adminApi.suspendAgent(agentId);

      if (response?.ok) {
        const payload = await response.json();
        setAgents(agents.map(a => a.id === agentId ? { ...a, ...payload.agent } : a));
        setSelectedAgent(null);
        setRejectionReason('');
        setShowRejectionInput(false);
      } else {
        const data = await response?.json();
        setError(data?.message || `Failed to ${action} agent.`);
      }
    } catch (err) {
      setError('An error occurred during the request.');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase() || '';
    let badgeClass = 'badge-info';
    if (s === 'pending') badgeClass = 'badge-warning';
    if (s === 'approved') badgeClass = 'badge-success';
    if (s === 'rejected' || s === 'inactive') badgeClass = 'badge-danger';
    if (s === 'suspended') badgeClass = 'badge-secondary';

    return (
      <span className={`badge ${badgeClass}`} style={{ padding: '8px 12px', fontWeight: 600, textTransform: 'capitalize', fontSize: '1.2rem' }}>
        {status}
      </span>
    );
  };

  if (loading && agents.length === 0) {
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

          {error && (
            <div className="alert alert-danger alert-dismissible fade show">
              {error}
              <button type="button" className="close" onClick={() => setError(null)}><span>&times;</span></button>
            </div>
          )}

          <div className="mb-4">
            <div className="btn-group" role="group">
              {['pending', 'approved', 'suspended', 'inactive', 'all'].map((f) => (
                <button
                  key={f}
                  onClick={() => setFilter(f)}
                  className={`btn btn-lg ${filter === f ? 'btn-primary' : 'btn-outline-primary'}`}
                  style={{ fontSize: '1.4rem' }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
            </div>
          </div>

          <div className="table-responsive">
            <table className="table display data-table text-nowrap">
              <thead style={{ fontSize: '1.4rem' }}>
                <tr>
                  <th>Agent Name</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Registered</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '1.4rem' }}>
                {agents.length === 0 ? (
                  <tr><td colSpan={5} className="text-center py-4 text-muted">No {filter} agents found.</td></tr>
                ) : (
                  agents.map((agent) => (
                    <tr key={agent.id}>
                      <td className="font-weight-bold">{agent.full_name}</td>
                      <td>
                        <div>{agent.email}</div>
                        <div className="text-muted" style={{ fontSize: '1.2rem' }}>{agent.phone}</div>
                      </td>
                      <td>{getStatusBadge(agent.status)}</td>
                      <td>{new Date(agent.created_at).toLocaleDateString()}</td>
                      <td>
                        <button 
                          className="btn-fill-sm text-light bg-dodger-blue"
                          style={{ border: 'none', cursor: 'pointer', fontSize: '1.3rem' }}
                          onClick={() => {
                            setSelectedAgent(agent);
                            setShowRejectionInput(false);
                          }}
                        >
                          Manage
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

      {/* Themed Management Modal */}
      {selectedAgent && (
        <div className="modal fade show" style={{ display: 'block', backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1100 }}>
          <div className="modal-dialog modal-dialog-centered modal-lg">
            <div className="modal-content" style={{ borderRadius: '15px', border: 'none' }}>
              <div className="modal-header pd-20">
                <h5 className="modal-title" style={{ fontSize: '1.8rem', fontWeight: 700 }}>Agent Profile & Status</h5>
                <button type="button" className="close" onClick={() => setSelectedAgent(null)}>
                  <span style={{ fontSize: '2.5rem' }}>&times;</span>
                </button>
              </div>
              <div className="modal-body pd-30">
                <div className="row mg-b-20">
                  <div className="col-md-6">
                    <p className="text-muted mg-b-5" style={{ fontSize: '1.2rem' }}>Full Name</p>
                    <p style={{ fontSize: '1.5rem', fontWeight: 600 }}>{selectedAgent.full_name}</p>
                  </div>
                  <div className="col-md-6">
                    <p className="text-muted mg-b-5" style={{ fontSize: '1.2rem' }}>Status</p>
                    {getStatusBadge(selectedAgent.status)}
                  </div>
                </div>

                <div className="row mg-b-20">
                  <div className="col-md-6">
                    <p className="text-muted mg-b-5" style={{ fontSize: '1.2rem' }}>Email Address</p>
                    <p style={{ fontSize: '1.4rem' }}>{selectedAgent.email}</p>
                  </div>
                  <div className="col-md-6">
                    <p className="text-muted mg-b-5" style={{ fontSize: '1.2rem' }}>Bank Account</p>
                    <p style={{ fontSize: '1.4rem' }}>{selectedAgent.bank_name} - {selectedAgent.bank_account_number}</p>
                  </div>
                </div>

                <hr className="mg-b-20" />

                {!showRejectionInput ? (
                  <div className="action-area d-flex gap-3 flex-wrap">
                    {selectedAgent.status?.toLowerCase() === 'pending' && (
                      <>
                        <button 
                          className="btn-fill-lg font-mg text-light bg-green-600 mr-3"
                          style={{ backgroundColor: '#28a745', border: 'none' }}
                          onClick={() => handleAction(selectedAgent.id, 'approve')}
                          disabled={!!processingId}
                        >
                          <i className="fas fa-check mr-2" /> Approve Agent
                        </button>
                        <button 
                          className="btn-fill-lg font-mg text-light bg-red-600"
                          style={{ backgroundColor: '#dc3545', border: 'none' }}
                          onClick={() => setShowRejectionInput(true)}
                          disabled={!!processingId}
                        >
                          <i className="fas fa-times mr-2" /> Reject Agent
                        </button>
                      </>
                    )}

                    {selectedAgent.status?.toLowerCase() === 'approved' && (
                      <button 
                        className="btn-fill-lg font-mg text-light bg-orange-peel"
                        style={{ backgroundColor: '#ffae01', border: 'none' }}
                        onClick={() => handleAction(selectedAgent.id, 'suspend')}
                        disabled={!!processingId}
                      >
                        <i className="fas fa-pause mr-2" /> Suspend Account
                      </button>
                    )}

                    {(selectedAgent.status?.toLowerCase() === 'suspended' || 
                      selectedAgent.status?.toLowerCase() === 'rejected' || 
                      selectedAgent.status?.toLowerCase() === 'inactive') && (
                      <button 
                        className="btn-fill-lg font-mg text-light bg-dodger-blue"
                        style={{ border: 'none' }}
                        onClick={() => handleAction(selectedAgent.id, 'approve')}
                        disabled={!!processingId}
                      >
                        <i className="fas fa-play mr-2" /> Re-Activate Account
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="rejection-form">
                    <label style={{ fontSize: '1.4rem', fontWeight: 600 }}>Reason for Rejection</label>
                    <textarea 
                      className="form-control"
                      rows={3}
                      style={{ fontSize: '1.4rem', marginTop: '10px' }}
                      placeholder="e.g. Incomplete profile or invalid bank details..."
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                    ></textarea>
                    <div className="mt-3 d-flex gap-3">
                      <button 
                        className="btn btn-danger btn-lg mr-3" 
                        onClick={() => handleAction(selectedAgent.id, 'reject')}
                        disabled={!rejectionReason || !!processingId}
                      >
                        Confirm Rejection
                      </button>
                      <button 
                        className="btn btn-secondary btn-lg" 
                        onClick={() => setShowRejectionInput(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <div className="modal-footer pd-20">
                <button className="btn-fill-lmd radius-4 text-light bg-light-sea-green" style={{ border: 'none' }} onClick={() => setSelectedAgent(null)}>Close</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
