'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { StudentAuthProvider, useStudentAuth } from '@/contexts/StudentAuthContext';
import { apiFetch } from '@/lib/apiClient';

interface Quiz {
  id: string;
  title: string;
  description: string | null;
  subject_id: string | null;
  subject_name?: string | null;
  duration_minutes: number;
  total_questions: number;
  passing_score: number;
  status: 'draft' | 'published' | 'closed';
}

const subjectKey = (quiz: Quiz) => quiz.subject_id ?? 'general';
const subjectLabel = (quiz: Quiz) => quiz.subject_name ?? 'General';

function StudentQuizPortal() {
  const router = useRouter();
  const { student, loading: authLoading } = useStudentAuth();
  const [quizzes, setQuizzes] = useState<Quiz[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [subjectFilter, setSubjectFilter] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!student) {
      router.replace('/cbt/login?next=/cbt');
      return;
    }

    const loadQuizzes = async () => {
      try {
        setLoading(true);
        const response = await apiFetch<{ data: Quiz[] }>('/api/v1/cbt/quizzes', {
          authScope: 'student',
        });
        setQuizzes(response.data || []);
        setError(null);
      } catch (err: any) {
        setError(err.message || 'Failed to load quizzes');
      } finally {
        setLoading(false);
      }
    };

    loadQuizzes();
  }, [authLoading, student, router]);

  const subjectOptions = useMemo(() => {
    const map = new Map<string, string>();
    quizzes.forEach((quiz) => {
      map.set(subjectKey(quiz), subjectLabel(quiz));
    });
    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [quizzes]);

  const filteredQuizzes = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return quizzes.filter((quiz) => {
      if (subjectFilter !== 'all' && subjectKey(quiz) !== subjectFilter) {
        return false;
      }
      if (search && !quiz.title.toLowerCase().includes(search)) {
        return false;
      }
      return true;
    });
  }, [quizzes, subjectFilter, searchTerm]);

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="spinner-border text-dodger-blue" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  const availableCount = filteredQuizzes.length;
  const totalCount = quizzes.length;

  return (
    <div className="cbt-portal">
      <style jsx global>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:wght@600;700&family=Space+Grotesk:wght@400;500;600&display=swap');

        .cbt-portal {
          --cbt-ink: #171717;
          --cbt-muted: #4d5159;
          --cbt-accent: #e4572e;
          --cbt-accent-2: #2a9d8f;
          --cbt-card: #ffffff;
          --cbt-border: #e7e1d9;
          --cbt-shadow: 0 20px 45px rgba(18, 24, 38, 0.12);
          min-height: 100vh;
          padding: 32px 20px 72px;
          background: radial-gradient(circle at top right, #fff2dc 0%, #f4f7fb 45%, #f6efe6 100%);
          color: var(--cbt-ink);
          font-family: 'Space Grotesk', 'Trebuchet MS', sans-serif;
        }

        .cbt-hero {
          position: relative;
          border-radius: 28px;
          padding: 32px 32px 36px;
          background: linear-gradient(135deg, #fef3dd 0%, #f6e7c5 40%, #e4f1ff 100%);
          box-shadow: var(--cbt-shadow);
          overflow: hidden;
          margin-bottom: 28px;
        }

        .cbt-hero::before {
          content: '';
          position: absolute;
          width: 240px;
          height: 240px;
          border-radius: 50%;
          background: rgba(42, 157, 143, 0.14);
          top: -80px;
          right: -60px;
        }

        .cbt-hero::after {
          content: '';
          position: absolute;
          width: 180px;
          height: 180px;
          border-radius: 26px;
          background: rgba(228, 87, 46, 0.14);
          bottom: -40px;
          left: -30px;
          transform: rotate(12deg);
        }

        .cbt-hero__grid {
          position: relative;
          z-index: 1;
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 0.8fr);
          gap: 24px;
        }

        .cbt-hero h1 {
          font-family: 'Fraunces', 'Times New Roman', serif;
          font-size: clamp(28px, 3.4vw, 44px);
          margin-bottom: 10px;
          color: var(--cbt-ink);
        }

        .cbt-hero p {
          color: var(--cbt-muted);
          margin-bottom: 18px;
          max-width: 520px;
        }

        .cbt-pill {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 6px 14px;
          border-radius: 999px;
          background: rgba(255, 255, 255, 0.75);
          border: 1px solid rgba(255, 255, 255, 0.8);
          font-weight: 600;
          letter-spacing: 0.02em;
          font-size: 12px;
          text-transform: uppercase;
        }

        .cbt-steps {
          display: grid;
          gap: 10px;
          margin-top: 18px;
        }

        .cbt-step {
          display: grid;
          grid-template-columns: auto 1fr;
          gap: 12px;
          align-items: center;
          padding: 10px 14px;
          border-radius: 14px;
          background: rgba(255, 255, 255, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.9);
        }

        .cbt-step__index {
          font-weight: 700;
          color: var(--cbt-accent);
        }

        .cbt-hero__panel {
          background: rgba(255, 255, 255, 0.8);
          border-radius: 20px;
          padding: 18px;
          border: 1px solid rgba(255, 255, 255, 0.95);
          display: grid;
          gap: 12px;
          align-content: start;
        }

        .cbt-hero__stat {
          display: flex;
          justify-content: space-between;
          font-weight: 600;
          color: var(--cbt-ink);
        }

        .cbt-card {
          background: var(--cbt-card);
          border-radius: 20px;
          padding: 20px 22px;
          box-shadow: 0 16px 32px rgba(18, 24, 38, 0.08);
          border: 1px solid var(--cbt-border);
          margin-bottom: 20px;
        }

        .cbt-card h3 {
          margin-bottom: 12px;
          font-weight: 600;
        }

        .cbt-info-grid {
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

        .cbt-filters {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          align-items: end;
        }

        .cbt-input,
        .cbt-select {
          width: 100%;
          border-radius: 14px;
          padding: 12px 14px;
          border: 1px solid var(--cbt-border);
          background: #fff;
          color: var(--cbt-ink);
          font-weight: 500;
        }

        .cbt-input:focus,
        .cbt-select:focus {
          outline: none;
          border-color: rgba(228, 87, 46, 0.5);
          box-shadow: 0 0 0 3px rgba(228, 87, 46, 0.15);
        }

        .cbt-count {
          font-size: 28px;
          font-weight: 700;
        }

        .cbt-alert {
          border-radius: 14px;
          padding: 12px 14px;
          background: rgba(228, 87, 46, 0.1);
          color: #8c2c12;
          margin-bottom: 12px;
        }

        .cbt-quiz-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
          gap: 18px;
          margin-top: 12px;
        }

        .cbt-quiz-card {
          background: var(--cbt-card);
          border-radius: 18px;
          padding: 18px;
          border: 1px solid var(--cbt-border);
          box-shadow: 0 14px 28px rgba(18, 24, 38, 0.08);
          display: grid;
          gap: 14px;
          animation: cbt-fade 600ms ease both;
        }

        .cbt-quiz-card__head {
          display: flex;
          justify-content: space-between;
          gap: 10px;
          align-items: start;
        }

        .cbt-quiz-title {
          font-weight: 600;
          font-size: 18px;
          margin-bottom: 4px;
        }

        .cbt-quiz-desc {
          color: var(--cbt-muted);
          font-size: 14px;
        }

        .cbt-status {
          padding: 4px 10px;
          border-radius: 999px;
          font-size: 12px;
          font-weight: 600;
          text-transform: capitalize;
        }

        .cbt-status--published {
          background: rgba(42, 157, 143, 0.15);
          color: #1a685f;
        }

        .cbt-status--draft {
          background: rgba(244, 162, 97, 0.18);
          color: #9c4f1a;
        }

        .cbt-status--closed {
          background: rgba(231, 76, 60, 0.16);
          color: #8b2c24;
        }

        .cbt-quiz-meta {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 8px;
          font-size: 13px;
          color: var(--cbt-muted);
        }

        .cbt-quiz-meta strong {
          display: block;
          font-size: 16px;
          color: var(--cbt-ink);
        }

        .cbt-quiz-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
        }

        .cbt-subject {
          background: rgba(42, 157, 143, 0.12);
          color: #1f756d;
          padding: 6px 12px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 12px;
          text-transform: uppercase;
        }

        .cbt-btn {
          border: none;
          border-radius: 999px;
          padding: 10px 18px;
          background: var(--cbt-ink);
          color: #fff;
          font-weight: 600;
          transition: transform 150ms ease, box-shadow 150ms ease;
        }

        .cbt-btn:hover {
          transform: translateY(-1px);
          box-shadow: 0 10px 22px rgba(18, 24, 38, 0.2);
        }

        .cbt-secondary-btn {
          background: #fff;
          border: 1px solid var(--cbt-border);
          color: var(--cbt-ink);
        }

        @keyframes cbt-fade {
          from {
            opacity: 0;
            transform: translateY(12px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 900px) {
          .cbt-hero__grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <section className="cbt-hero">
        <div className="cbt-hero__grid">
          <div>
            <div className="cbt-pill">CBT Portal</div>
            <h1>Sign in, pick a subject, start a quiz.</h1>
            <p>
              Log in with your admission details to see the quizzes available for your school and
              class.
            </p>
            <div className="cbt-steps">
              <div className="cbt-step">
                <div className="cbt-step__index">01</div>
                <div>Sign in with your admission number and first name.</div>
              </div>
              <div className="cbt-step">
                <div className="cbt-step__index">02</div>
                <div>Pick a subject and quiz that fits your class.</div>
              </div>
              <div className="cbt-step">
                <div className="cbt-step__index">03</div>
                <div>Answer questions and submit before time runs out.</div>
              </div>
            </div>
          </div>
          <div className="cbt-hero__panel">
            <div className="cbt-hero__stat">
              <span>Total quizzes</span>
              <span>{totalCount}</span>
            </div>
            <div className="cbt-hero__stat">
              <span>Subjects</span>
              <span>{subjectOptions.length}</span>
            </div>
            <div className="cbt-hero__stat">
              <span>Signed in</span>
              <span>{student ? 'Yes' : 'No'}</span>
            </div>
            {student ? null : (
              <button
                type="button"
                onClick={() => router.push('/cbt/login?next=/cbt')}
                className="cbt-btn cbt-secondary-btn"
              >
                Go to login
              </button>
            )}
          </div>
        </div>
      </section>

      {authLoading || !student ? null : (
        <section className="cbt-card">
          <h3>Welcome, {student.first_name}</h3>
          <div className="cbt-info-grid">
            <div className="cbt-info-item">
              <span>Admission No</span>
              <strong>{student.admission_no}</strong>
            </div>
            <div className="cbt-info-item">
              <span>Class</span>
              <strong>{student.school_class?.name || '-'}</strong>
            </div>
            <div className="cbt-info-item">
              <span>Arm</span>
              <strong>{student.class_arm?.name || '-'}</strong>
            </div>
            <div className="cbt-info-item">
              <span>Session / Term</span>
              <strong>
                {student.current_session?.name || '-'} / {student.current_term?.name || '-'}
              </strong>
            </div>
          </div>
        </section>
      )}

      <section className="cbt-card">
        <h3>Find a quiz</h3>
        {error ? <div className="cbt-alert">{error}</div> : null}
        <div className="cbt-filters">
          <div>
            <label>Subject</label>
            <select
              value={subjectFilter}
              onChange={(event) => setSubjectFilter(event.target.value)}
              className="cbt-select"
            >
              <option value="all">All subjects</option>
              {subjectOptions.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label>Search quiz</label>
            <input
              type="text"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              className="cbt-input"
              placeholder="Type a quiz title"
            />
          </div>
          <div>
            <label>Available quizzes</label>
            <div className="cbt-count">{availableCount}</div>
          </div>
        </div>
      </section>

      <section className="cbt-card">
        <h3>Available quizzes</h3>
        {availableCount === 0 ? (
          <div className="cbt-alert">No quizzes found for this selection.</div>
        ) : (
          <div className="cbt-quiz-grid">
            {filteredQuizzes.map((quiz, index) => (
              <div
                key={quiz.id}
                className="cbt-quiz-card"
                style={{ animationDelay: `${index * 70}ms` }}
              >
                <div className="cbt-quiz-card__head">
                  <div>
                    <div className="cbt-quiz-title">{quiz.title}</div>
                    <div className="cbt-quiz-desc">{quiz.description || 'No description'}</div>
                  </div>
                  <span className={`cbt-status cbt-status--${quiz.status}`}>{quiz.status}</span>
                </div>
                <div className="cbt-quiz-meta">
                  <div>
                    Duration
                    <strong>{quiz.duration_minutes} min</strong>
                  </div>
                  <div>
                    Questions
                    <strong>{quiz.total_questions}</strong>
                  </div>
                  <div>
                    Pass score
                    <strong>{quiz.passing_score}%</strong>
                  </div>
                </div>
                <div className="cbt-quiz-footer">
                  <span className="cbt-subject">{subjectLabel(quiz)}</span>
                  <button
                    type="button"
                    onClick={() => {
                      if (student) {
                        router.push(`/cbt/${quiz.id}/take`);
                      } else {
                        router.push(
                          `/cbt/login?next=${encodeURIComponent(`/cbt/${quiz.id}/take`)}`,
                        );
                      }
                    }}
                    className="cbt-btn"
                  >
                    Start quiz
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default function CBTHome() {
  return (
    <StudentAuthProvider>
      <StudentQuizPortal />
    </StudentAuthProvider>
  );
}
