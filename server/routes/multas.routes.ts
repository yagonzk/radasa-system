import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middlewares/validate.js";
import { bodySchema, idParamsSchema, multaBody } from "../validators/schemas.js";
import { multasController } from "../controllers/multas.controller.js";

export const multasRoutes = Router();

multasRoutes.get("/", asyncHandler(multasController.list));
multasRoutes.get("/:id/consultar", validate(idParamsSchema), asyncHandler(multasController.consultarVeiculo));
multasRoutes.get("/:id/documento", validate(idParamsSchema), asyncHandler(multasController.getDocumento));
multasRoutes.post("/", validate(bodySchema(multaBody)), asyncHandler(multasController.create));
multasRoutes.put("/:id", validate(idParamsSchema), validate(bodySchema(multaBody)), asyncHandler(multasController.update));
multasRoutes.delete("/:id", validate(idParamsSchema), asyncHandler(multasController.remove));
