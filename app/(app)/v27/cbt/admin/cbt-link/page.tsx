"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { apiFetch } from "@/lib/apiClient";

interface AssessmentComponent {
  id: string;
  name: string;
  label?: string | null;
  weight?: number | null;
  subjects?: Array<{ id: string; name: string; code?: string | null }>;
  updated_at?: string | null;
}

interface AssessmentComponentResponse {
  data?: AssessmentComponent[];
}

export default function CbtLinksOverviewPage() {
  const { user } = useAuth();
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    const loadComponents = async () => {
      try {
        setLoading(true);
        setError(null);
        const payload = await apiFetch<AssessmentComponentResponse>(
          "/api/v1/settings/assessment-components?per_page=200",
        );
        const data = Array.isArray(payload?.data) ? payload.data : [];
        if (active) {
          setComponents(data);
        }
      } catch (err: any) {
        if (active) {
          setError(err?.message ?? "Unable to load assessment components.");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    if (user) {
      loadComponents();
    }

    return () => {
      active = false;
    };
  }, [user]);

  const totalComponents = components.length;
  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100 bg-ash">
        <div className="spinner-border text-dodger-blue" role="status">
          <span className="sr-only">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-ash min-vh-100">
      <div className="breadcrumbs-area quiz-fade-up">
        <h3>CBT Links</h3>
        <ul>
          <li>
            <a href="/cbt">CBT</a>
          </li>
          <li>
            <a href="/v27/cbt/admin">Quiz Management</a>
          </li>
          <li>CBT Links</li>
        </ul>
      </div>

      <div className="row gutters-20 quiz-fade-up quiz-fade-up-delay-1">
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-6">
                <div className="item-icon bg-light-blue">
                  <i className="flaticon-open-book text-blue"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Components</div>
                  <div className="item-number">{totalComponents}</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="card height-auto quiz-fade-up quiz-fade-up-delay-2">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Assessment Components</h3>
              <p className="text-muted mb-0">
                Link CBT exams to assessment components. Editing is done in the assessment module.
              </p>
            </div>
            <div className="d-flex flex-wrap">
              <Link
                href="/v19/assessment-components"
                className="btn-fill-lmd btn-gradient-yellow btn-hover-bluedark text-light mr-2"
              >
                Assessment Components
              </Link>
              <Link
                href="/v19/assessment-structures"
                className="btn-fill-lmd btn-gradient-yellow btn-hover-bluedark text-light"
              >
                Assessment Structures
              </Link>
            </div>
          </div>

          {error ? (
            <div className="alert alert-danger" role="alert">
              {error}
            </div>
          ) : null}

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Label</th>
                  <th>Weight</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {components.length ? (
                  components.map((component) => (
                    <tr key={component.id}>
                      <td>{component.name}</td>
                      <td>{component.label || "-"}</td>
                      <td>
                        {typeof component.weight === "number"
                          ? component.weight.toFixed(2)
                          : "-"}
                      </td>
                      <td>
                        {component.updated_at
                          ? new Date(component.updated_at).toLocaleString()
                          : "-"}
                      </td>
                      <td>
                        <Link
                          href={`/v19/assessment-components/${component.id}/cbt-link`}
                          className="btn btn-sm btn-outline-primary mr-2"
                        >
                          CBT Link
                        </Link>
                        <Link
                          href={`/v19/assessment-components/${component.id}/structures`}
                          className="btn btn-sm btn-outline-secondary"
                        >
                          Structures
                        </Link>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="text-center">
                      No assessment components found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
