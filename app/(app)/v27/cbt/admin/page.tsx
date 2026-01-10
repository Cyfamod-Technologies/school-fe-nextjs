'use client';

import React, { useState, useEffect } from 'react';
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
}

export default function AdminDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'draft' | 'published' | 'closed'>('all');

  useEffect(() => {
    if (user) {
      loadQuizzes();
    }
  }, [user]);

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

  const handlePublish = async (quizId: string) => {
    try {
      await apiFetch(`/api/v1/cbt/quizzes/${quizId}/publish`, {
        method: 'POST',
      });
      loadQuizzes(); // Reload quizzes
    } catch (err: any) {
      console.error('Error publishing quiz:', err);
    }
  };

  const handleDelete = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;

    try {
      await apiFetch(`/api/v1/cbt/quizzes/${quizId}`, {
        method: 'DELETE',
      });
      loadQuizzes(); // Reload quizzes
    } catch (err: any) {
      console.error('Error deleting quiz:', err);
    }
  };

  const getFilteredQuizzes = () => {
    if (filterStatus === 'all') return quizzes;
    return quizzes.filter((q) => q.status === filterStatus);
  };

  const filteredQuizzes = getFilteredQuizzes();
  const stats = {
    total: quizzes.length,
    draft: quizzes.filter((q) => q.status === 'draft').length,
    published: quizzes.filter((q) => q.status === 'published').length,
    closed: quizzes.filter((q) => q.status === 'closed').length,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8 flex justify-between items-center">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Quiz Management</h1>
          <p className="text-gray-600">Create, edit, and manage all quizzes</p>
        </div>
        <button
          onClick={() => router.push('/v27/cbt/admin/create')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-lg transition-colors flex items-center gap-2"
        >
          + Create New Quiz
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-gray-600 text-sm font-medium">Total Quizzes</div>
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-yellow-600 text-sm font-medium">Draft</div>
          <div className="text-3xl font-bold text-yellow-600">{stats.draft}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-green-600 text-sm font-medium">Published</div>
          <div className="text-3xl font-bold text-green-600">{stats.published}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <div className="text-red-600 text-sm font-medium">Closed</div>
          <div className="text-3xl font-bold text-red-600">{stats.closed}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-4 mb-6">
        {(['all', 'draft', 'published', 'closed'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilterStatus(status)}
            className={`px-6 py-2 rounded-lg font-medium transition-all ${
              filterStatus === status
                ? 'bg-indigo-600 text-white shadow-lg'
                : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)} ({
            status === 'all' ? stats.total : stats[status as keyof typeof stats]
            })
          </button>
        ))}
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
      )}

      {/* Quizzes Table */}
      {filteredQuizzes.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-lg">
          <div className="text-6xl mb-4">📚</div>
          <p className="text-gray-500 text-lg mb-6">No quizzes found</p>
          <button
            onClick={() => router.push('/v27/cbt/admin/create')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-2 px-6 rounded-lg transition-colors"
          >
            Create First Quiz
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto bg-white rounded-lg shadow">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Title</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Duration</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Questions</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Pass Score</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Status</th>
                <th className="px-6 py-3 text-left text-sm font-semibold text-gray-900">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredQuizzes.map((quiz) => (
                <tr key={quiz.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4 text-sm">
                    <div className="font-medium text-gray-900">{quiz.title}</div>
                    <div className="text-gray-500 text-xs mt-1">{quiz.description}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900">{quiz.duration_minutes} min</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{quiz.total_questions}</td>
                  <td className="px-6 py-4 text-sm text-gray-900">{quiz.passing_score}%</td>
                  <td className="px-6 py-4 text-sm">
                    <span
                      className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${
                        quiz.status === 'published'
                          ? 'bg-green-100 text-green-800'
                          : quiz.status === 'draft'
                            ? 'bg-yellow-100 text-yellow-800'
                            : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {quiz.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/v27/cbt/admin/${quiz.id}/edit`)}
                        className="text-indigo-600 hover:text-indigo-700 font-medium"
                      >
                        Edit
                      </button>
                      {quiz.status === 'draft' && (
                        <button
                          onClick={() => handlePublish(quiz.id)}
                          className="text-green-600 hover:text-green-700 font-medium"
                        >
                          Publish
                        </button>
                      )}
                      <button
                        onClick={() => handleDelete(quiz.id)}
                        className="text-red-600 hover:text-red-700 font-medium"
                      >
                        Delete
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
  );
}
