"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { studentLogin } from "@/lib/studentAuth";
import { DEMO_MODE_ENABLED } from "@/lib/config";

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

.student-login .student-cta .cta-action {
  background: #ffffff;
  color: #2563eb;
  font-weight: 700;
  padding: 0.65rem 1.8rem;
  border-radius: 999px;
  text-decoration: none;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.12);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.student-login .student-cta .cta-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(0, 0, 0, 0.18);
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

export default function StudentLoginPage() {
  const router = useRouter();
  const [admissionNo, setAdmissionNo] = useState("");
  const [password, setPassword] = useState("123456");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const demoModeEnabled = DEMO_MODE_ENABLED;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await studentLogin({
        admission_no: admissionNo.trim(),
        password: password.trim(),
      });
      router.push("/v26/student-dashboard");
    } catch (submissionError) {
      const message =
        submissionError instanceof Error
          ? submissionError.message
          : "Unable to login. Please check the credentials.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  const applyDemoCredentials = () => {
    setAdmissionNo("DIS002-2024/2025/1");
    setPassword("123456");
    setError(null);
  };

  return (
    <div className="login-page-wrap student-login">
      <div className="login-page-content">
        <div className="student-cta mb-4">
          <div className="d-flex align-items-center">
            <span className="cta-icon">
              <i className="fas fa-id-card" aria-hidden="true" />
            </span>
            <div className="cta-text">
              <div className="font-weight-bold mb-1">Student Result Portal</div>
              <small className="text-white-50">
                Sign in with your admission number and password
                . You can update it after your first login.
              </small>
            </div>
          </div>
          {/* <Link href="/login" className="cta-action">
            Staff / Admin Login
          </Link> */}
        </div>

        <div className="login-box">
          <div className="item-logo mb-4">
            <Link href="/" className="d-inline-flex align-items-center">
              <img
                src="/assets/img/logo2.png"
                alt="Result Portal Logo"
                style={{ maxWidth: "160px", height: "auto" }}
              />
            </Link>
          </div>
          <h2>Student Login</h2>
          <p className="text-muted mb-4">
            Enter your admission number and password to access your dashboard.
          </p>
          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}
          <form onSubmit={handleSubmit}>
            <div className="form-group mb-4">
              <label htmlFor="admission_no">Admission Number</label>
              <input
                id="admission_no"
                type="text"
                className="form-control"
                value={admissionNo}
                onChange={(event) => setAdmissionNo(event.target.value)}
                required
                placeholder="DIS002-2024/2025/01"
              />
            </div>
            <div className="form-group mb-4">
              <label htmlFor="student-password">Password</label>
              <input
                id="student-password"
                type="password"
                className="form-control"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
              />
       
            </div>
            <button
              type="submit"
              className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark btn-block"
              disabled={loading}
            >
              {loading ? "Signing in…" : "Login"}
            </button>
            {demoModeEnabled ? (
              <div className="form-group mt-3">
                <label className="text-muted small d-block mb-1">
                  Demo login
                </label>
                <button
                  type="button"
                  className="btn btn-sm btn-outline-secondary"
                  onClick={applyDemoCredentials}
                >
                  DIS002-2024/2025/1 / 123456
                </button>
              </div>
            ) : null}
          </form>
        </div>
        <p className="student-footer text-center mt-4 small">
          Your information is protected. If you have trouble signing in, please
          contact your school administrator.
        </p>
      </div>
      <style jsx>{styles}</style>
    </div>
  );
}
