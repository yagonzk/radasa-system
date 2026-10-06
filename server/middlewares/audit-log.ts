import type { RequestHandler } from "express";
import { prisma, trackPrismaTask } from "../lib/prisma.js";
import { logger } from "../config/logger.js";
import { requestParam } from "../utils/request-param.js";

const labels: Record<string, string> = {
  motoristas: "motorista", chapas: "chapa", clientes: "cliente", empresa: "empresa", produtos: "produto",
  locais: "local", veiculos: "veículo", viagens: "viagem", fechamentos: "holerite",
  manifestos: "romaneio", romaneios: "romaneio", abastecimentos: "abastecimento", pneus: "pneu", estoque: "movimentação de almoxarifado", usuarios: "usuário", comercial: "registro comercial", admin: "configuração administrativa", "portal-motorista": "registro do motorista",
};

const auditHiddenKeys = new Set([
  "password", "newPassword", "currentPassword", "certificadoSenha", "certificadoArquivo",
  "pdfUrl", "xmlUrl", "notaFiscalUrl", "crlvPdfUrl", "cnhPdfUrl", "toxicologicoPdfUrl",
  "base64", "dataUrl", "conteudoArquivo",
]);
const auditContentKeys = new Set(["conteudo", "arquivo", "imagem", "foto", "fotos"]);
const MAX_AUDIT_STRING = 4_000;
const MAX_AUDIT_ARRAY = 100;
const MAX_AUDIT_DEPTH = 6;

function auditMarker(value: unknown) {
  const size = typeof value === "string" ? value.length : Array.isArray(value) ? value.length : 1;
  return `[conteúdo omitido do log: ${size}]`;
}

function sanitizeAuditValue(value: unknown, depth = 0, key = ""): unknown {
  if (auditHiddenKeys.has(key) || auditContentKeys.has(key)) return auditMarker(value);
  if (value == null || typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "string") {
    return value.length > MAX_AUDIT_STRING
      ? `${value.slice(0, MAX_AUDIT_STRING)}… [${value.length - MAX_AUDIT_STRING} caracteres omitidos]`
      : value;
  }
  if (depth >= MAX_AUDIT_DEPTH) return "[estrutura profunda omitida do log]";
  if (Array.isArray(value)) {
    const items = value.slice(0, MAX_AUDIT_ARRAY).map((item) => sanitizeAuditValue(item, depth + 1));
    if (value.length > MAX_AUDIT_ARRAY) items.push(`[${value.length - MAX_AUDIT_ARRAY} itens omitidos]`);
    return items;
  }
  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([entryKey, entryValue]) => [
        entryKey,
        sanitizeAuditValue(entryValue, depth + 1, entryKey),
      ]),
    );
  }
  return String(value);
}

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
        // Auditoria registra a operação, não anexos. Remover base64/XML/PDF aqui
        // evita duplicar megabytes no banco a cada importação de romaneio/nota.
        detalhes: sanitizeAuditValue(req.body && typeof req.body === "object" ? req.body : {}) as any,
      },
    }).catch(error => logger.error({ error }, "Falha ao registrar log de auditoria"));
    trackPrismaTask(auditTask);
  });
  next();
};
