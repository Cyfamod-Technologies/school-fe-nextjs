'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { studentLoginWithName } from '@/lib/studentAuth';

const styles = `
.student-login .student-cta {
  background: linear-gradient(135deg, #2563eb 0%, #4f46e5 100%);
  border-radius: 18px;
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  padding: 1.5rem;
  gap: 1rem;
  box-shadow: 0 18px 40px rgba(37, 99, 235, 0.25);
}

.student-login .student-cta .cta-icon {
  width: 54px;
  height: 54px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
  margin-right: 1rem;
}

.student-login .student-cta .cta-text {
  max-width: 520px;
}

.student-login .login-box {
  border-radius: 24px;
  box-shadow: 0 18px 40px rgba(15, 23, 42, 0.08);
  padding: 2.5rem;
}

.student-login .login-box h2 {
  font-weight: 700;
  margin-bottom: 0.25rem;
}

.student-login .login-box .text-muted {
  color: #64748b !important;
}

.student-login .student-footer {
  color: #ffffff;
  font-weight: 500;
}

.student-login .student-footer a {
  color: #2563eb;
  font-weight: 700;
  text-decoration: none;
  border-bottom: 2px solid rgba(37, 99, 235, 0.25);
  padding-bottom: 0.1rem;
}

@media (max-width: 576px) {
  .student-login .login-box {
    padding: 1.5rem;
  }
}
`;

export default function CBTStudentLoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') || '/cbt';

  const [admissionNo, setAdmissionNo] = useState('');
  const [firstName, setFirstName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await studentLoginWithName({
        admission_no: admissionNo.trim(),
        first_name: firstName.trim(),
      });
      router.push(nextPath);
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : 'Unable to login. Please check the details.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-page-wrap student-login">
      <div className="login-page-content">
        <div className="student-cta mb-4">
          <div className="d-flex align-items-center">
            <span className="cta-icon">
              <i className="fas fa-pen-alt" aria-hidden="true" />
            </span>
            <div className="cta-text">
              <div className="font-weight-bold mb-1">Student Quiz Portal</div>
              <small className="text-white-50">
                Sign in to see the quizzes available for your school and class.
              </small>
            </div>
          </div>
        </div>

        <div className="login-box">
          <div className="item-logo mb-4">
            <Link href="/" className="d-inline-flex align-items-center">
              <img
                src="/assets/img/logo2.png"
                alt="Quiz Portal Logo"
                style={{ maxWidth: '160px', height: 'auto' }}
              />
            </Link>
          </div>
          <h2>Student Quiz Login</h2>
          <p className="text-muted mb-4">
            Enter your admission number and first name to view available quizzes.
          </p>
          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}
          <form onSubmit={handleSubmit}>
            <div className="form-group mb-4">
              <label htmlFor="admission-no">Admission Number</label>
              <input
                id="admission-no"
                type="text"
                className="form-control"
                value={admissionNo}
                onChange={(event) => setAdmissionNo(event.target.value)}
                required
                placeholder="DIS002-2024/2025/01"
              />
            </div>
            <div className="form-group mb-4">
              <label htmlFor="first-name">First Name</label>
              <input
                id="first-name"
                type="text"
                className="form-control"
                value={firstName}
                onChange={(event) => setFirstName(event.target.value)}
                required
                placeholder="e.g. David"
              />
            </div>
            <button
              type="submit"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark btn-block"
              disabled={loading}
            >
              {loading ? 'Signing in...' : 'Continue'}
            </button>
          </form>
        </div>
        <p className="student-footer text-center mt-4 small">
          Need to choose a different quiz? <Link href="/cbt">Back to quiz list</Link>
        </p>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}
