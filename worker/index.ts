import { env as cloudflareEnv } from "cloudflare:workers";
import { httpServerHandler } from "cloudflare:node";
import { createServer } from "node:http";
import { createApp, registerErrors } from "../server/app.js";

type HyperdriveBinding = { connectionString: string };
type WorkerBindings = { HYPERDRIVE?: HyperdriveBinding };

// Se o binding HYPERDRIVE estiver configurado no wrangler.jsonc, o Prisma usa
// automaticamente a connection string acelerada. Sem binding, o projeto
// continua funcionando com DATABASE_URL, o que torna o rollout reversível.
const hyperdrive = (cloudflareEnv as unknown as WorkerBindings).HYPERDRIVE;
if (hyperdrive?.connectionString) {
  (globalThis as typeof globalThis & { __RADASA_DATABASE_URL?: string }).__RADASA_DATABASE_URL =
    hyperdrive.connectionString;
}

const app = createApp();
registerErrors(app);

const server = createServer(app);
server.listen(3000);

export default httpServerHandler(server);
