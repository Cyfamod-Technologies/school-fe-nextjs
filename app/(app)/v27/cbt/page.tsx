'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiClient';

interface Quiz {
  id: string;
  title: string;
  description: string;
  subject_id: string;
  class_id: string;
  duration_minutes: number;
  total_questions: number;
  passing_score: number;
  status: 'draft' | 'published' | 'closed';
  start_time: string;
  end_time: string;
  attempted?: boolean;
}

export default function CBTHome() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'available' | 'attempted'>('available');

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      router.push('/login');
      return;
    }

    loadQuizzes();
  }, [authLoading, user]);

  const loadQuizzes = async () => {
    try {
      setLoading(true);
      const response = await apiFetch<{ data: Quiz[] }>('/api/v1/cbt/quizzes');
      setQuizzes(response.data || []);
      setError(null);
    } catch (err: any) {
      setError(err.message || 'Failed to load quizzes');
      console.error('Error loading quizzes:', err);
    } finally {
      setLoading(false);
    }
  };

  const getFilteredQuizzes = () => {
    switch (filterStatus) {
      case 'attempted':
        return quizzes.filter((q) => q.attempted);
      case 'available':
        return quizzes.filter((q) => q.status === 'published' && !q.attempted);
      default:
        return quizzes;
    }
  };

  const handleStartQuiz = (quizId: string) => {
    router.push(`/v27/cbt/${quizId}/take`);
  };

  const handleViewResults = (quizId: string) => {
    router.push(`/v27/cbt/${quizId}`);
  };

  const filteredQuizzes = getFilteredQuizzes();

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Computer-Based Tests</h1>
        <p className="text-gray-600">Manage and take your quizzes online</p>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setFilterStatus('available')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            filterStatus === 'available'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Available ({quizzes.filter((q) => q.status === 'published' && !q.attempted).length})
        </button>
        <button
          onClick={() => setFilterStatus('attempted')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            filterStatus === 'attempted'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          Attempted ({quizzes.filter((q) => q.attempted).length})
        </button>
        <button
          onClick={() => setFilterStatus('all')}
          className={`px-6 py-2 rounded-lg font-medium transition-all ${
            filterStatus === 'all'
              ? 'bg-indigo-600 text-white shadow-lg'
              : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
          }`}
        >
          All Quizzes ({quizzes.length})
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Quizzes Grid */}
      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-gray-500 text-lg">No quizzes available</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredQuizzes.map((quiz) => (
            <div
              key={quiz.id}
              className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-6 border-l-4 border-indigo-500"
            >
              <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900 mb-2">{quiz.title}</h2>
                <p className="text-gray-600 text-sm">{quiz.description}</p>
              </div>

              {/* Quiz Details */}
              <div className="grid grid-cols-2 gap-4 mb-4 py-4 border-y border-gray-200">
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Duration</div>
                  <div className="text-lg font-semibold text-gray-900">
                    {quiz.duration_minutes}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Questions</div>
                  <div className="text-lg font-semibold text-gray-900">{quiz.total_questions}</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Pass Score</div>
                  <div className="text-lg font-semibold text-gray-900">{quiz.passing_score}%</div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 uppercase tracking-wide">Status</div>
                  <div className="text-lg font-semibold">
                    <span
                      className={`inline-block px-2 py-1 rounded text-xs font-bold ${
                        quiz.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : quiz.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {quiz.status}
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3">
                {quiz.attempted ? (
                  <button
                    onClick={() => handleViewResults(quiz.id)}
                    className="flex-1 bg-gray-600 hover:bg-gray-700 text-white font-medium py-2 rounded-lg transition-colors"
                  >
                    View Results
                  </button>
                ) : quiz.status === 'published' ? (
                  <button
                    onClick={() => handleStartQuiz(quiz.id)}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 rounded-lg transition-colors"
                  >
                    Start Quiz
                  </button>
                ) : (
                  <button
                    disabled
                    className="flex-1 bg-gray-300 text-gray-500 font-medium py-2 rounded-lg cursor-not-allowed"
                  >
                    Unavailable
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
