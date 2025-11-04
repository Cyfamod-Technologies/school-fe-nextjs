"use client";

import Link from "next/link";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getStaff, updateStaff } from "@/lib/staff";

const availableRoles = [
  "Teacher",
  "Accountant",
  "Administrator",
  "Counselor",
  "Support",
];

const genderOptions = [
  { value: "male", label: "Male" },
  { value: "female", label: "Female" },
  { value: "others", label: "Others" },
];

interface StaffFormState {
  full_name: string;
  email: string;
  phone: string;
  role: string;
  gender: string;
  employment_start_date: string;
  address: string;
  qualifications: string;
}

const emptyForm: StaffFormState = {
  full_name: "",
  email: "",
  phone: "",
  role: "",
  gender: "",
  employment_start_date: "",
  address: "",
  qualifications: "",
};

export default function EditStaffPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const staffId = searchParams.get("id");

  const [form, setForm] = useState<StaffFormState>(emptyForm);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!staffId) {
      router.replace("/v15/all-staff");
      return;
    }

    getStaff(staffId)
      .then((staff) => {
        if (!staff) {
          throw new Error("Staff profile not found.");
        }

        setForm({
          full_name: staff.full_name ?? staff.user?.name ?? "",
          email: staff.email ?? staff.user?.email ?? "",
          phone: staff.phone ?? staff.user?.phone ?? "",
          role: staff.role ?? "",
          gender: (staff.gender ?? "").toLowerCase(),
          employment_start_date: staff.employment_start_date
            ? new Date(staff.employment_start_date).toISOString().slice(0, 10)
            : "",
          address: staff.address ?? "",
          qualifications: staff.qualifications ?? "",
        });
        setError(null);
      })
      .catch((err) => {
        console.error("Unable to load staff", err);
        setError(
          err instanceof Error
            ? err.message
            : "Unable to load staff profile.",
        );
      })
      .finally(() => setLoading(false));
  }, [router, staffId]);

  const updateField = (key: keyof StaffFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const genderValue = useMemo(() => form.gender ?? "", [form.gender]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!staffId) {
      return;
    }

    setError(null);

    if (!form.full_name.trim()) {
      setError("Enter the staff member's full name.");
      return;
    }
    if (!form.email.trim()) {
      setError("Enter the staff email address.");
      return;
    }
    if (!form.phone.trim()) {
      setError("Enter the staff phone number.");
      return;
    }
    if (!form.role.trim()) {
      setError("Select the staff role.");
      return;
    }
    if (!form.gender.trim()) {
      setError("Select the staff gender.");
      return;
    }

    const payload = new FormData();
    payload.append("full_name", form.full_name.trim());
    payload.append("email", form.email.trim());
    payload.append("phone", form.phone.trim());
    payload.append("role", form.role.trim());
    payload.append("gender", form.gender.trim());

    payload.append("employment_start_date", form.employment_start_date);
    payload.append("address", form.address.trim());
    payload.append("qualifications", form.qualifications.trim());

    if (photoFile) {
      payload.append("photo", photoFile);
    }

    try {
      setSubmitting(true);
      await updateStaff(staffId, payload);
      router.push("/v15/all-staff");
    } catch (err) {
      console.error("Unable to update staff", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to update staff profile. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!staffId) {
    return null;
  }

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
        <h3>Staff Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href="/v15/all-staff">All Staff</Link>
          </li>
          <li>Edit Staff</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Edit Staff Profile</h3>
            </div>
            <button
              className="btn btn-outline-secondary"
              type="button"
              onClick={() => router.back()}
            >
              <i className="fas fa-arrow-left mr-1" />
              Back
            </button>
          </div>

          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}

          <form onSubmit={handleSubmit}>
            <div className="row gutters-8">
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-name">Full Name *</label>
                <input
                  id="staff-name"
                  type="text"
                  className="form-control"
                  value={form.full_name}
                  onChange={(event) => updateField("full_name", event.target.value)}
                  required
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-email">Email *</label>
                <input
                  id="staff-email"
                  type="email"
                  className="form-control"
                  value={form.email}
                  onChange={(event) => updateField("email", event.target.value)}
                  required
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-phone">Phone *</label>
                <input
                  id="staff-phone"
                  type="tel"
                  className="form-control"
                  value={form.phone}
                  onChange={(event) => updateField("phone", event.target.value)}
                  required
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-role">Role *</label>
                <select
                  id="staff-role"
                  className="form-control"
                  value={form.role}
                  onChange={(event) => updateField("role", event.target.value)}
                  required
                >
                  <option value="">Select Role</option>
                  {availableRoles.map((role) => (
                    <option key={role} value={role}>
                      {role}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-gender">Gender *</label>
                <select
                  id="staff-gender"
                  className="form-control"
                  value={genderValue}
                  onChange={(event) => updateField("gender", event.target.value)}
                  required
                >
                  <option value="">Select Gender</option>
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="employment-date">Employment Start Date</label>
                <input
                  id="employment-date"
                  type="date"
                  className="form-control"
                  value={form.employment_start_date}
                  onChange={(event) =>
                    updateField("employment_start_date", event.target.value)
                  }
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-address">Address</label>
                <input
                  id="staff-address"
                  type="text"
                  className="form-control"
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-qualifications">Qualifications</label>
                <input
                  id="staff-qualifications"
                  type="text"
                  className="form-control"
                  value={form.qualifications}
                  onChange={(event) =>
                    updateField("qualifications", event.target.value)
                  }
                />
              </div>
              <div className="col-12 form-group">
                <label className="text-dark-medium">Update Staff Photo</label>
                <input
                  type="file"
                  className="form-control-file"
                  accept="image/*"
                  onChange={(event) => {
                    const file = event.target.files?.[0] ?? null;
                    setPhotoFile(file);
                  }}
                />
              </div>
              <div className="col-12 form-group d-flex justify-content-between">
                <button
                  type="submit"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  disabled={submitting}
                >
                  {submitting ? "Updating..." : "Update Staff"}
                </button>
                <button
                  type="button"
                  className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                  onClick={() => router.push("/v15/all-staff")}
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
