'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { StudentAuthProvider, useStudentAuth } from '@/contexts/StudentAuthContext';
import { apiFetch } from '@/lib/apiClient';

interface QuizQuestion {
  id: string;
  quiz_id: string;
  question_text: string;
  question_type: 'mcq' | 'multiple_select' | 'true_false' | 'short_answer';
  marks: number;
  order: number;
  image_url?: string;
  explanation?: string;
  options: QuizOption[];
}

interface QuizOption {
  id: string;
  question_id: string;
  option_text: string;
  order: number;
  image_url?: string;
}

interface Quiz {
  id: string;
  title: string;
  subject_name?: string | null;
  duration_minutes: number;
  total_questions: number;
  show_answers: boolean;
  allow_review: boolean;
}

interface QuizAnswer {
  questionId: string;
  selectedOption?: string;
  answerText?: string;
  selectedOptions?: string[];
}

function TakeQuizPageInner() {
  const params = useParams();
  const router = useRouter();
  const { student, loading: authLoading } = useStudentAuth();
  const quizId = params.quizId as string;

  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Map<string, QuizAnswer>>(new Map());
  const [timeRemaining, setTimeRemaining] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [attemptId, setAttemptId] = useState<string | null>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Load quiz data and start attempt
  useEffect(() => {
    if (authLoading) return;

    if (!student) {
      router.push(`/cbt/login?next=/cbt/${quizId}/take`);
      return;
    }

    const loadQuiz = async () => {
      try {
        setLoading(true);
        // Load quiz details
        const quizResponse = await apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}`, {
          authScope: 'student',
        });
        setQuiz(quizResponse.data);

        // Load questions
        const questionsResponse = await apiFetch<{ data: QuizQuestion[] }>(
          `/api/v1/cbt/quizzes/${quizId}/questions`,
          { authScope: 'student' },
        );
        setQuestions(questionsResponse.data || []);

        // Start attempt
        const attemptResponse = await apiFetch<{ data: { id: string } }>('/api/v1/cbt/quiz-attempts', {
          method: 'POST',
          body: JSON.stringify({
            quiz_id: quizId,
          }),
          authScope: 'student',
        });
        setAttemptId(attemptResponse.data.id);
        setTimeRemaining(quizResponse.data.duration_minutes * 60);

        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load quiz');
        console.error('Error loading quiz:', err);
      } finally {
        setLoading(false);
      }
    };

    if (quizId) {
      loadQuiz();
    }
  }, [authLoading, student, quizId, router]);

  // Timer effect
  useEffect(() => {
    if (timeRemaining <= 0 || !attemptId) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          // Auto-submit quiz when time expires
          submitQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [timeRemaining, attemptId]);

  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    return `${minutes}m ${secs}s`;
  };

  const handleAnswerChange = (answer: QuizAnswer) => {
    setAnswers(new Map(answers.set(answer.questionId, answer)));
  };

  const handleNext = () => {
    if (currentQuestionIndex < questions.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  const handlePrevious = () => {
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(currentQuestionIndex - 1);
    }
  };

  const handleGoToQuestion = (index: number) => {
    setCurrentQuestionIndex(index);
  };

  const submitQuiz = async () => {
    if (!attemptId) return;

    try {
      // Submit all answers
      const answersArray = Array.from(answers.values());
      const questionLookup = new Map(questions.map((question) => [question.id, question]));
      for (const answer of answersArray) {
        const question = questionLookup.get(answer.questionId);
        const payload: Record<string, unknown> = {
          attempt_id: attemptId,
          question_id: answer.questionId,
        };

        if (question?.question_type === 'multiple_select') {
          payload.answer_text = JSON.stringify(answer.selectedOptions || []);
        } else {
          payload.selected_option_id = answer.selectedOption;
          payload.answer_text = answer.answerText;
        }

        await apiFetch('/api/v1/cbt/quiz-answers', {
          method: 'POST',
          body: JSON.stringify(payload),
          authScope: 'student',
        });
      }

      // Submit the attempt
      await apiFetch(`/api/v1/cbt/quiz-attempts/${attemptId}/submit`, {
        method: 'POST',
        authScope: 'student',
      });

      // Redirect to results
      router.push(`/cbt/results/${attemptId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit quiz');
      console.error('Error submitting quiz:', err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (!student) {
    return null;
  }

  if (error || !quiz || questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error || 'Failed to load quiz'}</p>
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

  const currentQuestion = questions[currentQuestionIndex];
  const currentAnswer = answers.get(currentQuestion.id);
  const answeredCount = answers.size;
  const unansweredCount = questions.length - answeredCount;
  const progressPercent = Math.round((answeredCount / questions.length) * 100);
  const questionTypeLabel = currentQuestion.question_type.replace('_', ' ');

  return (
    <div className="cbt-take">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Space+Grotesk:wght@400;500;600&display=swap');

        .cbt-take {
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

        .cbt-shell {
          max-width: 1200px;
          margin: 0 auto;
        }

        .cbt-header {
          border-radius: 26px;
          background: linear-gradient(135deg, #fef3dd 0%, #f8e4bb 45%, #e3f0ff 100%);
          padding: 24px 28px;
          display: grid;
          grid-template-columns: minmax(0, 1.3fr) minmax(0, 0.9fr);
          gap: 24px;
          box-shadow: var(--cbt-shadow);
          position: relative;
          overflow: hidden;
        }

        .cbt-header::before {
          content: '';
          position: absolute;
          inset: 0;
          background: radial-gradient(circle at 15% 10%, rgba(255, 255, 255, 0.75), transparent 55%);
          pointer-events: none;
        }

        .cbt-header h1 {
          font-family: 'Fraunces', 'Times New Roman', serif;
          font-size: clamp(28px, 3.2vw, 42px);
          margin-bottom: 8px;
        }

        .cbt-kicker {
          text-transform: uppercase;
          letter-spacing: 0.18em;
          font-size: 11px;
          font-weight: 600;
          color: var(--cbt-muted);
        }

        .cbt-subline {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          align-items: center;
          color: var(--cbt-muted);
          font-weight: 500;
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

        .cbt-header__right {
          background: rgba(255, 255, 255, 0.82);
          border-radius: 20px;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.95);
          display: grid;
          gap: 14px;
          align-content: start;
        }

        .cbt-timer {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
          gap: 12px;
          font-weight: 600;
        }

        .cbt-timer__value {
          font-size: 24px;
          color: var(--cbt-accent);
        }

        .cbt-progress__bar {
          height: 8px;
          border-radius: 999px;
          background: #efe8dd;
          overflow: hidden;
        }

        .cbt-progress__bar span {
          display: block;
          height: 100%;
          border-radius: inherit;
          background: linear-gradient(90deg, var(--cbt-accent), var(--cbt-accent-2));
        }

        .cbt-progress__meta {
          display: flex;
          justify-content: space-between;
          font-size: 13px;
          color: var(--cbt-muted);
        }

        .cbt-card {
          background: var(--cbt-card);
          border-radius: 20px;
          padding: 18px 20px;
          border: 1px solid var(--cbt-border);
          box-shadow: 0 14px 30px rgba(18, 24, 38, 0.08);
        }

        .cbt-student-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
          gap: 14px;
        }

        .cbt-info-item span {
          display: block;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          color: var(--cbt-muted);
          margin-bottom: 4px;
        }

        .cbt-info-item strong {
          font-size: 16px;
        }

        .cbt-layout {
          display: grid;
          grid-template-columns: minmax(0, 3fr) minmax(0, 1.2fr);
          gap: 22px;
          margin-top: 22px;
        }

        .cbt-question-title {
          font-size: 22px;
          font-weight: 600;
          margin-top: 10px;
          margin-bottom: 6px;
        }

        .cbt-question-top {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          flex-wrap: wrap;
        }

        .cbt-question-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .cbt-tag {
          padding: 6px 12px;
          border-radius: 999px;
          background: rgba(42, 157, 143, 0.14);
          color: #1f756d;
          font-size: 12px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .cbt-tag--muted {
          background: rgba(228, 87, 46, 0.14);
          color: #8f3a20;
        }

        .cbt-answer-block {
          margin-top: 20px;
          display: grid;
          gap: 12px;
        }

        .cbt-option {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
          padding: 14px 16px;
          border-radius: 16px;
          border: 1px solid var(--cbt-border);
          background: #fffdfb;
          cursor: pointer;
          transition: border-color 150ms ease, box-shadow 150ms ease, transform 150ms ease;
        }

        .cbt-option input {
          width: 18px;
          height: 18px;
          appearance: none;
          border: 2px solid #cfc7bd;
          border-radius: 50%;
          display: inline-grid;
          place-content: center;
          margin: 0;
        }

        .cbt-option input[type='checkbox'] {
          border-radius: 6px;
        }

        .cbt-option input::before {
          content: '';
          width: 8px;
          height: 8px;
          transform: scale(0);
          transition: transform 120ms ease;
          border-radius: inherit;
          background: var(--cbt-accent);
        }

        .cbt-option input:checked::before {
          transform: scale(1);
        }

        .cbt-option.is-selected {
          border-color: rgba(228, 87, 46, 0.6);
          box-shadow: 0 12px 24px rgba(228, 87, 46, 0.12);
          transform: translateY(-1px);
        }

        .cbt-option__text {
          font-size: 15px;
          color: var(--cbt-ink);
        }

        .cbt-textarea {
          width: 100%;
          border-radius: 16px;
          padding: 14px;
          border: 1px solid var(--cbt-border);
          font-family: inherit;
        }

        .cbt-textarea:focus {
          outline: none;
          border-color: rgba(228, 87, 46, 0.5);
          box-shadow: 0 0 0 3px rgba(228, 87, 46, 0.16);
        }

        .cbt-nav {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          border-top: 1px solid #efe7dd;
          padding-top: 18px;
          margin-top: 24px;
          align-items: center;
        }

        .cbt-btn {
          border-radius: 999px;
          padding: 10px 18px;
          font-weight: 600;
          border: 1px solid transparent;
          transition: transform 150ms ease, box-shadow 150ms ease;
        }

        .cbt-btn--ghost {
          border-color: #d9d1c7;
          background: #fff;
          color: var(--cbt-ink);
        }

        .cbt-btn--primary {
          background: var(--cbt-ink);
          color: #fff;
        }

        .cbt-btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
          box-shadow: none;
        }

        .cbt-btn:not(:disabled):hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(18, 24, 38, 0.18);
        }

        .cbt-sidebar {
          position: sticky;
          top: 24px;
          align-self: start;
        }

        .cbt-palette {
          display: grid;
          grid-template-columns: repeat(5, minmax(0, 1fr));
          gap: 8px;
          margin-top: 12px;
        }

        .cbt-palette__btn {
          border: none;
          border-radius: 10px;
          padding: 8px 0;
          font-weight: 600;
          font-size: 13px;
          cursor: pointer;
          transition: transform 150ms ease, box-shadow 150ms ease;
        }

        .cbt-palette__btn.is-active {
          background: var(--cbt-ink);
          color: #fff;
          box-shadow: 0 10px 20px rgba(18, 24, 38, 0.2);
        }

        .cbt-palette__btn.is-answered {
          background: rgba(42, 157, 143, 0.18);
          color: #1a6d64;
        }

        .cbt-palette__btn.is-unanswered {
          background: #f0e9e0;
          color: #6b6f76;
        }

        .cbt-legend {
          display: grid;
          gap: 8px;
          margin-top: 16px;
          font-size: 13px;
          color: var(--cbt-muted);
        }

        .cbt-legend span {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .cbt-legend i {
          width: 10px;
          height: 10px;
          border-radius: 50%;
          display: inline-block;
        }

        .cbt-modal {
          position: fixed;
          inset: 0;
          background: rgba(16, 18, 22, 0.55);
          display: grid;
          place-items: center;
          padding: 20px;
          z-index: 50;
        }

        .cbt-modal__card {
          max-width: 420px;
          width: 100%;
          background: #fff;
          border-radius: 20px;
          padding: 24px;
          box-shadow: 0 24px 50px rgba(18, 24, 38, 0.2);
        }

        .cbt-fade {
          animation: cbt-fade 600ms ease both;
        }

        .cbt-delay-1 {
          animation-delay: 120ms;
        }

        .cbt-delay-2 {
          animation-delay: 240ms;
        }

        .cbt-delay-3 {
          animation-delay: 360ms;
        }

        @keyframes cbt-fade {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 980px) {
          .cbt-header {
            grid-template-columns: 1fr;
          }

          .cbt-layout {
            grid-template-columns: 1fr;
          }

          .cbt-sidebar {
            position: static;
          }
        }
      `}</style>

      <div className="cbt-shell">
        <header className="cbt-header cbt-fade">
          <div>
            <div className="cbt-kicker">CBT Session</div>
            <h1>{quiz.title}</h1>
            <div className="cbt-subline">
              <span className="cbt-pill">{quiz.subject_name || 'General'}</span>
              <span>
                Question {currentQuestionIndex + 1} of {questions.length}
              </span>
            </div>
          </div>
          <div className="cbt-header__right">
            <div className="cbt-timer">
              <span>Time left</span>
              <span className="cbt-timer__value">{formatTime(timeRemaining)}</span>
            </div>
            <div>
              <div className="cbt-progress__bar">
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <div className="cbt-progress__meta">
                <span>{answeredCount} answered</span>
                <span>{unansweredCount} remaining</span>
              </div>
            </div>
          </div>
        </header>

        <section className="cbt-card cbt-fade cbt-delay-1" style={{ marginTop: '18px' }}>
          <div className="cbt-student-grid">
            <div className="cbt-info-item">
              <span>Admission No</span>
              <strong>{student.admission_no}</strong>
            </div>
            <div className="cbt-info-item">
              <span>Student</span>
              <strong>{student.first_name}</strong>
            </div>
            <div className="cbt-info-item">
              <span>Class</span>
              <strong>{student.school_class?.name || '-'}</strong>
            </div>
            <div className="cbt-info-item">
              <span>Arm</span>
              <strong>{student.class_arm?.name || '-'}</strong>
            </div>
          </div>
        </section>

        <div className="cbt-layout">
          <main className="cbt-card cbt-fade cbt-delay-2">
            <div className="cbt-question-top">
              <div>
                <div className="cbt-kicker">Question {currentQuestionIndex + 1}</div>
                <div className="cbt-question-title">{currentQuestion.question_text}</div>
              </div>
              <div className="cbt-question-tags">
                <span className="cbt-tag">{currentQuestion.marks} marks</span>
                <span className="cbt-tag cbt-tag--muted">{questionTypeLabel}</span>
              </div>
            </div>

            {currentQuestion.image_url && (
              <img
                src={currentQuestion.image_url}
                alt="Question"
                className="cbt-card"
                style={{ marginTop: '16px' }}
              />
            )}

            {currentQuestion.question_type === 'mcq' && (
              <div className="cbt-answer-block">
                {currentQuestion.options.map((option) => {
                  const isSelected = currentAnswer?.selectedOption === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`cbt-option ${isSelected ? 'is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option.id}
                        checked={isSelected}
                        onChange={() =>
                          handleAnswerChange({
                            questionId: currentQuestion.id,
                            selectedOption: option.id,
                          })
                        }
                      />
                      <span className="cbt-option__text">{option.option_text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {currentQuestion.question_type === 'true_false' && (
              <div className="cbt-answer-block">
                {currentQuestion.options.map((option) => {
                  const isSelected = currentAnswer?.selectedOption === option.id;
                  return (
                    <label
                      key={option.id}
                      className={`cbt-option ${isSelected ? 'is-selected' : ''}`}
                    >
                      <input
                        type="radio"
                        name={`question-${currentQuestion.id}`}
                        value={option.id}
                        checked={isSelected}
                        onChange={() =>
                          handleAnswerChange({
                            questionId: currentQuestion.id,
                            selectedOption: option.id,
                          })
                        }
                      />
                      <span className="cbt-option__text">{option.option_text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {currentQuestion.question_type === 'multiple_select' && (
              <div className="cbt-answer-block">
                {currentQuestion.options.map((option) => {
                  const isSelected = currentAnswer?.selectedOptions?.includes(option.id) || false;
                  return (
                    <label
                      key={option.id}
                      className={`cbt-option ${isSelected ? 'is-selected' : ''}`}
                    >
                      <input
                        type="checkbox"
                        value={option.id}
                        checked={isSelected}
                        onChange={(e) => {
                          const selected = new Set(currentAnswer?.selectedOptions || []);
                          if (e.target.checked) {
                            selected.add(option.id);
                          } else {
                            selected.delete(option.id);
                          }
                          handleAnswerChange({
                            questionId: currentQuestion.id,
                            selectedOptions: Array.from(selected),
                          });
                        }}
                      />
                      <span className="cbt-option__text">{option.option_text}</span>
                    </label>
                  );
                })}
              </div>
            )}

            {currentQuestion.question_type === 'short_answer' && (
              <textarea
                value={currentAnswer?.answerText || ''}
                onChange={(e) =>
                  handleAnswerChange({
                    questionId: currentQuestion.id,
                    answerText: e.target.value,
                  })
                }
                className="cbt-textarea"
                rows={6}
                placeholder="Enter your answer here..."
              />
            )}

            <div className="cbt-nav">
              <button
                onClick={handlePrevious}
                disabled={currentQuestionIndex === 0}
                className="cbt-btn cbt-btn--ghost"
              >
                Previous
              </button>
              <button
                onClick={handleNext}
                disabled={currentQuestionIndex === questions.length - 1}
                className="cbt-btn cbt-btn--ghost"
              >
                Next
              </button>
              <button
                onClick={() => setShowConfirmation(true)}
                className="cbt-btn cbt-btn--primary"
                style={{ marginLeft: 'auto' }}
              >
                Submit quiz
              </button>
            </div>
          </main>

          <aside className="cbt-card cbt-sidebar cbt-fade cbt-delay-3">
            <div className="cbt-kicker">Question map</div>
            <div className="cbt-question-title" style={{ fontSize: '18px' }}>
              {answeredCount}/{questions.length} answered
            </div>
            <div className="cbt-palette">
              {questions.map((q, index) => {
                const stateClass =
                  index === currentQuestionIndex
                    ? 'is-active'
                    : answers.has(q.id)
                      ? 'is-answered'
                      : 'is-unanswered';
                return (
                  <button
                    key={q.id}
                    onClick={() => handleGoToQuestion(index)}
                    className={`cbt-palette__btn ${stateClass}`}
                  >
                    {index + 1}
                  </button>
                );
              })}
            </div>

            <div className="cbt-legend">
              <span>
                <i style={{ background: '#1a1a1a' }} /> Current
              </span>
              <span>
                <i style={{ background: '#2a9d8f' }} /> Answered
              </span>
              <span>
                <i style={{ background: '#d8d1c8' }} /> Unanswered
              </span>
            </div>
          </aside>
        </div>
      </div>

      {showConfirmation && (
        <div className="cbt-modal">
          <div className="cbt-modal__card">
            <h2 className="cbt-question-title">Submit quiz?</h2>
            <p style={{ color: '#525760', marginBottom: '8px' }}>
              You have answered <strong>{answeredCount}</strong> out of{' '}
              <strong>{questions.length}</strong> questions.
            </p>
            <p style={{ color: '#525760', marginBottom: '18px' }}>
              Once submitted, you cannot change your answers.
            </p>

            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                onClick={() => setShowConfirmation(false)}
                className="cbt-btn cbt-btn--ghost"
                style={{ flex: 1 }}
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  submitQuiz();
                }}
                className="cbt-btn cbt-btn--primary"
                style={{ flex: 1 }}
              >
                Submit
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TakeQuizPage() {
  return (
    <StudentAuthProvider>
      <TakeQuizPageInner />
    </StudentAuthProvider>
  );
}
