import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setAccessToken } from "@/lib/api";
import { migrateLegacyLocalStorage } from "@/lib/legacyMigration";

type AuthUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "ADMIN" | "GERENTE" | "BORRACHARIA" | "MANUTENCAO" | "VISUALIZACAO" | "USER";
};

type AuthResponse = { token: string; user: AuthUser };

type RegisterInput = {
  name: string;
  username: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const finishAuthentication = useCallback(async (data: AuthResponse) => {
    setAccessToken(data.token);
    setUser(data.user);
    await migrateLegacyLocalStorage();
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAccessToken(null);
      setUser(null);
    };
    window.addEventListener("radasa:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("radasa:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    let active = true;

    api.get<AuthUser>("/auth/me")
      .then(async ({ data }) => {
        if (!active) return;
        setUser(data);
        await migrateLegacyLocalStorage();
      })
      .catch(() => {
        setAccessToken(null);
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const login = async (identifier: string, password: string) => {
    const { data } = await api.post<AuthResponse>("/auth/login", { identifier, password });
    await finishAuthentication(data);
  };

  const register = async (input: RegisterInput) => {
    const { data } = await api.post<AuthResponse>("/auth/register", input);
    await finishAuthentication(data);
  };

  const logout = () => {
    setAccessToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
