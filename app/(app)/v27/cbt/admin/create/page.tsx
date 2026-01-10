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
  shuffle_questions: boolean;
  shuffle_options: boolean;
  allow_review: boolean;
}

interface Subject {
  id: string;
  name: string;
}

interface Class {
  id: string;
  name: string;
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

  const [formData, setFormData] = useState<QuizFormData>({
    title: '',
    description: '',
    duration_minutes: 30,
    total_questions: 10,
    passing_score: 50,
    subject_id: '',
    class_id: '',
    show_answers: true,
    shuffle_questions: false,
    shuffle_options: false,
    allow_review: true,
  });

  // Load subjects and classes on mount
  useEffect(() => {
    const loadData = async () => {
      try {
        setLoadingData(true);
        const [subjectsRes, classesRes] = await Promise.all([
          apiFetch<{ data: Subject[] }>('/api/v1/settings/subjects'),
          apiFetch<{ data: Class[] }>('/api/v1/classes'),
        ]);

        setSubjects(subjectsRes.data || []);
        setClasses(classesRes.data || []);
        setError(null);
      } catch (err: any) {
        setError('Failed to load subjects and classes');
        console.error('Error loading data:', err);
      } finally {
        setLoadingData(false);
      }
    };

    if (user) {
      loadData();
    }
  }, [user]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? parseInt(value) : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.title.trim()) {
      setError('Quiz title is required');
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

      const response = await apiFetch<{ data: { id: string } }>('/api/v1/cbt/quizzes', {
        method: 'POST',
        body: JSON.stringify({
          ...formData,
          status: 'draft', // Create as draft by default
        }),
      });

      setSuccess(true);

      // Redirect to the quiz details page or back to list after 2 seconds
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

  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <p className="text-gray-500">Please log in to create a quiz</p>
        </div>
      </div>
    );
  }

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <button
          onClick={() => router.back()}
          className="text-indigo-600 hover:text-indigo-700 font-medium mb-4 flex items-center gap-2"
        >
          ← Back
        </button>
        <h1 className="text-4xl font-bold text-gray-900 mb-2">Create New Quiz</h1>
        <p className="text-gray-600">Set up a new Computer-Based Test for your students</p>
      </div>

      {/* Success Message */}
      {success && (
        <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✓ Quiz created successfully! Redirecting...
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-8">
        {/* Basic Information */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-indigo-100">
            Basic Information
          </h2>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Quiz Title *</label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              placeholder="e.g., Mathematics Final Exam"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              required
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Provide details about this quiz..."
              rows={4}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Subject *</label>
              <select
                name="subject_id"
                value={formData.subject_id}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              >
                <option value="">Select a subject</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>
                    {subject.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Class (Optional)</label>
              <select
                name="class_id"
                value={formData.class_id}
                onChange={handleInputChange}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
              >
                <option value="">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Quiz Settings */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-indigo-100">
            Quiz Settings
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (minutes) *</label>
              <input
                type="number"
                name="duration_minutes"
                value={formData.duration_minutes}
                onChange={handleInputChange}
                min="1"
                max="480"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Total Questions *</label>
              <input
                type="number"
                name="total_questions"
                value={formData.total_questions}
                onChange={handleInputChange}
                min="1"
                max="1000"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Passing Score (%) *</label>
              <input
                type="number"
                name="passing_score"
                value={formData.passing_score}
                onChange={handleInputChange}
                min="0"
                max="100"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none transition"
                required
              />
            </div>
          </div>
        </div>

        {/* Display Options */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-4 border-b-2 border-indigo-100">
            Display Options
          </h2>

          <div className="space-y-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="show_answers"
                checked={formData.show_answers}
                onChange={handleInputChange}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-700">Show correct answers after submission</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="shuffle_questions"
                checked={formData.shuffle_questions}
                onChange={handleInputChange}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-700">Randomize question order for each student</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="shuffle_options"
                checked={formData.shuffle_options}
                onChange={handleInputChange}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-700">Randomize answer options for each student</span>
            </label>

            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="allow_review"
                checked={formData.allow_review}
                onChange={handleInputChange}
                className="w-4 h-4 text-indigo-600 rounded focus:ring-2 focus:ring-indigo-500"
              />
              <span className="text-gray-700">Allow students to review their answers</span>
            </label>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4 pt-6 border-t border-gray-200">
          <button
            type="button"
            onClick={() => router.back()}
            className="flex-1 px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex-1 px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Creating...' : 'Create Quiz'}
          </button>
        </div>
      </form>

      {/* Info Box */}
      <div className="mt-8 p-6 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold text-blue-900 mb-2">📝 Next Steps</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• After creating the quiz, you'll be able to add questions</li>
          <li>• Make sure to set passing score before publishing</li>
          <li>• You can save as draft and edit later</li>
          <li>• Publish the quiz when ready for students to see it</li>
        </ul>
      </div>
    </div>
  );
}
