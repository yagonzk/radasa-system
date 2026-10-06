import { api, getAccessToken, getRealtimeClientId, invalidateResourceCache } from "./api";

export const REALTIME_CHANGE_EVENT = "radasa:realtime-change";
export const REALTIME_STATUS_EVENT = "radasa:realtime-status";

type RealtimeChange = {
  type: "change";
  resources?: string[];
  path?: string;
  method?: string;
  sourceClientId?: string;
  at?: number;
};

type RealtimeStatus = "connecting" | "connected" | "disconnected";

let socket: WebSocket | null = null;
let retryTimer: number | null = null;
let retryAttempt = 0;
let consumers = 0;
let stopped = true;
let changeFlushTimer: number | null = null;
const pendingResources = new Set<string>();
let pendingChange: RealtimeChange | null = null;
const REALTIME_COALESCE_MS = 300;

function status(value: RealtimeStatus) {
  window.dispatchEvent(new CustomEvent<RealtimeStatus>(REALTIME_STATUS_EVENT, { detail: value }));
}

function websocketUrl() {
  const configured = String(api.defaults.baseURL || "/api");
  const apiUrl = new URL(configured, window.location.origin);
  const basePath = apiUrl.pathname.replace(/\/$/, "");
  apiUrl.pathname = `${basePath}/realtime`;
  apiUrl.search = "";
  apiUrl.hash = "";
  apiUrl.protocol = apiUrl.protocol === "https:" ? "wss:" : "ws:";
  return apiUrl.toString();
}

function resourceEventName(resource: string) {
  return `radasa-api-change:${resource}`;
}

function flushChanges() {
  changeFlushTimer = null;
  if (!pendingResources.size || !pendingChange) return;
  const resources = [...pendingResources];
  pendingResources.clear();
  const change = { ...pendingChange, resources };
  pendingChange = null;

  for (const resource of resources) {
    window.dispatchEvent(
      new CustomEvent(resourceEventName(resource), {
        detail: { source: "realtime" },
      }),
    );
  }

  window.dispatchEvent(
    new CustomEvent<RealtimeChange>(REALTIME_CHANGE_EVENT, { detail: change }),
  );
}

function applyChange(change: RealtimeChange) {
  if (change.sourceClientId && change.sourceClientId === getRealtimeClientId()) return;
  const resources = Array.from(new Set((change.resources || []).filter(Boolean)));
  if (!resources.length) return;

  // Invalida imediatamente, mas agrupa rajadas de escrita (importação em massa,
  // pagamentos em lote etc.) em um único refetch por recurso. Sem isso, 20 PATCHes
  // podiam fazer outro PC recalcular Dashboard/Financeiro/Fiscal 20 vezes seguidas.
  for (const resource of resources) {
    invalidateResourceCache(resource);
    pendingResources.add(resource);
  }
  pendingChange = change;
  if (changeFlushTimer === null) {
    changeFlushTimer = window.setTimeout(flushChanges, REALTIME_COALESCE_MS);
  }
}

function scheduleReconnect() {
  if (stopped || consumers <= 0 || retryTimer !== null) return;
  const delays = [1_000, 2_000, 5_000, 10_000, 15_000, 30_000];
  const delay = delays[Math.min(retryAttempt, delays.length - 1)];
  retryAttempt += 1;
  retryTimer = window.setTimeout(() => {
    retryTimer = null;
    connect();
  }, delay);
}

function connect() {
  if (stopped || consumers <= 0) return;
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) return;

  const token = getAccessToken();
  if (!token) {
    status("disconnected");
    return;
  }

  status("connecting");
  try {
    socket = new WebSocket(websocketUrl(), ["radasa-sync", token]);
  } catch (error) {
    console.warn("[realtime] Não foi possível abrir a conexão.", error);
    socket = null;
    status("disconnected");
    scheduleReconnect();
    return;
  }

  socket.addEventListener("open", () => {
    retryAttempt = 0;
    status("connected");
  });

  socket.addEventListener("message", (event) => {
    if (event.data === "pong") return;
    if (typeof event.data !== "string") return;
    try {
      const change = JSON.parse(event.data) as RealtimeChange;
      if (change?.type === "change") applyChange(change);
    } catch {
      // Mensagens desconhecidas não derrubam a sincronização.
    }
  });

  socket.addEventListener("close", () => {
    socket = null;
    status("disconnected");
    scheduleReconnect();
  });

  socket.addEventListener("error", () => {
    // O evento close fará o reconnect com backoff.
  });
}

export function startRealtimeSync() {
  consumers += 1;
  stopped = false;
  connect();

  return () => {
    consumers = Math.max(0, consumers - 1);
    if (consumers > 0) return;
    stopped = true;
    if (retryTimer !== null) {
      window.clearTimeout(retryTimer);
      retryTimer = null;
    }
    if (changeFlushTimer !== null) {
      window.clearTimeout(changeFlushTimer);
      changeFlushTimer = null;
    }
    pendingResources.clear();
    pendingChange = null;
    if (socket) {
      try { socket.close(1000, "Sessão encerrada."); } catch { /* noop */ }
      socket = null;
    }
    status("disconnected");
  };
}

export function realtimeChangeTouches(event: Event, ...resources: string[]) {
  const detail = (event as CustomEvent<RealtimeChange>).detail;
  const changed = new Set(detail?.resources || []);
  return resources.some((resource) => changed.has(resource));
}
