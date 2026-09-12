import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, loadToken, setToken } from "./api";

export type User = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  country?: string;
  city?: string;
  roles: string[];
  avatar?: string | null;
  avatarUrl?: string | null;
  shopName?: string;
  specialty?: string | null;
  shopCover?: string | null;
};

type Ctx = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<User>;
  signUp: (data: any) => Promise<User>;
  signInWithGoogle: (idToken: string, extra?: Record<string, any>) => Promise<User>;
  sendOtp: (phone: string, countryIso?: string) => Promise<{ phone: string }>;
  verifyOtp: (data: any) => Promise<User>;
  signOut: () => Promise<void>;
  refresh: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<User>;
};

const AuthCtx = createContext<Ctx>(null as any);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const t = await loadToken();
    if (!t) {
      setUser(null);
      return;
    }
    try {
      const me = await api<User>("/auth/me");
      setUser(me);
    } catch {
      await setToken(null);
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const signIn = async (email: string, password: string) => {
    const r = await api<{ token: string; user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
    return r.user;
  };

  const signUp = async (data: any) => {
    const r = await api<{ token: string; user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify(data),
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
    return r.user;
  };

  const signInWithGoogle = async (idToken: string, extra?: Record<string, any>) => {
    const r = await api<{ token: string; user: User }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken, ...(extra || {}) }),
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
    return r.user;
  };

  const sendOtp = async (phone: string, countryIso?: string) => {
    return api<{ phone: string }>("/auth/otp/send", {
      method: "POST",
      body: JSON.stringify({ phone, countryIso }),
      auth: false,
    });
  };

  const verifyOtp = async (data: any) => {
    const r = await api<{ token: string; user: User }>("/auth/otp/verify", {
      method: "POST",
      body: JSON.stringify(data),
      auth: false,
    });
    await setToken(r.token);
    setUser(r.user);
    return r.user;
  };

  const signOut = async () => {
    await setToken(null);
    setUser(null);
  };

  const updateProfile = async (data: Partial<User>) => {
    const me = await api<User>("/auth/me", {
      method: "PUT",
      body: JSON.stringify(data),
    });
    setUser(me);
    return me;
  };

  return (
    <AuthCtx.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signInWithGoogle,
        sendOtp,
        verifyOtp,
        signOut,
        refresh,
        updateProfile,
      }}
    >
      {children}
    </AuthCtx.Provider>
  );
}

export function useAuth() {
  return useContext(AuthCtx);
}
