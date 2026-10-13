import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import { isIP } from "node:net";
import type { Request, RequestHandler } from "express";

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return String(value ?? "").split(",")[0]?.trim() ?? "";
}

function clientKey(req: Request): string {
  // Cloudflare define este header com o IP original do visitante.
  const cloudflareIp = firstHeaderValue(req.headers["cf-connecting-ip"]);
  if (isIP(cloudflareIp)) return ipKeyGenerator(cloudflareIp);

  // Express usa trust proxy configurado; jamais confiar diretamente em
  // X-Forwarded-For enviado livremente pelo cliente.
  if (req.ip && isIP(req.ip)) return ipKeyGenerator(req.ip);

  // Não deixa a aplicação quebrar caso o bridge não forneça IP.
  return "unknown-client";
}

export function createRateLimiter(options: Partial<Options>): RequestHandler {
  return rateLimit({
    ...options,
    keyGenerator: (req) => clientKey(req),
  });
}
