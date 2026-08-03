import pino from "pino";
import { env } from "./env";

export const logger = pino({
  level: env.LOG_LEVEL,
  redact: {
    paths: ["req.headers.authorization", "password", "passwordHash", "token"],
    censor: "[REDACTED]",
  },
});
