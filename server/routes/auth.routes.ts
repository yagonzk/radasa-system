import { Router } from "express";
import { authController } from "../controllers/auth.controller.js";
import { authenticate } from "../middlewares/auth.js";
import { validate } from "../middlewares/validate.js";
import { changePasswordSchema, forgotPasswordSchema, loginSchema, registerSchema, resetPasswordSchema, updateProfileSchema } from "../validators/schemas.js";
import { asyncHandler } from "../utils/async-handler.js";
import { createRateLimiter } from "../middlewares/rate-limit.js";

export const authRoutes = Router();

const authRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas tentativas. Aguarde alguns minutos e tente novamente." },
});

const passwordResetRateLimit = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Muitas solicitações de recuperação. Aguarde alguns minutos e tente novamente." },
});

authRoutes.post("/login", authRateLimit, validate(loginSchema), asyncHandler(authController.login));
authRoutes.post("/register", authRateLimit, validate(registerSchema), asyncHandler(authController.register));
authRoutes.post("/forgot-password", passwordResetRateLimit, validate(forgotPasswordSchema), asyncHandler(authController.forgotPassword));
authRoutes.post("/reset-password", passwordResetRateLimit, validate(resetPasswordSchema), asyncHandler(authController.resetPassword));
authRoutes.get("/me", authenticate, asyncHandler(authController.me));
authRoutes.put("/profile", authenticate, validate(updateProfileSchema), asyncHandler(authController.updateProfile));
authRoutes.put("/change-password", authenticate, validate(changePasswordSchema), asyncHandler(authController.changePassword));
