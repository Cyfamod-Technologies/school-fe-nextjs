'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StudentAuthProvider, useStudentAuth } from '@/contexts/StudentAuthContext';
import { apiFetch } from '@/lib/apiClient';

type QuestionType = 'mcq' | 'multiple_select' | 'true_false' | 'short_answer';

interface ReviewOption {
  id: string;
  option_text: string;
  order: number;
  image_url?: string | null;
  is_correct?: boolean;
}

interface ReviewAnswer {
  selected_option_id: string | null;
  selected_option_ids: string[];
  answer_text: string | null;
  is_correct?: boolean;
}

interface ReviewQuestion {
  id: string;
  question_text: string;
  question_type: QuestionType;
  marks: number;
  order: number;
  image_url?: string | null;
  options: ReviewOption[];
  answer: ReviewAnswer | null;
  accepted_answers?: string[];
}

interface ReviewQuiz {
  id: string;
  title: string;
  show_answers: boolean;
  allow_review: boolean;
}

interface ReviewAttempt {
  id: string;
  quiz_id: string;
  status: string;
  start_time: string | null;
  end_time: string | null;
}

interface ReviewResponse {
  attempt: ReviewAttempt;
  quiz: ReviewQuiz;
  questions: ReviewQuestion[];
}

const questionTypeLabel = (type: QuestionType) => {
  switch (type) {
    case 'mcq':
      return 'Multiple choice';
    case 'multiple_select':
      return 'Multiple select';
    case 'true_false':
      return 'True/False';
    default:
      return 'Short answer';
  }
};

