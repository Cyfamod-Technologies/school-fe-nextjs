'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StudentAuthProvider, useStudentAuth } from '@/contexts/StudentAuthContext';
import { apiFetch } from '@/lib/apiClient';

interface QuizResult {
  id: string;
  attempt_id: string;
  quiz_id: string;
  total_questions: number;
  attempted_questions: number;
  correct_answers: number;
  total_marks: number;
  marks_obtained: number;
  percentage: number;
  grade: string;
  status: 'pass' | 'fail';
  submitted_at: string;
  graded_at: string;
  quiz?: Quiz;
}

interface Quiz {
  title: string;
  show_score?: boolean;
  show_answers?: boolean;
  allow_review?: boolean;
}

interface QuizAttempt {
  id: string;
  quiz_id: string;
  student_id: string;
  start_time: string;
  end_time: string | null;
  status: 'in_progress' | 'submitted' | 'graded';
}

const formatDuration = (seconds: number | null): string => {
  if (seconds === null || Number.isNaN(seconds)) {
    return '—';
  }
  const safeSeconds = Math.max(0, seconds);
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const secs = safeSeconds % 60;
  const parts = [];
  if (hours > 0) {
    parts.push(`${hours}h`);
  }
  if (minutes > 0 || hours > 0) {
    parts.push(`${minutes}m`);
  }
  parts.push(`${secs}s`);
  return parts.join(' ');
};

