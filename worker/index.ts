import { httpServerHandler } from "cloudflare:node";
import { createServer } from "node:http";
import { createApp, registerErrors } from "../server/app.js";
import {
  runWithRuntimeBindings,
  type WorkerRuntimeBindings,
} from "../server/lib/runtime-bindings.js";

(globalThis as typeof globalThis & { __RADASA_CLOUDFLARE?: boolean }).__RADASA_CLOUDFLARE = true;

const app = createApp();
registerErrors(app);

const server = createServer(app);
server.listen(3000);

const httpHandler = httpServerHandler(server) as any;

export default {
  fetch(request: any, env: WorkerRuntimeBindings, ctx: any) {
    // O acesso a bindings que podem disparar I/O (como HYPERDRIVE.connectionString)
    // precisa acontecer dentro do handler. O AsyncLocalStorage propaga esses valores
    // somente pela cadeia assíncrona desta request, sem estado global mutável.
    return runWithRuntimeBindings(env, () => httpHandler.fetch(request, env, ctx));
  },
  async scheduled(_controller: any, _env: WorkerRuntimeBindings, _ctx: any) {
    // A consulta SEFAZ é executada pelo Agente SEFAZ local no Windows.
    // O Worker não tenta mTLS diretamente para evitar incompatibilidade com o Ambiente Nacional.
  },
};
