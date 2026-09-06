import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import type { RequestHandler } from "express";
import { getRuntimeDatabaseUrl } from "./runtime-bindings.js";

/**
 * No Worker cada request recebe um Prisma Client próprio. Quando Hyperdrive
 * estiver ligado, a connection string vem do binding e o pooling global fica
 * por conta da Cloudflare. Localmente e como fallback, DATABASE_URL continua
 * sendo usada normalmente.
 */
type RequestPrismaScope = { client?: PrismaClient };
const requestPrisma = new AsyncLocalStorage<RequestPrismaScope>();
let nodePrisma: PrismaClient | undefined;

function connectionString() {
  const hyperdriveUrl = getRuntimeDatabaseUrl();
  if (hyperdriveUrl) return hyperdriveUrl;

  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL não foi configurada para o Prisma.");
  return value;
}

function isUsingHyperdrive() {
  return Boolean(getRuntimeDatabaseUrl());
}

function createPrismaClient(connection: string) {
  const adapter = new PrismaPg({
    connectionString: connection,
    // Hyperdrive já faz pooling global. O pequeno pool local só permite que
    // Promise.all dentro da mesma request execute algumas queries em paralelo.
    // Um pool local pequeno evita multiplicar conexões quando várias requests
    // chegam juntas. Com Hyperdrive, o pooling pesado acontece fora do Worker.
    max: isUsingHyperdrive() ? 2 : 1,
    connectionTimeoutMillis: 5_000,
    idleTimeoutMillis: 2_000,
  });

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });
}

function currentPrisma() {
  const scoped = requestPrisma.getStore();
  if (scoped) {
    if (!scoped.client) scoped.client = createPrismaClient(connectionString());
    return scoped.client;
  }

  if (!nodePrisma) nodePrisma = createPrismaClient(connectionString());
  return nodePrisma;
}

/** Deve ficar antes das rotas /api. O client só nasce no primeiro acesso ao Prisma. */
export const prismaRequestContext: RequestHandler = (_req, res, next) => {
  const scope: RequestPrismaScope = {};
  let cleaned = false;
  const cleanup = () => {
    if (cleaned) return;
    cleaned = true;
    if (scope.client) void scope.client.$disconnect().catch(() => undefined);
  };

  // Evita criar pool para rotas que não acessam banco e fecha qualquer pool local
  // ao final da request. No Worker, não compartilhamos sockets entre requests.
  res.once("finish", cleanup);
  res.once("close", cleanup);
  requestPrisma.run(scope, next);
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
