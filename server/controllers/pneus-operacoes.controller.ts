import type { Request, Response } from "express";
import { pneusOperacoesService } from "../services/pneus-operacoes.service.js";
import { requestParam } from "../utils/request-param.js";

export const pneusOperacoesController = {
  async listInstallations(_req: Request, res: Response) { res.json(await pneusOperacoesService.listInstallations()); },
  async install(req: Request, res: Response) { res.status(201).json(await pneusOperacoesService.install(requestParam(req.params.id), req.body)); },
  async retire(req: Request, res: Response) { res.json(await pneusOperacoesService.retire(requestParam(req.params.id), req.body)); },
  async listRotations(_req: Request, res: Response) { res.json(await pneusOperacoesService.listRotations()); },
  async rotate(req: Request, res: Response) { res.status(201).json(await pneusOperacoesService.rotate(req.body)); },
  async undoRotation(req: Request, res: Response) { res.json(await pneusOperacoesService.undoRotation(requestParam(req.params.id))); },
};
