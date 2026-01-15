import { apiFetch } from './apiClient';

export interface AssessmentComponentStructure {
  id: string;
  school_id: string;
  assessment_component_id: string;
  class_id: string | null;
  term_id: string | null;
  max_score: number;
  description: string | null;
  is_active: boolean;
  class?: { id: string; name: string };
  term?: { id: string; name: string };
  created_at?: string;
  updated_at?: string;
}

export class AssessmentComponentStructureService {
  /**
   * Get all structures for a specific assessment component
   */
  static async getByComponent(componentId: string) {
    return apiFetch(
      `/api/v1/settings/assessment-component-structures/component/${componentId}`
    );
  }

  /**
   * Create or update a structure
   */
  static async save(structure: {
    assessment_component_id: string;
    class_id: string | null;
    term_id: string | null;
    max_score: number;
    description?: string | null;
    is_active?: boolean;
  }) {
    return apiFetch(
      '/api/v1/settings/assessment-component-structures',
      {
        method: 'POST',
        body: JSON.stringify(structure),
      }
    );
  }

  /**
   * Get max score for a specific assessment component and class
   */
  static async getMaxScore(params: {
    assessment_component_id: string;
    class_id?: string | null;
    term_id?: string | null;
  }) {
    const queryParams = new URLSearchParams();
    queryParams.append('assessment_component_id', params.assessment_component_id);
    if (params.class_id) {
      queryParams.append('class_id', params.class_id);
    }
    if (params.term_id) {
      queryParams.append('term_id', params.term_id);
    }

    return apiFetch(
      `/api/v1/settings/assessment-component-structures/max-score?${queryParams.toString()}`
    );
  }

  /**
   * Get all applicable structures for a component
   */
  static async getApplicable(params: {
    assessment_component_id: string;
    class_id?: string | null;
    term_id?: string | null;
  }) {
    const queryParams = new URLSearchParams();
    queryParams.append('assessment_component_id', params.assessment_component_id);
    if (params.class_id) {
      queryParams.append('class_id', params.class_id);
    }
    if (params.term_id) {
      queryParams.append('term_id', params.term_id);
    }

    return apiFetch(
      `/api/v1/settings/assessment-component-structures/applicable?${queryParams.toString()}`
    );
  }

  /**
   * Create multiple structures at once
   */
  static async bulkSave(structures: Array<{
    assessment_component_id: string;
    class_id: string | null;
    term_id: string | null;
    max_score: number;
    description?: string | null;
    is_active?: boolean;
  }>) {
    return apiFetch(
      '/api/v1/settings/assessment-component-structures/bulk',
      {
        method: 'POST',
        body: JSON.stringify({ structures }),
      }
    );
  }

  /**
   * Delete a structure
   */
  static async delete(id: string) {
    return apiFetch(
      `/api/v1/settings/assessment-component-structures/${id}`,
      {
        method: 'DELETE',
      }
    );
  }
}
