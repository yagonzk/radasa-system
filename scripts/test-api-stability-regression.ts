import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { diffIds, assertEditVersion, mapWithConcurrency } from "../server/utils/concurrency.ts";
import { isTransientDatabaseError } from "../server/utils/transient-db-error.ts";
import { createMutationConcurrencyGate } from "../server/middlewares/concurrency-gate.ts";
import { EventEmitter } from "node:events";

const diff = diffIds(["a", "b", "c"], ["b", "c", "d"]);
assert.deepEqual(diff.toRemove, ["a"]);
assert.deepEqual(diff.toAdd, ["d"]);
assert.deepEqual(diff.toKeep, ["b", "c"]);

assert.doesNotThrow(() => assertEditVersion(3, 3));
assert.throws(() => assertEditVersion(3, 2), /alterado por outra requisição/i);
assert.doesNotThrow(() => assertEditVersion(3, undefined));

let active = 0;
let peak = 0;
const values = await mapWithConcurrency([1,2,3,4,5,6], 2, async (value) => {
  active += 1;
  peak = Math.max(peak, active);
  await new Promise((resolve) => setTimeout(resolve, 10));
  active -= 1;
  return value * 2;
});
assert.deepEqual(values, [2,4,6,8,10,12]);
assert.ok(peak <= 2, `Concorrência excedeu 2: ${peak}`);

assert.equal(isTransientDatabaseError({ code: "P1001" }), true);
assert.equal(isTransientDatabaseError({ code: "P2024" }), true);
assert.equal(isTransientDatabaseError({ code: "P2028" }), true);
assert.equal(isTransientDatabaseError({ code: "53300" }), true);
assert.equal(isTransientDatabaseError({ code: "P2002" }), false);


class FakeResponse extends EventEmitter {
  headersSent = false;
  destroyed = false;
  writableEnded = false;
  locals: Record<string, unknown> = { requestId: "req-test-12345678" };
  statusCode = 200;
  setHeader() { return this; }
  status(code: number) { this.statusCode = code; return this; }
  json() { this.headersSent = true; this.writableEnded = true; this.emit("finish"); return this; }
}

const mutationGate = createMutationConcurrencyGate({ maxActive: 8, maxQueue: 40, maxWaitMs: 1000 });
let gateActive = 0;
let gatePeak = 0;
let gateCompleted = 0;
await Promise.all(Array.from({ length: 12 }, () => new Promise<void>((resolve) => {
  const res = new FakeResponse();
  mutationGate({ method: "PUT" } as any, res as any, () => {
    gateActive += 1;
    gatePeak = Math.max(gatePeak, gateActive);
    setTimeout(() => {
      gateActive -= 1;
      gateCompleted += 1;
      res.writableEnded = true;
      res.emit("finish");
      resolve();
    }, 10);
  });
})));
assert.equal(gateCompleted, 12);
assert.ok(gatePeak <= 8, `Gate excedeu 8 mutações: ${gatePeak}`);

const service = fs.readFileSync(path.resolve("server/services/viagens.service.ts"), "utf8");
assert.match(service, /FOR UPDATE/i, "update de viagem precisa bloquear a linha no PostgreSQL");
assert.match(service, /editVersion/, "update precisa validar/incrementar editVersion");
assert.doesNotMatch(
  service.slice(service.indexOf("async update(id: string, input: any)"), service.indexOf("async remove(id: string)")),
  /viagemAbastecimento\.deleteMany\(\{ where: \{ viagemId: id \} \}\)/,
  "update não deve apagar todos os vínculos de abastecimento",
);

const bootstrap = fs.readFileSync(path.resolve("server/routes/bootstrap.routes.ts"), "utf8");
assert.match(bootstrap, /mapWithConcurrency\([^,]+,\s*3,/s, "bootstrap deve limitar loaders simultâneos");

const api = fs.readFileSync(path.resolve("client/src/lib/api.ts"), "utf8");
assert.match(api, /config\.method.*get/i, "retry deve verificar método GET");
assert.match(api, /__radasaRetry/, "retry GET deve acontecer no máximo uma vez");
assert.match(api, /mapWithLimit\(resources,\s*3,/s, "fallback do bootstrap deve limitar requests simultâneas");

const prismaSource = fs.readFileSync(path.resolve("server/lib/prisma.ts"), "utf8");
assert.match(prismaSource, /if \(!scoped\.client\) scoped\.client = createPrismaClient/, "Prisma por request deve ser lazy");
assert.match(prismaSource, /max:\s*isUsingHyperdrive\(\) \? 2 : 1/, "pool local deve ser pequeno");

const appSource = fs.readFileSync(path.resolve("server/app.ts"), "utf8");
assert.match(appSource, /createMutationConcurrencyGate/, "API deve limitar mutações concorrentes por isolate");
assert.match(appSource, /maxActive:\s*8/, "gate deve limitar a 8 mutações simultâneas por isolate");


const workerSource = fs.readFileSync(path.resolve("worker/index.ts"), "utf8");
assert.doesNotMatch(
  workerSource,
  /import\s+\{\s*env\s+as\s+cloudflareEnv\s*\}\s+from\s+["']cloudflare:workers["']/,
  "Worker não deve acessar env do Cloudflare no escopo global",
);
assert.match(
  workerSource,
  /runWithRuntimeBindings\(env,\s*\(\)\s*=>\s*httpHandler\.fetch\(request,\s*env,\s*ctx\)\)/s,
  "bindings do Cloudflare devem ser associados ao contexto da request dentro de fetch()",
);

const runtimeBindingsSource = fs.readFileSync(path.resolve("server/lib/runtime-bindings.ts"), "utf8");
assert.match(runtimeBindingsSource, /AsyncLocalStorage/, "bindings runtime devem ser request-scoped");
assert.match(runtimeBindingsSource, /HYPERDRIVE\?\.connectionString/, "runtime deve expor connectionString do Hyperdrive");

assert.match(
  prismaSource,
  /getRuntimeDatabaseUrl\(\)/,
  "Prisma deve resolver Hyperdrive a partir do contexto runtime da request",
);
assert.doesNotMatch(
  prismaSource,
  /__RADASA_DATABASE_URL/,
  "Prisma não deve depender de variável global mutável para Hyperdrive",
);

console.log("API stability regression: OK");
