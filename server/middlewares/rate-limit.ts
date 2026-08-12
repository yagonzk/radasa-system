import rateLimit, { ipKeyGenerator, type Options } from "express-rate-limit";
import type { Request, RequestHandler } from "express";

function firstHeaderValue(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0]?.trim() ?? "";
  return String(value ?? "").split(",")[0]?.trim() ?? "";
}

function clientKey(req: Request): string {
  // Cloudflare define este header com o IP original do visitante.
  const cloudflareIp = firstHeaderValue(req.headers["cf-connecting-ip"]);
  if (cloudflareIp) return ipKeyGenerator(cloudflareIp);

  // Fallback útil em proxies locais/ambientes que não sejam Cloudflare.
  const forwardedIp = firstHeaderValue(req.headers["x-forwarded-for"]);
  if (forwardedIp) return ipKeyGenerator(forwardedIp);

  if (req.ip) return ipKeyGenerator(req.ip);

  // Não deixa a aplicação quebrar caso o bridge não forneça IP.
  return "unknown-client";
}

export function createRateLimiter(options: Partial<Options>): RequestHandler {
  return rateLimit({
    ...options,
    keyGenerator: (req) => clientKey(req),
  });
}
