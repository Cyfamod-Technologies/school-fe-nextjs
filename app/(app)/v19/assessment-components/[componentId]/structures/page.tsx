'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { apiFetch } from '@/lib/apiClient';

interface Structure {
  id: string;
  assessment_component_id: string;
  class_id: string | null;
  term_id: string | null;
  max_score: number;
  description: string | null;
  is_active: boolean;
  class?: { id: string; name: string };
  term?: { id: string; name: string };
  created_at?: string;
}

interface AssessmentComponent {
  id: string;
  name: string;
  max_score?: number;
  weight?: number;
  label?: string;
}

interface SchoolClass {
  id: string;
  name: string;
}

interface SessionTerm {
  id: string;
  name: string;
}

const statusBadgeClass = (isActive: boolean): string => {
  return isActive ? 'badge badge-success' : 'badge badge-secondary';
};

export default function AssessmentComponentStructures() {
  const params = useParams();
  const componentId = params.componentId as string;

  const [component, setComponent] = useState<AssessmentComponent | null>(null);
  const [structures, setStructures] = useState<Structure[]>([]);
  const [classes, setClasses] = useState<SchoolClass[]>([]);
  const [terms, setTerms] = useState<SessionTerm[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const componentSummary = component
    ? `Configuring structures for ${component.name}. Default score: ${
        component.weight ?? 'Not set'
      }.`
    : 'Configure class and term specific scores.';
  const componentScore =
    typeof component?.weight === 'number'
      ? component.weight.toFixed(2)
      : '—';
  const componentWeight =
    typeof component?.weight === 'number'
      ? component.weight.toFixed(2)
      : '—';
  const totalStructures = structures.length;
  const activeStructures = structures.filter((structure) => structure.is_active).length;

  const [formData, setFormData] = useState({
    class_id: new Set<string>(),
    term_id: '',
    max_score: '',
    description: '',
    is_active: true,
  });

  useEffect(() => {
    loadData();
  }, [componentId]);

  const loadData = async () => {
    try {
      setLoading(true);
      setError('');

      const [structuresRes, classesRes, termsRes] = (await Promise.all([
        apiFetch(`/api/v1/settings/assessment-component-structures/component/${componentId}`),
        apiFetch('/api/v1/classes'),
        apiFetch('/api/v1/terms'),
      ])) as any[];

      setComponent((structuresRes as any)?.component);
      setStructures((structuresRes as any)?.structures || []);
      setClasses(Array.isArray(classesRes) ? classesRes : (classesRes as any)?.data || []);
      setTerms(Array.isArray(termsRes) ? termsRes : (termsRes as any)?.data || []);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const selectedClasses = Array.from(formData.class_id);
      if (selectedClasses.length === 0) {
        // Create one structure for all classes
        const payload = {
          assessment_component_id: componentId,
          class_id: null,
          term_id: null,
          max_score: parseFloat(formData.max_score),
          description: formData.description || null,
          is_active: formData.is_active,
        };

        await apiFetch('/api/v1/settings/assessment-component-structures', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      } else {
        // Create separate structures for each selected class
        const promises = selectedClasses.map((classId) =>
          apiFetch('/api/v1/settings/assessment-component-structures', {
            method: 'POST',
            body: JSON.stringify({
              assessment_component_id: componentId,
              class_id: classId,
              term_id: null,
              max_score: parseFloat(formData.max_score),
              description: formData.description || null,
              is_active: formData.is_active,
            }),
          })
        );
        await Promise.all(promises);
      }

      setSuccess('Structure(s) saved successfully');
      setFormData({
        class_id: new Set<string>(),
        term_id: '',
        max_score: '',
        description: '',
        is_active: true,
      });
      setShowForm(false);
      await loadData();
    } catch (err: any) {
      console.error('Error saving structure:', err);
      setError(err.message || 'Failed to save structure');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this structure?')) {
      return;
    }

    setError('');
    setSuccess('');

    try {
      await apiFetch(`/api/v1/settings/assessment-component-structures/${id}`, {
        method: 'DELETE',
      });

      setSuccess('Structure deleted successfully');
      await loadData();
    } catch (err: any) {
      console.error('Error deleting structure:', err);
      setError(err.message || 'Failed to delete structure');
    }
  };

  const handleClassToggle = (classId: string, checked: boolean) => {
    setFormData((prev) => {
      const nextIds = new Set(prev.class_id);
      if (checked) {
        nextIds.add(classId);
      } else {
        nextIds.delete(classId);
      }
      return {
        ...prev,
        class_id: nextIds,
      };
    });
  };

  const handleSelectAllClasses = (checked: boolean) => {
    setFormData((prev) => {
      if (checked) {
        const allClassIds = new Set(classes.map((c) => c.id));
        return {
          ...prev,
          class_id: allClassIds,
        };
      } else {
        return {
          ...prev,
          class_id: new Set<string>(),
        };
      }
    });
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
        <h3>Assessment Structures</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>
            <Link href="/v19/assessment-components">Assessment Components</Link>
          </li>
          <li>Score Structures</li>
        </ul>
      </div>

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="row gutters-20 align-items-center">
            <div className="col-lg-8 col-12">
              <div className="item-title">
                <h3 className="mb-2">Score Structures</h3>
                <p className="text-muted mb-0">{componentSummary}</p>
              </div>
            </div>
            <div className="col-lg-4 col-12 d-flex justify-content-lg-end">
              <button
                type="button"
                onClick={() => setShowForm((prev) => !prev)}
                className="btn-fill-lmd btn-gradient-yellow btn-hover-bluedark text-light"
              >
                {showForm ? 'Close Form' : 'Add Structure'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="row gutters-20">
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-6">
                <div className="item-icon bg-light-blue">
                  <i className="flaticon-percentage-discount text-blue"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Default Score</div>
                  <div className="item-number">
                    <span>{componentScore}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-6">
                <div className="item-icon bg-light-yellow">
                  <i className="flaticon-checklist text-orange"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Weight</div>
                  <div className="item-number">
                    <span>{componentWeight}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-6">
                <div className="item-icon bg-light-green">
                  <i className="flaticon-script text-green"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Structures</div>
                  <div className="item-number">
                    <span>{totalStructures}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
        <div className="col-xl-3 col-sm-6 col-12">
          <div className="dashboard-summery-one mg-b-20">
            <div className="row align-items-center">
              <div className="col-6">
                <div className="item-icon bg-light-red">
                  <i className="flaticon-open-book text-red"></i>
                </div>
              </div>
              <div className="col-6">
                <div className="item-content">
                  <div className="item-title">Active</div>
                  <div className="item-number">
                    <span>{activeStructures}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
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

      {showForm ? (
        <div className="card height-auto mb-4">
          <div className="card-body">
            <div className="heading-layout1">
              <div className="item-title">
                <h3>Create Structure</h3>
              </div>
            </div>

            <form onSubmit={handleSubmit}>
              <div className="row gutters-20">
                <div className="col-md-4 col-12 form-group">
                  <label>Classes *</label>
                  <div className="border rounded p-2 class-checkbox-list">
                    {classes.length ? (
                      <>
                        <div className="form-check mb-2 pb-2 border-bottom">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            id="select-all-classes"
                            checked={
                              classes.length > 0 &&
                              formData.class_id.size === classes.length
                            }
                            onChange={(event) =>
                              handleSelectAllClasses(event.target.checked)
                            }
                          />
                          <label
                            className="form-check-label fw-bold"
                            htmlFor="select-all-classes"
                          >
                            Select All
                          </label>
                        </div>
                        {classes.map((cls) => (
                          <div className="form-check" key={cls.id}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`class-${cls.id}`}
                              checked={formData.class_id.has(cls.id)}
                              onChange={(event) =>
                                handleClassToggle(cls.id, event.target.checked)
                              }
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`class-${cls.id}`}
                            >
                              {cls.name}
                            </label>
                          </div>
                        ))}
                      </>
                    ) : (
                      <p className="text-muted mb-0">No classes available</p>
                    )}
                  </div>
                  <small className="form-text text-muted">
                    Select multiple classes or leave empty for all classes.
                  </small>
                </div>

                <div className="col-md-4 col-12 form-group">
                  <label>Term</label>
                  <select
                    disabled
                    value=""
                    className="form-control"
                  >
                    <option value="">Any Term (applies to all)</option>
                  </select>
                  <small className="form-text text-muted">
                    Applied to all terms.
                  </small>
                </div>

                <div className="col-md-4 col-12 form-group">
                  <label>Max Score *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={formData.max_score}
                    onChange={(e) =>
                      setFormData({ ...formData, max_score: e.target.value })
                    }
                    className="form-control"
                    placeholder="10.00"
                  />
                  <small className="form-text text-muted">
                    Maximum score teachers can assign for this component.
                  </small>
                </div>

                <div className="col-md-4 col-12 form-group">
                  <label>Status</label>
                  <div className="form-check">
                    <input
                      id="structure-active"
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) =>
                        setFormData({
                          ...formData,
                          is_active: e.target.checked,
                        })
                      }
                      className="form-check-input"
                    />
                    <label className="form-check-label" htmlFor="structure-active">
                      Active
                    </label>
                  </div>
                </div>

                <div className="col-md-8 col-12 form-group">
                  <label>Description (optional)</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData({ ...formData, description: e.target.value })
                    }
                    className="form-control"
                    rows={3}
                    placeholder="Applies to SSS3 final term examination."
                  />
                </div>

                <div className="col-12 form-group d-flex justify-content-between">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-fill-lg btn-gradient-yellow btn-hover-bluedark text-light"
                  >
                    {submitting ? 'Saving...' : 'Save Structure'}
                  </button>
                  <button
                    type="button"
                    className="btn-fill-lg bg-blue-dark btn-hover-yellow text-light"
                    onClick={() => {
                      setShowForm(false);
                      setFormData({
                        class_id: new Set<string>(),
                        term_id: '',
                        max_score: '',
                        description: '',
                        is_active: true,
                      });
                    }}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      <div className="card height-auto mb-4">
        <div className="card-body">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>Configured Structures</h3>
            </div>
          </div>

          <div className="table-responsive">
            <table className="table display text-nowrap">
              <thead>
                <tr>
                  <th>Class</th>
                  <th>Term</th>
                  <th>Max Score</th>
                  <th>Description</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {structures.length ? (
                  structures.map((structure) => (
                    <tr key={structure.id}>
                      <td>
                        {structure.class?.name ? (
                          <span className="font-weight-bold text-dark">{structure.class.name}</span>
                        ) : (
                          <span className="text-muted">All Classes</span>
                        )}
                      </td>
                      <td>
                        {structure.term?.name ? (
                          <span className="font-weight-bold text-dark">{structure.term.name}</span>
                        ) : (
                          <span className="text-muted">All Terms</span>
                        )}
                      </td>
                      <td>
                        <span className="badge badge-pill badge-info">
                          {Number(structure.max_score).toFixed(2)}
                        </span>
                      </td>
                      <td className="text-muted">
                        {structure.description ? structure.description : 'No description'}
                      </td>
                      <td>
                        <span className={statusBadgeClass(structure.is_active)}>
                          {structure.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          onClick={() => handleDelete(structure.id)}
                          className="btn btn-sm btn-outline-danger"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={6} className="text-center text-muted">
                      No structures configured. Default component score will be used.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card height-auto">
        <div className="card-body bg-light-blue">
          <div className="heading-layout1">
            <div className="item-title">
              <h3>How Score Structures Work</h3>
            </div>
          </div>
          <ul className="list-unstyled mb-0">
            <li className="mb-2">
              <strong>Global Score:</strong> If no specific structure is created, the
              assessment component default score is used.
            </li>
            <li className="mb-2">
              <strong>Class Specific:</strong> Set a different score for a particular
              class (applies to all terms).
            </li>
            <li className="mb-2">
              <strong>Term Specific:</strong> Set a different score for a particular
              term (applies to all classes).
            </li>
            <li className="mb-2">
              <strong>Class + Term:</strong> Set a specific score for a class in a
              particular term (highest priority).
            </li>
            <li>
              <strong>Example:</strong> CA1 can be 10 for JSS1, 15 for SSS1, and 20 for
              SSS3.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}
