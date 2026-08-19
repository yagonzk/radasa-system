import { Router } from "express";
import { UserRole } from "@prisma/client";
import { authenticate, requireRole } from "../middlewares/auth.js";
import { asyncHandler } from "../utils/async-handler.js";
import { logsController } from "../controllers/logs.controller.js";

export const logsRoutes = Router();

// Logs contêm histórico de ações de todos os usuários e, por isso,
// ficam restritos exclusivamente à administração.
logsRoutes.use(authenticate, requireRole(UserRole.ADMIN));
logsRoutes.get("/", asyncHandler(logsController.list));
