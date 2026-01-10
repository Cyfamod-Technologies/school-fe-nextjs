'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiClient';

interface AttemptHistory {
  id: string;
  quiz_id: string;
  quiz_title: string;
  start_time: string;
  end_time: string;
  status: 'in_progress' | 'submitted' | 'graded';
  marks_obtained?: number;
  total_marks?: number;
  percentage?: number;
  grade?: string;
}

export default function HistoryPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [attempts, setAttempts] = useState<AttemptHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      router.push('/login');
      return;
    }

    loadHistory();
  }, [user]);

  const loadHistory = async () => {
    try {
      setLoading(true);
      const response = await apiFetch<{ data: AttemptHistory[] }>('/api/v1/cbt/quiz-attempts');
      setAttempts(response.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load history');
      console.error('Error loading history:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Quiz History</h1>
        <p className="text-gray-600">Your quiz attempts and results</p>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* History Table */}
      {attempts.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <div className="text-6xl mb-4">📋</div>
          <p className="text-gray-500 text-lg">No attempts yet</p>
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Quiz</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Started</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Score</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Grade</th>
                <th className="px-6 py-4 text-left text-sm font-semibold text-gray-900">Action</th>
              </tr>
            </thead>
            <tbody>
              {attempts.map((attempt, index) => (
                <tr key={attempt.id} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-6 py-4 text-sm text-gray-900 font-medium">{attempt.quiz_title}</td>
                  <td className="px-6 py-4 text-sm text-gray-600">
                    {new Date(attempt.start_time).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${
                        attempt.status === 'graded'
                          ? 'bg-green-100 text-green-800'
                          : attempt.status === 'submitted'
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-yellow-100 text-yellow-800'
                      }`}
                    >
                      {attempt.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">
                    {attempt.marks_obtained !== undefined && attempt.total_marks
                      ? `${attempt.marks_obtained}/${attempt.total_marks}`
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-sm font-bold">
                    {attempt.grade ? (
                      <span className="text-indigo-600">{attempt.grade}</span>
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-sm">
                    {attempt.status === 'graded' && (
                      <button
                        onClick={() => router.push(`/v27/cbt/results/${attempt.id}`)}
                        className="text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        View Results
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Back Button */}
      <div className="mt-8">
        <button
          onClick={() => router.push('/v27/cbt')}
          className="text-indigo-600 hover:text-indigo-800 font-medium"
        >
          ← Back to Quizzes
        </button>
      </div>
    </div>
  );
}
