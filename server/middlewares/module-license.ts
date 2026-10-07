import type { RequestHandler } from "express";
import { AppError } from "../utils/app-error.js";
import {
  assertUserModuleAccess,
  type LicenseModule,
} from "../services/module-license.service.js";

export function requireModuleLicense(module: LicenseModule): RequestHandler {
  return async (req, _res, next) => {
    try {
      // Quando AUTH_REQUIRED está desligado em desenvolvimento, authenticateIfRequired
      // pode deixar a request sem usuário. Em produção, a autenticação já terá barrado antes.
      if (!req.user) return next();
      await assertUserModuleAccess(req.user.id, req.user.role, module);
      next();
    } catch (error) {
      next(error);
    }
  };
}
