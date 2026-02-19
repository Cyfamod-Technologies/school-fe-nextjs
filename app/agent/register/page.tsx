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

export default function AgentRegisterPage() {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    whatsapp_number: '',
    password: '',
    password_confirmation: '',
  });

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');
  const [awaitingVerification, setAwaitingVerification] = useState(false);

  const completeAuth = useCallback(
    (payload: { token?: string; agent?: unknown }) => {
      if (payload.token) {
        localStorage.setItem('agentToken', payload.token);
        localStorage.setItem('agent_token', payload.token);
      }
      if (payload.agent) {
        localStorage.setItem('agent', JSON.stringify(payload.agent));
      }

      setAwaitingVerification(false);
      setSuccessMessage('Registration successful. Redirecting to your dashboard...');
      setSuccess(true);
      window.setTimeout(() => router.push('/agent/dashboard'), 1200);
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

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);

    if (
      !formData.full_name.trim() ||
      !formData.email.trim() ||
      !formData.whatsapp_number.trim() ||
      !formData.password ||
      !formData.password_confirmation
    ) {
      setError('Please fill in all required fields.');
      return;
    }

    if (formData.password !== formData.password_confirmation) {
      setError('Password confirmation does not match.');
      return;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      const response = await agentApi.register({
        full_name: formData.full_name.trim(),
        email: formData.email.trim().toLowerCase(),
        whatsapp_number: formData.whatsapp_number.trim(),
        password: formData.password,
        password_confirmation: formData.password_confirmation,
      });
      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(readMessage(data, 'Registration failed.'));
        return;
      }

      if (data?.verification_required || !data?.token) {
        setAwaitingVerification(true);
        setSuccessMessage(
          readMessage(
            data,
            'Registration successful. Check your inbox/SPAM folder to verify your email before signing in.',
          ),
        );
        setSuccess(true);
        return;
      }

      completeAuth({ token: data.token, agent: data.agent });
    } catch {
      setError('Unable to register right now. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.successPage}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h2>{awaitingVerification ? 'Check Your Email' : 'Registration Successful'}</h2>
          <p>{successMessage}</p>
          {awaitingVerification && (
            <div className={styles.formFooter}>
              <p>
                <Link href="/agent/login">Go to Login</Link>
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.noise} />
      <div className={styles.orbA} />
      <div className={styles.orbB} />

      <main className={styles.shell}>
        <section className={`${styles.storyPanel} ${styles.reveal}`}>
          <p className={styles.storyKicker}>Partner Program</p>
          <h1 className={styles.storyTitle}>
            Become a growth agent for schools and earn from conversions.
          </h1>
          <p className={styles.storyText}>
            Register once, get approved, generate referral links, and track your payouts in real
            time.
          </p>

          <div className={styles.storyGrid}>
            <article className={styles.storyCard}>
              <h3>Onboarding</h3>
              <p>Fast registration with manual approval for quality control.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>Referral Tracking</h3>
              <p>Every generated code is tracked from first visit to first payment.</p>
            </article>
            <article className={styles.storyCard}>
              <h3>Payout Visibility</h3>
              <p>See thresholds, requests, and payout statuses in one place.</p>
            </article>
          </div>

          <p className={styles.storyFoot}>
            Already registered? <Link href="/agent/login">Sign in here</Link>
          </p>
        </section>

        <section className={`${styles.formPanel} ${styles.revealDelayed}`}>
          <div className={styles.formCard}>
            <div className={styles.formHead}>
              <div className={styles.mark}>A</div>
              <div>
                <p className={styles.eyebrow}>Create Account</p>
                <h2 className={styles.formTitle}>Agent Registration</h2>
              </div>
            </div>
            <p className={styles.formSubtitle}>
              Provide your details and set a secure password to continue.
            </p>

            {error && <div className={styles.alertError}>{error}</div>}

            <form className={styles.form} onSubmit={handleSubmit}>
              <div className={styles.field}>
                <label htmlFor="full_name">
                  Full Name <span>*</span>
                </label>
                <input
                  id="full_name"
                  type="text"
                  name="full_name"
                  placeholder="Jane Doe"
                  value={formData.full_name}
                  onChange={handleInputChange}
                  disabled={loading || googleLoading}
                  required
                />
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.field}>
                  <label htmlFor="email">
                    Email Address <span>*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    placeholder="you@example.com"
                    value={formData.email}
                    onChange={handleInputChange}
                    disabled={loading || googleLoading}
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="whatsapp_number">
                    WhatsApp Number <span>*</span>
                  </label>
                  <input
                    id="whatsapp_number"
                    type="tel"
                    name="whatsapp_number"
                    placeholder="+2348012345678"
                    value={formData.whatsapp_number}
                    onChange={handleInputChange}
                    disabled={loading || googleLoading}
                    required
                  />
                </div>
              </div>

              <div className={styles.gridTwo}>
                <div className={styles.field}>
                  <label htmlFor="password">
                    Password <span>*</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <input
                      id="password"
                      className={styles.inputWithToggle}
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      placeholder="Minimum 8 characters"
                      value={formData.password}
                      onChange={handleInputChange}
                      autoComplete="new-password"
                      minLength={8}
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

                <div className={styles.field}>
                  <label htmlFor="password_confirmation">
                    Confirm Password <span>*</span>
                  </label>
                  <div className={styles.inputWrap}>
                    <input
                      id="password_confirmation"
                      className={styles.inputWithToggle}
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="password_confirmation"
                      placeholder="Repeat password"
                      value={formData.password_confirmation}
                      onChange={handleInputChange}
                      autoComplete="new-password"
                      minLength={8}
                      disabled={loading || googleLoading}
                      required
                    />
                    <button
                      type="button"
                      className={styles.toggle}
                      onClick={() => setShowConfirmPassword((value) => !value)}
                      aria-label={showConfirmPassword ? 'Hide password confirmation' : 'Show password confirmation'}
                    >
                      {showConfirmPassword ? 'Hide' : 'Show'}
                    </button>
                  </div>
                </div>
              </div>

              <button type="submit" className={styles.primaryButton} disabled={loading || googleLoading}>
                {loading ? (
                  <span className={styles.loadingRow}>
                    <span className={styles.spinner} />
                    Creating account...
                  </span>
                ) : (
                  'Create Account'
                )}
              </button>
            </form>

            <div className={styles.divider}>
              <span>or continue with</span>
            </div>

            <div className={styles.oauthCard}>
              <p className={styles.oauthText}>Google Registration</p>
              <div ref={googleButtonRef} className={styles.googleWrap} />
              {!GOOGLE_CLIENT_ID && (
                <p className={styles.hint}>
                  Set <code>NEXT_PUBLIC_GOOGLE_CLIENT_ID</code> to enable Google registration.
                </p>
              )}
              {googleLoading && <p className={styles.hint}>Signing in with Google...</p>}
            </div>

            <div className={styles.formFooter}>
              <p>
                Already have an account? <Link href="/agent/login">Sign in</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
