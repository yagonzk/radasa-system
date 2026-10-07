import type { Request, Response } from "express";
import { agroEstoqueService } from "../services/agro-estoque.service.js";
import { requestParam } from "../utils/request-param.js";

export const agroController = {
  status: async (_req: Request, res: Response) => res.json({ module: "AGRO", available: true }),
  dashboard: async (_req: Request, res: Response) => res.json(await agroEstoqueService.dashboard()),
  estoque: async (_req: Request, res: Response) => res.json(await agroEstoqueService.listEstoque()),

  produtos: async (_req: Request, res: Response) => res.json(await agroEstoqueService.listProdutos()),
  criarProduto: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createProduto(req.body)),
  atualizarProduto: async (req: Request, res: Response) => res.json(await agroEstoqueService.updateProduto(requestParam(req.params.id), req.body)),
  removerProduto: async (req: Request, res: Response) => res.json(await agroEstoqueService.removeProduto(requestParam(req.params.id))),

  lotes: async (req: Request, res: Response) => res.json(await agroEstoqueService.listLotes(String(req.query.produtoId ?? ""))),
  criarLote: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createLote(req.body)),
  atualizarLote: async (req: Request, res: Response) => res.json(await agroEstoqueService.updateLote(requestParam(req.params.id), req.body)),
  removerLote: async (req: Request, res: Response) => res.json(await agroEstoqueService.removeLote(requestParam(req.params.id))),

  movimentacoes: async (req: Request, res: Response) => res.json(await agroEstoqueService.listMovimentacoes(req.query)),
  criarMovimentacao: async (req: Request, res: Response) => res.status(201).json(await agroEstoqueService.createMovimentacao(req.body, req.user?.id)),
};
