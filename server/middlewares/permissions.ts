import type { RequestHandler } from "express";
import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";

const map: Record<string, string> = {
  dashboard: "dashboard", demandas: "demandas", manifestos: "romaneios", romaneios: "romaneios",
  viagens: "viagens", abastecimentos: "abastecimentos", pedagios: "viagens", alertas: "dashboard",
  manutencao: "frota", pneus: "frota", financeiro: "financeiro", "centros-custo": "financeiro",
  fechamentos: "financeiro", fiscal: "fiscal", ciots: "fiscal", cte: "fiscal",
  comercial: "comercial", bi: "bi", clientes: "cadastros", fornecedores: "cadastros",
  produtos: "cadastros", motoristas: "cadastros", chapas: "cadastros", veiculos: "cadastros",
  locais: "cadastros", empresa: "cadastros", cnpj: "cadastros", estoque: "cadastros",
  "portal-motorista": "portal_motorista",
};

export const permissionGate: RequestHandler = async (req, _res, next) => {
  try {
    // Sempre confere a conta no banco, inclusive ADMIN: desativação e mudança
    // de perfil/permissões não podem esperar o JWT expirar (8 horas).
    if (!req.user) return next(); // modo local sem autenticação obrigatória
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { active: true, role: true, permissoes: true },
    });
    if (!user || !user.active) {
      return next(new AppError(401, "Sua conta foi desativada ou não está disponível."));
    }
    // O perfil atual sempre prevalece sobre aquele gravado no token antigo.
    req.user.role = user.role;
    if (user.role === "ADMIN") return next();

    const segment = req.path.split("/").filter(Boolean)[0];
    const permission = map[segment];
    if (!permission) return next();
    const permissions = (user.permissoes && typeof user.permissoes === "object" && !Array.isArray(user.permissoes)
      ? user.permissoes : {}) as Record<string, unknown>;
    if (Object.keys(permissions).length === 0 || permissions[permission] === true) return next();
    return next(new AppError(403, "Seu perfil não possui acesso a este módulo."));
  } catch (error) {
    next(error);
  }
};
