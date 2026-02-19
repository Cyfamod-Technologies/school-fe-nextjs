'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { agentApi } from '@/lib/agents';

interface ProfileFormState {
  full_name: string;
  email: string;
  phone: string;
  whatsapp_number: string;
  company_name: string;
  address: string;
  bank_name: string;
  bank_account_name: string;
  bank_account_number: string;
}

interface PasswordFormState {
  current_password: string;
  password: string;
  password_confirmation: string;
}

const EMPTY_PROFILE: ProfileFormState = {
  full_name: '',
  email: '',
  phone: '',
  whatsapp_number: '',
  company_name: '',
  address: '',
  bank_name: '',
  bank_account_name: '',
  bank_account_number: '',
};

const EMPTY_PASSWORD: PasswordFormState = {
  current_password: '',
  password: '',
  password_confirmation: '',
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const asString = (value: unknown, fallback = ''): string =>
  typeof value === 'string' ? value : fallback;

const extractAgentRecord = (payload: unknown): Record<string, unknown> => {
  const root = asRecord(payload);
  const source = asRecord(root.data ?? root);
  return asRecord(source.agent ?? source);
};

const readMessage = (payload: unknown, fallback: string): string => {
  const root = asRecord(payload);
  const message = root.message;
  if (typeof message === 'string' && message.trim() !== '') {
    return message;
  }

  const errors = asRecord(root.errors);
  for (const value of Object.values(errors)) {
    if (Array.isArray(value) && typeof value[0] === 'string' && value[0].trim() !== '') {
      return value[0];
    }
  }

  return fallback;
};

const mapAgentToForm = (payload: unknown): ProfileFormState => {
  const agent = extractAgentRecord(payload);

  return {
    full_name: asString(agent.full_name),
    email: asString(agent.email),
    phone: asString(agent.phone),
    whatsapp_number: asString(agent.whatsapp_number),
    company_name: asString(agent.company_name),
    address: asString(agent.address),
    bank_name: asString(agent.bank_name),
    bank_account_name: asString(agent.bank_account_name),
    bank_account_number: asString(agent.bank_account_number),
  };
};

const mapStatus = (payload: unknown): string => {
  const agent = extractAgentRecord(payload);
  return asString(agent.status, 'pending');
};

const mapHasPassword = (payload: unknown): boolean => {
  const root = asRecord(payload);
  if (typeof root.has_password === 'boolean') {
    return root.has_password;
  }
  const source = asRecord(root.data ?? root);
  if (typeof source.has_password === 'boolean') {
    return source.has_password;
  }
  return true;
};

const statusBadgeClass = (status: string): string => {
  const value = status.toLowerCase();
  if (value === 'approved') return 'badge badge-success';
  if (value === 'pending') return 'badge badge-warning';
  if (value === 'suspended' || value === 'inactive') return 'badge badge-danger';
  return 'badge badge-secondary';
};

const toStatusLabel = (status: string): string =>
  status
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(' ');

export default function AgentProfilePage() {
  const router = useRouter();
  const [form, setForm] = useState<ProfileFormState>(EMPTY_PROFILE);
  const [passwordForm, setPasswordForm] = useState<PasswordFormState>(EMPTY_PASSWORD);
  const [status, setStatus] = useState('pending');
  const [hasPassword, setHasPassword] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState<string | null>(null);

  const fetchProfile = useCallback(async () => {
    setLoading(true);
    try {
      const response = await agentApi.getProfile();

      if (response.status === 401) {
        localStorage.removeItem('agentToken');
        localStorage.removeItem('agent_token');
        localStorage.removeItem('agent');
        router.replace('/agent/login');
        return;
      }

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(readMessage(payload, 'Failed to load profile details.'));
        return;
      }

      setForm(mapAgentToForm(payload));
      setStatus(mapStatus(payload));
      setHasPassword(mapHasPassword(payload));
    } catch {
      setError('Unable to load profile right now.');
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  const handleInputChange = (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setError(null);
    setSuccess(null);
  };

  const handlePasswordChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setPasswordForm((prev) => ({
      ...prev,
      [name]: value,
    }));
    setPasswordError(null);
    setPasswordSuccess(null);
  };

  const profileCompletion = useMemo(() => {
    const optionalFields = [
      form.phone,
      form.whatsapp_number,
      form.company_name,
      form.address,
      form.bank_name,
      form.bank_account_name,
      form.bank_account_number,
    ];
    const completed = optionalFields.filter((value) => value.trim() !== '').length;
    return Math.round((completed / optionalFields.length) * 100);
  }, [form]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);

    if (!form.full_name.trim() || !form.email.trim()) {
      setError('Full name and email are required.');
      setSaving(false);
      return;
    }

    try {
      const response = await agentApi.updateProfile({
        full_name: form.full_name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        whatsapp_number: form.whatsapp_number.trim() || null,
        company_name: form.company_name.trim() || null,
        address: form.address.trim() || null,
        bank_name: form.bank_name.trim() || null,
        bank_account_name: form.bank_account_name.trim() || null,
        bank_account_number: form.bank_account_number.trim() || null,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setError(readMessage(payload, 'Failed to update profile.'));
        return;
      }

      setForm(mapAgentToForm(payload));
      setStatus(mapStatus(payload));
      setHasPassword(mapHasPassword(payload));
      setSuccess(readMessage(payload, 'Profile updated successfully.'));

      if (typeof window !== 'undefined') {
        let existingAgent: Record<string, unknown> = {};
        try {
          const existing = localStorage.getItem('agent');
          existingAgent = existing ? asRecord(JSON.parse(existing)) : {};
        } catch {
          existingAgent = {};
        }

        const mergedAgent = {
          ...existingAgent,
          ...extractAgentRecord(payload),
        };
        localStorage.setItem('agent', JSON.stringify(mergedAgent));
      }
    } catch {
      setError('An error occurred while updating profile.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordSaving(true);
    setPasswordError(null);
    setPasswordSuccess(null);

    if (!passwordForm.password || !passwordForm.password_confirmation) {
      setPasswordError('New password and confirmation are required.');
      setPasswordSaving(false);
      return;
    }

    if (passwordForm.password !== passwordForm.password_confirmation) {
      setPasswordError('Password confirmation does not match.');
      setPasswordSaving(false);
      return;
    }

    if (passwordForm.password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      setPasswordSaving(false);
      return;
    }

    if (hasPassword && !passwordForm.current_password.trim()) {
      setPasswordError('Current password is required.');
      setPasswordSaving(false);
      return;
    }

    try {
      const response = await agentApi.changePassword({
        current_password: hasPassword ? passwordForm.current_password : undefined,
        password: passwordForm.password,
        password_confirmation: passwordForm.password_confirmation,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        setPasswordError(readMessage(payload, 'Failed to update password.'));
        return;
      }

      setHasPassword(true);
      setPasswordForm(EMPTY_PASSWORD);
      setPasswordSuccess(readMessage(payload, 'Password updated successfully.'));
    } catch {
      setPasswordError('An error occurred while updating password.');
    } finally {
      setPasswordSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Profile</h3>
        <ul>
          <li>
            <Link href="/agent/dashboard">Home</Link>
          </li>
          <li>Profile</li>
        </ul>
      </div>

      <div className="row gutters-20">
        <div className="col-xl-4 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-blue">
                  <i className="flaticon-user text-blue" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">Account Status</div>
                  <div className="item-number">
                    <span className={statusBadgeClass(status)}>{toStatusLabel(status)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-green">
                  <i className="flaticon-checklist text-green" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">Profile Completion</div>
                  <div className="item-number">
                    <span>{profileCompletion}%</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-xl-4 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-5">
                <div className="item-icon bg-light-yellow">
                  <i className="flaticon-classmates text-orange" />
                </div>
              </div>
              <div className="col-7">
                <div className="item-content">
                  <div className="item-title">WhatsApp</div>
                  <div className="item-number">
                    <span>{form.whatsapp_number.trim() || 'Not set'}</span>
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
              <h3>Edit Profile</h3>
            </div>
          </div>

          <p className="text-muted mb-4">
            Update your contact and payout account details. This information is used for
            communication and payout processing.
          </p>

          {error && (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          )}

          {success && (
            <div className="alert alert-success" role="alert">
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="full_name">Full Name *</label>
                <input
                  id="full_name"
                  name="full_name"
                  type="text"
                  className="form-control"
                  value={form.full_name}
                  onChange={handleInputChange}
                  disabled={saving}
                  required
                />
              </div>

              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="email">Email *</label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={handleInputChange}
                  disabled={saving}
                  required
                />
              </div>

              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="phone">Phone Number</label>
                <input
                  id="phone"
                  name="phone"
                  type="text"
                  className="form-control"
                  value={form.phone}
                  onChange={handleInputChange}
                  disabled={saving}
                />
              </div>

              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="whatsapp_number">WhatsApp Number</label>
                <input
                  id="whatsapp_number"
                  name="whatsapp_number"
                  type="text"
                  className="form-control"
                  value={form.whatsapp_number}
                  onChange={handleInputChange}
                  disabled={saving}
                />
              </div>

              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="company_name">Company Name</label>
                <input
                  id="company_name"
                  name="company_name"
                  type="text"
                  className="form-control"
                  value={form.company_name}
                  onChange={handleInputChange}
                  disabled={saving}
                />
              </div>

              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="bank_name">Bank Name</label>
                <input
                  id="bank_name"
                  name="bank_name"
                  type="text"
                  className="form-control"
                  value={form.bank_name}
                  onChange={handleInputChange}
                  disabled={saving}
                />
              </div>

              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="bank_account_name">Account Name</label>
                <input
                  id="bank_account_name"
                  name="bank_account_name"
                  type="text"
                  className="form-control"
                  value={form.bank_account_name}
                  onChange={handleInputChange}
                  disabled={saving}
                />
              </div>

              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="bank_account_number">Account Number</label>
                <input
                  id="bank_account_number"
                  name="bank_account_number"
                  type="text"
                  className="form-control"
                  value={form.bank_account_number}
                  onChange={handleInputChange}
                  disabled={saving}
                />
              </div>

              <div className="col-12 form-group">
                <label htmlFor="address">Address</label>
                <textarea
                  id="address"
                  name="address"
                  className="textarea form-control"
                  value={form.address}
                  onChange={handleInputChange}
                  rows={3}
                  disabled={saving}
                />
              </div>

              <div className="col-12 form-group mg-t-8 d-flex justify-content-end">
                <button
                  type="submit"
                  className="btn-fill-lmd text-light bg-dark-pastel-green"
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>

      <div className="card dashboard-card-one pd-b-20 mg-b-20">
        <div className="card-body">
          <div className="heading-layout1 mg-b-17">
            <div className="item-title">
              <h3>Password & Security</h3>
            </div>
          </div>

          <p className="text-muted mb-4">
            {hasPassword
              ? 'Use your current password and set a new secure password.'
              : 'Set a password for your account so you can log in with email and password.'}
          </p>

          {passwordError && (
            <div className="alert alert-danger" role="alert">
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div className="alert alert-success" role="alert">
              {passwordSuccess}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <div className="row">
              {hasPassword && (
                <div className="col-lg-4 col-12 form-group">
                  <label htmlFor="current_password">Current Password *</label>
                  <input
                    id="current_password"
                    name="current_password"
                    type="password"
                    className="form-control"
                    value={passwordForm.current_password}
                    onChange={handlePasswordChange}
                    disabled={passwordSaving}
                    autoComplete="current-password"
                  />
                </div>
              )}

              <div className={`${hasPassword ? 'col-lg-4' : 'col-lg-6'} col-12 form-group`}>
                <label htmlFor="password">New Password *</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  className="form-control"
                  value={passwordForm.password}
                  onChange={handlePasswordChange}
                  disabled={passwordSaving}
                  autoComplete="new-password"
                />
              </div>

              <div className={`${hasPassword ? 'col-lg-4' : 'col-lg-6'} col-12 form-group`}>
                <label htmlFor="password_confirmation">Confirm New Password *</label>
                <input
                  id="password_confirmation"
                  name="password_confirmation"
                  type="password"
                  className="form-control"
                  value={passwordForm.password_confirmation}
                  onChange={handlePasswordChange}
                  disabled={passwordSaving}
                  autoComplete="new-password"
                />
              </div>

              <div className="col-12 form-group mg-t-8 d-flex justify-content-end">
                <button
                  type="submit"
                  className="btn-fill-lmd text-light bg-dark-pastel-green"
                  disabled={passwordSaving}
                >
                  {passwordSaving ? 'Updating...' : hasPassword ? 'Change Password' : 'Set Password'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
