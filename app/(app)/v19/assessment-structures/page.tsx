'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiFetch } from '@/lib/apiClient';

interface AssessmentComponent {
  id: string;
  name: string;
  max_score?: number;
  weight?: number;
  label?: string;
}

export default function AssessmentStructuresPage() {
  const [components, setComponents] = useState<AssessmentComponent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadComponents();
  }, []);

  const loadComponents = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/v1/settings/assessment-components') as any;
      
      if (res?.data) {
        setComponents(res.data);
      } else if (Array.isArray(res)) {
        setComponents(res);
      } else {
        setComponents([]);
      }
    } catch (err: any) {
      console.error('Error loading components:', err);
      setError(err.message || 'Failed to load assessment components. Please check your backend connection.');
      setComponents([]);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="d-flex align-items-center justify-content-center min-vh-100">
        <div className="spinner-border text-primary" role="status">
          <span className="sr-only">Loading assessment components...</span>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="breadcrumbs-area">
        <h3>Assessment Score Structures</h3>
        <ul>
          <li>
            <Link href="/v10/dashboard">Home</Link>
          </li>
          <li>Assessment Structures</li>
        </ul>
      </div>

      <div className="row">
        <div className="col-12">
          {/* Header */}
          <div className="card height-auto mb-4">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>Assessment Score Structures</h3>
                  <p className="text-muted mb-0">
                    Manage class and term-specific score limits for each assessment component
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Error Alert */}
          {error && (
            <div className="alert alert-danger mb-4" role="alert">
              <div className="d-flex align-items-start justify-content-between">
                <div>
                  <strong>Failed to Load Components</strong>
                  <p className="mb-0">{error}</p>
                </div>
                <button
                  onClick={loadComponents}
                  className="btn btn-danger btn-sm"
                >
                  Retry
                </button>
              </div>
            </div>
          )}

          {/* Info Box */}
          <div className="card height-auto mb-4">
            <div className="card-body bg-light">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>💡 What are Score Structures?</h3>
                </div>
              </div>
              <p className="text-muted mb-3">
                Score structures allow you to set different maximum scores for assessment components based on specific classes and terms.
                For example, you can configure CA1 to have a maximum of 10 points for JSS1, 15 for SSS1, and 20 for SSS3.
              </p>
              <ul className="list-unstyled mb-0">
                <li className="mb-2">✓ Set class-specific limits (applies to all terms)</li>
                <li className="mb-2">✓ Set term-specific limits (applies to all classes)</li>
                <li className="mb-2">✓ Set class + term combinations (highest priority)</li>
                <li className="mb-0">✓ Fallback to component default if no structure matches</li>
              </ul>
            </div>
          </div>

          {/* Components Grid */}
          {components.length === 0 ? (
            <div className="card height-auto">
              <div className="card-body text-center">
                <div className="text-4xl text-gray-300 mb-4">📝</div>
                <p className="text-gray-600 font-medium mb-2">No assessment components found</p>
                <p className="text-gray-500 text-sm">
                  Create assessment components first to manage their score structures.
                </p>
              </div>
            </div>
          ) : (
            <div className="row">
              {components.map((component) => (
                <div key={component.id} className="col-xl-4 col-lg-6 col-md-6 col-12 mb-4">
                  <div className="card height-auto">
                    <div className="card-body">
                      <div className="heading-layout1 mb-3">
                        <div className="item-title">
                          <h3 className="mb-1">{component.name}</h3>
                          {component.label && (
                            <p className="text-muted small mb-0">{component.label}</p>
                          )}
                        </div>
                        <div className="dropdown">
                          <span className="text-2xl">⚙️</span>
                        </div>
                      </div>

                      <div className="row gutters-20 mb-3">
                        {component.max_score && (
                          <div className="col-6">
                            <div className="item-content">
                              <div className="item-title text-muted small">Default Score</div>
                              <div className="item-number">
                                <span className="badge badge-info">{Number(component.max_score).toFixed(2)}</span>
                              </div>
                            </div>
                          </div>
                        )}
                        {component.weight && (
                          <div className="col-6">
                            <div className="item-content">
                              <div className="item-title text-muted small">Weight</div>
                              <div className="item-number">
                                <span className="text-dark">{Number(component.weight).toFixed(2)}%</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>

                      <Link
                        href={`/v19/assessment-components/${component.id}/structures`}
                        className="btn-fill-lmd btn-gradient-yellow btn-hover-bluedark text-light w-100"
                      >
                        Manage Structures
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Help Section */}
          <div className="card height-auto">
            <div className="card-body">
              <div className="heading-layout1">
                <div className="item-title">
                  <h3>🎯 How to Use</h3>
                </div>
              </div>
              <ol className="mb-0">
                <li><strong>1. Click on a component</strong> from the grid above</li>
                <li><strong>2. Click "Add Structure"</strong> to create a new score configuration</li>
                <li><strong>3. Select optional class and/or term</strong> to make it specific</li>
                <li><strong>4. Set the max score</strong> teachers can assign for this component</li>
                <li><strong>5. Save and repeat</strong> for other classes/terms as needed</li>
              </ol>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
