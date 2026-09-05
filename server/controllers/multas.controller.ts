import type { Request, Response } from "express";
import { multasService } from "../services/multas.service.js";
import { requestParam } from "../utils/request-param.js";

export const multasController = {
  list: async (_req: Request, res: Response) => res.json(await multasService.list()),
  create: async (req: Request, res: Response) => res.status(201).json(await multasService.create(req.body)),
  update: async (req: Request, res: Response) => res.json(await multasService.update(requestParam(req.params.id), req.body)),
  remove: async (req: Request, res: Response) => { await multasService.remove(requestParam(req.params.id)); res.status(204).send(); },
  getDocumento: async (req: Request, res: Response) => res.json(await multasService.getDocumento(requestParam(req.params.id))),
  consultarVeiculo: async (req: Request, res: Response) => res.json(await multasService.consultarVeiculo(requestParam(req.params.id))),
};
