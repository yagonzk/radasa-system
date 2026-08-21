import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { fiscalController } from "../controllers/fiscal.controller.js";

export const fiscalRoutes = Router();

fiscalRoutes.get("/resumo", asyncHandler(fiscalController.resumo));
