'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { agentApi } from '@/lib/agents';
import styles from './page.module.css';

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
            options: Record<string, unknown>
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? '';

export default function AgentLoginPage() {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

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
    [router]
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
        const data = await apiResponse.json();

        if (!apiResponse.ok) {
          setError(data.message || 'Google sign-in failed. Please try again.');
          return;
        }

        completeAuth({ token: data.token, agent: data.agent });
      } catch {
        setError('Unable to complete Google sign-in right now.');
      } finally {
        setGoogleLoading(false);
      }
    },
    [completeAuth]
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
        width: 320,
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
      return () => {
        existingScript.removeEventListener('load', renderButton);
      };
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!email || !password) {
      setError('Please fill in all fields');
      setLoading(false);
      return;
    }

    try {
      const response = await agentApi.login(email, password);

      if (response.ok) {
        const data = await response.json();
        completeAuth({ token: data.token, agent: data.agent });
      } else {
        const data = await response.json();
        setError(data.message || 'Invalid email or password. Please try again.');
      }
    } catch {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.page}>
      <div className={styles.glowPrimary} />
      <div className={styles.glowSecondary} />

      <main className={styles.shell}>
        <section className={`${styles.brandPanel} ${styles.reveal}`}>
          <p className={styles.kicker}>Agent Network</p>
          <h1 className={styles.heading}>Welcome back</h1>
          <p className={styles.subheading}>
            Sign in to track referrals, monitor commissions, and request payouts.
          </p>

          <div className={styles.metrics}>
            <article className={styles.metricCard}>
              <p className={styles.metricLabel}>Approval Workflow</p>
              <p className={styles.metricValue}>Structured onboarding</p>
            </article>
            <article className={styles.metricCard}>
              <p className={styles.metricLabel}>Commission Tracking</p>
              <p className={styles.metricValue}>Real-time updates</p>
            </article>
            <article className={styles.metricCard}>
              <p className={styles.metricLabel}>Payout Visibility</p>
              <p className={styles.metricValue}>Transparent history</p>
            </article>
          </div>
        </section>

        <section className={`${styles.formPanel} ${styles.revealDelayed}`}>
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Agent Login</h2>
            <p className={styles.formSubtitle}>Sign in with email/password or continue with Google.</p>

            {error && (
              <div className={styles.errorBox}>
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
              <div className={styles.field}>
                <label htmlFor="email">Email Address</label>
                <input
                  id="email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError(null);
                  }}
                  placeholder="you@example.com"
                  disabled={loading || googleLoading}
                />
              </div>

              <div className={styles.field}>
                <label htmlFor="password">Password</label>
                <div className={styles.passwordWrap}>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    value={password}
                    onChange={(e) => {
                      setPassword(e.target.value);
                      setError(null);
                    }}
                    placeholder="Enter your password"
                    disabled={loading || googleLoading}
                  />
                  <button
                    type="button"
                    className={styles.toggleBtn}
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className={styles.submitBtn}
              >
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

            <div className={styles.oauthBlock}>
              <p className={styles.oauthLabel}>Or continue with Google</p>
              <div ref={googleButtonRef} className={styles.googleButtonWrap} />
              {!GOOGLE_CLIENT_ID && (
                <p className={styles.oauthHint}>
                  Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to enable Google sign-in.
                </p>
              )}
              {googleLoading && <p className={styles.oauthHint}>Signing in with Google...</p>}
            </div>

            <div className={styles.footer}>
              <p>
                New agent? <Link href="/agent/register">Create an account</Link>
              </p>
              <p className={styles.helpText}>Need access help? Contact admin support.</p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