function ResultsPageInner() {
  const params = useParams();
  const router = useRouter();
  const { student, loading: authLoading, logout } = useStudentAuth();
  const resultId = params.attemptId as string;

  const [result, setResult] = useState<QuizResult | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [attempt, setAttempt] = useState<QuizAttempt | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const studentName = useMemo(() => {
    if (!student) {
      return 'Student';
    }
    return [student.first_name, student.middle_name, student.last_name]
      .filter((value) => value && value.trim().length > 0)
      .join(' ');
  }, [student]);

  const timeUsedSeconds = useMemo(() => {
    if (!attempt?.start_time) {
      return null;
    }
    const endTimestamp = attempt.end_time || result?.submitted_at;
    if (!endTimestamp) {
      return null;
    }
    const start = new Date(attempt.start_time).getTime();
    const end = new Date(endTimestamp).getTime();
    if (Number.isNaN(start) || Number.isNaN(end)) {
      return null;
    }
    return Math.max(0, Math.round((end - start) / 1000));
  }, [attempt, result]);

  const accuracy = useMemo(() => {
    if (!result || result.attempted_questions === 0) {
      return 0;
    }
    return (result.correct_answers / result.attempted_questions) * 100;
  }, [result]);

  const showScore = quiz?.show_score ?? true;
  const allowReview = quiz?.allow_review ?? false;

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        const response = await apiFetch<{ data: QuizResult }>(`/api/v1/cbt/quiz-results/${resultId}`, {
          authScope: 'student',
        });
        setResult(response.data);

        const quizData = response.data.quiz;
        if (quizData) {
          setQuiz(quizData);
        } else if (response.data.quiz_id) {
          // Fallback for older responses
          const quizResponse = await apiFetch<{ data: Quiz }>(
            `/api/v1/cbt/quizzes/${response.data.quiz_id}`,
            { authScope: 'student' },
          );
          setQuiz(quizResponse.data);
        }

        if (response.data.attempt_id) {
          const attemptResponse = await apiFetch<{ data: QuizAttempt }>(
            `/api/v1/cbt/quiz-attempts/${response.data.attempt_id}`,
            { authScope: 'student' },
          );
          setAttempt(attemptResponse.data);
        }

        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load results');
        console.error('Error loading results:', err);
      } finally {
        setLoading(false);
      }
    };

    if (resultId && student) {
      loadResults();
    }
  }, [resultId, student]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!student) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">Please log in to view results.</p>
          <button
            onClick={() => router.push('/cbt/login?next=/cbt')}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error || 'Failed to load results'}</p>
          <button
            onClick={() => router.push('/cbt')}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700"
          >
            Back to Quizzes
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="cbt-result">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Space+Grotesk:wght@400;500;600&display=swap');

        .cbt-result {
          --cbt-ink: #1a1a1a;
          --cbt-muted: #525760;
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

        .cbt-result__shell {
          max-width: 1100px;
          margin: 0 auto;
          display: grid;
          gap: 22px;
        }

        .cbt-result__hero {
          border-radius: 26px;
          background: linear-gradient(135deg, #fef3dd 0%, #f8e4bb 45%, #e3f0ff 100%);
          padding: 28px;
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
          gap: 20px;
          box-shadow: var(--cbt-shadow);
        }

        .cbt-result__hero h1 {
          font-family: 'Fraunces', 'Times New Roman', serif;
          font-size: clamp(28px, 3.2vw, 40px);
          margin-bottom: 10px;
        }

        .cbt-result__kicker {
          text-transform: uppercase;
          letter-spacing: 0.16em;
          font-size: 11px;
          font-weight: 600;
          color: var(--cbt-muted);
          margin-bottom: 6px;
        }

        .cbt-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.9);
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .cbt-pill--accent {
          background: rgba(228, 87, 46, 0.14);
          color: #8f3a20;
        }

        .cbt-pill--success {
          background: rgba(42, 157, 143, 0.15);
          color: #1f756d;
        }

        .cbt-card {
          background: var(--cbt-card);
          border-radius: 20px;
          padding: 18px 20px;
          border: 1px solid var(--cbt-border);
          box-shadow: 0 14px 30px rgba(18, 24, 38, 0.08);
        }

        .cbt-metrics {
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .cbt-metric {
          display: flex;
          justify-content: space-between;
          font-weight: 600;
          color: var(--cbt-ink);
        }

        .cbt-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .cbt-stat {
          background: #fffdfb;
          border-radius: 16px;
          border: 1px solid var(--cbt-border);
          padding: 16px;
        }

        .cbt-stat span {
          display: block;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--cbt-muted);
        }

        .cbt-stat strong {
          font-size: 22px;
        }

        .cbt-actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          justify-content: center;
        }

        .cbt-btn {
          border-radius: 999px;
          padding: 10px 20px;
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

        @media (max-width: 900px) {
          .cbt-result__hero {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="cbt-result__shell">
        <section className="cbt-result__hero">
          <div>
            <div className="cbt-result__kicker">Quiz submitted</div>
            <h1>Well done, {studentName || 'Student'}.</h1>
            <p style={{ color: '#525760', marginBottom: '16px' }}>
              You have successfully completed <strong>{quiz?.title || 'your quiz'}</strong>.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              <span className={`cbt-pill cbt-pill--${showScore && result.status === 'pass' ? 'success' : 'accent'}`}>
                {showScore ? (result.status === 'pass' ? 'Passed' : 'Completed') : 'Completed'}
              </span>
              {showScore && (
                <>
                  <span className="cbt-pill cbt-pill--accent">{formatPercent(result.percentage)}%</span>
                  <span className="cbt-pill">Grade {result.grade}</span>
                </>
              )}
            </div>
          </div>
          <div className="cbt-card cbt-metrics">
            <div className="cbt-metric">
              <span>Time used</span>
              <span>{formatDuration(timeUsedSeconds)}</span>
            </div>
            {showScore && (
              <div className="cbt-metric">
                <span>Score</span>
                <span>
                  {result.marks_obtained} / {result.total_marks}
                </span>
              </div>
            )}
            <div className="cbt-metric">
              <span>Submitted</span>
              <span>{new Date(result.submitted_at).toLocaleString()}</span>
            </div>
          </div>
        </section>

        <section className="cbt-card">
          <div className="cbt-grid">
            <div className="cbt-stat">
              <span>Total questions</span>
              <strong>{result.total_questions}</strong>
            </div>
            <div className="cbt-stat">
              <span>Attempted</span>
              <strong>{result.attempted_questions}</strong>
            </div>
            {showScore && (
              <>
                <div className="cbt-stat">
                  <span>Correct answers</span>
                  <strong>{result.correct_answers}</strong>
                </div>
                <div className="cbt-stat">
                  <span>Accuracy</span>
                  <strong>{accuracy.toFixed(1)}%</strong>
                </div>
              </>
            )}
          </div>
        </section>

        <section className="cbt-card">
          <div className="cbt-grid">
            <div className="cbt-stat">
              <span>Admission no</span>
              <strong>{student?.admission_no || '—'}</strong>
            </div>
            <div className="cbt-stat">
              <span>Class</span>
              <strong>{student?.school_class?.name || '—'}</strong>
            </div>
            <div className="cbt-stat">
              <span>Arm</span>
              <strong>{student?.class_arm?.name || '—'}</strong>
            </div>
            {result.graded_at && (
              <div className="cbt-stat">
                <span>Graded at</span>
                <strong>{new Date(result.graded_at).toLocaleString()}</strong>
              </div>
            )}
          </div>
        </section>

        <div className="cbt-actions">
          <button
            onClick={async () => {
              await logout();
              router.push('/cbt/login?next=/cbt');
            }}
            className="cbt-btn cbt-btn--primary"
          >
            Logout
          </button>
          {allowReview && (
            <button
              onClick={() => router.push(`/cbt/results/${resultId}/review`)}
              className="cbt-btn cbt-btn--ghost"
            >
              Review answers
            </button>
          )}
          <button
            onClick={() => router.push('/cbt')}
            className="cbt-btn cbt-btn--ghost"
          >
            Back to quizzes
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResultsPage() {
  return (
    <StudentAuthProvider>
      <ResultsPageInner />
    </StudentAuthProvider>
  );
}
const formatPercent = (value: number | string | null | undefined): string => {
  const numeric = typeof value === 'number' ? value : Number(value);
  if (Number.isNaN(numeric)) {
    return '0.0';
  }
  return numeric.toFixed(1);
};
