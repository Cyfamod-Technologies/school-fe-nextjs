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

const filterThemes: Record<
  'all' | 'draft' | 'published' | 'closed',
  { active: string; inactive: string }
> = {
  all: {
    active: 'bg-dodger-blue text-light',
    inactive: 'border-dodger-blue text-dodger-blue',
  },
  draft: {
    active: 'bg-orange-peel text-light',
    inactive: 'border-orange-peel text-orange-peel',
  },
  published: {
    active: 'bg-dark-pastel-green text-light',
    inactive: 'border-dark-pastel-green text-dark-pastel-green',
  },
  closed: {
    active: 'bg-red text-light',
    inactive: 'border-red text-red',
  },
};

const statusBadgeClass = (status: Quiz['status']) => {
  switch (status) {
    case 'published':
      return 'badge badge-pill badge-success';
    case 'draft':
      return 'badge badge-pill badge-warning';
    default:
      return 'badge badge-pill badge-danger';
  }
};

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
      loadQuizzes();
    } catch (err: any) {
      console.error('Error publishing quiz:', err);
    }
  };

  const handleUnpublish = async (quizId: string) => {
    try {
      await apiFetch(`/api/v1/cbt/quizzes/${quizId}/unpublish`, {
        method: 'POST',
      });
      loadQuizzes();
    } catch (err: any) {
      console.error('Error unpublishing quiz:', err);
    }
  };

  const handleDelete = async (quizId: string) => {
    if (!confirm('Are you sure you want to delete this quiz?')) return;

    try {
      await apiFetch(`/api/v1/cbt/quizzes/${quizId}`, {
        method: 'DELETE',
      });
      loadQuizzes();
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
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="spinner-border text-dodger-blue" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ash min-vh-100">
      <div className="breadcrumbs-area quiz-fade-up">
        <h3>Quiz Management</h3>
        <ul>
          <li>
            <a href="/v27/cbt">CBT</a>
          </li>
          <li>Quiz Management</li>
        </ul>
      </div>

      <div className="row gutters-20 quiz-fade-up quiz-fade-up-delay-1">
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-6">
                <div className="item-icon bg-light-blue">
                  <i className="flaticon-open-book text-blue"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Total Quizzes</div>
                  <div className="item-number">{stats.total}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-6">
                <div className="item-icon bg-light-yellow">
                  <i className="flaticon-script text-orange"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Draft</div>
                  <div className="item-number">{stats.draft}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-6">
                <div className="item-icon bg-light-green">
                  <i className="flaticon-checklist text-green"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Published</div>
                  <div className="item-number">{stats.published}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-6">
                <div className="item-icon bg-light-red">
                  <i className="flaticon-turn-off text-red"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Closed</div>
                  <div className="item-number">{stats.closed}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card height-auto quiz-fade-up quiz-fade-up-delay-2">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>All Quizzes</h3>
            </div>
            <button
              type="button"
              onClick={() => router.push('/v27/cbt/admin/create')}
              className="btn-fill-lmd radius-4 text-light btn-gradient-yellow"
            >
              + Create New Quiz
            </button>
          </div>

          <div className="d-flex flex-wrap align-items-center mg-b-20">
            {(['all', 'draft', 'published', 'closed'] as const).map((status) => {
              const theme = filterThemes[status];
              return (
                <button
                  type="button"
                  key={status}
                  onClick={() => setFilterStatus(status)}
                  className={`btn-fill-md radius-4 mg-r-10 mg-b-10 ${
                    filterStatus === status ? theme.active : theme.inactive
                  }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)} (
                  {status === 'all' ? stats.total : stats[status as keyof typeof stats]})
                </button>
              );
            })}
          </div>

          {error && (
            <div className="alert alert-danger mg-b-20" role="alert">
              {error}
            </div>
          )}

          {filteredQuizzes.length === 0 ? (
            <div className="alert alert-info" role="alert">
              <div className="d-flex flex-column flex-sm-row align-items-sm-center justify-content-between">
                <span>No quizzes found for this filter.</span>
                <button
                  type="button"
                  onClick={() => router.push('/v27/cbt/admin/create')}
                  className="btn-fill-lmd radius-4 text-light btn-gradient-yellow mg-t-10"
                >
                  Create First Quiz
                </button>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table display data-table text-nowrap">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Duration</th>
                    <th>Questions</th>
                    <th>Pass Score</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuizzes.map((quiz) => (
                    <tr key={quiz.id}>
                      <td>
                        <div className="font-weight-bold text-dark">{quiz.title}</div>
                        <div className="text-dark-low">{quiz.description}</div>
                      </td>
                      <td>{quiz.duration_minutes} min</td>
                      <td>{quiz.total_questions}</td>
                      <td>{quiz.passing_score}%</td>
                      <td>
                        <span className={statusBadgeClass(quiz.status)}>{quiz.status}</span>
                      </td>
                      <td>
                        <div className="d-flex flex-wrap">
                          {/* <button
                            type="button"
                            onClick={() => router.push(`/v27/cbt/admin/${quiz.id}/questions`)}
                            className="btn-fill-sm radius-4 text-light bg-light-blue mg-r-8 mg-b-8"
                          >
                            Questions
                          </button> */}
                          <button
                            type="button"
                            onClick={() => router.push(`/v27/cbt/admin/${quiz.id}/results`)}
                            className="btn-fill-sm radius-4 text-light bg-dark-pastel-green mg-r-8 mg-b-8"
                          >
                            Results
                          </button>
                          <button
                            type="button"
                            onClick={() => router.push(`/v27/cbt/admin/${quiz.id}/edit`)}
                            className="btn-fill-sm radius-4 text-light bg-dodger-blue mg-r-8 mg-b-8"
                          >
                            Edit
                          </button>
                          {quiz.status === 'draft' && (
                            <button
                              type="button"
                              onClick={() => handlePublish(quiz.id)}
                              className="btn-fill-sm radius-4 text-light bg-dark-pastel-green mg-r-8 mg-b-8"
                            >
                              Publish
                            </button>
                          )}
                          {quiz.status === 'published' && (
                            <button
                              type="button"
                              onClick={() => handleUnpublish(quiz.id)}
                              className="btn-fill-sm radius-4 text-light bg-orange-peel mg-r-8 mg-b-8"
                            >
                              Unpublish
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => handleDelete(quiz.id)}
                            className="btn-fill-sm radius-4 text-light bg-red mg-b-8"
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
      </div>
    </div>
  );
}
