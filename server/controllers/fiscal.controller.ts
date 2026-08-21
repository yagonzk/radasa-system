import type { Request, Response } from "express";
import { fiscalService } from "../services/fiscal.service.js";

export const fiscalController = {
  async resumo(req: Request, res: Response) {
    const from = typeof req.query.from === "string" && req.query.from.trim() ? req.query.from.trim() : undefined;
    const to = typeof req.query.to === "string" && req.query.to.trim() ? req.query.to.trim() : undefined;
    res.json(await fiscalService.resumo({ from, to }));
  },
};
