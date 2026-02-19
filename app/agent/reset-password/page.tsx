'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { agentApi } from '@/lib/agents';
import styles from '../auth.module.css';

const readMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim() !== '') {
      return record.message;
    }

    if (record.errors && typeof record.errors === 'object') {
      const values = Object.values(record.errors as Record<string, unknown>);
      for (const entry of values) {
        if (Array.isArray(entry) && typeof entry[0] === 'string') {
          return entry[0];
        }
      }
    }
  }
  return fallback;
};

export default function AgentResetPasswordPage() {
  const searchParams = useSearchParams();

  const token = useMemo(() => searchParams.get('token') ?? '', [searchParams]);
  const email = useMemo(() => searchParams.get('email') ?? '', [searchParams]);

  const [password, setPassword] = useState('');
  const [passwordConfirmation, setPasswordConfirmation] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const invalidLink = token.trim() === '' || email.trim() === '';

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (invalidLink) {
      setError('Invalid password reset link. Please request a new one.');
      return;
    }

    if (!password || !passwordConfirmation) {
      setError('Please enter and confirm your new password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    if (password !== passwordConfirmation) {
      setError('Password confirmation does not match.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await agentApi.resetPassword({
        email,
        token,
        password,
        password_confirmation: passwordConfirmation,
      });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(readMessage(payload, 'Unable to reset password.'));
        return;
      }

      setSuccess(readMessage(payload, 'Password reset successful. You can now log in.'));
      setPassword('');
      setPasswordConfirmation('');
    } catch {
      setError('Unable to reset password right now.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.noise} />
      <div className={styles.orbA} />
      <div className={styles.orbB} />

      <main className={styles.shell}>
        <section className={`${styles.storyPanel} ${styles.reveal}`}>
          <p className={styles.storyKicker}>Set New Password</p>
          <h1 className={styles.storyTitle}>Create a fresh password for your agent account.</h1>
          <p className={styles.storyText}>
            Use at least 8 characters. For better security, include letters, numbers, and symbols.
          </p>
          <div className={styles.storyGrid}>
            <article className={styles.storyCard}>
              <h3>Token Validation</h3>
              <p>Reset links are single-use and expire automatically.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>After Reset</h3>
              <p>Sign in with your new password immediately from the login page.</p>
            </article>
          </div>
          <p className={styles.storyFoot}>
            Need another link? <Link href="/agent/forgot-password">Request new reset email</Link>
          </p>
        </section>

        <section className={`${styles.formPanel} ${styles.revealDelayed}`}>
          <div className={styles.formCard}>
            <div className={styles.formHead}>
              <div className={styles.mark}>A</div>
              <div>
                <p className={styles.eyebrow}>Reset Password</p>
                <h2 className={styles.formTitle}>Choose New Password</h2>
              </div>
            </div>
            <p className={styles.formSubtitle}>
              Account email: <strong>{email || 'Unavailable'}</strong>
            </p>

            {error && <div className={styles.alertError}>{error}</div>}
            {success && <div className={styles.alertSuccess}>{success}</div>}

            {invalidLink ? (
              <div className={styles.formFooter}>
                <p>
                  This reset link is invalid. <Link href="/agent/forgot-password">Request another one</Link>.
                </p>
              </div>
            ) : (
              <form className={styles.form} onSubmit={handleSubmit}>
                <div className={styles.field}>
                  <label htmlFor="password">New Password</label>
                  <div className={styles.inputWrap}>
                    <input
                      id="password"
                      className={styles.inputWithToggle}
                      type={showPassword ? 'text' : 'password'}
                      placeholder="Minimum 8 characters"
                      value={password}
                      onChange={(event) => {
                        setPassword(event.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      minLength={8}
                      autoComplete="new-password"
                      disabled={submitting}
                      required
                    />
                    <button
                      type="button"
                      className={styles.toggle}
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <div className={styles.field}>
                  <label htmlFor="password_confirmation">Confirm New Password</label>
                  <div className={styles.inputWrap}>
                    <input
                      id="password_confirmation"
                      className={styles.inputWithToggle}
                      type={showConfirmation ? 'text' : 'password'}
                      placeholder="Repeat password"
                      value={passwordConfirmation}
                      onChange={(event) => {
                        setPasswordConfirmation(event.target.value);
                        setError(null);
                        setSuccess(null);
                      }}
                      minLength={8}
                      autoComplete="new-password"
                      disabled={submitting}
                      required
                    />
                    <button
                      type="button"
                      className={styles.toggle}
                      onClick={() => setShowConfirmation((value) => !value)}
                      aria-label={showConfirmation ? 'Hide password confirmation' : 'Show password confirmation'}
                    >
                      {showConfirmation ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>

                <button type="submit" className={styles.primaryButton} disabled={submitting}>
                  {submitting ? (
                    <span className={styles.loadingRow}>
                      <span className={styles.spinner} />
                      Resetting password...
                    </span>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            )}

            <div className={styles.formFooter}>
              <p>
                Back to <Link href="/agent/login">Agent Login</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
