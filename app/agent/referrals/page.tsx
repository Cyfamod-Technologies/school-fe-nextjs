'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agentApi } from '@/lib/agents';

interface ReferralRow {
  id: string;
  referral_code: string;
  referral_link: string;
  registered_schools_count: number;
  status: string;
  first_payment_amount: number;
  created_at: string;
  registrations: unknown[];
  school: unknown;
}

interface ReferralRegistrationTableRow {
  id: string;
  referral_id: string;
  referral_code: string;
  referral_link: string;
  status: string;
  first_payment_amount: number;
  school_name: string;
  students_count: number;
  registered_at: string;
  has_school_registration: boolean;
  school_id: string;
}

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asNumber = (value: unknown, fallback = 0): number => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const toStatusLabel = (value: string): string =>
  value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

const statusBadgeClass = (status: string): string => {
  const value = status.toLowerCase();
  if (value === 'paid' || value === 'active') return 'badge badge-success';
  if (value === 'registered') return 'badge badge-info';
  if (value === 'visited') return 'badge badge-primary';
  if (value === 'rejected' || value === 'inactive') return 'badge badge-danger';
  return 'badge badge-warning';
};

const formatNaira = (amount: number): string =>
  `₦${amount.toLocaleString('en-NG', { maximumFractionDigits: 0 })}`;

const formatDate = (dateString: string): string => {
  if (!dateString) {
    return 'N/A';
  }

  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) {
    return 'N/A';
  }

  return new Intl.DateTimeFormat('en-NG', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
  }).format(date);
};

