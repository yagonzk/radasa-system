import { httpServerHandler } from "cloudflare:node";
import { createServer } from "node:http";
import jwt from "jsonwebtoken";
import { createApp, registerErrors } from "../server/app.js";
import { env } from "../server/config/env.js";
import {
  runWithRuntimeBindings,
  type WorkerRuntimeBindings,
} from "../server/lib/runtime-bindings.js";
export { RadasaRealtimeHub } from "./realtime-hub.js";

(globalThis as typeof globalThis & { __RADASA_CLOUDFLARE?: boolean }).__RADASA_CLOUDFLARE = true;

const app = createApp();
registerErrors(app);

const server = createServer(app);
server.listen(3000);

const httpHandler = httpServerHandler(server) as any;
const REALTIME_PROTOCOL = "radasa-sync";

type DurableObjectNamespaceLike = {
  idFromName(name: string): unknown;
  get(id: unknown): { fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> };
};

type RealtimeBindings = WorkerRuntimeBindings & {
  REALTIME_HUB?: DurableObjectNamespaceLike;
};

type RealtimeTokenPayload = { sub?: string; email?: string; role?: string };

function websocketToken(request: Request) {
  const protocols = String(request.headers.get("Sec-WebSocket-Protocol") || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!protocols.includes(REALTIME_PROTOCOL)) return "";
  return protocols.find((value) => value !== REALTIME_PROTOCOL) || "";
}

function realtimeAuthorized(request: Request) {
  const token = websocketToken(request);
  if (!token) return false;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as RealtimeTokenPayload;
    return Boolean(payload?.sub);
  } catch {
    return false;
  }
}

function hubStub(envBindings: RealtimeBindings) {
  const namespace = envBindings.REALTIME_HUB;
  if (!namespace) return null;
  return namespace.get(namespace.idFromName("radasa-global"));
}

function affectedResources(pathname: string) {
  const path = pathname.replace(/^\/api\/?/, "");
  const parts = path.split("/").filter(Boolean);
  const root = parts[0] || "";
  const resources = new Set<string>();

  const direct: Record<string, string> = {
    motoristas: "motoristas",
    chapas: "chapas",
    clientes: "clientes",
    fornecedores: "fornecedores",
    empresa: "empresa",
    produtos: "produtos",
    locais: "locais",
    veiculos: "veiculos",
    viagens: "viagens",
    fechamentos: "fechamentos",
    manifestos: "manifestos",
    romaneios: "manifestos",
    abastecimentos: "abastecimentos",
    pneus: "pneus",
    demandas: "demandas",
    ciots: "ciots",
    pedagios: "pedagios",
    fiscal: "fiscal",
    financeiro: "financeiro",
    manutencao: "manutencao",
    estoque: "estoque",
    admin: "admin",
    usuarios: "usuarios",
    sefaz: "fiscal",
    cte: "ciots",
    agro: "agro",
  };

  const primary = direct[root];
  if (primary) resources.add(primary);

  if (root === "agro") {
    const section = parts[1] || "dashboard";
    resources.add(`agro/${section}`);
    if (["produtos", "lotes", "movimentacoes"].includes(section)) {
      resources.add("agro/estoque");
      resources.add("agro/dashboard");
    }
    if (section === "movimentacoes") resources.add("agro/movimentacoes");
  }

  if (root === "estoque" && ["tipos", "subcategorias", "produtos"].includes(parts[1] || "")) {
    resources.add(`estoque/${parts[1]}`);
  }

  if (["manifestos", "romaneios", "viagens", "abastecimentos", "financeiro", "manutencao", "pneus", "veiculos", "motoristas", "fechamentos", "estoque", "pedagios"].includes(root)) {
    resources.add("dashboard");
  }
  if (["motoristas", "veiculos", "manutencao", "pneus"].includes(root)) {
    resources.add("alertas");
  }
  if (["manifestos", "romaneios", "clientes", "produtos", "veiculos", "fiscal"].includes(root)) {
    resources.add("bi");
  }
  if (["viagens", "abastecimentos", "fechamentos", "financeiro", "manifestos", "romaneios", "manutencao", "pneus", "estoque", "pedagios", "chapas"].includes(root)) {
    resources.add("financeiro");
  }
  if (["manifestos", "romaneios", "abastecimentos", "fechamentos", "estoque", "pneus", "viagens", "pedagios", "financeiro", "chapas"].includes(root)) {
    resources.add("fiscal");
  }

  return [...resources];
}

function shouldBroadcast(request: Request, response: Response) {
  if (!request.url.includes("/api/")) return false;
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(request.method.toUpperCase())) return false;
  if (response.status >= 400) return false;
  const pathname = new URL(request.url).pathname;
  if (pathname === "/api/auth/login" || pathname === "/api/auth/register") return false;
  return true;
}

async function broadcastMutation(request: Request, response: Response, bindings: RealtimeBindings) {
  const stub = hubStub(bindings);
  if (!stub) return;
  const url = new URL(request.url);
  const resources = affectedResources(url.pathname);
  if (!resources.length) return;

  await stub.fetch("https://radasa-realtime.internal/broadcast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "change",
      resources,
      path: url.pathname,
      method: request.method.toUpperCase(),
      sourceClientId: String(request.headers.get("X-Radasa-Client-Id") || ""),
      at: Date.now(),
    }),
  });
}

export default {
  async fetch(request: any, envBindings: RealtimeBindings, ctx: any) {
    const url = new URL(request.url);

    if (url.pathname === "/api/realtime") {
      if (String(request.headers.get("Upgrade") || "").toLowerCase() !== "websocket") {
        return new Response("WebSocket obrigatório.", { status: 426 });
      }
      if (!realtimeAuthorized(request)) {
        return new Response("Não autorizado.", { status: 401 });
      }
      const stub = hubStub(envBindings);
      if (!stub) return new Response("Sincronização em tempo real indisponível.", { status: 503 });
      return stub.fetch(request);
    }

    // O acesso a bindings que podem disparar I/O (como HYPERDRIVE.connectionString)
    // precisa acontecer dentro do handler. O AsyncLocalStorage propaga esses valores
    // somente pela cadeia assíncrona desta request, sem estado global mutável.
    const response = await runWithRuntimeBindings(envBindings, () => httpHandler.fetch(request, envBindings, ctx));

    if (shouldBroadcast(request, response)) {
      ctx.waitUntil(
        broadcastMutation(request, response, envBindings).catch((error) => {
          console.error("[realtime] Falha ao publicar alteração", error);
        }),
      );
    }

    return response;
  },
  async scheduled(_controller: any, _env: WorkerRuntimeBindings, _ctx: any) {
    // A consulta SEFAZ é executada pelo Agente SEFAZ local no Windows.
    // O Worker não tenta mTLS diretamente para evitar incompatibilidade com o Ambiente Nacional.
  },
};
