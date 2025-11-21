"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import {
  getCurrentStaffProfile,
  updateCurrentStaffProfile,
  type Staff,
  type StaffSelfPayload,
} from "@/lib/staff";
import { useAuth } from "@/contexts/AuthContext";

const initialProfileState = {
  full_name: "",
  email: "",
  phone: "",
  address: "",
  qualifications: "",
  gender: "",
  employment_start_date: "",
};

export default function StaffProfilePage() {
  const { refreshAuth } = useAuth();
  const [profile, setProfile] = useState(initialProfileState);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);

  const [passwordForm, setPasswordForm] = useState({
    old_password: "",
    password: "",
    password_confirmation: "",
  });

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    void getCurrentStaffProfile()
      .then((staff) => {
        if (!isMounted) {
          return;
        }
        hydrateProfile(staff);
      })
      .catch((err) => {
        if (!isMounted) {
          return;
        }
        console.error("Unable to load staff profile", err);
        setError(
          err instanceof Error ? err.message : "Unable to load your profile details.",
        );
      })
      .finally(() => {
        if (isMounted) {
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const hydrateProfile = (staff: Staff | null) => {
    if (!staff) {
      return;
    }
    setProfile({
      full_name: staff.full_name ?? staff.user?.name ?? "",
      email: staff.email ?? staff.user?.email ?? "",
      phone: staff.phone ?? staff.user?.phone ?? "",
      address: staff.address ?? "",
      qualifications: staff.qualifications ?? "",
      gender: staff.gender ?? "",
      employment_start_date: staff.employment_start_date ?? "",
    });
  };

  const updateField = (field: keyof typeof profile, value: string) => {
    setProfile((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const handleProfileSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setProfileSubmitting(true);
    setError(null);
    setSuccess(null);

    const payload: StaffSelfPayload = {
      ...profile,
    };

    try {
      const staff = await updateCurrentStaffProfile(payload);
      hydrateProfile(staff);
      setSuccess("Profile updated successfully.");
      await refreshAuth();
    } catch (err) {
      console.error("Unable to update staff profile", err);
      setError(
        err instanceof Error ? err.message : "Unable to update your profile. Please try again.",
      );
    } finally {
      setProfileSubmitting(false);
    }
  };

  const handlePasswordSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setPasswordSubmitting(true);
    setError(null);
    setSuccess(null);

    if (!passwordForm.password || passwordForm.password !== passwordForm.password_confirmation) {
      setError("New passwords do not match.");
      setPasswordSubmitting(false);
      return;
    }

    try {
      await updateCurrentStaffProfile({
        password: passwordForm.password,
        password_confirmation: passwordForm.password_confirmation,
        old_password: passwordForm.old_password,
      });
      setSuccess("Password updated successfully.");
      setPasswordForm({
        old_password: "",
        password: "",
        password_confirmation: "",
      });
    } catch (err) {
      console.error("Unable to update password", err);
      setError(
        err instanceof Error ? err.message : "Unable to change password. Please try again.",
      );
    } finally {
      setPasswordSubmitting(false);
    }
  };

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>My Profile</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Staff Profile</li>
        </ul>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="alert alert-success" role="alert">
          {success}
        </div>
      ) : null}

      {loading ? (
        <div className="card">
          <div className="card-body text-center">
            <div className="spinner-border text-primary mb-2" role="status" aria-hidden="true" />
            <p className="text-muted mb-0">Loading your profile…</p>
          </div>
        </div>
      ) : (
        <div className="row">
          <div className="col-lg-7 col-12">
            <div className="card height-auto">
              <div className="card-body">
                <div className="heading-layout1">
                  <div className="item-title">
                    <h3>Personal Information</h3>
                  </div>
                </div>
                <form className="new-added-form" onSubmit={handleProfileSubmit}>
                  <div className="row">
                    <div className="col-md-6 form-group">
                      <label htmlFor="profile-name">Full Name *</label>
                      <input
                        id="profile-name"
                        type="text"
                        className="form-control"
                        value={profile.full_name}
                        onChange={(event) => updateField("full_name", event.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 form-group">
                      <label htmlFor="profile-email">Email *</label>
                      <input
                        id="profile-email"
                        type="email"
                        className="form-control"
                        value={profile.email}
                        onChange={(event) => updateField("email", event.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 form-group">
                      <label htmlFor="profile-phone">Phone *</label>
                      <input
                        id="profile-phone"
                        type="tel"
                        className="form-control"
                        value={profile.phone}
                        onChange={(event) => updateField("phone", event.target.value)}
                        required
                      />
                    </div>
                    <div className="col-md-6 form-group">
                      <label htmlFor="profile-gender">Gender</label>
                      <select
                        id="profile-gender"
                        className="form-control"
                        value={profile.gender}
                        onChange={(event) => updateField("gender", event.target.value)}
                      >
                        <option value="">Select gender</option>
                        <option value="male">Male</option>
                        <option value="female">Female</option>
                        <option value="others">Others</option>
                      </select>
                    </div>
                    <div className="col-md-6 form-group">
                      <label htmlFor="profile-address">Address</label>
                      <input
                        id="profile-address"
                        type="text"
                        className="form-control"
                        value={profile.address}
                        onChange={(event) => updateField("address", event.target.value)}
                        placeholder="Home address"
                      />
                    </div>
                    <div className="col-md-6 form-group">
                      <label htmlFor="profile-qualifications">Qualifications</label>
                      <input
                        id="profile-qualifications"
                        type="text"
                        className="form-control"
                        value={profile.qualifications}
                        onChange={(event) => updateField("qualifications", event.target.value)}
                        placeholder="B.Ed, M.Ed, etc."
                      />
                    </div>
                    <div className="col-md-6 form-group">
                      <label htmlFor="profile-employment-date">Employment Start Date</label>
                      <input
                        id="profile-employment-date"
                        type="date"
                        className="form-control"
                        value={profile.employment_start_date}
                        onChange={(event) =>
                          updateField("employment_start_date", event.target.value)
                        }
                      />
                    </div>
                  </div>
                  <div className="form-group mt-3">
                    <button
                      type="submit"
                      className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                      disabled={profileSubmitting}
                    >
                      {profileSubmitting ? "Saving…" : "Save Changes"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
          <div className="col-lg-5 col-12">
            <div className="card height-auto">
              <div className="card-body">
                <div className="heading-layout1 mb-3">
                  <div className="item-title">
                    <h3>Change Password</h3>
                  </div>
                </div>
                <form onSubmit={handlePasswordSubmit}>
                  <div className="form-group">
                    <label htmlFor="password-old">Current Password</label>
                    <input
                      id="password-old"
                      type="password"
                      className="form-control"
                      value={passwordForm.old_password}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          old_password: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="password-new">New Password</label>
                    <input
                      id="password-new"
                      type="password"
                      className="form-control"
                      value={passwordForm.password}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          password: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label htmlFor="password-confirm">Confirm New Password</label>
                    <input
                      id="password-confirm"
                      type="password"
                      className="form-control"
                      value={passwordForm.password_confirmation}
                      onChange={(event) =>
                        setPasswordForm((prev) => ({
                          ...prev,
                          password_confirmation: event.target.value,
                        }))
                      }
                      required
                    />
                  </div>
                  <div className="form-group mt-3">
                    <button
                      type="submit"
                      className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                      disabled={passwordSubmitting}
                    >
                      {passwordSubmitting ? "Updating…" : "Update Password"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
