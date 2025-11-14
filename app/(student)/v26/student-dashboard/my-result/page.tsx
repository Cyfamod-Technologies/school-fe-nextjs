"use client";

import { useStudentAuth } from "@/contexts/StudentAuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function StudentMyResultPage() {
  const { student, loading } = useStudentAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !student) {
      router.push("/student-login");
    }
  }, [loading, student, router]);

  if (loading || !student) {
    return <p>Loading results…</p>;
  }

  return (
    <div className="card height-auto">
      <div className="card-body">
        <div className="heading-layout1 mb-4">
          <div className="item-title">
            <h3>My Result</h3>
            <p className="mb-0 text-muted">
              Select session and term, then enter your PIN to view results.
            </p>
          </div>
        </div>
        <p className="text-muted">
          This page will soon allow you to select a session, choose a term, and
          enter a valid PIN to view or print your result slip directly from the
          portal.
        </p>
      </div>
    </div>
  );
}
