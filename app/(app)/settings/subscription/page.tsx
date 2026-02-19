'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';
import { useAuth } from '@/contexts/AuthContext';
import styles from './payment-center.module.css';

interface Invoice {
  id: string;
  invoice_type: string;
  student_count?: number;
  price_per_student?: number;
  amount_due: number;
  amount_paid: number;
  payment_status: string;
  due_date?: string;
}

interface Term {
  id: string;
  name: string;
  session_id: string;
  session_name: string;
  payment_status: string;
  amount_due: number;
  amount_paid: number;
  outstanding_balance: number;
  is_free_trial_term: boolean;
  free_trial_enabled_for_school: boolean;
  student_count_snapshot: number;
  midterm_student_count: number;
  total_students_billed: number;
  students_paid_estimate: number;
  students_left_for_payment: number;
  start_date?: string;
  end_date?: string;
  invoices: Invoice[];
}

interface PaymentHistoryItem {
  id: string;
  reference: string;
  amount: number;
  status: string;
  scope: string;
  session_name: string;
  term_name: string;
  term_count: number;
  created_at: string;
  paid_at: string;
}

interface SessionSummary {
  sessionId: string;
  sessionName: string;
  termCount: number;
  outstandingTermsCount: number;
  totalOutstanding: number;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const formatNaira = (amount: number): string =>
  `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

const formatDate = (value: string): string => {
  if (!value) {
    return '-';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '-';
  }
  return new Intl.DateTimeFormat('en-NG', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
};

const parseApiError = (error: unknown, fallback: string): string => {
  if (!(error instanceof Error) || error.message.trim() === '') {
    return fallback;
  }

  const message = error.message.trim();
  const lower = message.toLowerCase();
  if (lower.includes('unauthenticated') || lower.includes('session expired')) {
    return 'Your session has expired. Please sign in again to continue.';
  }

  return message;
};

const badgeClassName = (status: string): string => {
  const value = status.toLowerCase();
  if (value === 'success' || value === 'paid') return styles.badgeSuccess;
  if (value === 'pending' || value === 'partial' || value === 'initialized') return styles.badgeWarning;
  if (value === 'failed' || value === 'abandoned' || value === 'unpaid') return styles.badgeDanger;
  return styles.badgeNeutral;
};

const loadTerms = async (): Promise<Term[]> => {
  const payload = await apiFetch<unknown>('/api/v1/terms/school/all');
  const root = asRecord(payload);
  const terms = Array.isArray(root.terms) ? root.terms : Array.isArray(root.data) ? root.data : [];

  return terms.map((entry) => {
    const row = asRecord(entry);
    const invoicesRaw = Array.isArray(row.invoices) ? row.invoices : [];

    const invoices = invoicesRaw.map((invoiceEntry) => {
      const invoice = asRecord(invoiceEntry);
      return {
        id: asString(invoice.id),
        invoice_type: asString(invoice.invoice_type, 'original'),
        student_count: asNumber(invoice.student_count, 0),
        price_per_student: asNumber(invoice.price_per_student, 0),
        amount_due: asNumber(invoice.amount_due),
        amount_paid: asNumber(invoice.amount_paid),
        payment_status: asString(invoice.payment_status, asString(invoice.status, 'pending')),
        due_date: asString(invoice.due_date),
      };
    });

    const studentCountSnapshot = asNumber(row.student_count_snapshot, 0);
    const midtermStudentCount = asNumber(row.midterm_student_count, 0);
    const totalStudentsBilled = asNumber(
      row.total_students_billed,
      Math.max(0, studentCountSnapshot + midtermStudentCount),
    );
    const studentsLeftForPayment = asNumber(
      row.students_left_for_payment,
      asNumber(row.outstanding_balance) > 0 ? totalStudentsBilled : 0,
    );
    const studentsPaidEstimate = asNumber(
      row.students_paid_estimate,
      Math.max(0, totalStudentsBilled - studentsLeftForPayment),
    );

    return {
      id: asString(row.id),
      name: asString(row.name, 'Term'),
      session_id: asString(row.session_id),
      session_name: asString(row.session_name, 'Session'),
      payment_status: asString(row.payment_status, 'pending'),
      amount_due: asNumber(row.amount_due),
      amount_paid: asNumber(row.amount_paid),
      outstanding_balance: asNumber(row.outstanding_balance),
      is_free_trial_term: Boolean(row.is_free_trial_term),
      free_trial_enabled_for_school: Boolean(row.free_trial_enabled_for_school),
      student_count_snapshot: studentCountSnapshot,
      midterm_student_count: midtermStudentCount,
      total_students_billed: totalStudentsBilled,
      students_paid_estimate: studentsPaidEstimate,
      students_left_for_payment: studentsLeftForPayment,
      start_date: asString(row.start_date),
      end_date: asString(row.end_date),
      invoices,
    };
  });
};

const loadPaymentHistory = async (): Promise<PaymentHistoryItem[]> => {
  const payload = await apiFetch<unknown>('/api/v1/terms/payments/history?per_page=50');
  const root = asRecord(payload);
  const payments = Array.isArray(root.payments)
    ? root.payments
    : Array.isArray(root.data)
    ? root.data
    : [];

  return payments.map((entry) => {
    const row = asRecord(entry);
    return {
      id: asString(row.id),
      reference: asString(row.reference),
      amount: asNumber(row.amount),
      status: asString(row.status, 'pending'),
      scope: asString(row.scope, 'term'),
      session_name: asString(row.session_name, '-'),
      term_name: asString(row.term_name, '-'),
      term_count: Math.max(1, asNumber(row.term_count, 1)),
      created_at: asString(row.created_at),
      paid_at: asString(row.paid_at),
    };
  });
};

export default function PaymentPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, schoolContext } = useAuth();

  const [terms, setTerms] = useState<Term[]>([]);
  const [payments, setPayments] = useState<PaymentHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [payingTermId, setPayingTermId] = useState<string | null>(null);
  const [payingSessionId, setPayingSessionId] = useState<string | null>(null);
  const [verifyingRef, setVerifyingRef] = useState<string | null>(null);
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [selectedTermId, setSelectedTermId] = useState<string>('');
  const [handledReference, setHandledReference] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setError(null);
      const [loadedTerms, loadedPayments] = await Promise.all([
        loadTerms(),
        loadPaymentHistory(),
      ]);
      setTerms(loadedTerms);
      setPayments(loadedPayments);
    } catch (err) {
      setError(parseApiError(err, 'Failed to load payment data.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshData();
  }, [refreshData]);

  const sessionSummaries = useMemo<SessionSummary[]>(() => {
    const map = new Map<string, SessionSummary>();

    for (const term of terms) {
      if (!term.session_id) {
        continue;
      }

      const existing = map.get(term.session_id) ?? {
        sessionId: term.session_id,
        sessionName: term.session_name || 'Session',
        termCount: 0,
        outstandingTermsCount: 0,
        totalOutstanding: 0,
      };

      existing.termCount += 1;
      existing.totalOutstanding += term.outstanding_balance;
      if (term.outstanding_balance > 0) {
        existing.outstandingTermsCount += 1;
      }

      map.set(term.session_id, existing);
    }

    return Array.from(map.values()).sort((a, b) => b.sessionName.localeCompare(a.sessionName));
  }, [terms]);

  useEffect(() => {
    if (sessionSummaries.length === 0) {
      setSelectedSessionId('');
      return;
    }

    if (sessionSummaries.some((session) => session.sessionId === selectedSessionId)) {
      return;
    }

    const outstandingSession = sessionSummaries.find((session) => session.totalOutstanding > 0);
    setSelectedSessionId(outstandingSession?.sessionId ?? sessionSummaries[0].sessionId);
  }, [selectedSessionId, sessionSummaries]);

  const selectedSession = useMemo(
    () => sessionSummaries.find((session) => session.sessionId === selectedSessionId) ?? null,
    [selectedSessionId, sessionSummaries],
  );

  const selectedSessionTerms = useMemo(
    () => terms.filter((term) => term.session_id === selectedSessionId),
    [selectedSessionId, terms],
  );

  useEffect(() => {
    if (selectedSessionTerms.length === 0) {
      setSelectedTermId('');
      return;
    }

    if (selectedSessionTerms.some((term) => term.id === selectedTermId)) {
      return;
    }

    const outstandingTerm = selectedSessionTerms.find((term) => term.outstanding_balance > 0);
    setSelectedTermId(outstandingTerm?.id ?? selectedSessionTerms[0].id);
  }, [selectedSessionTerms, selectedTermId]);

  const selectedSessionTerm = useMemo(
    () => selectedSessionTerms.find((term) => term.id === selectedTermId) ?? null,
    [selectedSessionTerms, selectedTermId],
  );

  const freeTrialTerms = useMemo(
    () => terms.filter((term) => term.is_free_trial_term),
    [terms],
  );

  const nextPayableTerm = useMemo(
    () => selectedSessionTerms.find((term) => term.outstanding_balance > 0) ?? null,
    [selectedSessionTerms],
  );

  const needsLogin = useMemo(() => {
    if (!error) {
      return false;
    }
    return error.toLowerCase().includes('sign in again');
  }, [error]);

  const totals = useMemo(() => {
    let due = 0;
    let paid = 0;
    let outstanding = 0;

    terms.forEach((term) => {
      due += term.amount_due;
      paid += term.amount_paid;
      outstanding += term.outstanding_balance;
    });

    return { due, paid, outstanding };
  }, [terms]);

  const totalStudents = useMemo(() => {
    if (typeof user?.student_count === 'number') {
      return user.student_count;
    }

    const school = asRecord(schoolContext.school);
    const value = school.student_count ?? school.students_count;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }, [schoolContext.school, user?.student_count]);

  const visibleTerms = useMemo(() => {
    if (!selectedSessionId) {
      return terms;
    }
    return terms.filter((term) => term.session_id === selectedSessionId);
  }, [selectedSessionId, terms]);

  const initializeTermPayment = async (termId: string) => {
    setError(null);
    setNotice(null);
    setPayingTermId(termId);

    try {
      const payload = await apiFetch<{ authorization_url?: string }>('/api/v1/terms/' + termId + '/paystack/initialize', {
        method: 'POST',
      });
      const authUrl = asString(payload?.authorization_url);
      if (!authUrl) {
        setError('Paystack did not return an authorization URL.');
        return;
      }
      window.location.assign(authUrl);
    } catch (err) {
      setError(parseApiError(err, 'Unable to initialize term payment.'));
    } finally {
      setPayingTermId(null);
    }
  };

  const initializeSessionPayment = async () => {
    if (!selectedSessionId) {
      setError('Select a session to continue.');
      return;
    }

    setError(null);
    setNotice(null);
    setPayingSessionId(selectedSessionId);

    try {
      const payload = await apiFetch<{ authorization_url?: string }>('/api/v1/terms/paystack/initialize-session', {
        method: 'POST',
        body: JSON.stringify({ session_id: selectedSessionId }),
      });
      const authUrl = asString(payload?.authorization_url);
      if (!authUrl) {
        setError('Paystack did not return an authorization URL.');
        return;
      }
      window.location.assign(authUrl);
    } catch (err) {
      setError(parseApiError(err, 'Unable to initialize session payment.'));
    } finally {
      setPayingSessionId(null);
    }
  };

  const initializeSelectedTermPayment = async () => {
    if (!selectedSessionTerm) {
      setError('Select a term to continue.');
      return;
    }

    if (selectedSessionTerm.is_free_trial_term) {
      setError(null);
      setNotice('Selected term is on free trial. No payment is required for this term.');
      return;
    }

    if (selectedSessionTerm.outstanding_balance <= 0) {
      setError('The selected term is already settled. Choose an unpaid term.');
      return;
    }

    await initializeTermPayment(selectedSessionTerm.id);
  };

  const verifyPayment = useCallback(
    async (reference: string) => {
      setVerifyingRef(reference);
      setError(null);
      setNotice(null);

      try {
        const payload = await apiFetch<{ scope?: string; message?: string }>('/api/v1/terms/paystack/verify', {
          method: 'POST',
          body: JSON.stringify({ reference }),
        });

        const scope = asString(payload?.scope, 'term');
        if (scope === 'session') {
          setNotice('Session payment verified successfully and applied.');
        } else {
          setNotice('Term payment verified successfully and applied.');
        }

        await refreshData();
      } catch (err) {
        setError(parseApiError(err, 'Unable to verify payment.'));
      } finally {
        setVerifyingRef(null);
        router.replace('/settings/payment');
      }
    },
    [refreshData, router],
  );

  useEffect(() => {
    const reference =
      searchParams.get('reference') ??
      searchParams.get('trxref') ??
      searchParams.get('payment_reference');

    if (!reference || reference.trim() === '') {
      return;
    }

    if (reference === handledReference) {
      return;
    }

    setHandledReference(reference);
    void verifyPayment(reference);
  }, [handledReference, searchParams, verifyPayment]);

  if (loading) {
    return (
      <div className={styles.loaderWrap}>
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Payment</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Payment</li>
        </ul>
      </div>

      <div className={styles.page}>
        <section className={styles.hero}>
          <h1>Payment Center</h1>
          <p>Pay per term or settle a complete session from one place.</p>
          <div className={styles.heroStats}>
            <article className={styles.heroStat}>
              <span>Total Due</span>
              <strong>{formatNaira(totals.due)}</strong>
            </article>
            <article className={styles.heroStat}>
              <span>Total Paid</span>
              <strong>{formatNaira(totals.paid)}</strong>
            </article>
            <article className={styles.heroStat}>
              <span>Outstanding</span>
              <strong>{formatNaira(totals.outstanding)}</strong>
            </article>
            <article className={styles.heroStat}>
              <span>Total Students</span>
              <strong>{totalStudents === null ? '-' : totalStudents.toLocaleString('en-NG')}</strong>
            </article>
          </div>
        </section>

        {error ? (
          <div className={styles.alertError}>
            <span>{error}</span>
            {needsLogin ? (
              <Link href="/login?next=%2Fsettings%2Fpayment" className={styles.reauthLink}>
                Sign in
              </Link>
            ) : null}
          </div>
        ) : null}
        {notice ? <div className={styles.alertSuccess}>{notice}</div> : null}
        {verifyingRef ? (
          <div className={styles.alertInfo}>
            Verifying payment reference <strong>{verifyingRef}</strong>...
          </div>
        ) : null}

        {freeTrialTerms.length > 0 ? (
          <section className={styles.trialStatus}>
            <h3>Free Trial Active</h3>
            <p>
              Your school currently has free trial on <strong>{freeTrialTerms.length}</strong> term(s). Trial terms have
              zero amount due, so payment is disabled for those specific terms.
            </p>
            {nextPayableTerm ? (
              <p>
                Next payable term in selected session: <strong>{nextPayableTerm.name}</strong> (
                {formatNaira(nextPayableTerm.outstanding_balance)} outstanding).
              </p>
            ) : (
              <p>No payable term is available yet in the currently selected session.</p>
            )}
          </section>
        ) : null}

        {needsLogin ? (
          <section className={styles.authGate}>
            <h2>Sign in required</h2>
            <p>Your admin session has expired. Sign in again to continue managing school payments.</p>
            <Link href="/login?next=%2Fsettings%2Fpayment" className={styles.authGateAction}>
              Go to Sign in
            </Link>
          </section>
        ) : null}

        {!needsLogin ? (
          <>
            <section className={styles.sessionPanel}>
              <div>
                <h2>Pay Complete Session</h2>
                <p>One checkout for all outstanding terms in a selected session.</p>
              </div>

              <div className={styles.sessionControl}>
                <select
                  value={selectedSessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                  disabled={payingSessionId !== null || verifyingRef !== null || sessionSummaries.length === 0}
                >
                  {sessionSummaries.length === 0 ? <option>No sessions available</option> : null}
                  {sessionSummaries.map((session) => (
                    <option key={session.sessionId} value={session.sessionId}>
                      {session.sessionName} ({session.termCount} terms)
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void initializeSessionPayment()}
                  disabled={
                    !selectedSession ||
                    selectedSession.totalOutstanding <= 0 ||
                    payingSessionId !== null ||
                    verifyingRef !== null
                  }
                >
                  {payingSessionId === selectedSessionId ? 'Preparing...' : 'Pay Session'}
                </button>
              </div>

              <div className={styles.sessionTermControl}>
                <select
                  value={selectedTermId}
                  onChange={(event) => setSelectedTermId(event.target.value)}
                  disabled={payingSessionId !== null || verifyingRef !== null || selectedSessionTerms.length === 0}
                >
                  {selectedSessionTerms.length === 0 ? <option>No terms in selected session</option> : null}
                  {selectedSessionTerms.map((term) => (
                    <option key={term.id} value={term.id}>
                      {term.name} ({term.is_free_trial_term ? 'Free Trial' : term.outstanding_balance > 0 ? 'Unpaid' : 'Paid'})
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  onClick={() => void initializeSelectedTermPayment()}
                  disabled={
                    !selectedSessionTerm ||
                    selectedSessionTerm.outstanding_balance <= 0 ||
                    payingTermId === selectedTermId ||
                    verifyingRef !== null
                  }
                >
                  {payingTermId === selectedTermId ? 'Preparing...' : 'Pay Selected Term'}
                </button>
              </div>

              {selectedSession ? (
                <p className={styles.sessionMeta}>
                  {selectedSession.sessionName}: {selectedSession.outstandingTermsCount} unpaid term(s), total outstanding{' '}
                  <strong>{formatNaira(selectedSession.totalOutstanding)}</strong>.
                </p>
              ) : null}

              {selectedSessionTerm ? (
                <p className={styles.sessionMeta}>
                  {selectedSessionTerm.is_free_trial_term ? (
                    <>
                      Selected term <strong>{selectedSessionTerm.name}</strong> is on free trial. Payment is not required.
                    </>
                  ) : (
                    <>
                      Selected term: <strong>{selectedSessionTerm.name}</strong> with outstanding{' '}
                      <strong>{formatNaira(selectedSessionTerm.outstanding_balance)}</strong>.
                    </>
                  )}
                </p>
              ) : null}
            </section>

            <section className={styles.termSection}>
              <div className={styles.sectionHead}>
                <h2>Term Payments</h2>
                <span>
                  {selectedSession ? `${selectedSession.sessionName} • ` : ''}
                  {visibleTerms.length} terms
                </span>
              </div>

              {selectedSessionId && visibleTerms.length === 0 ? (
                <p className={styles.empty}>No terms found for the selected session.</p>
              ) : (
                <div className={styles.termGrid}>
                  {visibleTerms.map((term) => {
                    const progress = term.amount_due > 0 ? Math.min(100, Math.round((term.amount_paid / term.amount_due) * 100)) : 0;
                    return (
                      <article key={term.id} className={styles.termCard}>
                        <header>
                          <h3>{term.name}</h3>
                          <span className={`${styles.badge} ${badgeClassName(term.payment_status)}`}>{term.payment_status}</span>
                        </header>

                        <p className={styles.termMeta}>
                          {term.session_name}
                          {term.start_date ? ` • ${formatDate(term.start_date)}` : ''}
                          {term.end_date ? ` to ${formatDate(term.end_date)}` : ''}
                        </p>

                        {term.is_free_trial_term ? (
                          <p className={styles.trialMeta}>Free trial applied for this term.</p>
                        ) : null}

                        <div className={styles.progressTrack}>
                          <div className={styles.progressFill} style={{ width: `${progress}%` }} />
                        </div>
                        <p className={styles.progressLabel}>{progress}% paid</p>

                        <div className={styles.studentStats}>
                          <div>
                            <span>Students billed</span>
                            <strong>{term.total_students_billed.toLocaleString('en-NG')}</strong>
                          </div>
                          <div>
                            <span>Students left</span>
                            <strong>{term.students_left_for_payment.toLocaleString('en-NG')}</strong>
                          </div>
                        </div>

                        <div className={styles.amounts}>
                          <div>
                            <span>Due</span>
                            <strong>{formatNaira(term.amount_due)}</strong>
                          </div>
                          <div>
                            <span>Paid</span>
                            <strong>{formatNaira(term.amount_paid)}</strong>
                          </div>
                          <div>
                            <span>Outstanding</span>
                            <strong>{formatNaira(term.outstanding_balance)}</strong>
                          </div>
                        </div>

                        <div className={styles.actions}>
                          {term.outstanding_balance > 0 ? (
                            <button
                              type="button"
                              className={styles.payBtn}
                              onClick={() => void initializeTermPayment(term.id)}
                              disabled={payingTermId === term.id || verifyingRef !== null}
                            >
                              {payingTermId === term.id ? 'Preparing...' : 'Pay Now'}
                            </button>
                          ) : term.is_free_trial_term ? (
                            <span className={styles.trialChip}>Free Trial</span>
                          ) : (
                            <span className={styles.settled}>Settled</span>
                          )}

                        </div>

                        {term.invoices.length > 0 ? (
                          <details className={styles.invoiceDetails}>
                            <summary>Invoices ({term.invoices.length})</summary>
                            <div className={styles.invoiceList}>
                              {term.invoices.map((invoice) => (
                                <div key={invoice.id} className={styles.invoiceRow}>
                                  <span>{invoice.invoice_type === 'original' ? 'Original' : 'Mid-term'}</span>
                                  <span>{formatNaira(invoice.amount_due)}</span>
                                  <span>{formatDate(invoice.due_date ?? '')}</span>
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </article>
                    );
                  })}
                </div>
              )}
            </section>

            <section className={styles.historySection}>
              <div className={styles.sectionHead}>
                <h2>Payments Made</h2>
                <span>{payments.length}</span>
              </div>

              {payments.length === 0 ? (
                <p className={styles.empty}>No payment transactions yet.</p>
              ) : (
                <div className={styles.tableWrap}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Reference</th>
                        <th>Scope</th>
                        <th>Details</th>
                        <th>Amount</th>
                        <th>Status</th>
                        <th>Paid At</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payments.map((payment) => (
                        <tr key={payment.id}>
                          <td>{formatDate(payment.created_at)}</td>
                          <td>{payment.reference}</td>
                          <td>{payment.scope === 'session' ? 'Session' : 'Term'}</td>
                          <td>
                            {payment.scope === 'session'
                              ? `${payment.session_name} (${payment.term_count} terms)`
                              : payment.term_name}
                          </td>
                          <td>{formatNaira(payment.amount)}</td>
                          <td>
                            <span className={`${styles.badge} ${badgeClassName(payment.status)}`}>{payment.status}</span>
                          </td>
                          <td>{formatDate(payment.paid_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        ) : null}
      </div>
    </>
  );
}
