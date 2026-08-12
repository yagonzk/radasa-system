import { httpServerHandler } from "cloudflare:node";
import { createServer } from "node:http";
import { createApp, registerErrors } from "../server/app.js";

// O backend continua sendo o mesmo Express usado atualmente.
// A Cloudflare converte as requests do Worker para o servidor HTTP Node.
const app = createApp();
registerErrors(app);

const server = createServer(app);
server.listen(3000);

export default httpServerHandler(server);
