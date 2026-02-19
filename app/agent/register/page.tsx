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

export default function AgentRegisterPage() {
  const router = useRouter();
  const googleButtonRef = useRef<HTMLDivElement | null>(null);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    whatsapp_number: '',
    password: '',
    password_confirmation: '',
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
  };

  const completeAuth = useCallback(
    (payload: { token?: string; agent?: unknown }) => {
      if (payload.token) {
        localStorage.setItem('agentToken', payload.token);
        localStorage.setItem('agent_token', payload.token);
      }

      if (payload.agent) {
        localStorage.setItem('agent', JSON.stringify(payload.agent));
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/agent/dashboard');
      }, 1200);
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
        width: 340,
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

    if (
      !formData.full_name ||
      !formData.email ||
      !formData.whatsapp_number ||
      !formData.password ||
      !formData.password_confirmation
    ) {
      setError('Please fill in all required fields');
      setLoading(false);
      return;
    }

    if (formData.password !== formData.password_confirmation) {
      setError('Password confirmation does not match');
      setLoading(false);
      return;
    }

    try {
      const response = await agentApi.register(formData);
      const data = await response.json();

      if (response.ok) {
        completeAuth({ token: data.token, agent: data.agent });
      } else {
        setError(data.message || 'Registration failed');
      }
    } catch {
      setError('An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className={styles.successPage}>
        <div className={styles.successCard}>
          <div className={styles.successIcon}>✓</div>
          <h2>Registration Successful</h2>
          <p>Your account has been created. Redirecting...</p>
          <div className={styles.successBar}>
            <div className={styles.successBarFill} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <div className={styles.glowPrimary} />
      <div className={styles.glowSecondary} />

      <main className={styles.shell}>
        <section className={`${styles.brandPanel} ${styles.reveal}`}>
          <p className={styles.kicker}>Partner Program</p>
          <h1 className={styles.heading}>Become a school growth agent</h1>
          <p className={styles.subheading}>
            Sign up in seconds and start earning from verified school referrals.
          </p>

          <div className={styles.benefits}>
            <article className={styles.benefitCard}>
              <h3>12% Commission</h3>
              <p>Earn from qualifying school payments tied to your referral code.</p>
            </article>
            <article className={styles.benefitCard}>
              <h3>Live Tracking</h3>
              <p>Monitor referral progress, conversions, and earnings in one place.</p>
            </article>
            <article className={styles.benefitCard}>
              <h3>Fast Onboarding</h3>
              <p>Register with email or continue with Google in one click.</p>
            </article>
          </div>

          <p className={styles.loginPrompt}>
            Already registered? <Link href="/agent/login">Sign in here</Link>
          </p>
        </section>

        <section className={`${styles.formPanel} ${styles.revealDelayed}`}>
          <div className={styles.formCard}>
            <h2 className={styles.formTitle}>Agent Registration</h2>
            <p className={styles.formSubtitle}>Enter your profile, WhatsApp number, and password to continue.</p>

            {error && (
              <div className={styles.errorBox}>
                <p>{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className={styles.form}>
              <section className={styles.formSection}>
                <h3>Personal Information</h3>
                <div className={styles.field}>
                  <label htmlFor="full_name">
                    Full Name <span>*</span>
                  </label>
                  <input
                    id="full_name"
                    type="text"
                    name="full_name"
                    value={formData.full_name}
                    onChange={handleChange}
                    placeholder="John Doe"
                    required
                  />
                </div>

                <div className={styles.field}>
                  <label htmlFor="email">
                    Email Address <span>*</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    placeholder="john@example.com"
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
                    value={formData.whatsapp_number}
                    onChange={handleChange}
                    placeholder="+2348012345678"
                    required
                  />
                </div>
              </section>

              <section className={styles.formSection}>
                <h3>Security</h3>
                <div className={styles.gridTwo}>
                  <div className={styles.field}>
                    <label htmlFor="password">
                      Password <span>*</span>
                    </label>
                    <input
                      id="password"
                      type="password"
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Minimum 8 characters"
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </div>

                  <div className={styles.field}>
                    <label htmlFor="password_confirmation">
                      Confirm Password <span>*</span>
                    </label>
                    <input
                      id="password_confirmation"
                      type="password"
                      name="password_confirmation"
                      value={formData.password_confirmation}
                      onChange={handleChange}
                      placeholder="Repeat password"
                      minLength={8}
                      autoComplete="new-password"
                      required
                    />
                  </div>
                </div>
              </section>

              <button
                type="submit"
                disabled={loading || googleLoading}
                className={styles.submitBtn}
              >
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
                Already have an account?{' '}
                <Link href="/agent/login">Sign in</Link>
              </p>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
