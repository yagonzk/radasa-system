import type { Request, Response } from "express";
import { estoqueService } from "../services/estoque.service.js";
import { requestParam } from "../utils/request-param.js";

export const estoqueController = {
  listSubcategorias: async (_req: Request, res: Response) => res.json(await estoqueService.listSubcategorias()),
  createSubcategoria: async (req: Request, res: Response) => res.status(201).json(await estoqueService.createSubcategoria(req.body)),
  removeSubcategoria: async (req: Request, res: Response) => { await estoqueService.removeSubcategoria(requestParam(req.params.id)); res.status(204).send(); },
  listTiposProduto: async (_req: Request, res: Response) => res.json(await estoqueService.listTiposProduto()),
  createTipoProduto: async (req: Request, res: Response) => res.status(201).json(await estoqueService.createTipoProduto(req.body)),
  removeTipoProduto: async (req: Request, res: Response) => {
    await estoqueService.removeTipoProduto(requestParam(req.params.id));
    res.status(204).send();
  },
  listProdutos: async (_req: Request, res: Response) => res.json(await estoqueService.listProdutos()),
  createProduto: async (req: Request, res: Response) => res.status(201).json(await estoqueService.createProduto(req.body)),
  updateProduto: async (req: Request, res: Response) => res.json(await estoqueService.updateProduto(requestParam(req.params.id), req.body)),
  removeProduto: async (req: Request, res: Response) => {
    await estoqueService.removeProduto(requestParam(req.params.id));
    res.status(204).send();
  },
  list: async (_req: Request, res: Response) => res.json(await estoqueService.list()),
  resumo: async (_req: Request, res: Response) => res.json(await estoqueService.resumo()),
  create: async (req: Request, res: Response) => res.status(201).json(await estoqueService.create(req.body)),
  remove: async (req: Request, res: Response) => {
    await estoqueService.remove(requestParam(req.params.id));
    res.status(204).send();
  },
};
