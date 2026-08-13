import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { RequestHandler } from "express";

/**
 * No Worker cada request recebe um Prisma Client próprio. Quando Hyperdrive
 * estiver ligado, a connection string vem do binding e o pooling global fica
 * por conta da Cloudflare. Localmente e como fallback, DATABASE_URL continua
 * sendo usada normalmente.
 */
const requestPrisma = new AsyncLocalStorage<PrismaClient>();
let nodePrisma: PrismaClient | undefined;

type RadasaGlobal = typeof globalThis & { __RADASA_DATABASE_URL?: string };

function connectionString() {
  const hyperdriveUrl = (globalThis as RadasaGlobal).__RADASA_DATABASE_URL;
  if (hyperdriveUrl) return hyperdriveUrl;

  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL não foi configurada para o Prisma.");
  return value;
}

function isUsingHyperdrive() {
  return Boolean((globalThis as RadasaGlobal).__RADASA_DATABASE_URL);
}

function createPrismaClient(connection: string) {
  const adapter = new PrismaPg({
    connectionString: connection,
    // Hyperdrive já faz pooling global. O pequeno pool local só permite que
    // Promise.all dentro da mesma request execute algumas queries em paralelo.
    max: isUsingHyperdrive() ? 3 : 2,
    connectionTimeoutMillis: 10_000,
    idleTimeoutMillis: 3_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function currentPrisma() {
  const scoped = requestPrisma.getStore();
  if (scoped) return scoped;

  if (!nodePrisma) nodePrisma = createPrismaClient(connectionString());
  return nodePrisma;
}

/** Deve ficar antes das rotas /api. */
export const prismaRequestContext: RequestHandler = (_req, res, next) => {
  const client = createPrismaClient(connectionString());
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    void client.$disconnect().catch(() => undefined);
  };

  // Evita deixar pools/sockets locais vivos após a resposta, principalmente no
  // fallback direto ao Neon. Hyperdrive mantém o pool de rede fora do Worker.
  res.once("finish", cleanup);
  res.once("close", cleanup);
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
