import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticate, requireRole } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { adminController as controller } from "../controllers/admin.controller.js";

export const adminRoutes = Router();

adminRoutes.use(authenticate, requireRole(UserRole.ADMIN));
adminRoutes.get("/resumo", asyncHandler(controller.resumo));
adminRoutes.get("/usuarios", asyncHandler(controller.usuarios));
adminRoutes.get("/usuarios/:id", asyncHandler(controller.usuario));
adminRoutes.put("/usuarios/:id/conta", asyncHandler(controller.conta));
adminRoutes.put("/usuarios/:id/acesso", asyncHandler(controller.acesso));
adminRoutes.put("/usuarios/:id/licencas/:module/dias", asyncHandler(controller.atualizarDiasLicenca));
adminRoutes.get("/configuracoes", asyncHandler(controller.configuracoes));
adminRoutes.put("/configuracoes", asyncHandler(controller.salvarConfiguracao));
adminRoutes.get("/logs", asyncHandler(controller.logs));
