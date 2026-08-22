import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { fiscalController } from "../controllers/fiscal.controller.js";

export const fiscalRoutes = Router();

fiscalRoutes.get("/resumo", asyncHandler(fiscalController.resumo));
fiscalRoutes.get("/rentabilidade", asyncHandler(fiscalController.rentabilidade));

fiscalRoutes.get("/precos-produtos", asyncHandler(fiscalController.listPrecosProdutos));
fiscalRoutes.post("/precos-produtos", asyncHandler(fiscalController.createPrecoProduto));
fiscalRoutes.put("/precos-produtos/:id", asyncHandler(fiscalController.updatePrecoProduto));
fiscalRoutes.delete("/precos-produtos/:id", asyncHandler(fiscalController.removePrecoProduto));
