import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useUser } from "@clerk/clerk-react";
import { syncUserWithBackend, updateRole as apiUpdateRole } from "../services/auth.service";
import type { User, UserRole } from "../types";

interface AuthContextValue {
  dbUser: User | null;
  role: UserRole;
  isAnalyst: boolean;
  isAdmin: boolean;
  loading: boolean;
  syncNow: () => Promise<void>;
  changeRole: (newRole: UserRole) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const { user: clerkUser, isSignedIn, isLoaded } = useUser();
  const [dbUser, setDbUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  async function performSync() {
    if (!isSignedIn || !clerkUser) {
      setDbUser(null);
      setLoading(false);
      return;
    }

    try {
      const name =
        clerkUser.fullName ||
        [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ").trim() ||
        clerkUser.username ||
        undefined;
      const email = clerkUser.primaryEmailAddress?.emailAddress;

      const res = await syncUserWithBackend({ name, email });
      if (res.ok && res.user) {
        setDbUser(res.user);
      }
    } catch (err) {
      console.error("[AuthContext] Failed to sync user with Neon DB:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (isLoaded) {
      performSync();
    }
  }, [isLoaded, isSignedIn, clerkUser?.id]);

  async function changeRole(newRole: UserRole) {
    try {
      const res = await apiUpdateRole(newRole);
      if (res.ok && res.user) {
        setDbUser(res.user);
      }
    } catch (err: any) {
      console.error("[AuthContext] Failed to update role:", err);
      throw err;
    }
  }

  const role: UserRole = dbUser?.role || "listener";
  const isAnalyst = role === "analyst" || role === "admin";
  const isAdmin = role === "admin";

  return (
    <AuthContext.Provider
      value={{
        dbUser,
        role,
        isAnalyst,
        isAdmin,
        loading,
        syncNow: performSync,
        changeRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
