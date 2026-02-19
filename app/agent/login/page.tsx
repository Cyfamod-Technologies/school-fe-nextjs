'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agentApi } from '@/lib/agents';
import styles from '../auth.module.css';

type GoogleCredentialResponse = {
  credential?: string;
};

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: GoogleCredentialResponse) => void;
          }) => void;
          renderButton: (
            container: HTMLElement,
            options: Record<string, unknown>,
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

const readMessage = (payload: unknown, fallback: string): string => {
  if (typeof payload === 'object' && payload !== null) {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim() !== '') {
      return record.message;
    }
  }
  return fallback;
};

export default function AgentLoginPage() {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const completeAuth = useCallback(
    (payload: { token?: string; agent?: unknown }) => {
      if (payload.token) {
        localStorage.setItem('agentToken', payload.token);
        localStorage.setItem('agent_token', payload.token);
      }
      if (payload.agent) {
        localStorage.setItem('agent', JSON.stringify(payload.agent));
      }
      router.push('/agent/dashboard');
    },
    [router],
  );

  const handleGoogleCredential = useCallback(
    async (response: GoogleCredentialResponse) => {
      if (!response.credential) {
        setError('Google sign-in did not return a credential. Please try again.');
        return;
      }

      setGoogleLoading(true);
      setError(null);

      try {
        const apiResponse = await agentApi.googleAuth(response.credential);
        const data = await apiResponse.json().catch(() => ({}));

        if (!apiResponse.ok) {
          setError(readMessage(data, 'Google sign-in failed. Please try again.'));
          return;
        }

        completeAuth({ token: data.token, agent: data.agent });
      } catch {
        setError('Unable to complete Google sign-in right now.');
      } finally {
        setGoogleLoading(false);
      }
    },
    [completeAuth],
  );

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID || !googleButtonRef.current) {
      return;
    }

    const renderButton = () => {
      if (!window.google?.accounts?.id || !googleButtonRef.current) {
        return;
      }

      googleButtonRef.current.innerHTML = '';
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: handleGoogleCredential,
      });
      window.google.accounts.id.renderButton(googleButtonRef.current, {
        type: 'standard',
        theme: 'outline',
        text: 'continue_with',
        shape: 'rectangular',
        size: 'large',
        width: 330,
      });
    };

    if (window.google?.accounts?.id) {
      renderButton();
      return;
    }

    const scriptId = 'google-gsi-script';
    const existingScript = document.getElementById(scriptId) as HTMLScriptElement | null;

    if (existingScript) {
      existingScript.addEventListener('load', renderButton);
      return () => existingScript.removeEventListener('load', renderButton);
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = renderButton;
    document.head.appendChild(script);

    return () => {
      script.onload = null;
    };
  }, [handleGoogleCredential]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (!email.trim() || !password) {
      setError('Please provide email and password.');
      return;
    }

    setLoading(true);
    try {
      const response = await agentApi.login(email.trim(), password);
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(readMessage(data, 'Invalid email or password.'));
        return;
      }

      completeAuth({ token: data.token, agent: data.agent });
    } catch {
      setError('Unable to sign in right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.noise} />
      <div className={styles.orbA} />
      <div className={styles.orbB} />

      <main className={styles.shell}>
        <section className={`${styles.storyPanel} ${styles.reveal}`}>
          <p className={styles.storyKicker}>Agent Workspace</p>
          <h1 className={styles.storyTitle}>
            Welcome back. Keep your referral pipeline moving.
          </h1>
          <p className={styles.storyText}>
            Sign in to monitor conversions, commission approvals, and payout readiness from one
            focused workspace.
          </p>

          <div className={styles.storyGrid}>
            <article className={styles.storyCard}>
              <h3>Referral Timeline</h3>
              <p>Track each code from visit to registration to paid status.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>Commission Clarity</h3>
              <p>See pending, approved, and paid commissions without switching screens.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>Structured Payouts</h3>
              <p>Request payout when threshold is met and follow each payout stage.</p>
            </article>
          </div>

          <p className={styles.storyFoot}>
            New here? <Link href="/agent/register">Create your agent account</Link>
          </p>
        </section>

        <section className={`${styles.formPanel} ${styles.revealDelayed}`}>
          <div className={styles.formCard}>
            <div className={styles.formHead}>
              <div className={styles.mark}>A</div>
              <div>
                <p className={styles.eyebrow}>Sign In</p>
                <h2 className={styles.formTitle}>Agent Login</h2>
              </div>
            </div>
            <p className={styles.formSubtitle}>
              Use your email and password, or continue with Google.
            </p>

            {error && <div className={styles.alertError}>{error}</div>}

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value);
                    setError(null);
                  }}
                  disabled={loading || googleLoading}
                  required
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="password">Password</label>
                <div className={styles.inputWrap}>
                  <input
                    id="password"
                    className={styles.inputWithToggle}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => {
                      setPassword(event.target.value);
                      setError(null);
                    }}
                    disabled={loading || googleLoading}
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

              <div className={styles.helperRow}>
                <Link href="/agent/forgot-password" className={styles.helperLink}>
                  Forgot password?
                </Link>
              </div>

              <button type="submit" className={styles.primaryButton} disabled={loading || googleLoading}>
                {loading ? (
                  <span className={styles.loadingRow}>
                    <span className={styles.spinner} />
                    Signing in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <div className={styles.divider}>
              <span>or continue with</span>
            </div>

            <div className={styles.oauthCard}>
              <p className={styles.oauthText}>Google Sign-In</p>
              <div ref={googleButtonRef} className={styles.googleWrap} />
              {!GOOGLE_CLIENT_ID && (
                <p className={styles.hint}>
                  Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to enable Google login.
                </p>
              )}
              {googleLoading && <p className={styles.hint}>Signing in with Google...</p>}
            </div>

            <div className={styles.formFooter}>
              <p>
                New agent? <Link href="/agent/register">Create an account</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
