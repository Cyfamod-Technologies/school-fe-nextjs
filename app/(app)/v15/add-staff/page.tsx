"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { createStaff } from "@/lib/staff";

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

const initialFormState: StaffFormState = {
  full_name: "",
  email: "",
  phone: "",
  role: "",
  gender: "",
  employment_start_date: "",
  address: "",
  qualifications: "",
};

export default function AddStaffPage() {
  const router = useRouter();

  const [form, setForm] = useState<StaffFormState>(initialFormState);
  const [photo, setPhoto] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);

  const updateField = (key: keyof StaffFormState, value: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

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

    if (form.employment_start_date) {
      payload.append("employment_start_date", form.employment_start_date);
    }
    if (form.address.trim()) {
      payload.append("address", form.address.trim());
    }
    if (form.qualifications.trim()) {
      payload.append("qualifications", form.qualifications.trim());
    }
    if (photo) {
      payload.append("photo", photo);
    }

    try {
      setSubmitting(true);
      const staff = await createStaff(payload);
      const tempPassword =
        staff.temporary_password ??
        "A temporary password has been sent to the staff email.";

      setSuccess(
        typeof tempPassword === "string"
          ? `Staff profile created successfully. Temporary password: ${tempPassword}`
          : "Staff profile created successfully.",
      );
      setTimeout(() => {
        router.push("/v15/all-staff");
      }, 1200);
    } catch (err) {
      console.error("Unable to create staff", err);
      setError(
        err instanceof Error
          ? err.message
          : "Unable to create staff profile. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

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
          <li>Add Staff</li>
        </ul>
      </div>

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Create Staff Profile</h3>
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

          {success ? (
            <div className="alert alert-success" role="alert">
              {success}
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
                  placeholder="e.g. John Doe"
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
                  placeholder="e.g. john@example.com"
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
                  placeholder="e.g. 0803 000 0000"
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
                  <option value="">Select role</option>
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
                  value={form.gender}
                  onChange={(event) => updateField("gender", event.target.value)}
                  required
                >
                  <option value="">Select gender</option>
                  {genderOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-start-date">Employment Start Date</label>
                <input
                  id="staff-start-date"
                  type="date"
                  className="form-control"
                  value={form.employment_start_date}
                  onChange={(event) =>
                    updateField("employment_start_date", event.target.value)
                  }
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-qualifications">Qualifications</label>
                <input
                  id="staff-qualifications"
                  type="text"
                  className="form-control"
                  placeholder="e.g. B.Ed Mathematics"
                  value={form.qualifications}
                  onChange={(event) =>
                    updateField("qualifications", event.target.value)
                  }
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-address">Address</label>
                <input
                  id="staff-address"
                  type="text"
                  className="form-control"
                  placeholder="e.g. 123 Main Street"
                  value={form.address}
                  onChange={(event) => updateField("address", event.target.value)}
                />
              </div>
              <div className="col-lg-6 col-12 form-group">
                <label htmlFor="staff-photo">Profile Photo</label>
                <input
                  id="staff-photo"
                  type="file"
                  accept="image/*"
                  className="form-control-file"
                  onChange={(event) =>
                    setPhoto(event.target.files?.[0] ?? null)
                  }
                />
              </div>
            </div>

            <div className="d-flex justify-content-end">
              <button
                type="submit"
                className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                disabled={submitting}
              >
                {submitting ? "Saving..." : "Create Staff"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
