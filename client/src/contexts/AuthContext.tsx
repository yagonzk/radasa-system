import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { api, setAccessToken } from "@/lib/api";
import { migrateLegacyLocalStorage } from "@/lib/legacyMigration";
import { REALTIME_CHANGE_EVENT, startRealtimeSync } from "@/lib/realtime";


export type ModuleLicenseSummary = {
  module: "TRANSPORTES" | "AGRO";
  status: "ATIVA" | "VENCIDA" | "SUSPENSA" | "NAO_CONTRATADO" | "ILIMITADA";
  active: boolean;
  unlimited: boolean;
  expiresAt: string | null;
  remainingDays: number | null;
};

export type AuthUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  telefone: string;
  cpf: string | null;
  fotoPerfil: string | null;
  role: "ADMIN" | "GERENTE" | "BORRACHARIA" | "MANUTENCAO" | "VISUALIZACAO" | "USER";
  motoristaId?: string | null;
  permissoes?: Record<string, boolean>;
  licenses?: ModuleLicenseSummary[];
};

type AuthResponse = { token: string; user: AuthUser };
type RegisterResponse = { message: string };

type RegisterInput = { name: string; username: string; email: string; password: string };
export type UpdateProfileInput = { name: string; email: string; telefone: string; cpf: string; fotoPerfil?: string | null };

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<string>;
  updateProfile: (input: UpdateProfileInput) => Promise<AuthUser>;
  refreshUser: () => Promise<AuthUser | null>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function canUseTransportes(user: AuthUser) {
  if (user.role === "ADMIN") return true;
  const license = user.licenses?.find((item) => item.module === "TRANSPORTES");
  if (!license || !license.active) return false;
  if (license.unlimited || license.status === "ILIMITADA") return true;
  return license.status === "ATIVA" && !!license.expiresAt && new Date(license.expiresAt).getTime() > Date.now();
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const finishAuthentication = useCallback(async (data: AuthResponse) => {
    setAccessToken(data.token);
    setUser(data.user);
    // A migração legada usa APIs do TMS. Não a executamos quando a conta possui
    // apenas Agro, evitando requests bloqueadas logo após o login.
    if (canUseTransportes(data.user)) await migrateLegacyLocalStorage();
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const { data } = await api.get<AuthUser>("/auth/me");
      setUser(data);
      return data;
    } catch (error: any) {
      if (error?.response?.status === 401) {
        setAccessToken(null);
        setUser(null);
        return null;
      }
      throw error;
    }
  }, []);

  useEffect(() => {
    const handleUnauthorized = () => { setAccessToken(null); setUser(null); };
    window.addEventListener("radasa:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("radasa:unauthorized", handleUnauthorized);
  }, []);

  useEffect(() => {
    if (!user) return;
    return startRealtimeSync();
  }, [user?.id]);

  useEffect(() => {
    if (!user) return;
    let timer: number | undefined;
    const refreshSoon = () => {
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void refreshUser().catch(() => undefined); }, 150);
    };
    const onBlocked = () => refreshSoon();
    const onRealtime = (event: Event) => {
      const detail = (event as CustomEvent<{ path?: string }>).detail;
      if (String(detail?.path || "").includes("/licencas/")) refreshSoon();
    };
    window.addEventListener("radasa:module-license-blocked", onBlocked);
    window.addEventListener(REALTIME_CHANGE_EVENT, onRealtime);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener("radasa:module-license-blocked", onBlocked);
      window.removeEventListener(REALTIME_CHANGE_EVENT, onRealtime);
    };
  }, [user?.id, refreshUser]);

  useEffect(() => {
    let active = true;
    api.get<AuthUser>("/auth/me")
      .then(async ({ data }) => { if (!active) return; setUser(data); if (canUseTransportes(data)) await migrateLegacyLocalStorage(); })
      .catch(() => { setAccessToken(null); if (active) setUser(null); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const login = async (identifier: string, password: string) => {
    const { data } = await api.post<AuthResponse>("/auth/login", { identifier, password });
    await finishAuthentication(data);
  };

  const register = async (input: RegisterInput) => {
    const { data } = await api.post<RegisterResponse>("/auth/register", input);
    return data.message;
  };

  const updateProfile = async (input: UpdateProfileInput) => {
    const { data } = await api.put<AuthUser>("/auth/profile", input);
    setUser(data);
    return data;
  };

  const logout = () => { setAccessToken(null); setUser(null); };

  return <AuthContext.Provider value={{ user, loading, login, register, updateProfile, refreshUser, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return context;
}
