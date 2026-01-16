'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { apiFetch } from '@/lib/apiClient';

type QuestionType = 'mcq' | 'multiple_select' | 'true_false' | 'short_answer';

interface AttemptResult {
  id: string;
  percentage: number;
  grade: string;
  status: 'pass' | 'fail';
  marks_obtained: number;
  total_marks: number;
  submitted_at: string;
}

interface AttemptSummary {
  id: string;
  quiz_id: string;
  student_id: string;
  student_name: string | null;
  status: string;
  start_time: string | null;
  end_time: string | null;
  result: AttemptResult | null;
}

interface QuizSummary {
  id: string;
  title: string;
}

interface AnswerDetails {
  selected_option_id: string | null;
  selected_option_ids: string[];
  answer_text: string | null;
  is_correct: boolean | null;
  marks_obtained: number | null;
}

interface QuestionOption {
  id: string;
  option_text: string;
  order: number;
  is_correct: boolean;
}

interface QuestionDetails {
  id: string;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  order: number;
  options: QuestionOption[];
  answer: AnswerDetails | null;
}

interface AttemptReviewResponse {
  attempt: AttemptSummary;
  quiz: QuizSummary;
  questions: QuestionDetails[];
}

const statusBadgeClass = (status: AttemptResult['status']) => {
  return status === 'pass' ? 'badge badge-pill badge-success' : 'badge badge-pill badge-danger';
};

export default function AttemptReviewPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const quizId = params.quizId as string;
  const attemptId = params.attemptId as string;

  const [data, setData] = useState<AttemptReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) return;

    const loadData = async () => {
      try {
        setLoading(true);
        setError(null);

        const response = await apiFetch<{ data: AttemptReviewResponse }>(
          `/api/v1/cbt/quiz-attempts/${attemptId}/answers`,
        );

        setData(response.data);
      } catch (err: any) {
        setError(err.message || 'Failed to load attempt answers');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [authLoading, user, attemptId]);

  const orderedQuestions = useMemo(() => {
    if (!data) return [];
    return [...data.questions].sort((a, b) => a.order - b.order);
  }, [data]);

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
        <div className="alert alert-info">Please log in to review attempts.</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="alert alert-danger">{error || 'Attempt not found.'}</div>
      </div>
    );
  }

  const result = data.attempt.result;

  return (
    <div className="bg-ash min-vh-100">
      <div className="breadcrumbs-area quiz-fade-up">
        <h3>Attempt Review</h3>
        <ul>
          <li>
            <a href={`/v27/cbt/admin/${quizId}/results`}>Quiz Results</a>
          </li>
          <li>Attempt Review</li>
        </ul>
      </div>

      {error && (
        <div className="alert alert-danger mg-b-20" role="alert">
          {error}
        </div>
      )}

      <div className="card height-auto quiz-fade-up quiz-fade-up-delay-1">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>{data.quiz.title}</h3>
            </div>
            <button
              type="button"
              onClick={() => router.push(`/v27/cbt/admin/${quizId}/results`)}
              className="btn-fill-lmd radius-4 text-light bg-dodger-blue"
            >
              Back to Results
            </button>
          </div>

          <div className="row gutters-20">
            <div className="col-md-4 col-12">
              <div className="border rounded p-3 bg-light">
                <div className="text-muted">Student</div>
                <div className="font-weight-bold text-dark">
                  {data.attempt.student_name || 'Unknown'}
                </div>
                <div className="text-muted small">{data.attempt.student_id}</div>
              </div>
            </div>
            <div className="col-md-4 col-12">
              <div className="border rounded p-3 bg-light">
                <div className="text-muted">Score</div>
                <div className="font-weight-bold text-dark">
                  {result ? `${result.marks_obtained}/${result.total_marks}` : 'Pending'}
                </div>
                <div className="text-muted small">
                  {result ? `${result.percentage}%` : 'Not graded'}
                </div>
              </div>
            </div>
            <div className="col-md-4 col-12">
              <div className="border rounded p-3 bg-light">
                <div className="text-muted">Result</div>
                {result ? (
                  <span className={statusBadgeClass(result.status)}>{result.status}</span>
                ) : (
                  <span className="badge badge-pill badge-secondary">pending</span>
                )}
                <div className="text-muted small mt-2">{result?.grade ? `Grade ${result.grade}` : '—'}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card height-auto quiz-fade-up quiz-fade-up-delay-2">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Answers</h3>
            </div>
            <span className="text-muted">{orderedQuestions.length} questions</span>
          </div>

          {orderedQuestions.length === 0 ? (
            <div className="alert alert-info">No questions found for this attempt.</div>
          ) : (
            <div className="list-group">
              {orderedQuestions.map((question) => {
                const answer = question.answer;
                const selectedIds = new Set(answer?.selected_option_ids || []);
                return (
                  <div key={question.id} className="list-group-item mb-3 border rounded">
                    <div className="d-flex justify-content-between align-items-start">
                      <div>
                        <div className="font-weight-bold text-dark">
                          {question.order}. {question.question_text}
                        </div>
                        <div className="text-muted small">
                          {question.question_type} • {question.marks} mark(s)
                        </div>
                      </div>
                      {answer ? (
                        <span className={answer.is_correct ? 'badge badge-success' : 'badge badge-danger'}>
                          {answer.is_correct ? 'Correct' : 'Wrong'}
                        </span>
                      ) : (
                        <span className="badge badge-secondary">No Answer</span>
                      )}
                    </div>

                    {question.question_type === 'short_answer' ? (
                      <div className="mt-3">
                        <div className="text-muted small mb-1">Student Answer</div>
                        <div className="border rounded p-2 bg-light">
                          {answer?.answer_text || 'No answer submitted.'}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3">
                        {question.options.map((option) => {
                          const isSelected =
                            selectedIds.has(option.id) || answer?.selected_option_id === option.id;
                          const isCorrect = option.is_correct;
                          return (
                            <div
                              key={option.id}
                              className={`d-flex align-items-center justify-content-between p-2 mb-2 rounded ${
                                isSelected ? 'bg-light-blue' : 'bg-light'
                              }`}
                            >
                              <span>
                                {option.option_text}
                                {isSelected ? ' (selected)' : ''}
                              </span>
                              <span className={isCorrect ? 'badge badge-success' : 'badge badge-secondary'}>
                                {isCorrect ? 'correct' : '—'}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
