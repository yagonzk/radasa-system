import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { hashPassword } from "./password-hash.service.js";
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

function cleanText(value: unknown) {
  return String(value ?? "").trim();
}

function normalizeEmail(value: unknown) {
  return cleanText(value).toLowerCase();
}

function normalizeUsername(value: unknown) {
  return cleanText(value).toLowerCase();
}

function normalizeCpf(value: unknown) {
  const raw = cleanText(value);
  if (!raw) return null;
  return raw.replace(/\D/g, "");
}

async function ensureUniqueAccountFields(id: string, username: string, email: string, cpf: string | null) {
  const conflict = await prisma.user.findFirst({
    where: {
      id: { not: id },
      OR: [
        { username },
        { email },
        ...(cpf ? [{ cpf }] : []),
      ],
    },
    select: { id: true, username: true, email: true, cpf: true },
  });

  if (!conflict) return;
  if (conflict.username === username) throw new AppError(409, "Este username já está sendo usado por outra conta.");
  if (conflict.email === email) throw new AppError(409, "Este e-mail já está sendo usado por outra conta.");
  if (cpf && conflict.cpf === cpf) throw new AppError(409, "Este CPF já está sendo usado por outra conta.");
  throw new AppError(409, "Já existe outra conta com esses dados.");
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

  async usuarios(filters: { q?: string; role?: string; active?: string } = {}) {
    const q = cleanText(filters.q);
    const role = cleanText(filters.role).toUpperCase();
    const active = cleanText(filters.active).toLowerCase();

    const users = await prisma.user.findMany({
      where: {
        ...(q ? {
          OR: [
            { name: { contains: q, mode: "insensitive" } },
            { username: { contains: q, mode: "insensitive" } },
            { email: { contains: q, mode: "insensitive" } },
          ],
        } : {}),
        ...(role ? { role: role as any } : {}),
        ...(active === "true" ? { active: true } : active === "false" ? { active: false } : {}),
      },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        telefone: true,
        cpf: true,
        role: true,
        active: true,
        motoristaId: true,
        permissoes: true,
        createdAt: true,
        updatedAt: true,
        moduleLicenses: true,
        auditLogs: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
    });

    return users.map((user) => {
      const { auditLogs, ...rest } = user;
      return {
        ...withLicenseSummaries(rest),
        lastActivityAt: auditLogs[0]?.createdAt ?? null,
      };
    });
  },

  async usuario(id: string) {
    const auditWhere = { OR: [{ userId: id }, { entityId: id }] };
    const [user, auditLogs, auditCount, ownLastActivity] = await Promise.all([
      prisma.user.findUnique({
        where: { id },
        select: {
          id: true,
          name: true,
          username: true,
          email: true,
          telefone: true,
          cpf: true,
          fotoPerfil: true,
          role: true,
          active: true,
          motoristaId: true,
          permissoes: true,
          createdAt: true,
          updatedAt: true,
          moduleLicenses: true,
        },
      }),
      prisma.auditLog.findMany({
        where: auditWhere,
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          action: true,
          method: true,
          path: true,
          entityId: true,
          detalhes: true,
          createdAt: true,
          user: { select: { id: true, name: true, username: true, email: true } },
        },
      }),
      prisma.auditLog.count({ where: auditWhere }),
      prisma.auditLog.findFirst({
        where: { userId: id },
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    if (!user) throw new AppError(404, "Usuário não encontrado.");
    return {
      ...withLicenseSummaries(user),
      auditLogs,
      auditCount,
      lastActivityAt: ownLastActivity?.createdAt ?? null,
    };
  },

  async atualizarConta(id: string, input: any) {
    const current = await prisma.user.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Usuário não encontrado.");

    const name = cleanText(input.name ?? current.name);
    const username = normalizeUsername(input.username ?? current.username);
    const email = normalizeEmail(input.email ?? current.email);
    const telefone = cleanText(input.telefone ?? current.telefone);
    const cpf = input.cpf === undefined ? current.cpf : normalizeCpf(input.cpf);
    const newPassword = cleanText(input.password);

    if (name.length < 2) throw new AppError(400, "Informe o nome da conta.");
    if (username.length < 3) throw new AppError(400, "O username precisa ter pelo menos 3 caracteres.");
    if (!/^\S+@\S+\.\S+$/.test(email)) throw new AppError(400, "Informe um e-mail válido.");
    if (cpf && cpf.length !== 11) throw new AppError(400, "Informe um CPF válido com 11 dígitos ou deixe o campo vazio.");
    if (newPassword && newPassword.length < 8) throw new AppError(400, "A nova senha precisa ter pelo menos 8 caracteres.");

    await ensureUniqueAccountFields(id, username, email, cpf);
    const passwordHash = newPassword ? await hashPassword(newPassword) : undefined;

    return prisma.user.update({
      where: { id },
      data: {
        name,
        username,
        email,
        telefone,
        cpf,
        ...(passwordHash ? { passwordHash } : {}),
      },
      select: {
        id: true,
        name: true,
        username: true,
        email: true,
        telefone: true,
        cpf: true,
        fotoPerfil: true,
        role: true,
        active: true,
        motoristaId: true,
        permissoes: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  },

  async atualizarAcesso(id: string, input: any, adminUserId?: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new AppError(404, "Usuário não encontrado.");

    const allowedRoles = new Set(["ADMIN", "GERENTE", "BORRACHARIA", "MANUTENCAO", "VISUALIZACAO", "USER"]);
    if (input.role !== undefined && !allowedRoles.has(String(input.role))) {
      throw new AppError(400, "Perfil de usuário inválido.");
    }

    if (id === adminUserId) {
      if (input.role && input.role !== "ADMIN") {
        throw new AppError(400, "Você não pode remover o seu próprio perfil de administrador.");
      }
      if (input.active === false) {
        throw new AppError(400, "Você não pode desativar a sua própria conta administrativa.");
      }
    }

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
        telefone: true,
        cpf: true,
        role: true,
        active: true,
        motoristaId: true,
        permissoes: true,
        updatedAt: true,
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
    include: { user: { select: { id: true, name: true, username: true, email: true } } },
  }),
};
