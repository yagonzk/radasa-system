import { randomUUID } from "node:crypto";
import { logger } from "../config/logger.js";
import type { RequestHandler } from "express";

function safeId(value: unknown) {
  const raw = String(value ?? "").trim();
  return /^[A-Za-z0-9._:-]{8,96}$/.test(raw) ? raw : "";
}

export const requestLogger: RequestHandler = (req, res, next) => {
  const startedAt = Date.now();
  const requestId = safeId(req.headers["x-request-id"]) || randomUUID();
  const mutationId = safeId(req.headers["x-mutation-id"]);
  res.locals.requestId = requestId;
  res.locals.mutationId = mutationId || undefined;
  res.setHeader("X-Request-Id", requestId);

  let logged = false;
  const writeLog = (aborted: boolean) => {
    if (logged) return;
    logged = true;
    logger.info({
      requestId,
      mutationId: mutationId || undefined,
      method: req.method,
      path: req.originalUrl,
      statusCode: res.statusCode,
      durationMs: Date.now() - startedAt,
      aborted,
    }, aborted ? "Requisição encerrada antes da resposta" : "Requisição concluída");
  };
  res.once("finish", () => writeLog(false));
  res.once("close", () => writeLog(!res.writableEnded));
  next();
};
