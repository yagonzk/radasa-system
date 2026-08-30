import { env as cloudflareEnv } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { createServer } from "node:http";
import { createApp, registerErrors } from "../server/app.js";

type HyperdriveBinding = { connectionString: string };
type WorkerBindings = {
  HYPERDRIVE?: HyperdriveBinding;
  RESEND_API_KEY?: string;
};

// Se o binding HYPERDRIVE estiver configurado no wrangler.jsonc, o Prisma usa
// automaticamente a connection string acelerada. Sem binding, o projeto
// continua funcionando com DATABASE_URL, o que torna o rollout reversível.
const bindings = cloudflareEnv as unknown as WorkerBindings;
(globalThis as typeof globalThis & { __RADASA_CLOUDFLARE?: boolean }).__RADASA_CLOUDFLARE = true;
const hyperdrive = bindings.HYPERDRIVE;
if (hyperdrive?.connectionString) {
  (globalThis as typeof globalThis & { __RADASA_DATABASE_URL?: string }).__RADASA_DATABASE_URL =
    hyperdrive.connectionString;
}




if (bindings.RESEND_API_KEY) {
  (
    globalThis as typeof globalThis & { __RADASA_RESEND_API_KEY?: string }
  ).__RADASA_RESEND_API_KEY = bindings.RESEND_API_KEY;
}


const app = createApp();
registerErrors(app);

const server = createServer(app);
server.listen(3000);

const httpHandler = httpServerHandler(server) as any;

export default {
  fetch(request: any, env: any, ctx: any) {
    return httpHandler.fetch(request, env, ctx);
  },
  async scheduled(_controller: any, _env: any, _ctx: any) {
    // A consulta SEFAZ é executada pelo Agente SEFAZ local no Windows.
    // O Worker não tenta mTLS diretamente para evitar incompatibilidade com o Ambiente Nacional.
  },
};
