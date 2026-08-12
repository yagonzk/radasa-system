import type { ErrorRequestHandler } from "express";
import { ZodError } from "zod";
import { logger } from "../config/logger.js";
import { AppError } from "../utils/app-error.js";

function serializeError(error: unknown) {
  if (error instanceof Error) {
    const anyError = error as Error & { code?: unknown; cause?: unknown };
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: anyError.code,
      cause: anyError.cause,
    };
  }

  if (typeof error === "object" && error !== null) {
    const value = error as Record<string, unknown>;
    return {
      name: String(value.name ?? ""),
      message: String(value.message ?? error),
      code: value.code,
      cause: value.cause,
    };
  }

  return { message: String(error) };
}

export const errorHandler: ErrorRequestHandler = (error, req, res, _next) => {
  if (error instanceof ZodError) {
    return res.status(400).json({ message: "Dados inválidos", issues: error.issues });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({ message: error.message, details: error.details });
  }

  const prismaCode =
    typeof error === "object" && error !== null
      ? (error as { code?: unknown }).code
      : undefined;

  if (prismaCode === "P2002") return res.status(409).json({ message: "Registro duplicado." });
  if (prismaCode === "P2003") return res.status(409).json({ message: "Registro vinculado a outros dados." });
  if (prismaCode === "P2025") return res.status(404).json({ message: "Registro não encontrado." });
  if (prismaCode === "P2034") return res.status(409).json({ message: "Conflito de gravação. Tente novamente." });

  const errorName =
    typeof error === "object" && error !== null
      ? String((error as { name?: unknown }).name ?? error.constructor?.name ?? "")
      : "";

  if (errorName === "PrismaClientInitializationError") {
    logger.error(
      { error: serializeError(error), method: req.method, url: req.originalUrl },
      "Banco temporariamente indisponível",
    );
    return res.status(503).json({
      message: "Banco de dados temporariamente indisponível. Tente novamente em instantes.",
    });
  }

  logger.error(
    { error: serializeError(error), method: req.method, url: req.originalUrl },
    "Erro não tratado",
  );
  return res.status(500).json({ message: "Erro interno do servidor." });
};
