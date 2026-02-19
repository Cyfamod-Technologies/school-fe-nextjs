'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface Agent {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  status: 'pending' | 'approved' | 'suspended' | 'inactive';
  bank_account_name?: string;
  bank_account_number?: string;
  bank_name?: string;
  company_name?: string;
}

interface AgentContextType {
  agent: Agent | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  register: (data: any) => Promise<void>;
  fetchAgent: () => Promise<void>;
}

const AgentContext = createContext<AgentContextType | undefined>(undefined);

export function AgentProvider({ children }: { children: React.ReactNode }) {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if agent is logged in on mount
    const token = localStorage.getItem('agent_token');
    if (token) {
      fetchAgent();
    } else {
      setLoading(false);
    }
  }, []);

  const fetchAgent = async () => {
    try {
      const token = localStorage.getItem('agent_token');
      if (!token) {
        setAgent(null);
        return;
      }

      const response = await fetch('/api/v1/agents/dashboard', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAgent(data.agent);
      } else {
        localStorage.removeItem('agent_token');
        setAgent(null);
      }
    } catch (error) {
      console.error('Failed to fetch agent:', error);
      setAgent(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (email: string, password: string) => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/agents/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        throw new Error('Login failed');
      }

      const data = await response.json();
      localStorage.setItem('agent_token', data.token);
      setAgent(data.agent);
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const token = localStorage.getItem('agent_token');
      if (token) {
        await fetch('/api/v1/agents/logout', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } finally {
      localStorage.removeItem('agent_token');
      setAgent(null);
    }
  };

  const register = async (data: any) => {
    setLoading(true);
    try {
      const response = await fetch('/api/v1/agents/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error('Registration failed');
      }

      const result = await response.json();
      setAgent(result.agent);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AgentContext.Provider
      value={{
        agent,
        loading,
        isAuthenticated: !!agent,
        login,
        logout,
        register,
        fetchAgent,
      }}
    >
      {children}
    </AgentContext.Provider>
  );
}

export function useAgent() {
  const context = useContext(AgentContext);
  if (context === undefined) {
    throw new Error('useAgent must be used within AgentProvider');
  }
  return context;
}