export default function AgentReferralsPage() {
  const router = useRouter();
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [maxReferralCodes, setMaxReferralCodes] = useState(10);
  const [remainingReferralCodes, setRemainingReferralCodes] = useState(0);
  const [canGenerateReferral, setCanGenerateReferral] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [customCode, setCustomCode] = useState('');
  const [generatingCode, setGeneratingCode] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const fetchReferrals = useCallback(async () => {
    try {
      const response = await agentApi.getDashboard();

      if (response.status === 401) {
        localStorage.removeItem('agentToken');
        localStorage.removeItem('agent_token');
        localStorage.removeItem('agent');
        router.replace('/agent/login');
        return;
      }

      if (!response.ok) {
        let message = 'Failed to load referrals.';
        try {
          const payload = await response.json();
          if (typeof payload?.message === 'string') {
            message = payload.message;
          }
        } catch {
          // ignore parse failure
        }
        setError(message);
        return;
      }

      const payload = await response.json();
      const root = asRecord(payload);
      const source = asRecord(root.data ?? root);
      const stats = asRecord(source.referrals);
      const recent = source.recent_referrals;
      const rows = Array.isArray(recent)
        ? recent
        : Array.isArray(asRecord(recent).data)
        ? (asRecord(recent).data as unknown[])
        : [];

      const parsedRows = rows.map((entry, index) => {
        const row = asRecord(entry);
        const registrations = Array.isArray(row.registrations) ? row.registrations : [];

        return {
          id: asString(row.id, `referral-${index + 1}`),
          referral_code: asString(row.referral_code, 'N/A'),
          referral_link: asString(row.referral_link, ''),
          registered_schools_count: asNumber(row.registered_schools_count, 0),
          status: asString(row.status, 'pending'),
          first_payment_amount: asNumber(row.first_payment_amount, 0),
          created_at: asString(row.created_at, ''),
          registrations,
          school: row.school,
        };
      });

      setReferrals(parsedRows);
      const parsedMaxCodes = asNumber(stats.max_referral_codes, 10);
      const parsedRemainingCodes = asNumber(
        stats.remaining_referral_codes,
        Math.max(parsedMaxCodes - parsedRows.length, 0),
      );
      setMaxReferralCodes(parsedMaxCodes);
      setRemainingReferralCodes(parsedRemainingCodes);
      setCanGenerateReferral(
        typeof stats.can_generate_referral === 'boolean'
          ? Boolean(stats.can_generate_referral)
          : parsedRemainingCodes > 0,
      );
    } catch {
      setError('Unable to load referrals right now.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchReferrals();
  }, [fetchReferrals]);

  const handleGenerateReferral = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!canGenerateReferral) {
      setError(`Referral code limit reached (${maxReferralCodes}).`);
      return;
    }

    setGeneratingCode(true);
    setError(null);

    try {
      const response = await agentApi.generateReferral(customCode.trim() || undefined);
      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        const responseMaxCodes = asNumber(payload?.max_referral_codes, maxReferralCodes);
        const responseRemainingCodes = asNumber(
          payload?.remaining_referral_codes,
          remainingReferralCodes,
        );
        setMaxReferralCodes(responseMaxCodes);
        setRemainingReferralCodes(responseRemainingCodes);
        setCanGenerateReferral(responseRemainingCodes > 0);

        const message =
          typeof payload?.message === 'string'
            ? payload.message
            : 'Failed to generate referral.';
        setError(message);
        return;
      }

      const row = asRecord(payload?.referral);
      const nextReferral: ReferralRow = {
        id: asString(row.id, `referral-${Date.now()}`),
        referral_code: asString(row.referral_code, 'N/A'),
        referral_link: asString(row.referral_link, ''),
        registered_schools_count: 0,
        status: asString(row.status, 'visited'),
        first_payment_amount: asNumber(row.first_payment_amount, 0),
        created_at: asString(row.created_at, ''),
        registrations: [],
        school: null,
      };

      setReferrals((prev) => [nextReferral, ...prev]);
      const nextRemainingCodes = asNumber(
        payload?.remaining_referral_codes,
        Math.max(remainingReferralCodes - 1, 0),
      );
      setRemainingReferralCodes(nextRemainingCodes);
      setCanGenerateReferral(nextRemainingCodes > 0);

      setCustomCode('');
      setShowGenerateModal(false);
    } catch {
      setError('An error occurred while generating referral.');
    } finally {
      setGeneratingCode(false);
    }
  };

  const handleCopy = async (key: string, value: string) => {
    if (!value) {
      return;
    }
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      setError('Unable to copy to clipboard.');
    }
  };

  const registrationRows = useMemo<ReferralRegistrationTableRow[]>(
    () =>
      referrals.flatMap((referral) => {
        const registrations = Array.isArray(referral.registrations)
          ? referral.registrations
          : [];
        const normalizedRows = registrations.map((entry, index) => {
          const registration = asRecord(entry);
          const school = asRecord(registration.school);
          const registrationId = asString(registration.id, `${referral.id}-reg-${index + 1}`);
          const schoolName = asString(school.name, '').trim();
          const schoolId = asString(school.id, asString(registration.school_id, '')).trim();

          return {
            id: `${referral.id}:${registrationId}`,
            referral_id: referral.id,
            referral_code: referral.referral_code,
            referral_link: referral.referral_link,
            status: referral.status,
            first_payment_amount: referral.first_payment_amount,
            school_name: schoolName || 'Unnamed school',
            students_count: asNumber(school.students_count, 0),
            registered_at: asString(
              registration.registered_at,
              asString(registration.created_at, referral.created_at),
            ),
            has_school_registration: true,
            school_id: schoolId,
          };
        });

        const schoolIds = new Set(
          normalizedRows.map((row) => row.school_id).filter((value) => value !== ''),
        );
        const legacySchool = asRecord(referral.school);
        const legacySchoolId = asString(legacySchool.id, '').trim();
        const legacySchoolName = asString(legacySchool.name, '').trim();

        if (
          legacySchoolId !== '' &&
          !schoolIds.has(legacySchoolId) &&
          legacySchoolName !== ''
        ) {
          normalizedRows.push({
            id: `${referral.id}:legacy-${legacySchoolId}`,
            referral_id: referral.id,
            referral_code: referral.referral_code,
            referral_link: referral.referral_link,
            status: referral.status,
            first_payment_amount: referral.first_payment_amount,
            school_name: legacySchoolName,
            students_count: asNumber(legacySchool.students_count, 0),
            registered_at: referral.created_at,
            has_school_registration: true,
            school_id: legacySchoolId,
          });
        }

        if (normalizedRows.length === 0) {
          return [
            {
              id: `${referral.id}-empty`,
              referral_id: referral.id,
              referral_code: referral.referral_code,
              referral_link: referral.referral_link,
              status: referral.status,
              first_payment_amount: referral.first_payment_amount,
              school_name: 'No school registration yet',
              students_count: 0,
              registered_at: '',
              has_school_registration: false,
              school_id: '',
            },
          ];
        }

        return normalizedRows;
      }),
    [referrals],
  );

  const activeCount = useMemo(
    () =>
      registrationRows.filter((item) =>
        item.has_school_registration &&
        ['visited', 'registered', 'paid', 'active'].includes(item.status.toLowerCase()),
      ).length,
    [registrationRows],
  );

  const totalReferredSchools = useMemo(
    () => registrationRows.filter((item) => item.has_school_registration).length,
    [registrationRows],
  );

  const paidCount = useMemo(
    () =>
      registrationRows.filter((item) =>
        item.has_school_registration &&
        ['paid', 'active'].includes(item.status.toLowerCase()),
      ).length,
    [registrationRows],
  );

  const totalFirstPayments = useMemo(
    () => referrals.reduce((sum, item) => sum + asNumber(item.first_payment_amount, 0), 0),
    [referrals],
  );

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Referrals</h3>
        <ul>
          <li>
            <Link href="/agent/dashboard">Home</Link>
          </li>
          <li>Referrals</li>
        </ul>
      </div>

      <div className="row gutters-20">
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-blue">
                  <i className="flaticon-classmates text-blue" />
                </div>
              </div>
              <div className="col-7">
                  <div className="item-content">
                  <div className="item-title">Total Referred Schools</div>
                  <div className="item-number">
                    <span>{totalReferredSchools}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-yellow">
                  <i className="flaticon-percentage-discount text-orange" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">Active Referred Schools</div>
                  <div className="item-number">
                    <span>{activeCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-green">
                  <i className="flaticon-money text-green" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">Paid Schools</div>
                  <div className="item-number">
                    <span>{paidCount}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-red">
                  <i className="flaticon-script text-red" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">First Payments</div>
                  <div className="item-number">
                    <span>{formatNaira(totalFirstPayments)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card dashboard-card-one pd-b-20 mg-b-20">
        <div className="card-body">
          <div className="heading-layout1 mg-b-17">
            <div className="item-title">
              <h3>Manage Referrals</h3>
            </div>
            <button
              type="button"
              className={`btn-fill-lmd text-light ${canGenerateReferral ? 'bg-orange-peel' : 'bg-secondary'}`}
              onClick={() => setShowGenerateModal(true)}
              disabled={!canGenerateReferral}
            >
              Generate Referral
            </button>
          </div>

          <p className="text-muted mb-4">
            Generate referral codes, copy links quickly, and track performance by status.
          </p>

          <p className="text-muted mb-3">
            Referral slots remaining: {remainingReferralCodes} of {maxReferralCodes}.
          </p>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {loading ? (
            <div className="d-flex align-items-center justify-content-center py-5">
              <div className="spinner-border text-primary" role="status">
                <span className="sr-only">Loading...</span>
              </div>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table display data-table">
                <thead>
                  <tr>
                    <th>Code</th>
                    <th>School Name</th>
                    <th>Students</th>
                    <th>Registered</th>
                    <th>Status</th>
                    <th>First Payment</th>
                  </tr>
                </thead>
                <tbody>
                  {registrationRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center text-muted">
                        No referrals yet. Generate your first code to begin.
                      </td>
                    </tr>
                  ) : (
                    registrationRows.map((referral) => (
                      <tr key={referral.id}>
                        <td>
                          <code>{referral.referral_code}</code>
                        </td>
                        <td>
                          {referral.has_school_registration ? (
                            referral.school_name
                          ) : (
                            <span className="text-muted">{referral.school_name}</span>
                          )}
                        </td>
                        <td>
                          {referral.has_school_registration ? (
                            referral.students_count.toLocaleString('en-NG')
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                        <td>
                          {referral.has_school_registration ? (
                            formatDate(referral.registered_at)
                          ) : (
                            <span className="text-muted">N/A</span>
                          )}
                        </td>
                        <td>
                          <span className={statusBadgeClass(referral.status)}>
                            {toStatusLabel(referral.status)}
                          </span>
                        </td>
                        <td>
                          {referral.first_payment_amount > 0 ? (
                            <span className="text-dark-medium">
                              {formatNaira(referral.first_payment_amount)}
                            </span>
                          ) : (
                            <span className="text-muted">-</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {referrals.length > 0 && (
            <div className="card dashboard-card-one mg-t-20">
              <div className="card-body">
                <div className="heading-layout1 mg-b-17">
                  <div className="item-title">
                    <h3>Referral Links & Actions</h3>
                  </div>
                </div>
                <div className="table-responsive">
                  <table className="table display data-table">
                    <thead>
                      <tr>
                        <th>Code</th>
                        <th>Schools</th>
                        <th>Referral Link</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {referrals.map((referral) => {
                        const schoolRowsCount = registrationRows.filter(
                          (row) => row.referral_id === referral.id && row.has_school_registration,
                        ).length;
                        return (
                          <tr key={`tools-${referral.id}`}>
                            <td>
                              <code>{referral.referral_code}</code>
                            </td>
                            <td>{schoolRowsCount.toLocaleString('en-NG')}</td>
                            <td>
                              {referral.referral_link ? (
                                <a
                                  href={referral.referral_link}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                >
                                  Open Link
                                </a>
                              ) : (
                                <span className="text-muted">N/A</span>
                              )}
                            </td>
                            <td>
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0 mr-2"
                                onClick={() =>
                                  handleCopy(`code:${referral.id}`, referral.referral_code)
                                }
                              >
                                {copiedKey === `code:${referral.id}` ? 'Copied' : 'Copy Code'}
                              </button>
                              <button
                                type="button"
                                className="btn btn-link btn-sm p-0"
                                onClick={() =>
                                  handleCopy(`link:${referral.id}`, referral.referral_link)
                                }
                              >
                                {copiedKey === `link:${referral.id}` ? 'Copied' : 'Copy Link'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <div className="alert alert-light mt-4 mb-0">
            <strong>Sharing Tips:</strong> Share referral links directly with school decision
            makers, keep outreach consistent, and monitor status updates for conversion signals.
          </div>
        </div>
      </div>

      {showGenerateModal && (
        <div
          className="position-fixed w-100 h-100 d-flex align-items-center justify-content-center"
          style={{
            inset: 0,
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            zIndex: 1050,
            padding: '1rem',
          }}
        >
          <div className="card" style={{ width: '100%', maxWidth: '460px' }}>
            <div className="card-body p-4">
              <div className="heading-layout1 mg-b-17">
                <div className="item-title">
                  <h3>Generate Referral Code</h3>
                </div>
              </div>

              <form onSubmit={handleGenerateReferral}>
                <div className="form-group">
                  <label>Custom Code (optional)</label>
                  <input
                    type="text"
                    value={customCode}
                    onChange={(event) => setCustomCode(event.target.value)}
                    className="form-control"
                    placeholder="Leave blank for auto-generated"
                    disabled={generatingCode}
                  />
                </div>

                <div className="d-flex justify-content-end mt-4">
                  <button
                    type="button"
                    className="btn btn-outline-secondary mr-2"
                    onClick={() => setShowGenerateModal(false)}
                    disabled={generatingCode}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="btn btn-warning"
                    disabled={generatingCode}
                  >
                    {generatingCode ? 'Generating...' : 'Generate'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
