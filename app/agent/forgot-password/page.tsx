'use client';

import { useState } from 'react';
import Link from 'next/link';
import { agentApi } from '@/lib/agents';
import styles from '../auth.module.css';

const readMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim() !== '') {
      return record.message;
    }
  }
  return fallback;
};

export default function AgentForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!email.trim()) {
      setError('Email address is required.');
      return;
    }

    setSubmitting(true);
    try {
      const response = await agentApi.forgotPassword({ email: email.trim().toLowerCase() });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(readMessage(payload, 'Unable to process request right now.'));
        return;
      }

      setSuccess(
        readMessage(
          payload,
          'If an account exists for this email, a password reset link has been sent.',
        ),
      );
    } catch {
      setError('Unable to process request right now.');
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
          <p className={styles.storyKicker}>Account Recovery</p>
          <h1 className={styles.storyTitle}>Reset your agent password securely.</h1>
          <p className={styles.storyText}>
            Enter your login email and we will send a reset link with a time-limited token.
          </p>
          <div className={styles.storyGrid}>
            <article className={styles.storyCard}>
              <h3>Secure Tokens</h3>
              <p>Password reset links expire automatically for account safety.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>Email Delivery</h3>
              <p>Check inbox and spam folders if you do not see the message quickly.</p>
            </article>
          </div>
          <p className={styles.storyFoot}>
            Remembered your password? <Link href="/agent/login">Back to login</Link>
          </p>
        </section>

        <section className={`${styles.formPanel} ${styles.revealDelayed}`}>
          <div className={styles.formCard}>
            <div className={styles.formHead}>
              <div className={styles.mark}>A</div>
              <div>
                <p className={styles.eyebrow}>Forgot Password</p>
                <h2 className={styles.formTitle}>Request Reset Link</h2>
              </div>
            </div>
            <p className={styles.formSubtitle}>
              We will email password reset instructions to your account.
            </p>

            {error && <div className={styles.alertError}>{error}</div>}
            {success && <div className={styles.alertSuccess}>{success}</div>}

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                    setSuccess(null);
                  }}
                  disabled={submitting}
                  required
                />
              </div>

              <button type="submit" className={styles.primaryButton} disabled={submitting}>
                {submitting ? (
                  <span className={styles.loadingRow}>
                    <span className={styles.spinner} />
                    Sending link...
                  </span>
                ) : (
                  'Send Reset Link'
                )}
              </button>
            </form>

            <div className={styles.formFooter}>
              <p>
                Go back to <Link href="/agent/login">Agent Login</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
