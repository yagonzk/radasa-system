import type { Request, Response } from "express";
import { crudController } from "./crud.controller.js";
import { usuariosService } from "../services/usuarios.service.js";
import { requestParam } from "../utils/request-param.js";

const baseController = crudController(usuariosService);

export const usuariosController = {
  ...baseController,
  pending: async (_req: Request, res: Response) =>
    res.json(await usuariosService.pending()),
  approve: async (req: Request, res: Response) =>
    res.json(await usuariosService.approve(requestParam(req.params.id))),
  reject: async (req: Request, res: Response) =>
    res.json(await usuariosService.reject(requestParam(req.params.id))),
};
