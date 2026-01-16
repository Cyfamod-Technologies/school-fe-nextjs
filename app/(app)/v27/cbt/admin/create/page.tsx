'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiClient';

interface QuizFormData {
  title: string;
  description: string;
  duration_minutes: number;
  total_questions: number;
  passing_score: number;
  subject_id: string;
  class_id: string;
  show_answers: boolean;
  show_score: boolean;
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_review: boolean;
  allow_multiple_attempts: boolean;
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

export default function CreateQuizPage() {
  const router = useRouter();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classes, setClasses] = useState<Class[]>([]);
  const [loadingData, setLoadingData] = useState(true);
  const [subjectsLoading, setSubjectsLoading] = useState(false);
  const [subjectsError, setSubjectsError] = useState<string | null>(null);

  const [formData, setFormData] = useState<QuizFormData>({
    title: '',
    description: '',
    duration_minutes: 30,
    total_questions: 10,
    passing_score: 50,
    subject_id: '',
    class_id: '',
    show_answers: true,
    show_score: true,
    shuffle_questions: false,
    shuffle_options: false,
    allow_review: true,
    allow_multiple_attempts: true,
  });

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);
        const classesRes = await apiFetch<{ data: Class[] }>('/api/v1/classes');
        setClasses(Array.isArray(classesRes) ? classesRes : classesRes.data || []);
        setError(null);
      } catch (err: any) {
        setError('Failed to load classes');
        console.error('Error loading data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  useEffect(() => {
    if (!formData.class_id) {
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
          `/api/v1/settings/subject-assignments?school_class_id=${formData.class_id}&per_page=500`,
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
          setFormData((prev) => {
            if (!prev.subject_id) {
              return prev;
            }
            if (!nextSubjects.some((subject) => subject.id === prev.subject_id)) {
              return { ...prev, subject_id: '' };
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
  }, [formData.class_id]);

  const handleInputChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>,
  ) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : type === 'number'
            ? value === ''
              ? prev[name as keyof QuizFormData]
              : Number.isFinite(Number(value))
                ? Number(value)
                : prev[name as keyof QuizFormData]
            : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('Quiz title is required');
      return;
    }

    if (!formData.class_id) {
      setError('Class is required');
      return;
    }

    if (!formData.subject_id) {
      setError('Subject is required');
      return;
    }

    if (formData.duration_minutes < 1) {
      setError('Duration must be at least 1 minute');
      return;
    }

    if (formData.total_questions < 1) {
      setError('Total questions must be at least 1');
      return;
    }

    if (formData.passing_score < 0 || formData.passing_score > 100) {
      setError('Passing score must be between 0 and 100');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await apiFetch<{ data: { id: string } }>('/api/v1/cbt/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          status: 'draft',
        }),
      });

      setSuccess(true);

      setTimeout(() => {
        router.push('/v27/cbt/admin');
      }, 2000);
    } catch (err: any) {
      setError(err.message || 'Failed to create quiz');
      console.error('Error creating quiz:', err);
    } finally {
      setLoading(false);
    }
  };

  const selectedSubject =
    subjects.find((subject) => subject.id === formData.subject_id)?.name || 'Not selected';
  const selectedClass = formData.class_id
    ? classes.find((cls) => cls.id === formData.class_id)?.name || 'Selected class'
    : 'Not selected';

  if (!user) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="alert alert-info">Please log in to create a quiz.</div>
      </div>
    );
  }

  if (loadingData) {
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
        <h3>Create New Quiz</h3>
        <ul>
          <li>
            <a href="/v27/cbt/admin">Quiz Management</a>
          </li>
          <li>Create New Quiz</li>
        </ul>
      </div>

      {success && (
        <div className="alert alert-success mg-b-20" role="alert">
          Quiz created successfully. Redirecting to management...
        </div>
      )}

      {error && (
        <div className="alert alert-danger mg-b-20" role="alert">
          {error}
        </div>
      )}

      <div className="row gutters-20">
        <div className="col-xl-8 col-12">
          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-1">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Quiz Setup</h3>
                </div>
                <span className="badge badge-pill badge-warning">Draft</span>
              </div>

              <form onSubmit={handleSubmit}>
                <div className="row gutters-20">
                  <div className="col-12 form-group">
                    <label>Quiz Title *</label>
                    <input
                      type="text"
                      name="title"
                      value={formData.title}
                      onChange={handleInputChange}
                      placeholder="e.g., Mathematics Final Exam"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="col-12 form-group">
                    <label>Description</label>
                    <textarea
                      name="description"
                      value={formData.description}
                      onChange={handleInputChange}
                      placeholder="Provide details about this quiz..."
                      rows={4}
                      className="form-control"
                    />
                  </div>

                  <div className="col-md-6 col-12 form-group">
                    <label>Class *</label>
                    <select
                      name="class_id"
                      value={formData.class_id}
                      onChange={(event) =>
                        setFormData((prev) => ({
                          ...prev,
                          class_id: event.target.value,
                          subject_id: '',
                        }))
                      }
                      className="form-control"
                      required
                    >
                      <option value="">Select a class</option>
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
                      name="subject_id"
                      value={formData.subject_id}
                      onChange={handleInputChange}
                      className="form-control"
                      required
                      disabled={!formData.class_id || subjectsLoading}
                    >
                      <option value="">
                        {formData.class_id ? 'Select a subject' : 'Select a class first'}
                      </option>
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
                    {!subjectsLoading && formData.class_id && subjects.length === 0 && !subjectsError && (
                      <small className="form-text text-muted">
                        No subjects assigned to this class yet.
                      </small>
                    )}
                  </div>
                </div>

                <div className="heading-layout1 mg-t-20">
                  <div className="item-title">
                    <h3>Quiz Settings</h3>
                  </div>
                </div>

                <div className="row gutters-20">
                  <div className="col-md-4 col-12 form-group">
                    <label>Duration (minutes) *</label>
                    <input
                      type="number"
                      name="duration_minutes"
                      value={formData.duration_minutes}
                      onChange={handleInputChange}
                      min="1"
                      max="480"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="col-md-4 col-12 form-group">
                    <label>Total Questions *</label>
                    <input
                      type="number"
                      name="total_questions"
                      value={formData.total_questions}
                      onChange={handleInputChange}
                      min="1"
                      max="1000"
                      className="form-control"
                      required
                    />
                  </div>

                  <div className="col-md-4 col-12 form-group">
                    <label>Passing Score (%) *</label>
                    <input
                      type="number"
                      name="passing_score"
                      value={formData.passing_score}
                      onChange={handleInputChange}
                      min="0"
                      max="100"
                      className="form-control"
                      required
                    />
                    <small className="form-text text-muted">Set the minimum score required to pass.</small>
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
                        name="show_answers"
                        checked={formData.show_answers}
                        onChange={handleInputChange}
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
                        name="show_score"
                        checked={formData.show_score}
                        onChange={handleInputChange}
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
                        name="shuffle_questions"
                        checked={formData.shuffle_questions}
                        onChange={handleInputChange}
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="shuffle_questions">
                        Randomize question order for each student
                      </label>
                    </div>
                  </div>

                  <div className="col-md-6 col-12 form-group">
                    <div className="form-check">
                      <input
                        id="shuffle_options"
                        type="checkbox"
                        name="shuffle_options"
                        checked={formData.shuffle_options}
                        onChange={handleInputChange}
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="shuffle_options">
                        Randomize answer options for each student
                      </label>
                    </div>
                  </div>

                  <div className="col-md-6 col-12 form-group">
                    <div className="form-check">
                      <input
                        id="allow_review"
                        type="checkbox"
                        name="allow_review"
                        checked={formData.allow_review}
                        onChange={handleInputChange}
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="allow_review">
                        Allow students to review their answers
                      </label>
                    </div>
                  </div>

                  <div className="col-md-6 col-12 form-group">
                    <div className="form-check">
                      <input
                        id="take_once"
                        type="checkbox"
                        checked={!formData.allow_multiple_attempts}
                        onChange={(event) =>
                          setFormData((prev) => ({
                            ...prev,
                            allow_multiple_attempts: !event.target.checked,
                          }))
                        }
                        className="form-check-input"
                      />
                      <label className="form-check-label" htmlFor="take_once">
                        Take once only (students can attempt once)
                      </label>
                    </div>
                  </div>
                </div>

                <div className="row gutters-20 mg-t-10">
                  <div className="col-md-6 col-12 form-group">
                    <button
                      type="button"
                      onClick={() => router.back()}
                      className="btn-fill-lmd radius-4 text-dodger-blue border-dodger-blue bg-light"
                    >
                      Cancel
                    </button>
                  </div>
                  <div className="col-md-6 col-12 form-group">
                    <button
                      type="submit"
                      disabled={loading}
                      className="fw-btn-fill btn-gradient-yellow"
                    >
                      {loading ? 'Creating...' : 'Create Quiz'}
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
                  <h3>Quiz Summary</h3>
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
                  <span>Attempts</span>
                  <span className="text-dark font-weight-bold">
                    {formData.allow_multiple_attempts ? 'Multiple' : 'Once'}
                  </span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Duration</span>
                  <span className="text-dark font-weight-bold">{formData.duration_minutes} min</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Questions</span>
                  <span className="text-dark font-weight-bold">{formData.total_questions}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center">
                  <span>Passing Score</span>
                  <span className="text-dark font-weight-bold">{formData.passing_score}%</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-3">
            <div className="card-body bg-light-blue">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Next Steps</h3>
                </div>
              </div>
              <ul className="list-unstyled">
                <li className="mg-b-10">Add questions and assign correct answers.</li>
                <li className="mg-b-10">Review the pass score before publishing.</li>
                <li className="mg-b-10">Use draft status to edit without student access.</li>
                <li>Publish when the quiz is ready for students.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
