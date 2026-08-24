import type { Request, Response } from "express";
import { crudController } from "./crud.controller.js";
import { viagensService } from "../services/viagens.service.js";

const base = crudController(viagensService);

export const viagensController = {
  ...base,
  rentabilidade: async (req: Request, res: Response) => {
    const rawId = req.params.id;
    const id = String(Array.isArray(rawId) ? rawId[0] ?? "" : rawId ?? "");
    res.json(await viagensService.rentabilidade(id));
  },
};
