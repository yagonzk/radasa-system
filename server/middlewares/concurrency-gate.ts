import type { Request, RequestHandler, Response, NextFunction } from "express";

type GateOptions = {
  maxActive: number;
  maxQueue: number;
  maxWaitMs: number;
};

type QueueEntry = {
  req: Request;
  res: Response;
  next: NextFunction;
  started: boolean;
  cancelled: boolean;
  timer?: ReturnType<typeof setTimeout>;
};

function isMutation(method: string) {
  return !["GET", "HEAD", "OPTIONS"].includes(method.toUpperCase());
}

/**
 * Limite de concorrência por isolate do Worker. Ele não substitui Hyperdrive,
 * mas impede que uma rajada local de mutações abra dezenas de conexões diretas
 * ao Neon ao mesmo tempo. Requests excedentes aguardam uma vaga por poucos segundos.
 */
export function createMutationConcurrencyGate(options: GateOptions): RequestHandler {
  const maxActive = Math.max(1, Math.floor(options.maxActive));
  const maxQueue = Math.max(0, Math.floor(options.maxQueue));
  const maxWaitMs = Math.max(250, Math.floor(options.maxWaitMs));
  const queue: QueueEntry[] = [];
  let active = 0;

  const drain = () => {
    while (active < maxActive && queue.length) {
      const entry = queue.shift()!;
      if (entry.cancelled || entry.res.headersSent || entry.res.destroyed) continue;
      if (entry.timer) clearTimeout(entry.timer);
      start(entry);
    }
  };

  const releaseFor = (entry: QueueEntry) => {
    let released = false;
    return () => {
      if (released) return;
      released = true;
      active = Math.max(0, active - 1);
      drain();
    };
  };

  const start = (entry: QueueEntry) => {
    if (entry.cancelled || entry.started) return;
    entry.started = true;
    active += 1;
    const release = releaseFor(entry);
    entry.res.once("finish", release);
    entry.res.once("close", release);
    entry.next();
  };

  return (req, res, next) => {
    if (!isMutation(req.method)) {
      next();
      return;
    }

    const entry: QueueEntry = { req, res, next, started: false, cancelled: false };
    if (active < maxActive) {
      start(entry);
      return;
    }

    if (queue.length >= maxQueue) {
      res.setHeader("Retry-After", "2");
      res.status(503).json({
        message: "O servidor está processando muitas gravações simultâneas. Aguarde alguns segundos e tente novamente.",
        requestId: res.locals.requestId,
      });
      return;
    }

    entry.timer = setTimeout(() => {
      if (entry.started || entry.cancelled || res.headersSent) return;
      entry.cancelled = true;
      res.setHeader("Retry-After", "2");
      res.status(503).json({
        message: "A gravação aguardou outras operações por tempo demais. Tente novamente em alguns segundos.",
        requestId: res.locals.requestId,
      });
    }, maxWaitMs);

    res.once("close", () => {
      if (entry.started) return;
      entry.cancelled = true;
      if (entry.timer) clearTimeout(entry.timer);
    });

    queue.push(entry);
  };
}
