import cors, { type CorsOptions } from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { apiRoutes } from "./routes/index.js";
import { requestLogger } from "./middlewares/request-logger.js";
import { sanitizeInputs } from "./middlewares/sanitize.js";
import { notFound } from "./middlewares/not-found.js";
import { errorHandler } from "./middlewares/error-handler.js";
import { createRateLimiter } from "./middlewares/rate-limit.js";
import { prismaRequestContext } from "./lib/prisma.js";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestLogger);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));

  const allowedOrigins = new Set(
    env.CLIENT_ORIGIN.split(",").map((value) => value.trim()).filter(Boolean),
  );

  // Hosts adicionais podem ser configurados em CLIENT_ORIGIN.
  // Em produção na Cloudflare, requests same-origin são aceitos automaticamente abaixo.

  const baseCorsOptions: CorsOptions = {
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  };

  // A API e o frontend usam o mesmo domínio (/api). Em produção,
  // porém, o navegador pode chegar pela URL principal, por um alias de deploy
  // ou pelo domínio customizado. A validação antiga considerava somente uma
  // lista fixa e transformava um Origin legítimo em erro 500.
  //
  // Aqui aceitamos:
  //   1) origens configuradas em CLIENT_ORIGIN;
  //   2) a mesma origem/host da requisição;
  //   3) o domínio principal radasa.com.br e www.radasa.com.br.
  // Origens desconhecidas simplesmente não recebem headers CORS; não geramos
  // exceção 500 no middleware.
  app.use(
    cors((req, callback) => {
      const rawOrigin = String(req.headers.origin ?? "").trim();
      if (!rawOrigin) {
        callback(null, { ...baseCorsOptions, origin: true });
        return;
      }

      const origin = rawOrigin.replace(/\/$/, "");
      let allowed = allowedOrigins.has(origin);

      try {
        const parsedOrigin = new URL(origin);
        const forwardedHostHeader = req.headers["x-forwarded-host"];
        const forwardedHost = Array.isArray(forwardedHostHeader)
          ? forwardedHostHeader[0]
          : String(forwardedHostHeader ?? "").split(",")[0].trim();
        const requestHost = (forwardedHost || String(req.headers.host ?? ""))
          .trim()
          .toLowerCase();
        const originHost = parsedOrigin.host.toLowerCase();
        const originHostname = parsedOrigin.hostname.toLowerCase();

        const sameHost = Boolean(requestHost) && originHost === requestHost;
        const customDomain =
          parsedOrigin.protocol === "https:" &&
          (originHostname === "radasa.com.br" || originHostname === "www.radasa.com.br");
        const localDevelopment =
          env.NODE_ENV !== "production" &&
          (originHostname === "localhost" || originHostname === "127.0.0.1");

        allowed = allowed || sameHost || customDomain || localDevelopment;
      } catch {
        allowed = false;
      }

      if (!allowed) {
        console.warn(`[cors] Origem recusada: ${origin}`);
      }

      callback(null, { ...baseCorsOptions, origin: allowed });
    }),
  );

  // Limite interno para falhar de forma previsível em uploads JSON grandes.
  app.use(express.json({ limit: "8mb" }));
  app.use(express.urlencoded({ extended: false, limit: "8mb" }));
  app.use(sanitizeInputs);
  app.use("/api", (_req, res, next) => {
    // Cadastros e listagens precisam refletir imediatamente as gravações no Neon.
    // Evita cache do navegador/CDN sobre respostas dinâmicas da API.
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    next();
  });
  // Prisma/pg não deve compartilhar sockets entre requests no runtime edge.
  app.use("/api", prismaRequestContext);
  app.use("/api", createRateLimiter({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: "draft-7", legacyHeaders: false }), apiRoutes);
  return app;
}

export function registerErrors(app: express.Express) {
  app.use(notFound);
  app.use(errorHandler);
}
