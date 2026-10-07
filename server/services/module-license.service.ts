import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";

export const LICENSE_MODULES = ["TRANSPORTES", "AGRO"] as const;
export type LicenseModule = (typeof LICENSE_MODULES)[number];
export type LicenseStatus = "ATIVA" | "VENCIDA" | "SUSPENSA" | "NAO_CONTRATADO" | "ILIMITADA";

const DAY_MS = 24 * 60 * 60 * 1000;

type LicenseRow = {
  id: string;
  userId: string;
  module: string;
  active: boolean;
  unlimited: boolean;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export function parseLicenseModule(value: string): LicenseModule {
  const module = value.trim().toUpperCase();
  if (!LICENSE_MODULES.includes(module as LicenseModule)) {
    throw new AppError(400, "Módulo de licença inválido.");
  }
  return module as LicenseModule;
}

export function licenseSummary(module: LicenseModule, row?: LicenseRow | null, now = new Date()) {
  if (!row) {
    return {
      module,
      status: "NAO_CONTRATADO" as LicenseStatus,
      active: false,
      unlimited: false,
      expiresAt: null,
      remainingDays: null,
    };
  }

  if (!row.active) {
    return {
      module,
      status: "SUSPENSA" as LicenseStatus,
      active: false,
      unlimited: row.unlimited,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      remainingDays: row.unlimited ? null : 0,
    };
  }

  if (row.unlimited) {
    return {
      module,
      status: "ILIMITADA" as LicenseStatus,
      active: true,
      unlimited: true,
      expiresAt: null,
      remainingDays: null,
    };
  }

  if (!row.expiresAt || row.expiresAt.getTime() <= now.getTime()) {
    return {
      module,
      status: "VENCIDA" as LicenseStatus,
      active: true,
      unlimited: false,
      expiresAt: row.expiresAt?.toISOString() ?? null,
      remainingDays: 0,
    };
  }

  return {
    module,
    status: "ATIVA" as LicenseStatus,
    active: true,
    unlimited: false,
    expiresAt: row.expiresAt.toISOString(),
    remainingDays: Math.max(0, Math.ceil((row.expiresAt.getTime() - now.getTime()) / DAY_MS)),
  };
}

export function userLicenseSummaries(role: string, rows: LicenseRow[], now = new Date()) {
  if (role === "ADMIN") {
    return LICENSE_MODULES.map((module) => ({
      module,
      status: "ILIMITADA" as LicenseStatus,
      active: true,
      unlimited: true,
      expiresAt: null,
      remainingDays: null,
    }));
  }

  const byModule = new Map(rows.map((row) => [row.module, row]));
  return LICENSE_MODULES.map((module) => licenseSummary(module, byModule.get(module), now));
}

export async function getUserLicenseSummaries(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, moduleLicenses: true },
  });
  if (!user) throw new AppError(404, "Usuário não encontrado.");
  return userLicenseSummaries(user.role, user.moduleLicenses);
}

export async function setLicenseRemainingDays(input: {
  targetUserId: string;
  adminUserId: string;
  module: LicenseModule;
  remainingDays: number;
}) {
  const remainingDays = Number(input.remainingDays);
  if (!Number.isInteger(remainingDays) || remainingDays < 0 || remainingDays > 365000) {
    throw new AppError(400, "Informe uma quantidade inteira de dias entre 0 e 365000.");
  }

  const target = await prisma.user.findUnique({
    where: { id: input.targetUserId },
    select: { id: true, username: true, name: true, role: true },
  });
  if (!target) throw new AppError(404, "Usuário não encontrado.");
  if (target.role === "ADMIN") throw new AppError(400, "Contas administrativas possuem licença permanente.");

  const current = await prisma.moduleLicense.findUnique({
    where: { userId_module: { userId: input.targetUserId, module: input.module } },
  });
  const before = licenseSummary(input.module, current);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + remainingDays * DAY_MS);

  const updated = await prisma.$transaction(async (tx) => {
    const license = await tx.moduleLicense.upsert({
      where: { userId_module: { userId: input.targetUserId, module: input.module } },
      create: {
        userId: input.targetUserId,
        module: input.module,
        active: true,
        unlimited: false,
        expiresAt,
      },
      update: {
        active: true,
        unlimited: false,
        expiresAt,
      },
    });

    const after = licenseSummary(input.module, license, now);
    await tx.auditLog.create({
      data: {
        userId: input.adminUserId,
        action: `Alterou licença ${input.module} de @${target.username}`,
        method: "PUT",
        path: `/api/admin/usuarios/${target.id}/licencas/${input.module}/dias`,
        entityId: target.id,
        detalhes: {
          usuario: target.username,
          nome: target.name,
          modulo: input.module,
          antes: before,
          depois: after,
        },
      },
    });

    return license;
  });

  return licenseSummary(input.module, updated, now);
}
