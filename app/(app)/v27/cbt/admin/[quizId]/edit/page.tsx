'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiClient';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  duration_minutes: number;
  total_questions: number;
  passing_score: number;
  status: 'draft' | 'published' | 'closed';
  show_answers: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_review: boolean;
}

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

export default function EditQuizPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [quizForm, setQuizForm] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingQuiz, setSavingQuiz] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [questionCount, setQuestionCount] = useState(0);

  const questionMismatch = useMemo(() => {
    if (!quizForm) return false;
    return quizForm.total_questions !== questionCount;
  }, [quizForm, questionCount]);

  useEffect(() => {
    if (authLoading) return;

    if (!user) {
      return;
    }

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [quizRes, questionsRes] = await Promise.all([
          apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}`),
          apiFetch<{ data: { id: string }[] }>(
            `/api/v1/cbt/quizzes/${quizId}/questions?include_correct=1`,
          ),
        ]);

        setQuiz(quizRes.data);
        setQuizForm(quizRes.data);
        setQuestionCount((questionsRes.data || []).length);
      } catch (err: any) {
        setError(err.message || 'Failed to load quiz');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, user, quizId]);


  const saveQuiz = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quizForm) return;

    try {
      setSavingQuiz(true);
      setError(null);
      setSuccess(null);

      const payload = {
        title: quizForm.title,
        description: quizForm.description,
        duration_minutes: quizForm.duration_minutes,
        total_questions: quizForm.total_questions,
        passing_score: quizForm.passing_score,
        show_answers: quizForm.show_answers,
        shuffle_questions: quizForm.shuffle_questions,
        shuffle_options: quizForm.shuffle_options,
        allow_review: quizForm.allow_review,
      };

      const response = await apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      setQuiz(response.data);
      setQuizForm(response.data);
      setSuccess('Quiz settings saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz settings');
    } finally {
      setSavingQuiz(false);
    }
  };

  const publishQuiz = async () => {
    try {
      setPublishing(true);
      setError(null);
      const response = await apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}/publish`, {
        method: 'POST',
      });
      setQuiz(response.data);
      setQuizForm(response.data);
      setSuccess('Quiz published successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to publish quiz');
    } finally {
      setPublishing(false);
    }
  };

  const unpublishQuiz = async () => {
    try {
      setPublishing(true);
      setError(null);
      const response = await apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}/unpublish`, {
        method: 'POST',
      });
      setQuiz(response.data);
      setQuizForm(response.data);
      setSuccess('Quiz unpublished successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to unpublish quiz');
    } finally {
      setPublishing(false);
    }
  };

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
        <div className="alert alert-info">Please log in to edit a quiz.</div>
      </div>
    );
  }

  if (!quizForm) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="alert alert-danger">Quiz not found.</div>
      </div>
    );
  }

  return (
    <div className="bg-ash min-vh-100">
      <div className="breadcrumbs-area quiz-fade-up">
        <h3>Edit Quiz</h3>
        <ul>
          <li>
            <a href="/v27/cbt/admin">Quiz Management</a>
          </li>
          <li>Edit Quiz</li>
        </ul>
      </div>

      {error && (
        <div className="alert alert-danger mg-b-20" role="alert">
          {error}
        </div>
      )}

      {success && (
        <div className="alert alert-success mg-b-20" role="alert">
          {success}
        </div>
      )}

      <div className="row gutters-20">
        <div className="col-xl-8 col-12">
          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-1">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Quiz Settings</h3>
                </div>
                {quiz && <span className={statusBadgeClass(quiz.status)}>{quiz.status}</span>}
              </div>

              <form onSubmit={saveQuiz}>
                <div className="row gutters-20">
                  <div className="col-12 form-group">
                    <label>Quiz Title *</label>
                    <input
                      type="text"
                      value={quizForm.title}
                      onChange={(e) => setQuizForm({ ...quizForm, title: e.target.value })}
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="col-12 form-group">
                    <label>Description</label>
                    <textarea
                      value={quizForm.description || ''}
                      onChange={(e) => setQuizForm({ ...quizForm, description: e.target.value })}
                      className="form-control"
                      rows={3}
                    />
                  </div>

                  <div className="col-md-4 col-12 form-group">
                    <label>Duration (minutes)</label>
                    <input
                      type="number"
                      min="1"
                      value={quizForm.duration_minutes}
                      onChange={(e) =>
                        setQuizForm({ ...quizForm, duration_minutes: Number(e.target.value) })
                      }
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="col-md-4 col-12 form-group">
                    <label>Total Questions</label>
                    <input
                      type="number"
                      min="1"
                      value={quizForm.total_questions}
                      onChange={(e) =>
                        setQuizForm({ ...quizForm, total_questions: Number(e.target.value) })
                      }
                      className="form-control"
                      required
                    />
                  </div>
                  <div className="col-md-4 col-12 form-group">
                    <label>Passing Score (%)</label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={quizForm.passing_score}
                      onChange={(e) =>
                        setQuizForm({ ...quizForm, passing_score: Number(e.target.value) })
                      }
                      className="form-control"
                      required
                    />
                  </div>
                </div>

                <div className="heading-layout1 mg-t-20">
                  <div className="item-title">
                    <h3>Display Options</h3>
                  </div>
                </div>

                <div className="row gutters-20">
                  <div className="col-md-6 col-12 form-group">
                    <div className="form-check">
                      <input
                        id="show_answers"
                        type="checkbox"
                        checked={quizForm.show_answers}
                        onChange={(e) => setQuizForm({ ...quizForm, show_answers: e.target.checked })}
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="show_answers">
                        Show correct answers after submission
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6 col-12 form-group">
                    <div className="form-check">
                      <input
                        id="shuffle_questions"
                        type="checkbox"
                        checked={quizForm.shuffle_questions}
                        onChange={(e) =>
                          setQuizForm({ ...quizForm, shuffle_questions: e.target.checked })
                        }
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="shuffle_questions">
                        Shuffle questions
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6 col-12 form-group">
                    <div className="form-check">
                      <input
                        id="shuffle_options"
                        type="checkbox"
                        checked={quizForm.shuffle_options}
                        onChange={(e) =>
                          setQuizForm({ ...quizForm, shuffle_options: e.target.checked })
                        }
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="shuffle_options">
                        Shuffle options
                      </label>
                    </div>
                  </div>
                  <div className="col-md-6 col-12 form-group">
                    <div className="form-check">
                      <input
                        id="allow_review"
                        type="checkbox"
                        checked={quizForm.allow_review}
                        onChange={(e) => setQuizForm({ ...quizForm, allow_review: e.target.checked })}
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="allow_review">
                        Allow students to review answers
                      </label>
                    </div>
                  </div>
                </div>

                {questionMismatch && (
                  <div className="alert alert-warning mg-b-20" role="alert">
                    Total questions is {quizForm.total_questions}, but you have {questionCount}{' '}
                    configured.
                  </div>
                )}

                <div className="row gutters-20 mg-t-10">
                  <div className="col-md-6 col-12 form-group">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="btn-fill-lmd radius-4 text-dodger-blue border-dodger-blue bg-light"
                    >
                      Back
                    </button>
                  </div>
                  <div className="col-md-6 col-12 form-group d-flex justify-content-end">
                    <button
                      type="submit"
                      disabled={savingQuiz}
                      className="fw-btn-fill btn-gradient-yellow"
                    >
                      {savingQuiz ? 'Saving...' : 'Save Settings'}
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>

        </div>

        <div className="col-xl-4 col-12">
          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-2">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Summary</h3>
                </div>
              </div>
              <ul className="list-unstyled">
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Status</span>
                  <span className="text-dark font-weight-bold">{quiz?.status}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Configured Questions</span>
                  <span className="text-dark font-weight-bold">{questionCount}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Passing Score</span>
                  <span className="text-dark font-weight-bold">{quizForm.passing_score}%</span>
                </li>
                <li className="d-flex justify-content-between align-items-center">
                  <span>Duration</span>
                  <span className="text-dark font-weight-bold">{quizForm.duration_minutes} min</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-3">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Questions</h3>
                </div>
              </div>
              <p className="text-muted mb-2">Manage and review the quiz questions.</p>
              <div className="d-flex justify-content-between align-items-center mb-3">
                <span>Total</span>
                <span className="text-dark font-weight-bold">{questionCount}</span>
              </div>
              <button
                type="button"
                className="btn-fill-lmd radius-4 text-light btn-gradient-yellow"
                onClick={() => router.push(`/v27/cbt/admin/${quizId}/questions`)}
              >
                Manage Questions
              </button>
            </div>
          </div>

          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-4">
            <div className="card-body bg-light-blue">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Publish</h3>
                </div>
              </div>
              <p className="text-muted">
                Publish when the quiz is ready for students. Draft quizzes remain hidden.
              </p>
              <button
                type="button"
                className="btn-fill-lmd radius-4 text-light bg-dark-pastel-green"
                onClick={publishQuiz}
                disabled={publishing || questionCount === 0 || quiz?.status === 'published'}
              >
                {publishing ? 'Publishing...' : 'Publish Quiz'}
              </button>
              {quiz?.status === 'published' && (
                <button
                  type="button"
                  className="btn-fill-lmd radius-4 text-light bg-orange-peel mt-3"
                  onClick={unpublishQuiz}
                  disabled={publishing}
                >
                  {publishing ? 'Updating...' : 'Unpublish Quiz'}
                </button>
              )}
              {questionCount === 0 && (
                <p className="text-danger mt-2 mb-0">Add at least one question before publishing.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
