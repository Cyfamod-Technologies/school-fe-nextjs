"use client";

import { useStudentAuth } from "@/contexts/StudentAuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function StudentBioDataPage() {
  const { student, loading } = useStudentAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !student) {
      router.push("/student-login");
    }
  }, [loading, student, router]);

  if (loading || !student) {
    return <p>Loading bio-data…</p>;
  }

  return (
    <div className="card height-auto">
      <div className="card-body">
        <div className="heading-layout1 mb-4">
          <div className="item-title">
            <h3>Bio-data</h3>
            <p className="mb-0 text-muted">
              Update your personal information. (Coming soon)
            </p>
          </div>
        </div>
        <p>
          We are preparing a bio-data update form so you can manage your contact
          information directly from this dashboard.
        </p>
      </div>
    </div>
  );
}
