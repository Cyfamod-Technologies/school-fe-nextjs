"use client";

import Link from "next/link";
import { useStudentAuth } from "@/contexts/StudentAuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useMemo } from "react";

export default function StudentBioDataPage() {
  const { student, loading } = useStudentAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !student) {
      router.push("/student-login");
    }
  }, [loading, student, router]);

  if (loading || !student) {
    return (
      <div className="card">
        <div className="card-body text-center">
          <div className="spinner-border text-primary mb-3" role="status" />
          <p className="text-muted mb-0">Loading bio-data…</p>
        </div>
      </div>
    );
  }

  const personalDetails = useMemo(
    () => [
      { label: "Admission No", value: student.admission_no },
      {
        label: "Full Name",
        value: `${student.first_name} ${student.middle_name ?? ""} ${student.last_name}`.trim(),
      },
      { label: "Gender", value: student.gender ?? "—" },
      { label: "Date of Birth", value: student.date_of_birth ?? "—" },
      { label: "Nationality", value: student.nationality ?? "—" },
      { label: "State of Origin", value: student.state_of_origin ?? "—" },
      { label: "LGA of Origin", value: student.lga_of_origin ?? "—" },
      { label: "House", value: student.house ?? "—" },
      { label: "Club", value: student.club ?? "—" },
      { label: "Blood Group", value: student.blood_group?.name ?? "—" },

      {
        label: "Parent",
        value: student.parent?.name ?? "—",
      },
      {
        label: "Parent Phone",
        value: student.parent?.phone ?? "—",
      },
      { label: "Address", value: student.address ?? "—" },
      {
        label: "Medical Info",
        value: student.medical_information ?? "—",
      },
    ],
    [student],
  );

  return (
    <div className="card height-auto">
      <div className="card-body">
        <div className="heading-layout1 mb-4 d-flex justify-content-between align-items-center">
          <div className="item-title">
            <h3>Bio-data</h3>
            <p className="mb-0 text-muted">
              Review your information. Editing is coming soon.
            </p>
          </div>
          <Link
            href="#"
            aria-disabled="true"
            className="btn btn-outline-primary disabled"
            onClick={(event) => event.preventDefault()}
          >
            Edit (coming soon)
          </Link>
        </div>

        <ul className="list-group list-group-flush mb-0">
          {personalDetails.map((item) => (
            <li
              key={item.label}
              className="list-group-item px-0 d-flex justify-content-between"
            >
              <span className="text-muted">{item.label}</span>
              <span className="font-weight-bold text-break text-right">
                {item.value}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
