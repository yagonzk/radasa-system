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
  async resumo() {
    const now = new Date();
    const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [
      usuariosTotal, usuariosAtivos, usuariosPendentes, administradores,
      transportesLicencasAtivas, agroLicencasAtivas, logs24h, logs7d,
      motoristas, clientes, fornecedores, produtos, veiculos, empresas,
      romaneios, viagens, lancamentosFinanceiros,
      agroProdutos, agroFazendas, agroTalhoes, agroLavouras, agroBarracoes, agroInventariosAbertos,
      recentLogs,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({ where: { active: true } }),
      prisma.user.count({ where: { active: false } }),
      prisma.user.count({ where: { role: "ADMIN" } }),
      prisma.moduleLicense.count({ where: { module: "TRANSPORTES", active: true, user: { role: { not: "ADMIN" } }, OR: [{ unlimited: true }, { expiresAt: { gt: now } }] } }),
      prisma.moduleLicense.count({ where: { module: "AGRO", active: true, user: { role: { not: "ADMIN" } }, OR: [{ unlimited: true }, { expiresAt: { gt: now } }] } }),
      prisma.auditLog.count({ where: { createdAt: { gte: dayAgo } } }),
      prisma.auditLog.count({ where: { createdAt: { gte: weekAgo } } }),
      prisma.motorista.count(),
      prisma.cliente.count(),
      prisma.fornecedor.count(),
      prisma.produto.count(),
      prisma.veiculo.count(),
      prisma.empresa.count(),
      prisma.manifesto.count(),
      prisma.viagem.count(),
      prisma.lancamentoFinanceiro.count(),
      prisma.agroProduto.count(),
      prisma.agroFazenda.count(),
      prisma.agroTalhao.count(),
      prisma.agroLavoura.count(),
      prisma.agroEstoqueLocal.count(),
      prisma.agroInventario.count({ where: { status: "ABERTO" } }),
      prisma.auditLog.findMany({
        orderBy: { createdAt: "desc" },
        take: 8,
        select: {
          id: true,
          action: true,
          method: true,
          path: true,
          createdAt: true,
          user: { select: { name: true, username: true } },
        },
      }),
    ]);

    return {
      usuarios: { total: usuariosTotal, ativos: usuariosAtivos, pendentes: usuariosPendentes, administradores },
      licencas: { transportesAtivas: transportesLicencasAtivas + administradores, agroAtivas: agroLicencasAtivas + administradores },
      auditoria: { ultimas24h: logs24h, ultimos7dias: logs7d, recentes: recentLogs },
      cadastros: {
        transportes: { motoristas, clientes, fornecedores, produtos, veiculos, empresas },
        agro: { produtos: agroProdutos, fazendas: agroFazendas, talhoes: agroTalhoes, lavouras: agroLavouras, barracoes: agroBarracoes },
      },
      operacao: { romaneios, viagens, lancamentosFinanceiros, inventariosAgroAbertos: agroInventariosAbertos },
      generatedAt: now.toISOString(),
    };
  },
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
