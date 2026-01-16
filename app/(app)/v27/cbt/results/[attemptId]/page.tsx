'use client';

import React, { useEffect, useState } from 'react';
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
}

interface Quiz {
  title: string;
}

function ResultsPageInner() {
  const params = useParams();
  const router = useRouter();
  const { student, loading: authLoading } = useStudentAuth();
  const attemptId = params.attemptId as string;

  const [result, setResult] = useState<QuizResult | null>(null);
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadResults = async () => {
      try {
        setLoading(true);
        const response = await apiFetch<{ data: QuizResult }>(`/api/v1/cbt/quiz-results/${attemptId}`, {
          authScope: 'student',
        });
        setResult(response.data);

        // Load quiz details
        if (response.data.quiz_id) {
          const quizResponse = await apiFetch<{ data: Quiz }>(
            `/api/v1/cbt/quizzes/${response.data.quiz_id}`,
            { authScope: 'student' },
          );
          setQuiz(quizResponse.data);
        }

        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load results');
        console.error('Error loading results:', err);
      } finally {
        setLoading(false);
      }
    };

    if (attemptId && student) {
      loadResults();
    }
  }, [attemptId, student]);

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

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case 'A':
        return 'from-green-500 to-green-600';
      case 'B':
        return 'from-blue-500 to-blue-600';
      case 'C':
        return 'from-yellow-500 to-yellow-600';
      case 'D':
        return 'from-orange-500 to-orange-600';
      default:
        return 'from-red-500 to-red-600';
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Quiz Completed! 🎉</h1>
          <p className="text-gray-600">
            {quiz?.title}
          </p>
        </div>

        {/* Grade Card */}
        <div className={`bg-gradient-to-r ${getGradeColor(result.grade)} rounded-2xl shadow-xl p-12 text-white mb-8 text-center`}>
          <div className="mb-6">
            <div className="text-7xl font-bold mb-2">{result.grade}</div>
            <div className="text-2xl font-semibold mb-4">
              {result.status === 'pass' ? '✓ Passed' : '✗ Failed'}
            </div>
            <div className="text-5xl font-bold mb-2">{result.percentage.toFixed(1)}%</div>
            <div className="text-lg opacity-90">
              {result.marks_obtained} / {result.total_marks} marks
            </div>
          </div>
        </div>

        {/* Statistics Grid */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-600 text-sm uppercase tracking-wide mb-2">Total Questions</div>
            <div className="text-3xl font-bold text-gray-900">{result.total_questions}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-600 text-sm uppercase tracking-wide mb-2">Attempted</div>
            <div className="text-3xl font-bold text-blue-600">{result.attempted_questions}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-600 text-sm uppercase tracking-wide mb-2">Correct</div>
            <div className="text-3xl font-bold text-green-600">{result.correct_answers}</div>
          </div>
          <div className="bg-white rounded-lg shadow-md p-6 text-center">
            <div className="text-gray-600 text-sm uppercase tracking-wide mb-2">Accuracy</div>
            <div className="text-3xl font-bold text-indigo-600">
              {result.attempted_questions > 0
                ? ((result.correct_answers / result.attempted_questions) * 100).toFixed(1)
                : 0}
              %
            </div>
          </div>
        </div>

        {/* Performance Breakdown */}
        <div className="bg-white rounded-lg shadow-md p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Performance Breakdown</h2>

          <div className="space-y-6">
            {/* Attempted Questions */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-700 font-medium">Attempted Questions</span>
                <span className="text-gray-900 font-bold">{result.attempted_questions}/{result.total_questions}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${(result.attempted_questions / result.total_questions) * 100}%`,
                  }}
                ></div>
              </div>
            </div>

            {/* Correct Answers */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-700 font-medium">Correct Answers</span>
                <span className="text-gray-900 font-bold">{result.correct_answers}/{result.attempted_questions}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-green-600 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: result.attempted_questions > 0
                      ? `${(result.correct_answers / result.attempted_questions) * 100}%`
                      : 0,
                  }}
                ></div>
              </div>
            </div>

            {/* Marks */}
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-gray-700 font-medium">Marks Obtained</span>
                <span className="text-gray-900 font-bold">{result.marks_obtained}/{result.total_marks}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className="bg-indigo-600 h-3 rounded-full transition-all duration-500"
                  style={{
                    width: `${(result.marks_obtained / result.total_marks) * 100}%`,
                  }}
                ></div>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-600 mb-1">Submitted At</p>
              <p className="text-gray-900 font-semibold">
                {new Date(result.submitted_at).toLocaleString()}
              </p>
            </div>
            {result.graded_at && (
              <div>
                <p className="text-sm text-gray-600 mb-1">Graded At</p>
                <p className="text-gray-900 font-semibold">
                  {new Date(result.graded_at).toLocaleString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => router.push('/cbt')}
            className="px-8 py-3 rounded-lg bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors shadow-lg"
          >
            Back to Quizzes
          </button>
          <button
            onClick={() => router.push('/cbt/history')}
            className="px-8 py-3 rounded-lg bg-gray-600 text-white font-medium hover:bg-gray-700 transition-colors shadow-lg"
          >
            View History
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
