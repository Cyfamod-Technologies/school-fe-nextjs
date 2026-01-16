'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiClient';

type QuestionType = 'mcq' | 'multiple_select' | 'true_false' | 'short_answer';

interface Quiz {
  id: string;
  title: string;
  status: 'draft' | 'published' | 'closed';
  total_questions: number;
  passing_score: number;
  duration_minutes: number;
}

interface QuizOption {
  id?: string;
  option_text: string;
  order: number;
  is_correct: boolean;
  image_url?: string | null;
}

interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  order: number;
  image_url?: string | null;
  explanation?: string | null;
  options: QuizOption[];
}

interface QuestionForm {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  order: number;
  image_url: string;
  explanation: string;
  options: QuizOption[];
}

const questionTypeLabels: Record<QuestionType, string> = {
  mcq: 'Multiple Choice',
  multiple_select: 'Multiple Select',
  true_false: 'True / False',
  short_answer: 'Short Answer',
};

const makeTrueFalseOptions = (existing?: QuizOption[]): QuizOption[] => {
  const trueOption = existing?.[0];
  const falseOption = existing?.[1];

  return [
    {
      id: trueOption?.id,
      option_text: 'True',
      order: 1,
      is_correct: trueOption?.is_correct ?? false,
      image_url: trueOption?.image_url ?? null,
    },
    {
      id: falseOption?.id,
      option_text: 'False',
      order: 2,
      is_correct: falseOption?.is_correct ?? false,
      image_url: falseOption?.image_url ?? null,
    },
  ];
};

const normalizeOptions = (type: QuestionType, options: QuizOption[]): QuizOption[] => {
  if (type === 'short_answer') {
    return [];
  }

  if (type === 'true_false') {
    return makeTrueFalseOptions(options);
  }

  if (options.length === 0) {
    return [
      { option_text: '', order: 1, is_correct: false },
      { option_text: '', order: 2, is_correct: false },
    ];
  }

  return options.map((option, index) => ({
    ...option,
    order: index + 1,
  }));
};

const emptyQuestionForm = (order: number): QuestionForm => ({
  question_text: '',
  question_type: 'mcq',
  marks: 1,
  order,
  image_url: '',
  explanation: '',
  options: normalizeOptions('mcq', []),
});

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

