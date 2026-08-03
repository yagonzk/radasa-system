import pinoHttp from "pino-http";
import { logger } from "../config/logger";

export const requestLogger = pinoHttp({
  logger,
  customProps: (req) => ({ requestId: req.id }),
});
