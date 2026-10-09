import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { biNfeService } from "../services/bi-nfe.service.js";

export const biRoutes = Router();

biRoutes.get("/nfes/itens", asyncHandler(async (_req, res) => {
  res.json(await biNfeService.itens());
}));

// Consulta restrita às NF-es anexadas aos romaneios exibidos no BI.
biRoutes.post("/nfes/itens-romaneios", asyncHandler(async (req, res) => {
  const ids = req.body?.manifestoIds;
  if (!Array.isArray(ids) || ids.length > 5000 || ids.some((id: unknown) => typeof id !== "string" || id.length > 100)) {
    res.status(400).json({ message: "Lista de romaneios inválida." });
    return;
  }
  res.json(ids.length ? await biNfeService.itens([...new Set(ids)]) : []);
}));

biRoutes.post("/nfes/importar-xml", asyncHandler(async (req, res) => {
  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  res.json(await biNfeService.importarXml(items));
}));
