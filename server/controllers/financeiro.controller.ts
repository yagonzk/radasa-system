import type { Request, Response } from "express";
import { crudController } from "./crud.controller.js";
import { financeiroService } from "../services/financeiro.service.js";
import { dreOperacionalService } from "../services/dre-operacional.service.js";

const base = crudController(financeiroService);
const queryDate = (value: unknown) => typeof value === "string" ? value : undefined;

export const financeiroController = {
  ...base,
  resumo: async (req: Request, res: Response) => res.json(await financeiroService.resumo(queryDate(req.query.from), queryDate(req.query.to))),
  analise: async (req: Request, res: Response) => res.json(await financeiroService.analise(queryDate(req.query.from), queryDate(req.query.to))),
  analiseOperacional: async (req: Request, res: Response) => res.json(await financeiroService.analiseOperacional(queryDate(req.query.from), queryDate(req.query.to))),
  baixas: async (req: Request, res: Response) => res.json(await financeiroService.baixas(typeof req.query.lancamentoId === "string" ? req.query.lancamentoId : undefined)),
  adicionarBaixa: async (req: Request, res: Response) => res.json(await financeiroService.adicionarBaixa(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id, req.body)),
  removerBaixa: async (req: Request, res: Response) => {
    await financeiroService.removerBaixa(Array.isArray(req.params.id) ? req.params.id[0] : req.params.id);
    res.status(204).send();
  },
  removeAll: async (_req: Request, res: Response) => res.json(await financeiroService.removeAll()),
  fluxo: async (_req: Request, res: Response) => res.json(await financeiroService.fluxoCaixa()),
  dreOperacionalV2: async (req: Request, res: Response) => res.json(await dreOperacionalService.dashboard(req.query as any)),
  dreOperacionalDetalhes: async (req: Request, res: Response) => res.json(await dreOperacionalService.detalhes(req.query as any)),
};