export default function QuizQuestionsPage() {
  const router = useRouter();
  const params = useParams();
  const { user, loading: authLoading } = useAuth();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingQuestion, setSavingQuestion] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeQuestionId, setActiveQuestionId] = useState<string | null>(null);
  const [questionForm, setQuestionForm] = useState<QuestionForm>(() => emptyQuestionForm(1));

  const totalQuestionCount = questions.length;
  const nextQuestionOrder = totalQuestionCount + 1;
  const isEditingQuestion = Boolean(activeQuestionId);

  const questionMismatch = useMemo(() => {
    if (!quiz) return false;
    return quiz.total_questions !== totalQuestionCount;
  }, [quiz, totalQuestionCount]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [quizRes, questionsRes] = await Promise.all([
        apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}`),
        apiFetch<{ data: QuizQuestion[] }>(
          `/api/v1/cbt/quizzes/${quizId}/questions?include_correct=1`,
        ),
      ]);

      setQuiz(quizRes.data);
      setQuestions(questionsRes.data || []);
      setActiveQuestionId(null);
      setQuestionForm(emptyQuestionForm((questionsRes.data || []).length + 1));
    } catch (err: any) {
      setError(err.message || 'Failed to load quiz questions');
    } finally {
      setLoading(false);
    }
  };

  const refreshQuestions = async (): Promise<QuizQuestion[]> => {
    const response = await apiFetch<{ data: QuizQuestion[] }>(
      `/api/v1/cbt/quizzes/${quizId}/questions?include_correct=1`,
    );
    const nextQuestions = response.data || [];
    setQuestions(nextQuestions);
    return nextQuestions;
  };

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;
    loadData();
  }, [authLoading, user, quizId]);

  const resetQuestionForm = (order: number) => {
    setActiveQuestionId(null);
    setQuestionForm(emptyQuestionForm(order));
  };

  const handleQuestionSelect = (question: QuizQuestion) => {
    setActiveQuestionId(question.id);
    setQuestionForm({
      id: question.id,
      question_text: question.question_text,
      question_type: question.question_type,
      marks: question.marks,
      order: question.order,
      image_url: question.image_url ?? '',
      explanation: question.explanation ?? '',
      options: normalizeOptions(question.question_type, question.options || []),
    });
  };

  const updateQuestionType = (nextType: QuestionType) => {
    setQuestionForm((prev) => ({
      ...prev,
      question_type: nextType,
      options: normalizeOptions(nextType, prev.options),
    }));
  };

  const updateOptionText = (index: number, value: string) => {
    setQuestionForm((prev) => {
      const options = [...prev.options];
      options[index] = { ...options[index], option_text: value };
      return { ...prev, options };
    });
  };

  const updateOptionCorrect = (index: number, checked: boolean) => {
    setQuestionForm((prev) => {
      const options = prev.options.map((option, idx) => {
        if (prev.question_type === 'multiple_select') {
          return idx === index ? { ...option, is_correct: checked } : option;
        }
        return { ...option, is_correct: idx === index ? checked : false };
      });

      return { ...prev, options };
    });
  };

  const addOption = () => {
    setQuestionForm((prev) => ({
      ...prev,
      options: [
        ...prev.options,
        {
          option_text: '',
          order: prev.options.length + 1,
          is_correct: false,
        },
      ],
    }));
  };

  const removeOption = (index: number) => {
    setQuestionForm((prev) => {
      const options = prev.options.filter((_, idx) => idx !== index);
      return { ...prev, options: normalizeOptions(prev.question_type, options) };
    });
  };

  const validateQuestion = (): string | null => {
    if (!questionForm.question_text.trim()) {
      return 'Question text is required.';
    }

    if (questionForm.marks < 1) {
      return 'Marks must be at least 1.';
    }

    if (questionForm.question_type !== 'short_answer') {
      const filledOptions = questionForm.options.filter((option) => option.option_text.trim());
      if (filledOptions.length < 2) {
        return 'Provide at least two options.';
      }

      const correctCount = filledOptions.filter((option) => option.is_correct).length;
      if (correctCount === 0) {
        return 'Select at least one correct option.';
      }

      if (
        (questionForm.question_type === 'mcq' || questionForm.question_type === 'true_false') &&
        correctCount > 1
      ) {
        return 'Only one correct option is allowed.';
      }
    }

    return null;
  };

  const saveQuestion = async () => {
    const validationError = validateQuestion();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSavingQuestion(true);
      setError(null);
      setSuccess(null);

      const questionPayload: Record<string, unknown> = {
        question_text: questionForm.question_text.trim(),
        question_type: questionForm.question_type,
        marks: questionForm.marks,
        order: questionForm.order,
        image_url: questionForm.image_url.trim() || null,
        explanation: questionForm.explanation.trim() || null,
      };

      let questionId = questionForm.id;
      const normalizedOptions = questionForm.options
        .filter((option) => option.option_text.trim())
        .map((option, index) => ({
          ...option,
          option_text: option.option_text.trim(),
          order: index + 1,
        }));

      if (questionId) {
        await apiFetch(`/api/v1/cbt/quizzes/${quizId}/questions/${questionId}`, {
          method: 'PUT',
          body: JSON.stringify(questionPayload),
        });
      } else {
        if (questionForm.question_type !== 'short_answer') {
          questionPayload.options = normalizedOptions;
        }
        const response = await apiFetch<{ data: QuizQuestion }>(`/api/v1/cbt/quizzes/${quizId}/questions`, {
          method: 'POST',
          body: JSON.stringify(questionPayload),
        });
        questionId = response.data.id;
      }

      if (questionForm.question_type !== 'short_answer' && questionId && questionForm.id) {
        const existingOptions = questions.find((q) => q.id === questionId)?.options || [];
        const formIds = new Set(normalizedOptions.map((option) => option.id).filter(Boolean) as string[]);

        const toDelete = existingOptions.filter((option) => option.id && !formIds.has(option.id));
        const toCreate = normalizedOptions.filter((option) => !option.id);
        const toUpdate = normalizedOptions.filter((option) => option.id);

        await Promise.all(
          toDelete.map((option) =>
            apiFetch(`/api/v1/cbt/questions/${questionId}/options/${option.id}`, {
              method: 'DELETE',
            }),
          ),
        );

        await Promise.all(
          toUpdate.map((option) =>
            apiFetch(`/api/v1/cbt/questions/${questionId}/options/${option.id}`, {
              method: 'PUT',
              body: JSON.stringify({
                option_text: option.option_text,
                order: option.order,
                is_correct: option.is_correct,
                image_url: option.image_url || null,
              }),
            }),
          ),
        );

        await Promise.all(
          toCreate.map((option) =>
            apiFetch(`/api/v1/cbt/questions/${questionId}/options`, {
              method: 'POST',
              body: JSON.stringify({
                option_text: option.option_text,
                order: option.order,
                is_correct: option.is_correct,
                image_url: option.image_url || null,
              }),
            }),
          ),
        );
      }

      const refreshedQuestions = await refreshQuestions();
      resetQuestionForm(refreshedQuestions.length + 1);
      setSuccess('Question saved successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to save question');
    } finally {
      setSavingQuestion(false);
    }
  };

  const deleteQuestion = async (questionId: string) => {
    if (!confirm('Are you sure you want to delete this question?')) return;

    try {
      setSavingQuestion(true);
      await apiFetch(`/api/v1/cbt/quizzes/${quizId}/questions/${questionId}`, {
        method: 'DELETE',
      });
      const refreshedQuestions = await refreshQuestions();
      resetQuestionForm(refreshedQuestions.length + 1);
      setSuccess('Question deleted successfully.');
    } catch (err: any) {
      setError(err.message || 'Failed to delete question');
    } finally {
      setSavingQuestion(false);
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
        <div className="alert alert-info">Please log in to manage quiz questions.</div>
      </div>
    );
  }

  if (!quiz) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="alert alert-danger">Quiz not found.</div>
      </div>
    );
  }

  return (
    <div className="bg-ash min-vh-100">
      <div className="breadcrumbs-area quiz-fade-up">
        <h3>Quiz Questions</h3>
        <ul>
          <li>
            <a href="/v27/cbt/admin">Quiz Management</a>
          </li>
          <li>Questions</li>
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
                  <h3>Manage Questions</h3>
                </div>
                <span className={statusBadgeClass(quiz.status)}>{quiz.status}</span>
              </div>

              <div className="row">
                <div className="col-lg-5 col-12">
                  <div className="border rounded p-3 mb-3">
                    {questions.length === 0 ? (
                      <p className="text-muted mb-0">No questions yet.</p>
                    ) : (
                      <ul className="list-unstyled mb-0">
                        {questions.map((question) => (
                          <li
                            key={question.id}
                            className={`d-flex justify-content-between align-items-start mb-3 p-2 rounded ${
                              activeQuestionId === question.id ? 'bg-light-blue' : 'bg-light'
                            }`}
                          >
                            <div>
                              <div className="font-weight-bold text-dark">
                                {question.order}. {question.question_text.slice(0, 60)}
                              </div>
                              <small className="text-muted">
                                {questionTypeLabels[question.question_type]} • {question.marks} mark(s)
                              </small>
                            </div>
                            <div className="d-flex flex-column align-items-end">
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-primary mb-2"
                                onClick={() => handleQuestionSelect(question)}
                              >
                                Edit
                              </button>
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger"
                                onClick={() => deleteQuestion(question.id)}
                                disabled={savingQuestion}
                              >
                                Delete
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <button
                    type="button"
                    className="btn-fill-lmd radius-4 text-light btn-gradient-yellow"
                    onClick={() => resetQuestionForm(nextQuestionOrder)}
                  >
                    + New Question
                  </button>
                </div>

                <div className="col-lg-7 col-12">
                  <div className="border rounded p-3">
                    <h4 className="mb-3">{isEditingQuestion ? 'Edit Question' : 'Add Question'}</h4>

                    <div className="form-group">
                      <label>Question Text *</label>
                      <textarea
                        value={questionForm.question_text}
                        onChange={(e) =>
                          setQuestionForm({ ...questionForm, question_text: e.target.value })
                        }
                        className="form-control"
                        rows={3}
                      />
                    </div>

                    <div className="row gutters-20">
                      <div className="col-md-6 col-12 form-group">
                        <label>Question Type</label>
                        <select
                          value={questionForm.question_type}
                          onChange={(e) => updateQuestionType(e.target.value as QuestionType)}
                          className="form-control"
                        >
                          {Object.entries(questionTypeLabels).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-md-3 col-6 form-group">
                        <label>Marks</label>
                        <input
                          type="number"
                          min="1"
                          value={questionForm.marks}
                          onChange={(e) =>
                            setQuestionForm({ ...questionForm, marks: Number(e.target.value) })
                          }
                          className="form-control"
                        />
                      </div>
                      <div className="col-md-3 col-6 form-group">
                        <label>Order</label>
                        <input
                          type="number"
                          min="1"
                          value={questionForm.order}
                          onChange={(e) =>
                            setQuestionForm({ ...questionForm, order: Number(e.target.value) })
                          }
                          className="form-control"
                        />
                      </div>
                    </div>

                    <div className="row gutters-20">
                      <div className="col-12 form-group">
                        <label>Image URL (optional)</label>
                        <input
                          type="text"
                          value={questionForm.image_url}
                          onChange={(e) =>
                            setQuestionForm({ ...questionForm, image_url: e.target.value })
                          }
                          className="form-control"
                        />
                      </div>
                      <div className="col-12 form-group">
                        <label>Explanation (optional)</label>
                        <textarea
                          value={questionForm.explanation}
                          onChange={(e) =>
                            setQuestionForm({ ...questionForm, explanation: e.target.value })
                          }
                          className="form-control"
                          rows={2}
                        />
                      </div>
                    </div>

                    {questionForm.question_type === 'short_answer' ? (
                      <p className="text-muted">Short answer questions do not need options.</p>
                    ) : (
                      <div className="form-group">
                        <label>Options *</label>
                        {questionForm.options.map((option, index) => (
                          <div key={option.id ?? `option-${index}`} className="d-flex align-items-center mb-2">
                            <input
                              type="text"
                              value={option.option_text}
                              onChange={(e) => updateOptionText(index, e.target.value)}
                              className="form-control mg-r-10"
                              placeholder={`Option ${index + 1}`}
                              readOnly={questionForm.question_type === 'true_false'}
                            />
                            <div className="form-check">
                              <input
                                type={questionForm.question_type === 'multiple_select' ? 'checkbox' : 'radio'}
                                name="correct-option"
                                checked={option.is_correct}
                                onChange={(e) => updateOptionCorrect(index, e.target.checked)}
                                className="form-check-input"
                              />
                              <label className="form-check-label">Correct</label>
                            </div>
                            {questionForm.question_type !== 'true_false' && (
                              <button
                                type="button"
                                className="btn btn-sm btn-outline-danger ml-2"
                                onClick={() => removeOption(index)}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ))}

                        {questionForm.question_type !== 'true_false' && (
                          <button
                            type="button"
                            onClick={addOption}
                            className="btn btn-sm btn-outline-primary mt-2"
                          >
                            + Add Option
                          </button>
                        )}
                      </div>
                    )}

                    <div className="d-flex justify-content-between mt-4">
                      <button
                        type="button"
                        className="btn btn-outline-secondary"
                        onClick={() => resetQuestionForm(nextQuestionOrder)}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="btn-fill-lmd btn-gradient-yellow text-light"
                        onClick={saveQuestion}
                        disabled={savingQuestion}
                      >
                        {savingQuestion ? 'Saving...' : 'Save Question'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
                  <span>Title</span>
                  <span className="text-dark font-weight-bold">{quiz.title}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Status</span>
                  <span className="text-dark font-weight-bold">{quiz.status}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Configured Questions</span>
                  <span className="text-dark font-weight-bold">{totalQuestionCount}</span>
                </li>
                <li className="d-flex justify-content-between align-items-center mg-b-10">
                  <span>Passing Score</span>
                  <span className="text-dark font-weight-bold">{quiz.passing_score}%</span>
                </li>
                <li className="d-flex justify-content-between align-items-center">
                  <span>Duration</span>
                  <span className="text-dark font-weight-bold">{quiz.duration_minutes} min</span>
                </li>
              </ul>
              {questionMismatch && (
                <div className="alert alert-warning mt-3 mb-0" role="alert">
                  Total questions is {quiz.total_questions}, but you have {totalQuestionCount} configured.
                </div>
              )}
            </div>
          </div>

          <div className="card height-auto quiz-fade-up quiz-fade-up-delay-3">
            <div className="card-body bg-light-blue">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Navigation</h3>
                </div>
              </div>
              <button
                type="button"
                className="btn-fill-lmd radius-4 text-light bg-dodger-blue mb-2"
                onClick={() => router.push(`/v27/cbt/admin/${quizId}/edit`)}
              >
                Back to Settings
              </button>
              <button
                type="button"
                className="btn-fill-lmd radius-4 text-light btn-gradient-yellow"
                onClick={() => router.push('/v27/cbt/admin')}
              >
                Back to Quiz List
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
