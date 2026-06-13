"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { getCurrentUser } from "@/features/auth/services/auth-service";

const TOKEN_KEY = "ww_token";
const USER_KEY = "ww_user";
const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(null);
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    router.replace("/login");
  }, [router]);

  const storeSession = useCallback((session) => {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    setToken(session.token);
    setUser(session.user);
  }, []);

  const refreshUser = useCallback(async (activeToken = token) => {
    if (!activeToken) return null;
    const nextUser = await getCurrentUser(activeToken);
    localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
    setUser(nextUser);
    return nextUser;
  }, [token]);

  useEffect(() => {
    let cancelled = false;

    queueMicrotask(() => {
      if (cancelled) return;
      const storedToken = localStorage.getItem(TOKEN_KEY);
      const storedUser = localStorage.getItem(USER_KEY);

      if (storedToken) setToken(storedToken);
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
        } catch {
          localStorage.removeItem(USER_KEY);
        }
      }
      setReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!ready) return;
    const isPublic = ["/", "/login", "/signup", "/forgot-password"].includes(pathname);
    if (!token && !isPublic) router.replace("/login");
    if (token && ["/login", "/signup", "/forgot-password"].includes(pathname)) router.replace("/dashboard");
  }, [pathname, ready, router, token]);

  const value = useMemo(() => ({
    token,
    user,
    ready,
    isAdmin: Boolean(user?.isPlatformOwner),
    storeSession,
    refreshUser,
    logout
  }), [logout, ready, refreshUser, storeSession, token, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
