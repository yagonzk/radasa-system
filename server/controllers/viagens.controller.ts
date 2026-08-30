import type { Request, Response } from "express";
import { crudController } from "./crud.controller.js";
import { viagensService } from "../services/viagens.service.js";

const base = crudController(viagensService);

export const viagensController = {
  ...base,

  importarCustosPorData: async (req: Request, res: Response) => {
    res.json(await viagensService.importarCustosPorData(Array.isArray(req.body?.rows) ? req.body.rows : []));
  },
  previewExtratoTruckPag: async (req: Request, res: Response) => {
    res.json(await viagensService.previewExtratoTruckPag(Array.isArray(req.body?.arquivos) ? req.body.arquivos : []));
  },
  importarExtratoTruckPag: async (req: Request, res: Response) => {
    res.json(await viagensService.importarExtratoTruckPag(Array.isArray(req.body?.items) ? req.body.items : []));
  },
  despesasExtrato: async (req: Request, res: Response) => {
    const rawId = req.params.id; const id = String(Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "");
    res.json(await viagensService.despesasExtrato(id));
  },
  rentabilidade: async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const id = String(Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "");
    res.json(await viagensService.rentabilidade(id));
  },
};
