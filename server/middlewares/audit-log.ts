import type { RequestHandler } from "express";
import { prisma, trackPrismaTask } from "../lib/prisma.js";
import { logger } from "../config/logger.js";
import { requestParam } from "../utils/request-param.js";

const labels: Record<string, string> = {
  motoristas: "motorista", chapas: "chapa", clientes: "cliente", empresa: "empresa", produtos: "produto",
  locais: "local", veiculos: "veículo", multas: "multa", viagens: "viagem", fechamentos: "comissão",
  manifestos: "romaneio", romaneios: "romaneio", abastecimentos: "abastecimento", pneus: "pneu", estoque: "movimentação de almoxarifado", usuarios: "usuário", comercial: "registro comercial", admin: "configuração administrativa", "portal-motorista": "registro do motorista",
};

function describe(method: string, path: string, body?: unknown) {
  if (path.includes("/auth/change-password")) return "Alterou a própria senha";
  if (path.includes("/estoque/produtos")) {
    if (method === "POST") return "Cadastrou produto do almoxarifado";
    if (method === "PUT" || method === "PATCH") return "Editou produto do almoxarifado";
    if (method === "DELETE") return "Excluiu produto do almoxarifado";
  }
  const cleanPath = path.split("?")[0];
  if (
    cleanPath.includes("/motoristas/") &&
    (method === "PUT" || method === "PATCH") &&
    body &&
    typeof body === "object" &&
    "status" in body
  ) {
    return (body as { status?: string }).status === "DEMITIDO"
      ? "Demitiu motorista"
      : "Reativou motorista";
  }
  const segment = cleanPath.split("/").filter(Boolean).pop() || "registro";
  const parts = path.split("?")[0].split("/").filter(Boolean);
  const resource = parts.find(part => labels[part]);
  const label = resource ? labels[resource] : segment;
  if (method === "POST") return `Cadastrou ${label}`;
  if (method === "PUT" || method === "PATCH") return `Editou ${label}`;
  if (method === "DELETE") return `Excluiu ${label}`;
  return `${method} ${label}`;
}

export const auditMutations: RequestHandler = (req, res, next) => {
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(req.method)) return next();
  res.on("finish", () => {
    if (!req.user || res.statusCode >= 400 || req.path.includes("/auth/login") || req.path.includes("/auth/register")) return;
    const auditTask = prisma.auditLog.create({
      data: {
        userId: req.user.id, action: describe(req.method, req.originalUrl, req.body), method: req.method,
        path: req.originalUrl, entityId: requestParam(req.params.id) || null,
        detalhes: (() => { const body = req.body && typeof req.body === "object" ? { ...req.body } : {}; for (const key of ["password","newPassword","currentPassword","certificadoSenha"]) delete (body as any)[key]; return body as any; })(),
      },
    }).catch(error => logger.error({ error }, "Falha ao registrar log de auditoria"));
    trackPrismaTask(auditTask);
  });
  next();
};
