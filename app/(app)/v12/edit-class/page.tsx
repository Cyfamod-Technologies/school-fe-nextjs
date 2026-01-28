"use client";

import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { getClass, updateClass } from "@/lib/classes";

export default function EditClassPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const classId = searchParams.get("id");

  const [name, setName] = useState("");
  const [showPosition, setShowPosition] = useState<"default" | "show" | "hide">("default");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!classId) {
      router.replace("/v12/all-classes");
      return;
    }

    getClass(classId)
      .then((result) => {
        if (!result) {
          throw new Error("Class not found.");
        }
        setName(result.name ?? "");
        setShowPosition(
          result.result_show_position === true
            ? "show"
            : result.result_show_position === false
              ? "hide"
              : "default",
        );
        setError(null);
      })
      .catch((err) => {
        console.error("Unable to load class", err);
        setError(
          err instanceof Error ? err.message : "Unable to load class.",
        );
      })
      .finally(() => setLoading(false));
  }, [classId, router]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!classId) {
      return;
    }

    if (!name.trim()) {
      setError("Please enter a class name.");
      return;
    }

    setSubmitting(true);
    try {
      await updateClass(classId, {
        name: name.trim(),
        result_show_position:
          showPosition === "default" ? null : showPosition === "show",
      });
      router.push("/v12/all-classes");
    } catch (err) {
      console.error("Unable to update class", err);
      setError(
        err instanceof Error ? err.message : "Unable to update class.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!classId) {
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
        <h3>Class Management</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href="/v12/all-classes">All Classes</Link>
          </li>
          <li>Edit Class</li>
        </ul>
      </div>

      {error ? (
        <div className="alert alert-danger" role="alert">
          {error}
        </div>
      ) : null}

      <div className="card height-auto">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Edit Class</h3>
            </div>
          </div>

          <form className="new-added-form" onSubmit={handleSubmit}>
            <div className="row">
              <div className="col-12 form-group">
                <label htmlFor="class-name">Class Name *</label>
                <input
                  id="class-name"
                  type="text"
                  className="form-control"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                />
              </div>
              <div className="col-12 form-group">
                <label htmlFor="class-show-position">Show Position on Result</label>
                <select
                  id="class-show-position"
                  className="form-control"
                  value={showPosition}
                  onChange={(event) =>
                    setShowPosition(event.target.value as "default" | "show" | "hide")
                  }
                >
                  <option value="default">Use school default</option>
                  <option value="show">Show position</option>
                  <option value="hide">Hide position</option>
                </select>
              </div>
              <div className="col-12 form-group mg-t-8">
                <button
                  type="submit"
                  className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark"
                  disabled={submitting}
                >
                  {submitting ? "Saving…" : "Save Changes"}
                </button>
                <Link
                  href="/v12/all-classes"
                  className="btn-fill-lg bg-blue-dark btn-hover-yellow"
                >
                  Cancel
                </Link>
              </div>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
