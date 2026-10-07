import type { Request, Response } from "express";
import { adminService as service } from "../services/admin.service.js";

function requestId(req: Request) {
  return Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
}

function requestModule(req: Request) {
  return Array.isArray(req.params.module) ? req.params.module[0] : req.params.module;
}

function queryValue(value: unknown) {
  return Array.isArray(value) ? String(value[0] ?? "") : String(value ?? "");
}

export const adminController = {
  resumo: async (_req: Request, res: Response) => res.json(await service.resumo()),

  usuarios: async (req: Request, res: Response) => res.json(await service.usuarios({
    q: queryValue(req.query.q),
    role: queryValue(req.query.role),
    active: queryValue(req.query.active),
  })),

  usuario: async (req: Request, res: Response) =>
    res.json(await service.usuario(requestId(req))),

  conta: async (req: Request, res: Response) =>
    res.json(await service.atualizarConta(requestId(req), req.body)),

  acesso: async (req: Request, res: Response) =>
    res.json(await service.atualizarAcesso(requestId(req), req.body, req.user!.id)),

  atualizarDiasLicenca: async (req: Request, res: Response) =>
    res.json(await service.atualizarDiasLicenca(
      requestId(req),
      requestModule(req),
      req.body?.remainingDays,
      req.user!.id,
    )),

  configuracoes: async (_req: Request, res: Response) => res.json(await service.configuracoes()),

  salvarConfiguracao: async (req: Request, res: Response) =>
    res.json(await service.salvarConfiguracao(String(req.body.chave || ""), req.body.valor)),

  logs: async (_req: Request, res: Response) => res.json(await service.logs()),
};
