import type { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env.js";
import { AppError } from "../utils/app-error.js";
import { prisma } from "../lib/prisma.js";

function readToken(header?: string): string | undefined {
  if (!header?.startsWith("Bearer ")) return undefined;
  return header.slice(7).trim();
}

export const authenticate: RequestHandler = (req, _res, next) => {
  const token = readToken(req.headers.authorization);
  if (!token) return next(new AppError(401, "Autenticação obrigatória."));

  try {
    const payload = jwt.verify(token, env.JWT_SECRET, { algorithms: ["HS256"] });
    if (typeof payload === "string" ||
        typeof payload.sub !== "string" || !payload.sub ||
        typeof payload.email !== "string" || !payload.email ||
        !["ADMIN", "GERENTE", "BORRACHARIA", "MANUTENCAO", "VISUALIZACAO", "USER"].includes(String(payload.role))) {
      throw new Error("Payload de autenticação inválido.");
    }
    req.user = { id: payload.sub, email: payload.email, role: payload.role as UserRole };
    next();
  } catch {
    next(new AppError(401, "Token inválido ou expirado."));
  }
};

export const authenticateIfRequired: RequestHandler = (req, res, next) => {
  const token = readToken(req.headers.authorization);
  if (token) return authenticate(req, res, next);
  if (!env.AUTH_REQUIRED) return next();
  return next(new AppError(401, "Autenticação obrigatória."));
};

export function requireRole(...roles: UserRole[]): RequestHandler {
  return async (req, _res, next) => {
    try {
      if (!req.user) return next(new AppError(401, "Autenticação obrigatória."));
      const user = await prisma.user.findUnique({
        where: { id: req.user.id }, select: { active: true, role: true },
      });
      if (!user || !user.active) return next(new AppError(401, "Conta desativada ou não encontrada."));
      req.user.role = user.role;
      if (!roles.includes(user.role)) return next(new AppError(403, "Permissão insuficiente."));
      next();
    } catch (error) {
      next(error);
    }
  };
}
