import { Router } from "express";
import { sefazDfeController } from "../controllers/sefaz-dfe.controller.js";
import { asyncHandler } from "../utils/async-handler.js";
export const sefazDfeRoutes = Router();
sefazDfeRoutes.get("/status", asyncHandler(sefazDfeController.status));
sefazDfeRoutes.get("/documentos", asyncHandler(sefazDfeController.list));
sefazDfeRoutes.get("/documentos/:id/xml", asyncHandler(sefazDfeController.xml));
sefazDfeRoutes.post("/documentos/pendentes/importar-local", asyncHandler(sefazDfeController.importPendingLocal));
sefazDfeRoutes.post("/sincronizar", asyncHandler(sefazDfeController.sync));
