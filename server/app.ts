import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import { env } from "./config/env";
import { apiRoutes } from "./routes";
import { requestLogger } from "./middlewares/request-logger";
import { sanitizeInputs } from "./middlewares/sanitize";
import { notFound } from "./middlewares/not-found";
import { errorHandler } from "./middlewares/error-handler";

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.set("trust proxy", 1);
  app.use(requestLogger);
  app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
  app.use(cors({ origin: env.CLIENT_ORIGIN.split(",").map(v => v.trim()), credentials: true, methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"] }));
  app.use(express.json({ limit: "25mb" }));
  app.use(express.urlencoded({ extended: false, limit: "25mb" }));
  app.use(sanitizeInputs);
  app.use("/api", rateLimit({ windowMs: 15 * 60 * 1000, limit: 1000, standardHeaders: "draft-7", legacyHeaders: false }), apiRoutes);
  return app;
}

export function registerErrors(app: express.Express) {
  app.use(notFound);
  app.use(errorHandler);
}
