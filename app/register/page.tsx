"use client";

import Link from "next/link";
import Image, { type ImageLoader } from "next/image";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { BACKEND_URL, EMAIL_VERIFICATION_ENABLED, SCHOOL_REGISTRATION_ENABLED } from "@/lib/config";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function RegisterPage() {
  const router = useRouter();
  const registrationEnabled = SCHOOL_REGISTRATION_ENABLED;
  const verificationEnabled = EMAIL_VERIFICATION_ENABLED;

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    address: "",
    subdomain: "",
    password: "",
    password_confirmation: "",
  });

  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  const updateField = (
    key: keyof typeof formData,
    value: string,
  ) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
    if (key === "email" && emailError && emailPattern.test(value)) {
      setEmailError(null);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setEmailError(null);

    if (!emailPattern.test(formData.email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }

    if (formData.password !== formData.password_confirmation) {
      setError("Passwords do not match.");
      return;
    }

    try {
      setSubmitting(true);
      const response = await fetch(`${BACKEND_URL}/api/v1/register-school`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const contentType = response.headers.get("content-type");
        if (contentType?.includes("application/json")) {
          const data = await response.json();
          if (data.errors) {
            const firstError = Object.values<string[]>(data.errors).flat()[0];
            throw new Error(firstError ?? "Unable to register school.");
          }
          throw new Error(data.message ?? "Unable to register school.");
        }
        throw new Error(
          `Registration failed. Server returned status: ${response.status}.`,
        );
      }

      router.push("/login?status=registration-success");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to register. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!registrationEnabled) {
    return (
      <>
        <div className="login-page-wrap">
          <div className="login-page-content">
            <div className="login-box text-center py-5 px-4">
              <div className="item-logo mb-4">
                <Image
                  src="/assets/img/logo2.png"
                  alt="logo"
                  width={160}
                  height={60}
                  unoptimized
                  loader={passthroughLoader}
                  style={{ width: "auto", height: "auto" }}
                />
              </div>
              <h4>School Registration Unavailable</h4>
              <p className="text-muted mt-3 mb-4">
                Self-registration for new schools is currently disabled. Please contact
                the platform administrator if you need to onboard a new school.
              </p>
              <Link href="/login" className="register-login-action">
                Return to Login
              </Link>
            </div>
          </div>
        </div>
        <style jsx>{styles}</style>
      </>
    );
  }

  return (
    <>
      <div className="login-page-wrap">
        <div className="login-page-content">
          <div className="register-login-cta mb-4 p-3 d-flex align-items-center justify-content-between flex-wrap">
            <div className="d-flex align-items-center">
              <span className="register-login-icon d-inline-flex align-items-center justify-content-center mr-3">
                <i className="fas fa-sign-in-alt" aria-hidden="true" />
              </span>
              <div>
                <div className="font-weight-bold mb-1 text-dark">
                  Already have an account?
                </div>
                <small className="text-muted">
                  Continue where you left off by signing into your dashboard.
                </small>
              </div>
            </div>
            <Link href="/login" className="register-login-action">
              Go to Login
            </Link>
          </div>
          <div className="login-box">
            <div className="item-logo">
              <Image
                src="/assets/img/logo2.png"
                alt="logo"
                width={160}
                height={60}
                unoptimized
                loader={passthroughLoader}
                style={{ width: "auto", height: "auto" }}
              />
            </div>
            <form id="register-form" className="login-form" onSubmit={handleSubmit}>
              {error ? (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              ) : null}
              <div className="row">
                <div className="col-12">
                  <h4>Register Your School</h4>
                  {verificationEnabled ? (
                    <p className="text-muted small mb-3">
                      After submitting the form we will send a verification link to the email
                      address provided. You will need to confirm it before logging in.
                    </p>
                  ) : null}
                </div>
                <div className="col-lg-6 col-12 form-group">
                  <label htmlFor="name">School Name *</label>
                  <input
                    id="name"
                    type="text"
                    placeholder="Enter school name"
                    className="form-control"
                    required
                    value={formData.name}
                    onChange={(event) => updateField("name", event.target.value)}
                  />
                </div>
                <div className="col-lg-6 col-12 form-group">
                  <label htmlFor="email">School Email *</label>
                <input
                  id="email"
                  type="email"
                  placeholder="Enter school email"
                  className={`form-control${emailError ? " is-invalid" : ""}`}
                  required
                  value={formData.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  aria-invalid={emailError ? "true" : undefined}
                  aria-describedby={emailError ? "register-email-error" : undefined}
                />
                {emailError ? (
                  <div id="register-email-error" className="invalid-feedback">
                    {emailError}
                  </div>
                ) : null}
                </div>
                <div className="col-lg-6 col-12 form-group">
                  <label htmlFor="address">Address *</label>
                  <input
                    id="address"
                    type="text"
                    placeholder="Enter school address"
                    className="form-control"
                    required
                    value={formData.address}
                    onChange={(event) => updateField("address", event.target.value)}
                  />
                </div>
                <div className="col-lg-6 col-12 form-group">
                  <label htmlFor="subdomain">Subdomain *</label>
                  <input
                    id="subdomain"
                    type="text"
                    placeholder="Enter your desired subdomain"
                    className="form-control"
                    required
                    value={formData.subdomain}
                    onChange={(event) => updateField("subdomain", event.target.value)}
                  />
                </div>
                <div className="col-lg-6 col-12 form-group position-relative">
                  <label htmlFor="password">Password *</label>
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Enter password"
                    className="form-control"
                    required
                    value={formData.password}
                    onChange={(event) => updateField("password", event.target.value)}
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    style={{
                      background: "none",
                      border: "none",
                      position: "absolute",
                      top: "50%",
                      right: "0.75rem",
                      transform: "translateY(-50%)",
                      color: "#9299b8",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <i
                      className={`fas ${showPassword ? "fa-unlock" : "fa-lock"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <div className="col-lg-6 col-12 form-group position-relative">
                  <label htmlFor="password_confirmation">Confirm Password *</label>
                  <input
                    id="password_confirmation"
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="Confirm password"
                    className="form-control"
                    required
                    value={formData.password_confirmation}
                    onChange={(event) =>
                      updateField("password_confirmation", event.target.value)
                    }
                  />
                  <button
                    type="button"
                    className="password-toggle"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword ? "Hide confirm password" : "Show confirm password"
                    }
                    aria-pressed={showConfirmPassword}
                    style={{
                      background: "none",
                      border: "none",
                      position: "absolute",
                      top: "50%",
                      right: "0.75rem",
                      transform: "translateY(-50%)",
                      color: "#9299b8",
                      cursor: "pointer",
                      padding: 0,
                    }}
                  >
                    <i
                      className={`fas ${showConfirmPassword ? "fa-unlock" : "fa-lock"}`}
                      aria-hidden="true"
                    />
                  </button>
                </div>
                <div className="col-12 form-group mg-t-8">
                  <button type="submit" className="login-btn" disabled={submitting}>
                    {submitting ? "Registering..." : "Register"}
                  </button>
                </div>
              </div>
            </form>
          </div>
          <div className="sign-up register-login-footer">
            Already have a School ?{" "}
            <Link href="/login" className="register-login-footer-link">
              Login now!
            </Link>
          </div>
        </div>
      </div>
      <style jsx>{styles}</style>
    </>
  );
}

const passthroughLoader: ImageLoader = ({ src }) => src;

const styles = `
.register-login-cta {
  background: linear-gradient(135deg, #4076ff 0%, #6cc5ff 100%);
  border-radius: 18px;
  color: #ffffff;
  gap: 1rem;
  box-shadow: 0 18px 40px rgba(64, 118, 255, 0.28);
}

.register-login-icon {
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.2);
  color: #ffffff;
  font-size: 1.35rem;
}

.register-login-action {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 0.7rem 1.85rem;
  border-radius: 999px;
  background: #ffffff;
  color: #2460f7;
  border: none;
  font-weight: 700;
  font-size: 1rem;
  text-decoration: none;
  box-shadow: 0 10px 25px rgba(7, 47, 120, 0.18);
  transition: transform 0.2s ease, box-shadow 0.2s ease, background 0.2s ease, color 0.2s ease;
}

.register-login-action:hover {
  transform: translateY(-2px);
  box-shadow: 0 14px 32px rgba(7, 47, 120, 0.28);
  background: rgba(255, 255, 255, 0.92);
}

.register-login-footer {
  color: #1b2b3b !important;
  font-weight: 600;
}

.register-login-footer .register-login-footer-link {
  color: #2460f7;
  font-weight: 700;
  text-decoration: none;
  border-bottom: 2px solid rgba(36, 96, 247, 0.35);
  padding-bottom: 0.15rem;
  transition: color 0.2s ease, border-color 0.2s ease;
}

.register-login-footer .register-login-footer-link:hover {
  color: #0f4fe0;
  border-color: rgba(15, 79, 224, 0.6);
}
`;
