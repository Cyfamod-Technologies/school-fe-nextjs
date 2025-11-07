"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  getAuthenticatedUser,
  login as loginRequest,
  logout as logoutRequest,
  type LoginPayload,
  type User,
} from "@/lib/auth";
import {
  createEmptySchoolContext,
  fetchSchoolContext,
  type SchoolContext,
} from "@/lib/schoolContext";
import { deleteCookie, getCookie, setCookie } from "@/lib/cookies";

interface AuthState {
  user: User | null;
  schoolContext: SchoolContext;
  loading: boolean;
  permissions: Set<string>;
  hasPermission: (permission?: string | string[] | null) => boolean;
  login: (payload: LoginPayload) => Promise<void>;
  logout: () => Promise<void>;
  refreshSchoolContext: () => Promise<void>;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthState | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [schoolContext, setSchoolContext] = useState<SchoolContext>(
    createEmptySchoolContext,
  );
  const [loading, setLoading] = useState(true);
  const [permissions, setPermissions] = useState<Set<string>>(new Set());

  const hydrate = useCallback(async () => {
    const token = getCookie("token");
    if (!token) {
      setUser(null);
      setPermissions(new Set());
      setSchoolContext(createEmptySchoolContext());
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [userResponse, school] = await Promise.all([
        getAuthenticatedUser(),
        fetchSchoolContext(),
      ]);
      setUser(userResponse);
      setPermissions(
        new Set(
          Array.isArray(userResponse?.permissions)
            ? (userResponse.permissions as string[])
            : [],
        ),
      );
      setSchoolContext(school);
    } catch (error) {
      console.error("Failed to hydrate auth context", error);
      setUser(null);
      setPermissions(new Set());
      setSchoolContext(createEmptySchoolContext());
      deleteCookie("token");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const login = useCallback(async (payload: LoginPayload) => {
    const response = await loginRequest(payload);
    if (response.token) {
      setCookie("token", response.token);
    }
    await hydrate();
  }, [hydrate]);

  const logout = useCallback(async () => {
    await logoutRequest();
    deleteCookie("token");
    setUser(null);
    setPermissions(new Set());
    setSchoolContext(createEmptySchoolContext());
  }, []);

  const refreshSchoolContext = useCallback(async () => {
    const context = await fetchSchoolContext();
    setSchoolContext(context);
  }, []);

  const refreshAuth = useCallback(async () => {
    await hydrate();
  }, [hydrate]);

  const hasPermission = useCallback(
    (required?: string | string[] | null) => {
      if (!required) {
        return true;
      }
      const requiredList = Array.isArray(required) ? required : [required];
      if (requiredList.length === 0) {
        return true;
      }

      return requiredList.some((permission) => permissions.has(permission));
    },
    [permissions],
  );

  const value = useMemo(
    () => ({
      user,
      schoolContext,
      loading,
      permissions,
      hasPermission,
      login,
      logout,
      refreshSchoolContext,
      refreshAuth,
    }),
    [
      user,
      schoolContext,
      loading,
      permissions,
      hasPermission,
      login,
      logout,
      refreshSchoolContext,
      refreshAuth,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
