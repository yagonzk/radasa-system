import type { AuthUser, ModuleLicenseSummary } from "@/contexts/AuthContext";

export type RadasaModule = "TRANSPORTES" | "AGRO";

export function getModuleLicense(user: AuthUser | null | undefined, module: RadasaModule) {
  return user?.licenses?.find((license) => license.module === module) ?? null;
}

export function hasModuleAccess(user: AuthUser | null | undefined, module: RadasaModule) {
  if (!user) return false;
  if (user.role === "ADMIN") return true;
  const license = getModuleLicense(user, module);
  if (!license || !license.active) return false;
  if (license.unlimited || license.status === "ILIMITADA") return true;
  if (license.status !== "ATIVA" || !license.expiresAt) return false;
  return new Date(license.expiresAt).getTime() > Date.now();
}

export function remainingModuleDays(license: ModuleLicenseSummary | null | undefined) {
  if (!license || license.unlimited || license.status === "ILIMITADA") return null;
  if (!license.expiresAt) return license.remainingDays ?? 0;
  return Math.max(0, Math.ceil((new Date(license.expiresAt).getTime() - Date.now()) / 86_400_000));
}

export function moduleStatusLabel(license: ModuleLicenseSummary | null | undefined) {
  if (!license) return "Não contratado";
  if (license.unlimited || license.status === "ILIMITADA") return "Sem vencimento";
  if (!license.active || license.status === "SUSPENSA") return "Suspenso";
  const days = remainingModuleDays(license);
  if (license.status === "VENCIDA" || days === 0) return "Licença vencida";
  if (license.status === "NAO_CONTRATADO") return "Não contratado";
  return `${days} dia${days === 1 ? "" : "s"} restante${days === 1 ? "" : "s"}`;
}
