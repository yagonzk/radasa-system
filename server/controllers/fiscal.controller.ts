import type { Request, Response } from "express";
import { fiscalService } from "../services/fiscal.service.js";

function periodFromRequest(req: Request) {
  return {
    from: typeof req.query.from === "string" && req.query.from.trim()
      ? req.query.from.trim()
      : undefined,
    to: typeof req.query.to === "string" && req.query.to.trim()
      ? req.query.to.trim()
      : undefined,
  };
}

export const fiscalController = {
  async resumo(req: Request, res: Response) {
    res.json(await fiscalService.resumo(periodFromRequest(req)));
  },

  async rentabilidade(req: Request, res: Response) {
    res.json(await fiscalService.rentabilidade(periodFromRequest(req)));
  },

  async listPrecosProdutos(_req: Request, res: Response) {
    res.json(await fiscalService.listPrecosProdutos());
  },

  async createPrecoProduto(req: Request, res: Response) {
    res.status(201).json(await fiscalService.createPrecoProduto(req.body));
  },

  async updatePrecoProduto(req: Request, res: Response) {
    res.json(await fiscalService.updatePrecoProduto(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, req.body));
  },

  async removePrecoProduto(req: Request, res: Response) {
    res.json(await fiscalService.removePrecoProduto(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id));
  },
};
