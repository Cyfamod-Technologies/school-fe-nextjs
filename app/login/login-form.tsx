"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loading, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email || !password) {
      setError("Please enter both email and password.");
      return;
    }

    try {
      setSubmitting(true);
      await login({ email, password });

      const next = searchParams?.get("next");
      router.push(next || "/v10/dashboard");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Unable to sign in. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const nextPath = searchParams?.get("next") || "/v10/dashboard";

  useEffect(() => {
    if (loading || !user) {
      return;
    }
    router.replace(nextPath);
  }, [loading, user, router, nextPath]);

  return (
    <form id="login-form" className="login-form" onSubmit={handleSubmit}>
      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}
      <div className="form-group">
        <label htmlFor="email">Email</label>
        <input
          id="email"
          type="email"
          placeholder="Enter email"
          className="form-control"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <i className="far fa-envelope" />
      </div>
      <div className="form-group">
        <label htmlFor="password">Password</label>
        <input
          id="password"
          type="password"
          placeholder="Enter password"
          className="form-control"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
        />
        <i className="fas fa-lock" />
      </div>
      <div className="form-group d-flex align-items-center justify-content-between">
        <div className="form-check">
          <input
            type="checkbox"
            className="form-check-input"
            id="remember-me"
          />
          <label htmlFor="remember-me" className="form-check-label">
            Remember Me
          </label>
        </div>
        <span className="forgot-btn text-muted">Forgot Password?</span>
      </div>
      <div className="form-group">
        <button
          type="submit"
          className="login-btn"
          disabled={submitting || loading}
        >
          {submitting ? "Signing in..." : "Login"}
        </button>
      </div>
    </form>
  );
}
