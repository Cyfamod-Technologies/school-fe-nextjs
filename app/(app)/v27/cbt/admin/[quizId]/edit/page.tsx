'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiClient';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  subject_name?: string | null;
  class_id: string | null;
  duration_minutes: number;
  total_questions: number;
  passing_score: number;
  start_time: string | null;
  end_time: string | null;
  status: 'draft' | 'published' | 'closed';
  show_answers: boolean;
  show_score: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_review: boolean;
  allow_multiple_attempts: boolean;
  max_attempts: number;
}

interface Subject {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
}

interface SubjectAssignment {
  id: string;
  subject?: Subject | null;
  school_class_id: string;
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
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const toInputDateTime = (value?: string | null) => {
    if (!value) {
      return '';
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      const normalized = new Date(value.replace(' ', 'T'));
      if (Number.isNaN(normalized.getTime())) {
        return '';
      }
      const local = new Date(normalized.getTime() - normalized.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    }
    const local = new Date(parsed.getTime() - parsed.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
  };

  const normalizeDateTime = (value: string | null) => {
    if (!value) {
      return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
      return null;
    }
    return parsed.toISOString();
  };

  const formatScheduleValue = (value: string) => {
    const [datePart, timePart] = value.split('T');
    if (!datePart || !timePart) {
      return value;
    }
    const [year, month, day] = datePart.split('-').map(Number);
    const [hour, minute] = timePart.split(':').map(Number);
    if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
      return value;
    }
    const date = new Date(year, month - 1, day, hour, minute);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    const suffix = (() => {
      if (day % 100 >= 11 && day % 100 <= 13) {
        return 'th';
      }
      switch (day % 10) {
        case 1:
          return 'st';
        case 2:
          return 'nd';
        case 3:
          return 'rd';
        default:
          return 'th';
      }
    })();
    const monthLabel = date.toLocaleString('en-US', { month: 'short' });
    const timeLabel = date
      .toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })
      .toLowerCase()
      .replace(' ', '');
    return `${day}${suffix} ${monthLabel} ${year} ${timeLabel}`;
  };

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

        const [quizRes, questionsRes, classesRes] = await Promise.allSettled([
          apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}`),
          apiFetch<{ data: { id: string }[] }>(
            `/api/v1/cbt/quizzes/${quizId}/questions?include_correct=1`,
          ),
          apiFetch<{ data: Class[] }>('/api/v1/classes'),
        ]);

        if (quizRes.status !== 'fulfilled') {
          throw quizRes.reason;
        }

        const nextQuestionCount =
          questionsRes.status === 'fulfilled' ? (questionsRes.value.data || []).length : 0;
        const loadedQuiz = {
          ...quizRes.value.data,
          show_score: quizRes.value.data.show_score ?? true,
          max_attempts: quizRes.value.data.max_attempts ?? 1,
          total_questions: nextQuestionCount,
          start_time: toInputDateTime(quizRes.value.data.start_time),
          end_time: toInputDateTime(quizRes.value.data.end_time),
        };
        setQuiz(loadedQuiz);
        setQuizForm(loadedQuiz);
        setQuestionCount(nextQuestionCount);
        setClasses(
          classesRes.status === 'fulfilled'
            ? Array.isArray(classesRes.value)
              ? classesRes.value
              : classesRes.value.data || []
            : [],
        );

        if (classesRes.status !== 'fulfilled') {
          setError('Some quiz options could not be loaded. Check permissions for classes.');
        }
      } catch (err: any) {
        setError(err.message || 'Failed to load quiz data');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, user, quizId]);

  useEffect(() => {
    if (!quizForm?.class_id) {
      setSubjects([]);
      setSubjectsError(null);
      return;
    }

    let cancelled = false;

    const loadSubjectsForClass = async () => {
      try {
        setSubjectsLoading(true);
        setSubjectsError(null);

        const response = await apiFetch<{ data: SubjectAssignment[] }>(
          `/api/v1/settings/subject-assignments?school_class_id=${quizForm.class_id}&per_page=500`,
        );
        const assignments = Array.isArray(response) ? response : response.data || [];
        const deduped = new Map<string, Subject>();

        assignments.forEach((assignment) => {
          if (assignment.subject?.id) {
            deduped.set(assignment.subject.id, assignment.subject);
          }
        });

        const nextSubjects = Array.from(deduped.values());
        if (!cancelled) {
          setSubjects(nextSubjects);
          setQuizForm((prev) => {
            if (!prev) {
              return prev;
            }
            if (prev.subject_id && !nextSubjects.some((subject) => subject.id === prev.subject_id)) {
              return { ...prev, subject_id: null };
            }
            return prev;
          });
        }
      } catch (err: any) {
        if (!cancelled) {
          setSubjects([]);
          setSubjectsError(err.message || 'Failed to load subjects for the selected class.');
        }
      } finally {
        if (!cancelled) {
          setSubjectsLoading(false);
        }
      }
    };

    loadSubjectsForClass();

    return () => {
      cancelled = true;
    };
  }, [quizForm?.class_id]);

  const saveQuiz = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!quizForm) return;

    if (!quizForm.class_id) {
      setError('Class is required.');
      return;
    }

    if (!quizForm.subject_id) {
      setError('Subject is required.');
      return;
    }

    if (quizForm.allow_multiple_attempts && quizForm.max_attempts < 1) {
      setError('Max attempts must be at least 1.');
      return;
    }

    if (quizForm.start_time && quizForm.end_time && quizForm.end_time < quizForm.start_time) {
      setError('End time must be after the start time.');
      return;
    }

    try {
      setSavingQuiz(true);
      setError(null);
      setSuccess(null);

      const payload = {
        title: quizForm.title,
        description: quizForm.description,
        subject_id: quizForm.subject_id || null,
        class_id: quizForm.class_id || null,
        duration_minutes: quizForm.duration_minutes,
        passing_score: quizForm.passing_score,
        start_time: normalizeDateTime(quizForm.start_time),
        end_time: normalizeDateTime(quizForm.end_time),
        show_answers: quizForm.show_answers,
        show_score: quizForm.show_score,
        shuffle_questions: quizForm.shuffle_questions,
        shuffle_options: quizForm.shuffle_options,
        allow_review: quizForm.allow_review,
        allow_multiple_attempts: quizForm.allow_multiple_attempts,
        max_attempts: quizForm.allow_multiple_attempts ? quizForm.max_attempts : 1,
      };

      const response = await apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}`, {
        method: 'PUT',
        body: JSON.stringify(payload),
      });
      const refreshed = {
        ...response.data,
        start_time: toInputDateTime(response.data.start_time),
        end_time: toInputDateTime(response.data.end_time),
      };
      setQuiz(refreshed);
      setQuizForm(refreshed);
      setSuccess('Quiz settings saved.');
    } catch (err: any) {
      setError(err.message || 'Failed to save quiz settings');
    } finally {
      setSavingQuiz(false);
    }
  };

  const publishQuiz = async () => {
    try {
      if (questionCount === 0) {
        setError('Add at least one question before publishing.');
        return;
      }

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

  const selectedSubject =
    subjects.find((subject) => subject.id === quizForm.subject_id)?.name ||
    quizForm.subject_name ||
    'Not selected';
  const selectedClass = quizForm.class_id
    ? classes.find((cls) => cls.id === quizForm.class_id)?.name || 'Selected class'
    : 'All classes';
  const missingSubjectOption =
    quizForm.subject_id && !subjects.some((subject) => subject.id === quizForm.subject_id);
  const missingClassOption =
    quizForm.class_id && !classes.some((cls) => cls.id === quizForm.class_id);

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

                  <div className="col-md-6 col-12 form-group">
                    <label>Class *</label>
                    <select
                      value={quizForm.class_id || ''}
                      onChange={(e) => {
                        const nextClassId = e.target.value || null;
                        setQuizForm((prev) => {
                          if (!prev) {
                            return prev;
                          }
                          return {
                            ...prev,
                            class_id: nextClassId,
                            subject_id: nextClassId === prev.class_id ? prev.subject_id : null,
                          };
                        });
                      }}
                      className="form-control"
                      required
                    >
                      <option value="">Select a class</option>
                      {missingClassOption ? (
                        <option value={quizForm.class_id || ''}>Current class (unavailable)</option>
                      ) : null}
                      {classes.map((cls) => (
                        <option key={cls.id} value={cls.id}>
                          {cls.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="col-md-6 col-12 form-group">
                    <label>Subject *</label>
                    <select
                      value={quizForm.subject_id || ''}
                      onChange={(e) =>
                        setQuizForm({ ...quizForm, subject_id: e.target.value || null })
                      }
                      className="form-control"
                      required
                      disabled={!quizForm.class_id || subjectsLoading}
                    >
                      <option value="">
                        {quizForm.class_id ? 'Select a subject' : 'Select a class first'}
                      </option>
                      {missingSubjectOption ? (
                        <option value={quizForm.subject_id || ''}>
                          {quizForm.subject_name || 'Current subject'}
                        </option>
                      ) : null}
                      {subjects.map((subject) => (
                        <option key={subject.id} value={subject.id}>
                          {subject.name}
                        </option>
                      ))}
                    </select>
                    {subjectsLoading && (
                      <small className="form-text text-muted">Loading subjects...</small>
                    )}
                    {subjectsError && (
                      <small className="form-text text-danger">{subjectsError}</small>
                    )}
                    {!subjectsLoading &&
                      quizForm.class_id &&
                      subjects.length === 0 &&
                      !subjectsError && (
                        <small className="form-text text-muted">
                          No subjects assigned to this class yet.
                        </small>
                      )}
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
                    <h3>Schedule</h3>
                  </div>
                </div>

                <div className="row gutters-20">
                  <div className="col-md-6 col-12 form-group">
                    <label>Start Time</label>
                    <input
                      type="datetime-local"
                      value={quizForm.start_time || ''}
                      onChange={(e) =>
                        setQuizForm({ ...quizForm, start_time: e.target.value || null })
                      }
                      className="form-control"
                    />
                    <small className="form-text text-muted">
                      Leave blank to allow immediate access after publishing.
                    </small>
                  </div>
                  <div className="col-md-6 col-12 form-group">
                    <label>End Time</label>
                    <input
                      type="datetime-local"
                      value={quizForm.end_time || ''}
                      onChange={(e) =>
                        setQuizForm({ ...quizForm, end_time: e.target.value || null })
                      }
                      className="form-control"
                      min={quizForm.start_time || undefined}
                    />
                    <small className="form-text text-muted">
                      Leave blank to keep the quiz open.
                    </small>
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
                        id="show_score"
                        type="checkbox"
                        checked={quizForm.show_score}
                        onChange={(e) => setQuizForm({ ...quizForm, show_score: e.target.checked })}
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="show_score">
                        Show score to students after submission
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

                  <div className="col-md-6 col-12 form-group">
                    <div className="form-check">
                      <input
                        id="take_once"
                        type="checkbox"
                        checked={!quizForm.allow_multiple_attempts}
                        onChange={(e) =>
                          setQuizForm({
                            ...quizForm,
                            allow_multiple_attempts: !e.target.checked,
                            max_attempts: e.target.checked ? 1 : quizForm.max_attempts,
                          })
                        }
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="take_once">
                        Take once only (students can attempt once)
                      </label>
                    </div>
                  </div>
                  {quizForm.allow_multiple_attempts && (
                    <div className="col-md-6 col-12 form-group">
                      <label>Max Attempts</label>
                      <input
                        type="number"
                        min="1"
                        value={quizForm.max_attempts}
                        onChange={(e) =>
                          setQuizForm({ ...quizForm, max_attempts: Number(e.target.value) })
                        }
                        className="form-control"
                        required
                      />
                      <small className="form-text text-muted">
                        Set how many times a student can attempt this quiz.
                      </small>
                    </div>
                  )}
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
                  <span>Subject</span>
                  <span className="text-dark font-weight-bold">{selectedSubject}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Class</span>
                  <span className="text-dark font-weight-bold">{selectedClass}</span>
                </li>
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
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Start</span>
                  <span className="text-dark font-weight-bold">
                    {quizForm.start_time
                      ? formatScheduleValue(quizForm.start_time)
                      : 'Immediately'}
                  </span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>End</span>
                  <span className="text-dark font-weight-bold">
                    {quizForm.end_time
                      ? formatScheduleValue(quizForm.end_time)
                      : 'No end time'}
                  </span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Attempts</span>
                  <span className="text-dark font-weight-bold">
                    {quizForm.allow_multiple_attempts ? 'Multiple' : 'Once'}
                  </span>
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
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Results</h3>
                </div>
              </div>
              <p className="text-muted mb-2">See student attempts and answers.</p>
              <button
                type="button"
                className="btn-fill-lmd radius-4 text-light bg-dark-pastel-green"
                onClick={() => router.push(`/v27/cbt/admin/${quizId}/results`)}
              >
                View Results
              </button>
            </div>
          </div>

          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-5">
            <div className="card-body bg-light-blue">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Publish</h3>
                </div>
              </div>
              <p className="text-muted">
                Publish when the quiz is ready for students. Draft quizzes remain hidden.
              </p>
              {questionCount > 0 ? (
                quiz?.status !== 'published' ? (
                  <button
                    type="button"
                    className="btn-fill-lmd radius-4 text-light bg-dark-pastel-green"
                    onClick={publishQuiz}
                    disabled={publishing}
                  >
                    {publishing ? 'Publishing...' : 'Publish Quiz'}
                  </button>
                ) : (
                  <button
                    type="button"
                    className="btn-fill-lmd radius-4 text-light bg-orange-peel mt-3"
                    onClick={unpublishQuiz}
                    disabled={publishing}
                  >
                    {publishing ? 'Updating...' : 'Unpublish Quiz'}
                  </button>
                )
              ) : (
                <p className="text-danger mt-2 mb-0">Add at least one question before publishing.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
