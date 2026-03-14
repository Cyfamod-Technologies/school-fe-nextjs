'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { adminApi } from '@/lib/agents';
import { useAuth } from '@/contexts/AuthContext';
import { userHasRole } from '@/lib/roleChecks';
import { useRouter } from 'next/navigation';

interface PayoutRequest {
  id: string;
  agent_id: string;
  agent_name: string;
  amount: number;
  status: string;
  bank_account_number: string;
  bank_name: string;
  created_at: string;
  approved_at?: string;
  processed_at?: string;
}

export default function AdminPayoutsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState('pending'); // pending, approved, processing, completed
  const [processingId, setProcessingId] = useState<string | null>(null);

  useEffect(() => {
    const isAdminUser = userHasRole(user, 'super_admin') || userHasRole(user, 'admin');
    if (!authLoading && user && !isAdminUser) {
      router.replace('/v10/dashboard');
    }
  }, [user, authLoading, router]);

  const fetchPayouts = async () => {
    setLoading(true);
    try {
      const response = await adminApi.getPayouts(filter === 'all' ? undefined : filter);
      if (response.ok) {
        const data = await response.json();
        // Adjust based on actual API response structure
        const list = data.data || data.payouts || [];
        setPayouts(list);
      } else {
        setError('Failed to load payout requests.');
      }
    } catch (err) {
      setError('An error occurred while fetching payouts.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user) {
      fetchPayouts();
    }
  }, [user, filter]);

  const handleApprovePayout = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await adminApi.approvePayout(id);
      if (response.ok) {
        fetchPayouts();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to approve payout');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const handleProcessPayout = async (id: string) => {
    setProcessingId(id);
    try {
      const response = await adminApi.processPayout(id);
      if (response.ok) {
        fetchPayouts();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to mark as processing');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'pending': return 'badge-warning';
      case 'approved': return 'badge-info';
      case 'processing': return 'badge-primary';
      case 'completed': return 'badge-success';
      case 'failed': return 'badge-danger';
      default: return 'badge-secondary';
    }
  };

  const formatNaira = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  if (loading && payouts.length === 0) {
    return (
      <div className="d-flex align-items-center justify-content-center" style={{ minHeight: '400px' }}>
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Partner Program</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Payout Requests</li>
        </ul>
      </div>

      <div className="card dashboard-card-one pd-b-20 mg-b-20">
        <div className="card-body">
          <div className="heading-layout1 mg-b-17">
            <div className="item-title">
              <h3>Partner Payouts</h3>
            </div>
          </div>

          {error && <div className="alert alert-danger">{error}</div>}

          <div className="mb-4">
            <div className="btn-group" role="group">
              {['pending', 'approved', 'processing', 'completed', 'all'].map((f) => (
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
                  <th style={{ fontSize: '1.4rem' }}>Agent</th>
                  <th style={{ fontSize: '1.4rem' }}>Amount</th>
                  <th style={{ fontSize: '1.4rem' }}>Bank Details</th>
                  <th style={{ fontSize: '1.4rem' }}>Status</th>
                  <th style={{ fontSize: '1.4rem' }}>Requested</th>
                  <th style={{ fontSize: '1.4rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '1.4rem' }}>
                {payouts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-4">No {filter} payout requests found.</td>
                  </tr>
                ) : (
                  payouts.map((request) => (
                    <tr key={request.id}>
                      <td>{request.agent_name || 'N/A'}</td>
                      <td className="font-weight-bold">{formatNaira(request.amount)}</td>
                      <td>
                        <div>{request.bank_account_number}</div>
                        <div className="text-muted" style={{ fontSize: '1.1rem' }}>{request.bank_name}</div>
                      </td>
                      <td>
                        <span className={`badge ${getStatusColor(request.status)}`} style={{ padding: '8px 12px', fontWeight: 600, textTransform: 'capitalize' }}>
                          {request.status}
                        </span>
                      </td>
                      <td>{new Date(request.created_at).toLocaleDateString()}</td>
                      <td>
                        {request.status === 'pending' && (
                          <button 
                            className="btn-fill-sm text-light bg-green-600"
                            style={{ border: 'none', cursor: 'pointer', backgroundColor: '#28a745', fontSize: '1.2rem', padding: '5px 12px' }}
                            onClick={() => handleApprovePayout(request.id)}
                            disabled={!!processingId}
                          >
                            Approve
                          </button>
                        )}
                        {request.status === 'approved' && (
                          <button 
                            className="btn-fill-sm text-light bg-dodger-blue"
                            style={{ border: 'none', cursor: 'pointer', fontSize: '1.2rem', padding: '5px 12px' }}
                            onClick={() => handleProcessPayout(request.id)}
                            disabled={!!processingId}
                          >
                            Mark Processing
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
