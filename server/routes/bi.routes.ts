import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { biNfeService } from "../services/bi-nfe.service.js";

export const biRoutes = Router();

biRoutes.get("/nfes/itens", asyncHandler(async (_req, res) => {
  res.json(await biNfeService.itens());
}));

biRoutes.post("/nfes/importar-xml", asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  res.json(await biNfeService.importarXml(items));
}));
