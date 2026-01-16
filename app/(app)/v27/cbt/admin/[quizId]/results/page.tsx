'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiClient';

interface Quiz {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'closed';
}

interface QuizResultRow {
  id: string;
  attempt_id: string;
  quiz_id: string;
  student_id: string;
  student_name: string | null;
  total_questions: number;
  attempted_questions: number;
  correct_answers: number;
  total_marks: number;
  marks_obtained: number;
  percentage: number;
  grade: string;
  status: 'pass' | 'fail';
  submitted_at: string;
  graded_at: string | null;
}

const statusBadgeClass = (status: QuizResultRow['status']) => {
  return status === 'pass' ? 'badge badge-pill badge-success' : 'badge badge-pill badge-danger';
};

export default function QuizResultsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [results, setResults] = useState<QuizResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [quizRes, resultsRes] = await Promise.all([
          apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}`),
          apiFetch<{ data: QuizResultRow[] }>(`/api/v1/cbt/quizzes/${quizId}/results`),
        ]);

        setQuiz(quizRes.data);
        setResults(resultsRes.data || []);
      } catch (err: any) {
        setError(err.message || 'Failed to load quiz results');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, user, quizId]);

  const stats = useMemo(() => {
    const total = results.length;
    const passed = results.filter((result) => result.status === 'pass').length;
    const failed = results.filter((result) => result.status === 'fail').length;
    const average =
      total > 0
        ? results.reduce((sum, result) => sum + result.percentage, 0) / total
        : 0;
    return { total, passed, failed, average: Number(average.toFixed(2)) };
  }, [results]);

  if (authLoading || loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="spinner-border text-dodger-blue" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="alert alert-info">Please log in to view quiz results.</div>
      </div>
    );
  }

  return (
    <div className="bg-ash min-vh-100">
      <div className="breadcrumbs-area quiz-fade-up">
        <h3>Quiz Results</h3>
        <ul>
          <li>
            <a href="/v27/cbt/admin">Quiz Management</a>
          </li>
          <li>Results</li>
        </ul>
      </div>

      {error && (
        <div className="alert alert-danger mg-b-20" role="alert">
          {error}
        </div>
      )}

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
                  <div className="item-title">Total Attempts</div>
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
                <div className="item-icon bg-light-green">
                  <i className="flaticon-checklist text-green"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Passed</div>
                  <div className="item-number">{stats.passed}</div>
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
                  <div className="item-title">Failed</div>
                  <div className="item-number">{stats.failed}</div>
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
                  <i className="flaticon-percentage-discount text-orange"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Average</div>
                  <div className="item-number">{stats.average}%</div>
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
              <h3>{quiz?.title || 'Quiz'} Results</h3>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/v27/cbt/admin/${quizId}/edit`)}
              className="btn-fill-lmd radius-4 text-light bg-dodger-blue"
            >
              Back to Quiz
            </button>
          </div>

          {results.length === 0 ? (
            <div className="alert alert-info" role="alert">
              No students have completed this quiz yet.
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table display data-table text-nowrap">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Score</th>
                    <th>Percentage</th>
                    <th>Grade</th>
                    <th>Status</th>
                    <th>Submitted</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((result) => (
                    <tr key={result.id}>
                      <td>
                        <div className="font-weight-bold text-dark">
                          {result.student_name || 'Unknown'}
                        </div>
                        <div className="text-muted text-sm">{result.student_id}</div>
                      </td>
                      <td>
                        {result.marks_obtained}/{result.total_marks}
                      </td>
                      <td>{result.percentage}%</td>
                      <td>{result.grade}</td>
                      <td>
                        <span className={statusBadgeClass(result.status)}>{result.status}</span>
                      </td>
                      <td>{result.submitted_at ? new Date(result.submitted_at).toLocaleString() : '—'}</td>
                      <td>
                        <button
                          type="button"
                          onClick={() =>
                            router.push(`/v27/cbt/admin/${quizId}/results/${result.attempt_id}`)
                          }
                          className="btn btn-sm btn-outline-primary"
                        >
                          View Answers
                        </button>
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
