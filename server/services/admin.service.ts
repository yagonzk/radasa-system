import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import {
  parseLicenseModule,
  setLicenseRemainingDays,
  userLicenseSummaries,
} from "./module-license.service.js";

function withLicenseSummaries<T extends { role: string; moduleLicenses?: any[] }>(user: T) {
  const { moduleLicenses = [], ...rest } = user;
  return {
    ...rest,
    licenses: userLicenseSummaries(user.role, moduleLicenses),
  };
}

export const adminService = {
  async usuarios() {
    const users = await prisma.user.findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        active: true,
        motoristaId: true,
        permissoes: true,
        createdAt: true,
        moduleLicenses: true,
      },
    });
    return users.map(withLicenseSummaries);
  },

  async atualizarAcesso(id: string, input: any) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, "Usuário não encontrado.");

    return prisma.user.update({
      where: { id },
      data: {
        role: input.role ?? user.role,
        active: input.active ?? user.active,
        motoristaId: input.motoristaId === undefined ? user.motoristaId : (input.motoristaId || null),
        permissoes: input.permissoes ?? user.permissoes,
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        role: true,
        active: true,
        motoristaId: true,
        permissoes: true,
      },
    });
  },

  async atualizarDiasLicenca(userId: string, moduleValue: string, remainingDays: unknown, adminUserId: string) {
    const module = parseLicenseModule(moduleValue);
    if (remainingDays === null || remainingDays === undefined || String(remainingDays).trim() === "") {
      throw new AppError(400, "Informe os dias restantes da licença.");
    }
    const days = Number(remainingDays);
    return setLicenseRemainingDays({
      targetUserId: userId,
      adminUserId,
      module,
      remainingDays: days,
    });
  },

  configuracoes: () => prisma.configuracaoSistema.findMany({ orderBy: { chave: "asc" } }),

  async salvarConfiguracao(chave: string, valor: any) {
    return prisma.configuracaoSistema.upsert({
      where: { chave },
      create: { chave, valor },
      update: { valor },
    });
  },

  logs: () => prisma.auditLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 1000,
    include: { user: { select: { name: true, username: true, email: true } } },
  }),
};
