'use client';

import React, { useState, useEffect } from 'react';
import { subscriptionApi } from '@/lib/agents';

interface Invoice {
  id: string;
  invoice_type: string;
  amount_due: number;
  amount_paid: number;
  payment_status: string;
  due_date?: string;
}

interface Term {
  id: string;
  name: string;
  start_date: string;
  end_date: string;
  payment_status: string;
  amount_due: number;
  amount_paid: number;
  outstanding_balance: number;
  invoices: Invoice[];
}

export default function SubscriptionPage() {
  const [terms, setTerms] = useState<Term[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedTerm, setExpandedTerm] = useState<string | null>(null);
  const [recentPayment, setRecentPayment] = useState<{
    term?: string;
    amount?: number;
  } | null>(null);

  const fetchTerms = async () => {
    try {
      const response = await subscriptionApi.getSchoolTerms();
      if (response.ok) {
        const data = await response.json();
        setTerms(data.terms || []);
      } else {
        setError('Failed to load terms');
      }
    } catch (err) {
      setError('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTerms();
  }, []);

  const handleSwitchTerm = async (termId: string) => {
    const term = terms.find((t) => t.id === termId);
    if (!term) return;

    if (term.outstanding_balance > 0) {
      const message = `You have an outstanding balance of ₦${(
        term.outstanding_balance / 1000
      ).toFixed(1)}k. Please pay all fees before switching terms.`;
      alert(message);
      return;
    }

    try {
      const response = await subscriptionApi.switchTerm(termId);
      if (response.ok) {
        alert('Successfully switched to this term!');
        fetchTerms();
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to switch term');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  const handleSendReminder = async (termId: string) => {
    try {
      const response = await subscriptionApi.sendPaymentReminder(termId);
      if (response.ok) {
        alert('Payment reminder has been sent to all students!');
      } else {
        setError('Failed to send reminder');
      }
    } catch (err) {
      setError('An error occurred');
    }
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'text-green-600 bg-green-50';
      case 'partial':
        return 'text-yellow-600 bg-yellow-50';
      case 'unpaid':
        return 'text-red-600 bg-red-50';
      default:
        return 'text-gray-600 bg-gray-50';
    }
  };

  const getPaymentBadge = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'partial':
        return 'bg-yellow-100 text-yellow-800';
      case 'unpaid':
        return 'bg-red-100 text-red-800';
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

  const calculatePaymentPercentage = (paid: number, due: number) => {
    if (due === 0) return 0;
    return Math.round((paid / due) * 100);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading subscription details...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Subscription</h1>
          <p className="text-gray-600">
            Manage your school subscription and term payments
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {recentPayment && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-md">
            <p className="text-green-800">
              ✓ Payment of ₦{(recentPayment.amount! / 1000).toFixed(1)}k recorded for {recentPayment.term}
            </p>
          </div>
        )}

        {/* Terms List */}
        <div className="space-y-4">
          {terms.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <p className="text-gray-600">No terms available</p>
            </div>
          ) : (
            terms.map((term) => (
              <div
                key={term.id}
                className="bg-white rounded-lg shadow overflow-hidden"
              >
                {/* Term Header */}
                <div
                  className="p-6 cursor-pointer hover:bg-gray-50 transition"
                  onClick={() =>
                    setExpandedTerm(
                      expandedTerm === term.id ? null : term.id
                    )
                  }
                >
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-xl font-bold text-gray-900">
                          {term.name}
                        </h3>
                        <span
                          className={`px-3 py-1 rounded-full text-xs font-semibold ${getPaymentBadge(
                            term.payment_status
                          )}`}
                        >
                          {term.payment_status?.charAt(0).toUpperCase() +
                            term.payment_status?.slice(1)}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">
                        {formatDate(term.start_date)} to {formatDate(term.end_date)}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-3xl font-bold text-gray-900 mb-1">
                        {calculatePaymentPercentage(term.amount_paid, term.amount_due)}%
                      </div>
                      <p className="text-sm text-gray-600">Complete</p>
                    </div>
                    <div className="text-2xl">
                      {expandedTerm === term.id ? '▼' : '▶'}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-4 bg-gray-200 rounded-full h-3 overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        term.payment_status?.toLowerCase() === 'paid'
                          ? 'bg-green-500'
                          : term.payment_status?.toLowerCase() === 'partial'
                          ? 'bg-yellow-500'
                          : 'bg-red-500'
                      }`}
                      style={{
                        width: `${calculatePaymentPercentage(
                          term.amount_paid,
                          term.amount_due
                        )}%`,
                      }}
                    ></div>
                  </div>

                  {/* Summary Stats */}
                  <div className="mt-4 grid grid-cols-3 gap-4">
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Amount Due</p>
                      <p className="text-lg font-semibold text-gray-900">
                        ₦{(term.amount_due / 1000).toFixed(1)}k
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Amount Paid</p>
                      <p className="text-lg font-semibold text-green-600">
                        ₦{(term.amount_paid / 1000).toFixed(1)}k
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-600 mb-1">Outstanding</p>
                      <p
                        className={`text-lg font-semibold ${
                          term.outstanding_balance > 0
                            ? 'text-red-600'
                            : 'text-green-600'
                        }`}
                      >
                        ₦{(term.outstanding_balance / 1000).toFixed(1)}k
                      </p>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                {expandedTerm === term.id && (
                  <div className="border-t border-gray-200 p-6 bg-gray-50">
                    {/* Invoices */}
                    <div className="mb-6">
                      <h4 className="font-semibold text-gray-900 mb-4">
                        Invoices
                      </h4>
                      <div className="space-y-3">
                        {term.invoices?.map((invoice) => (
                          <div
                            key={invoice.id}
                            className="bg-white rounded-lg p-4"
                          >
                            <div className="flex items-center justify-between gap-4">
                              <div className="flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <p className="font-medium text-gray-900">
                                    {invoice.invoice_type === 'original'
                                      ? 'Original Invoice'
                                      : 'Mid-term Addition'}
                                  </p>
                                  <span
                                    className={`px-2 py-1 rounded text-xs font-semibold ${getPaymentBadge(
                                      invoice.payment_status
                                    )}`}
                                  >
                                    {invoice.payment_status}
                                  </span>
                                </div>
                                <p className="text-sm text-gray-600">
                                  Due: {formatDate(invoice.due_date || '')}
                                </p>
                              </div>
                              <div className="text-right">
                                <p className="font-semibold text-gray-900">
                                  ₦{(invoice.amount_due / 1000).toFixed(1)}k
                                </p>
                                <p className="text-xs text-gray-600">
                                  Paid: ₦{(invoice.amount_paid / 1000).toFixed(1)}k
                                </p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-3">
                      {term.outstanding_balance > 0 && (
                        <div className="flex-1 p-4 bg-red-50 border border-red-200 rounded-lg">
                          <p className="text-red-800 text-sm font-medium mb-2">
                            📌 Cannot switch term yet
                          </p>
                          <p className="text-red-700 text-xs">
                            You have ₦{(term.outstanding_balance / 1000).toFixed(1)}k
                            outstanding. Complete payment before switching terms.
                          </p>
                        </div>
                      )}
                      {term.outstanding_balance === 0 && (
                        <button
                          onClick={() => handleSwitchTerm(term.id)}
                          className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 transition"
                        >
                          ✓ Switch to {term.name}
                        </button>
                      )}
                      <button
                        onClick={() => handleSendReminder(term.id)}
                        className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300 transition"
                      >
                        Send Reminder
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Info Section */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
          <h3 className="font-semibold text-blue-900 mb-2">
            How School Subscription Works
          </h3>
          <ul className="text-blue-800 text-sm space-y-1">
            <li>
              • <strong>Per-Student Billing:</strong> You're charged based on the
              number of students in your school per term
            </li>
            <li>
              • <strong>Term Switching:</strong> All fees must be paid before
              switching to a new term
            </li>
            <li>
              • <strong>Mid-term Additions:</strong> New students admitted during
              a term are billed separately at a prorated rate
            </li>
            <li>
              • <strong>Payment Tracking:</strong> Monitor all payments and
              invoices in real-time
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