function ResultsReviewInner() {
  const router = useRouter();
  const params = useParams();
  const { student, loading: authLoading } = useStudentAuth();
  const resultId = params.attemptId as string;

  const [data, setData] = useState<ReviewResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!resultId || !student) {
      return;
    }

    const loadReview = async () => {
      try {
        setLoading(true);
        const response = await apiFetch<{ data: ReviewResponse }>(
          `/api/v1/cbt/quiz-results/${resultId}/review`,
          { authScope: 'student' },
        );
        setData(response.data);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load review');
      } finally {
        setLoading(false);
      }
    };

    loadReview();
  }, [resultId, student]);

  const orderedQuestions = useMemo(() => {
    if (!data?.questions) {
      return [];
    }
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

  if (!student) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="alert alert-info">Please log in to review your answers.</div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="alert alert-danger">{error || 'Review not available.'}</div>
      </div>
    );
  }

  const showAnswers = data.quiz.show_answers;

  return (
    <div className="cbt-review">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Space+Grotesk:wght@400;500;600&display=swap');

        .cbt-review {
          --cbt-ink: #1b1b1b;
          --cbt-muted: #5c616a;
          --cbt-accent: #e4572e;
          --cbt-accent-2: #2a9d8f;
          --cbt-card: #ffffff;
          --cbt-border: #e7e1d9;
          --cbt-shadow: 0 18px 40px rgba(18, 24, 38, 0.12);
          min-height: 100vh;
          background: radial-gradient(circle at top right, #fff1da 0%, #f2f6ff 45%, #f7efe4 100%);
          color: var(--cbt-ink);
          font-family: 'Space Grotesk', 'Trebuchet MS', sans-serif;
          padding: 28px 20px 60px;
        }

        .cbt-review__shell {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          gap: 20px;
        }

        .cbt-review__hero {
          background: linear-gradient(135deg, #fef3dd 0%, #f8e4bb 45%, #e3f0ff 100%);
          border-radius: 26px;
          padding: 24px;
          box-shadow: var(--cbt-shadow);
          display: flex;
          flex-wrap: wrap;
          justify-content: space-between;
          gap: 16px;
        }

        .cbt-review__hero h1 {
          font-family: 'Fraunces', 'Times New Roman', serif;
          font-size: clamp(24px, 3vw, 36px);
        }

        .cbt-review__hero p {
          color: var(--cbt-muted);
          margin-bottom: 0;
        }

        .cbt-card {
          background: var(--cbt-card);
          border-radius: 18px;
          padding: 18px 20px;
          border: 1px solid var(--cbt-border);
          box-shadow: 0 12px 28px rgba(18, 24, 38, 0.08);
        }

        .cbt-question {
          display: grid;
          gap: 12px;
          padding: 16px;
          border-radius: 16px;
          border: 1px solid var(--cbt-border);
          background: #fffdfb;
        }

        .cbt-question__meta {
          font-size: 12px;
          color: var(--cbt-muted);
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .cbt-option {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          padding: 10px 12px;
          border-radius: 12px;
          border: 1px solid #eee5da;
          background: #ffffff;
        }

        .cbt-option.is-selected {
          border-color: rgba(228, 87, 46, 0.35);
          background: rgba(228, 87, 46, 0.08);
        }

        .cbt-option.is-correct {
          border-color: rgba(42, 157, 143, 0.6);
          background: rgba(42, 157, 143, 0.12);
        }

        .cbt-badge {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .cbt-badge--correct {
          background: rgba(42, 157, 143, 0.18);
          color: #1f756d;
        }

        .cbt-badge--wrong {
          background: rgba(228, 87, 46, 0.16);
          color: #8f3a20;
        }

        .cbt-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
        }

        .cbt-btn {
          border-radius: 999px;
          padding: 10px 18px;
          font-weight: 600;
          border: 1px solid transparent;
          transition: transform 150ms ease, box-shadow 150ms ease;
        }

        .cbt-btn--primary {
          background: var(--cbt-ink);
          color: #fff;
        }

        .cbt-btn--ghost {
          background: #fff;
          border-color: #d9d1c7;
          color: var(--cbt-ink);
        }

        .cbt-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(18, 24, 38, 0.18);
        }
      `}</style>

      <div className="cbt-review__shell">
        <section className="cbt-review__hero">
          <div>
            <div className="text-uppercase text-muted small" style={{ letterSpacing: '0.2em' }}>
              Review answers
            </div>
            <h1>{data.quiz.title}</h1>
            <p>See the answers you submitted for each question.</p>
          </div>
          <div className="cbt-actions">
            <button
              onClick={() => router.push(`/cbt/results/${resultId}`)}
              className="cbt-btn cbt-btn--ghost"
            >
              Back to results
            </button>
            <button
              onClick={() => router.push('/cbt')}
              className="cbt-btn cbt-btn--primary"
            >
              Back to quizzes
            </button>
          </div>
        </section>

        <section className="cbt-card">
          <div className="d-flex justify-content-between align-items-center mb-3">
            <div className="text-muted small">{orderedQuestions.length} questions</div>
            {showAnswers ? (
              <span className="cbt-badge cbt-badge--correct">Correct answers shown</span>
            ) : (
              <span className="cbt-badge cbt-badge--wrong">Correct answers hidden</span>
            )}
          </div>
          <div className="d-grid" style={{ gap: '16px' }}>
            {orderedQuestions.map((question) => {
              const answer = question.answer;
              const selectedIds = new Set(answer?.selected_option_ids || []);
              const isShortAnswer = question.question_type === 'short_answer';
              return (
                <div key={question.id} className="cbt-question">
                  <div className="cbt-question__meta">
                    Q{question.order} • {questionTypeLabel(question.question_type)} • {question.marks} mark(s)
                  </div>
                  <div className="font-weight-bold text-dark">{question.question_text}</div>
                  {isShortAnswer ? (
                    <div>
                      <div className="text-muted small mb-1">Your answer</div>
                      <div className="border rounded p-2 bg-light">
                        {answer?.answer_text || 'No answer submitted.'}
                      </div>
                      {showAnswers && question.accepted_answers?.length ? (
                        <div className="text-muted small mt-2">
                          Accepted answers: {question.accepted_answers.join(', ')}
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="d-grid" style={{ gap: '10px' }}>
                      {question.options.map((option) => {
                        const isSelected =
                          selectedIds.has(option.id) || answer?.selected_option_id === option.id;
                        const isCorrect = showAnswers && option.is_correct;
                        return (
                          <div
                            key={option.id}
                            className={`cbt-option ${isSelected ? 'is-selected' : ''} ${
                              isCorrect ? 'is-correct' : ''
                            }`}
                          >
                            <span>
                              {option.option_text}
                              {isSelected ? ' (selected)' : ''}
                            </span>
                            {showAnswers && option.is_correct ? (
                              <span className="cbt-badge cbt-badge--correct">Correct</span>
                            ) : null}
                          </div>
                        );
                      })}
                      {!answer ? (
                        <div className="text-muted small">No answer submitted.</div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </div>
    </div>
  );
}

export default function ResultsReviewPage() {
  return (
    <StudentAuthProvider>
      <ResultsReviewInner />
    </StudentAuthProvider>
  );
}
