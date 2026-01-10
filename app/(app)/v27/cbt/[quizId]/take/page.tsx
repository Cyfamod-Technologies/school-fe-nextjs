'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
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

export default function TakeQuizPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
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
    const loadQuiz = async () => {
      try {
        setLoading(true);
        // Load quiz details
        const quizResponse = await apiFetch<{ data: Quiz }>(`/api/v1/cbt/quizzes/${quizId}`);
        setQuiz(quizResponse.data);

        // Load questions
        const questionsResponse = await apiFetch<{ data: QuizQuestion[] }>(`/api/v1/cbt/quizzes/${quizId}/questions`);
        setQuestions(questionsResponse.data || []);

        // Start attempt
        const attemptResponse = await apiFetch<{ data: { id: string } }>('/api/v1/cbt/quiz-attempts', {
          method: 'POST',
          body: JSON.stringify({
            quiz_id: quizId,
          }),
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

    if (quizId && user) {
      loadQuiz();
    }
  }, [quizId, user]);

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
      for (const answer of answersArray) {
        await apiFetch('/api/v1/cbt/quiz-answers', {
          method: 'POST',
          body: JSON.stringify({
            attempt_id: attemptId,
            question_id: answer.questionId,
            selected_option_id: answer.selectedOption,
            answer_text: answer.answerText,
          }),
        });
      }

      // Submit the attempt
      await apiFetch(`/api/v1/cbt/quiz-attempts/${attemptId}/submit`, {
        method: 'POST',
      });

      // Redirect to results
      router.push(`/v27/cbt/results/${attemptId}`);
    } catch (err: any) {
      setError(err.message || 'Failed to submit quiz');
      console.error('Error submitting quiz:', err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  if (error || !quiz || questions.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-red-600 text-lg mb-4">{error || 'Failed to load quiz'}</p>
          <button
            onClick={() => router.push('/v27/cbt')}
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-6 bg-white rounded-lg shadow-md p-6 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">{quiz.title}</h1>
            <p className="text-gray-600">
              Question {currentQuestionIndex + 1} of {questions.length}
            </p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-indigo-600">{formatTime(timeRemaining)}</div>
            <p className="text-gray-600 text-sm">Time Remaining</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Main Question Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-lg shadow-md p-8">
              <div className="mb-8">
                <h2 className="text-xl font-bold text-gray-900 mb-4">{currentQuestion.question_text}</h2>

                {currentQuestion.image_url && (
                  <img
                    src={currentQuestion.image_url}
                    alt="Question"
                    className="max-w-full h-auto mb-6 rounded-lg"
                  />
                )}

                {currentQuestion.question_type === 'mcq' && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option) => (
                      <label key={option.id} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors">
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          value={option.id}
                          checked={currentAnswer?.selectedOption === option.id}
                          onChange={() =>
                            handleAnswerChange({
                              questionId: currentQuestion.id,
                              selectedOption: option.id,
                            })
                          }
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="ml-4 text-gray-700">{option.option_text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.question_type === 'true_false' && (
                  <div className="space-y-3">
                    {[
                      { id: 'true', text: 'True' },
                      { id: 'false', text: 'False' },
                    ].map((option) => (
                      <label key={option.id} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors">
                        <input
                          type="radio"
                          name={`question-${currentQuestion.id}`}
                          value={option.id}
                          checked={currentAnswer?.selectedOption === option.id}
                          onChange={() =>
                            handleAnswerChange({
                              questionId: currentQuestion.id,
                              selectedOption: option.id,
                            })
                          }
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="ml-4 text-gray-700">{option.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {currentQuestion.question_type === 'multiple_select' && (
                  <div className="space-y-3">
                    {currentQuestion.options.map((option) => (
                      <label key={option.id} className="flex items-center p-4 border rounded-lg cursor-pointer hover:bg-indigo-50 transition-colors">
                        <input
                          type="checkbox"
                          value={option.id}
                          checked={currentAnswer?.selectedOptions?.includes(option.id) || false}
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
                          className="w-4 h-4 text-indigo-600"
                        />
                        <span className="ml-4 text-gray-700">{option.option_text}</span>
                      </label>
                    ))}
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
                    className="w-full p-4 border rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-600"
                    rows={6}
                    placeholder="Enter your answer here..."
                  />
                )}
              </div>

              {/* Navigation Buttons */}
              <div className="flex gap-4 pt-6 border-t">
                <button
                  onClick={handlePrevious}
                  disabled={currentQuestionIndex === 0}
                  className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  ← Previous
                </button>
                <button
                  onClick={handleNext}
                  disabled={currentQuestionIndex === questions.length - 1}
                  className="px-6 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  Next →
                </button>
                <button
                  onClick={() => setShowConfirmation(true)}
                  className="ml-auto px-6 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
                >
                  Submit Quiz
                </button>
              </div>
            </div>
          </div>

          {/* Question Palette Sidebar */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-md p-6">
              <h3 className="font-bold text-gray-900 mb-4">Questions ({answeredCount}/{questions.length})</h3>
              <div className="grid grid-cols-5 gap-2">
                {questions.map((q, index) => (
                  <button
                    key={q.id}
                    onClick={() => handleGoToQuestion(index)}
                    className={`p-2 rounded text-sm font-semibold transition-all ${
                      index === currentQuestionIndex
                        ? 'bg-indigo-600 text-white ring-2 ring-indigo-800'
                        : answers.has(q.id)
                          ? 'bg-green-100 text-green-800 hover:bg-green-200'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-indigo-600"></div>
                    <span className="text-gray-700">Current</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-700">Answered</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-gray-300"></div>
                    <span className="text-gray-700">Unanswered</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Submission Confirmation Modal */}
      {showConfirmation && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Submit Quiz?</h2>
            <p className="text-gray-600 mb-2">
              You have answered <strong>{answeredCount}</strong> out of <strong>{questions.length}</strong> questions.
            </p>
            <p className="text-gray-600 mb-6">
              Once submitted, you cannot change your answers.
            </p>

            <div className="flex gap-4">
              <button
                onClick={() => setShowConfirmation(false)}
                className="flex-1 px-4 py-2 rounded-lg border border-gray-300 text-gray-700 font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  submitQuiz();
                }}
                className="flex-1 px-4 py-2 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors"
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
