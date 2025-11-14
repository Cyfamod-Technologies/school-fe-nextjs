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
  StudentProfile,
  getStudentProfile,
  studentLogout,
} from "@/lib/studentAuth";

interface StudentAuthContextValue {
  student: StudentProfile | null;
  loading: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
}

const StudentAuthContext = createContext<StudentAuthContextValue | null>(null);

export function StudentAuthProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [student, setStudent] = useState<StudentProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const loadProfile = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await getStudentProfile();
      setStudent(profile);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProfile();
  }, [loadProfile]);

  const handleLogout = useCallback(async () => {
    await studentLogout();
    setStudent(null);
  }, []);

  const value = useMemo(
    () => ({
      student,
      loading,
      refresh: loadProfile,
      logout: handleLogout,
    }),
    [student, loading, loadProfile, handleLogout],
  );

  return (
    <StudentAuthContext.Provider value={value}>
      {children}
    </StudentAuthContext.Provider>
  );
}

export function useStudentAuth(): StudentAuthContextValue {
  const context = useContext(StudentAuthContext);
  if (!context) {
    throw new Error("useStudentAuth must be used within StudentAuthProvider");
  }
  return context;
}
