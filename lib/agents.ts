import { apiClient } from './apiClient';

export interface AgentProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  whatsapp_number: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  bank_name: string | null;
  company_name: string | null;
  address: string | null;
  status: string;
  created_at?: string;
  updated_at?: string;
}

export interface AgentProfileUpdateData {
  full_name: string;
  email: string;
  phone?: string | null;
  whatsapp_number?: string | null;
  bank_account_name?: string | null;
  bank_account_number?: string | null;
  bank_name?: string | null;
  company_name?: string | null;
  address?: string | null;
}

export interface AgentPasswordChangeData {
  current_password?: string;
  password: string;
  password_confirmation: string;
}

const getAgentAuthHeaders = (): Record<string, string> => {
  if (typeof window === 'undefined') {
    return {};
  }

  const token =
    localStorage.getItem('agentToken') ?? localStorage.getItem('agent_token');

  if (!token) {
    return {};
  }

  return {
    Authorization: `Bearer ${token}`,
  };
};

export const agentApi = {
  // Registration & Authentication
  register: async (data: {
    full_name: string;
    email: string;
    whatsapp_number: string;
    password: string;
    password_confirmation: string;
  }) => {
    return apiClient.post('/api/v1/agents/register', data);
  },

  googleAuth: async (credential: string) => {
    return apiClient.post('/api/v1/agents/google-auth', {
      credential,
    });
  },

  login: async (email: string, password: string) => {
    return apiClient.post('/api/v1/agents/login', {
      email,
      password,
    });
  },

  // Dashboard
  getDashboard: async (agentId?: string) => {
    const params = agentId ? `?agent_id=${agentId}` : '';
    return apiClient.get(`/api/v1/agents/dashboard${params}`, {
      headers: getAgentAuthHeaders(),
    });
  },

  // Profile
  getProfile: async () => {
    return apiClient.get('/api/v1/agents/profile', {
      headers: getAgentAuthHeaders(),
    });
  },

  updateProfile: async (data: AgentProfileUpdateData) => {
    return apiClient.put('/api/v1/agents/profile', data, {
      headers: getAgentAuthHeaders(),
    });
  },

  changePassword: async (data: AgentPasswordChangeData) => {
    return apiClient.put('/api/v1/agents/profile/password', data, {
      headers: getAgentAuthHeaders(),
    });
  },

  // Referrals
  generateReferral: async (customCode?: string) => {
    return apiClient.post('/api/v1/agents/referrals/generate', {
      custom_code: customCode,
    }, {
      headers: getAgentAuthHeaders(),
    });
  },

  getReferral: async (referralId: string) => {
    return apiClient.get(`/api/v1/agents/referrals/${referralId}`, {
      headers: getAgentAuthHeaders(),
    });
  },

  // Commissions
  getCommissionHistory: async (page = 1, perPage = 20) => {
    return apiClient.get(
      `/api/v1/agents/commissions/history?page=${page}&per_page=${perPage}`,
      {
        headers: getAgentAuthHeaders(),
      }
    );
  },

  // Payouts
  requestPayout: async (amount: number) => {
    return apiClient.post('/api/v1/agents/payouts/request', {
      amount,
    }, {
      headers: getAgentAuthHeaders(),
    });
  },

  getPayoutHistory: async (page = 1, perPage = 20) => {
    return apiClient.get(
      `/api/v1/agents/payouts/history?page=${page}&per_page=${perPage}`,
      {
        headers: getAgentAuthHeaders(),
      }
    );
  },
};

export const subscriptionApi = {
  // Terms
  getTerm: async (termId: string) => {
    return apiClient.get(`/api/v1/terms/${termId}`);
  },

  switchTerm: async (termId: string) => {
    return apiClient.post(`/api/v1/terms/${termId}/switch`, {});
  },

  getSchoolTerms: async (page = 1, perPage = 20) => {
    return apiClient.get(
      `/api/v1/terms/school/all?page=${page}&per_page=${perPage}`
    );
  },

  getPaymentDetails: async (termId: string) => {
    return apiClient.get(`/api/v1/terms/${termId}/payment-details`);
  },

  sendPaymentReminder: async (termId: string) => {
    return apiClient.post(`/api/v1/terms/${termId}/send-reminder`, {});
  },
};

export const adminApi = {
  // Agents
  getPendingAgents: async (page = 1, perPage = 20) => {
    return apiClient.get(
      `/api/v1/admin/agents/pending?page=${page}&per_page=${perPage}`
    );
  },

  approveAgent: async (agentId: string) => {
    return apiClient.post(`/api/v1/admin/agents/${agentId}/approve`, {});
  },

  rejectAgent: async (agentId: string, reason?: string) => {
    return apiClient.post(`/api/v1/admin/agents/${agentId}/reject`, {
      reason: reason || 'No reason provided',
    });
  },

  suspendAgent: async (agentId: string) => {
    return apiClient.post(`/api/v1/admin/agents/${agentId}/suspend`, {});
  },

  // Commissions
  getCommissions: async (status?: string, page = 1, perPage = 20) => {
    let url = `/api/v1/admin/commissions?page=${page}&per_page=${perPage}`;
    if (status) url += `&status=${status}`;
    return apiClient.get(url);
  },

  approveCommission: async (commissionId: string) => {
    return apiClient.post(`/api/v1/admin/commissions/${commissionId}/approve`, {});
  },

  bulkApproveCommissions: async (commissionIds: string[]) => {
    return apiClient.post('/api/v1/admin/commissions/bulk-approve', {
      commission_ids: commissionIds,
    });
  },

  // Payouts
  getPayouts: async (status?: string, page = 1, perPage = 20) => {
    let url = `/api/v1/admin/payouts?page=${page}&per_page=${perPage}`;
    if (status) url += `&status=${status}`;
    return apiClient.get(url);
  },

  approvePayout: async (payoutId: string) => {
    return apiClient.post(`/api/v1/admin/payouts/${payoutId}/approve`, {});
  },

  processPayout: async (payoutId: string) => {
    return apiClient.post(`/api/v1/admin/payouts/${payoutId}/process`, {});
  },

  bulkApprovePayouts: async (payoutIds: string[]) => {
    return apiClient.post('/api/v1/admin/payouts/bulk-approve', {
      payout_ids: payoutIds,
    });
  },
};
