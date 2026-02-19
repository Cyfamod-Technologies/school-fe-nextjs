'use client';

import React, { useState, useEffect } from 'react';
import { agentApi } from '@/lib/agents';

interface Referral {
  id: string;
  referral_code: string;
  referral_link: string;
  status: string;
  school_id?: string;
  first_payment_amount?: number;
  created_at: string;
}

export default function AgentReferralsPage() {
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const fetchReferrals = async () => {
    try {
      const response = await agentApi.getDashboard();
      if (response.ok) {
        const data = await response.json();
        setReferrals(data.recent_referrals || []);
      }
    } catch {
      setError('Failed to load referrals');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReferrals();
  }, []);

  const handleGenerateReferral = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneratingCode(true);
    setError(null);

    try {
      const response = await agentApi.generateReferral(customCode || undefined);
      if (response.ok) {
        const data = await response.json();
        setReferrals([data.referral, ...referrals]);
        setCustomCode('');
        setShowGenerateModal(false);
      } else {
        const data = await response.json();
        setError(data.message || 'Failed to generate referral');
      }
    } catch {
      setError('An error occurred');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleCopyLink = (link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedCode('link-' + link);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'visited':
        return 'bg-blue-100 text-blue-800';
      case 'registered':
        return 'bg-yellow-100 text-yellow-800';
      case 'paid':
        return 'bg-green-100 text-green-800';
      case 'active':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-600">Loading referrals...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8 flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Manage Referrals
            </h1>
            <p className="text-gray-600">
              Generate codes, share links, and track referrals
            </p>
          </div>
          <button
            onClick={() => setShowGenerateModal(true)}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition"
          >
            Generate New Code
          </button>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-md">
            <p className="text-red-800">{error}</p>
          </div>
        )}

        {/* Generate Modal */}
        {showGenerateModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-8 max-w-md w-full">
              <h2 className="text-2xl font-bold mb-6">Generate Referral Code</h2>
              <form onSubmit={handleGenerateReferral}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Custom Code (Optional)
                  </label>
                  <input
                    type="text"
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value)}
                    placeholder="Leave blank for auto-generated"
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-blue-500"
                  />
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={generatingCode}
                    className="flex-1 bg-blue-600 text-white py-2 rounded-lg hover:bg-blue-700 disabled:opacity-50"
                  >
                    {generatingCode ? 'Generating...' : 'Generate'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(false)}
                    className="flex-1 bg-gray-200 text-gray-800 py-2 rounded-lg hover:bg-gray-300"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Referrals Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {referrals.length === 0 ? (
            <div className="p-8 text-center text-gray-600">
              No referrals yet. Generate your first referral code to get started!
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b">
                  <tr>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Code
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Link
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      First Payment
                    </th>
                    <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {referrals.map((referral) => (
                    <tr key={referral.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <code className="bg-gray-100 px-3 py-1 rounded text-sm font-mono">
                            {referral.referral_code}
                          </code>
                          <button
                            onClick={() =>
                              handleCopyCode(referral.referral_code)
                            }
                            className="text-blue-600 hover:text-blue-700"
                          >
                            {copiedCode === referral.referral_code
                              ? '✓'
                              : 'Copy'}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <a
                            href={referral.referral_link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-600 hover:underline text-sm truncate"
                          >
                            View Link →
                          </a>
                          <button
                            onClick={() =>
                              handleCopyLink(referral.referral_link)
                            }
                            className="text-blue-600 hover:text-blue-700"
                          >
                            {copiedCode === 'link-' + referral.referral_link
                              ? '✓'
                              : 'Copy'}
                          </button>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span
                          className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor(
                            referral.status
                          )}`}
                        >
                          {referral.status}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        {referral.first_payment_amount ? (
                          <span className="text-green-600 font-semibold">
                            ₦
                            {(
                              referral.first_payment_amount / 1000
                            ).toFixed(1)}
                            k
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex gap-2">
                          <a
                            href={`/agent/referrals/${referral.id}`}
                            className="text-blue-600 hover:underline text-sm"
                          >
                            Details
                          </a>
                          <button className="text-blue-600 hover:underline text-sm">
                            Share
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Sharing Options */}
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Share Your Referral
          </h2>
          <p className="text-gray-600 mb-4">
            Share your referral link or code with schools to earn commission on
            their payments
          </p>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <button className="flex items-center justify-center gap-2 p-4 border rounded-lg hover:bg-gray-50">
              <span>📱 WhatsApp</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 border rounded-lg hover:bg-gray-50">
              <span>📧 Email</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 border rounded-lg hover:bg-gray-50">
              <span>🐦 Twitter</span>
            </button>
            <button className="flex items-center justify-center gap-2 p-4 border rounded-lg hover:bg-gray-50">
              <span>📥 Download QR</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
