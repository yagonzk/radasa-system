import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { RequestHandler } from "express";

/**
 * Cloudflare Workers: cada request precisa do seu próprio Prisma Client.
 * Reutilizar um Pool/Prisma global entre requests pode reaproveitar sockets
 * pertencentes a outro contexto do Worker e deixar Promises sem resolução.
 *
 * AsyncLocalStorage permite manter os services existentes (`prisma.*`) sem
 * mudar a API deles, mas resolve o client correto para cada request.
 */
const requestPrisma = new AsyncLocalStorage<PrismaClient>();
let nodePrisma: PrismaClient | undefined;

function createPrismaClient(connectionString: string) {
  const adapter = new PrismaPg({
    connectionString,
    // Workers têm limite baixo de conexões externas simultâneas. Um pool
    // pequeno por request é suficiente e ainda suporta os Promise.all atuais.
    max: 3,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 5_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function connectionString() {
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL não foi configurada para o Prisma.");
  return value;
}

function currentPrisma() {
  const scoped = requestPrisma.getStore();
  if (scoped) return scoped;

  // Node/Vite local continua podendo usar um singleton convencional.
  if (!nodePrisma) nodePrisma = createPrismaClient(connectionString());
  return nodePrisma;
}

/** Deve ficar antes das rotas /api. */
export const prismaRequestContext: RequestHandler = (_req, _res, next) => {
  const client = createPrismaClient(connectionString());
  requestPrisma.run(client, next);
};

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, property) {
    const client = currentPrisma();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

export function trackPrismaTask(task: Promise<unknown>) {
  void task.catch(() => undefined);
}
