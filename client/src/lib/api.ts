import axios from "axios";

const TOKEN_KEY = "radasa_access_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});


async function mapWithLimit<T, R>(items: readonly T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  const runners = Array.from({ length: Math.max(1, Math.min(limit, items.length || 1)) }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index]);
    }
  });
  await Promise.all(runners);
  return results;
}

function requestId(prefix: string) {
  const uuid = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${uuid}`;
}

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers["X-Request-Id"] = requestId("req");
  const method = String(config.method ?? "get").toLowerCase();
  if (!["get", "head", "options"].includes(method)) {
    config.headers["X-Mutation-Id"] = requestId("mut");
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    console.error("Erro na API:", error.response?.data ?? error.message);
    if (error.response?.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("radasa:unauthorized"));
    }

    // Somente GET é repetido automaticamente. Escritas nunca são repetidas,
    // evitando duplicar um Acerto de Viagem quando a primeira request terminou
    // no banco mas a resposta se perdeu no caminho.
    const config = error.config as (typeof error.config & { __radasaRetry?: boolean }) | undefined;
    const status = Number(error.response?.status ?? 0);
    const canRetry =
      config &&
      String(config.method ?? "get").toLowerCase() === "get" &&
      !config.__radasaRetry &&
      [429, 502, 503, 504].includes(status);

    if (canRetry) {
      config.__radasaRetry = true;
      const retryAfterSeconds = Number(error.response?.headers?.["retry-after"] ?? 0);
      const delayMs = retryAfterSeconds > 0
        ? Math.min(retryAfterSeconds * 1000, 3_000)
        : 500 + Math.floor(Math.random() * 250);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return api.request(config);
    }

    return Promise.reject(error);
  }
);

type ResourceCacheEntry = { data: unknown; expiresAt: number; savedAt: number };
type BootstrapResponse = {
  data?: Record<string, unknown>;
  errors?: Record<string, string>;
};

const resourceCache = new Map<string, ResourceCacheEntry>();
const resourceInflight = new Map<string, Promise<unknown>>();
const batchWaiters = new Map<string, Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>>();
let batchScheduled = false;

const BATCHABLE_RESOURCES = new Set([
  "motoristas", "chapas", "clientes", "fornecedores", "empresa", "produtos", "locais",
  "veiculos", "viagens", "fechamentos", "manifestos", "abastecimentos", "pneus",
]);

// Cadastros mudam pouco e podem ser reaproveitados entre navegações/reloads da
// mesma aba. O dado persistido é mostrado imediatamente e a atualização acontece
// em segundo plano, sem a tela voltar a ficar vazia enquanto o Neon responde.
const SESSION_CACHE_RESOURCES = new Set([
  "motoristas", "chapas", "clientes", "fornecedores", "empresa", "produtos", "locais", "veiculos",
  "manifestos", "abastecimentos",
]);
const SESSION_CACHE_PREFIX = "radasa_resource_cache_v154:";
const MAX_SESSION_CACHE_BYTES = 1_500_000;

function resourceTtl(resource: string) {
  if (["abastecimentos", "manifestos", "viagens", "fechamentos", "pneus"].includes(resource)) return 30_000;
  return 2 * 60_000;
}

function sessionKey(resource: string) {
  return `${SESSION_CACHE_PREFIX}${resource}`;
}

function persistResource(resource: string, data: unknown, savedAt: number) {
  if (!SESSION_CACHE_RESOURCES.has(resource) || typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({ data, savedAt });
    if (payload.length > MAX_SESSION_CACHE_BYTES) return;
    window.sessionStorage.setItem(sessionKey(resource), payload);
  } catch {
    // Cache é apenas otimização. Quota/privacidade do navegador não pode impedir a aplicação.
  }
}

function restoreSessionCache() {
  if (typeof window === "undefined") return;
  for (const resource of SESSION_CACHE_RESOURCES) {
    try {
      const raw = window.sessionStorage.getItem(sessionKey(resource));
      if (!raw) continue;
      const parsed = JSON.parse(raw) as { data?: unknown; savedAt?: number };
      if (!Array.isArray(parsed.data)) continue;
      const savedAt = Number(parsed.savedAt || 0);
      resourceCache.set(resource, {
        data: parsed.data,
        // O snapshot da sessão serve para primeira pintura; deixamos expirado
        // para que a montagem faça uma revalidação em background.
        expiresAt: 0,
        savedAt,
      });
    } catch {
      window.sessionStorage.removeItem(sessionKey(resource));
    }
  }
}

restoreSessionCache();

function saveResource(resource: string, data: unknown) {
  const savedAt = Date.now();
  resourceCache.set(resource, { data, expiresAt: savedAt + resourceTtl(resource), savedAt });
  persistResource(resource, data, savedAt);
  return data;
}

/**
 * Retorna inclusive um snapshot expirado. O hook usa isso apenas para evitar
 * "piscar" a tela vazia; getResourceCollection continua conferindo o TTL e
 * revalida em background quando necessário.
 */
export function peekResourceCollection<T>(resource: string): T[] | undefined {
  const cached = resourceCache.get(resource);
  if (!cached || !Array.isArray(cached.data)) return undefined;
  return cached.data as T[];
}

function freshResourceCollection<T>(resource: string): T[] | undefined {
  const cached = resourceCache.get(resource);
  if (!cached || cached.expiresAt <= Date.now() || !Array.isArray(cached.data)) return undefined;
  return cached.data as T[];
}

export function invalidateResourceCache(resource?: string) {
  if (resource) {
    resourceCache.delete(resource);
    if (typeof window !== "undefined") {
      try { window.sessionStorage.removeItem(sessionKey(resource)); } catch { /* noop */ }
    }
    return;
  }

  resourceCache.clear();
  if (typeof window !== "undefined") {
    for (const name of SESSION_CACHE_RESOURCES) {
      try { window.sessionStorage.removeItem(sessionKey(name)); } catch { /* noop */ }
    }
  }
}

async function fetchResourceDirect(resource: string) {
  const response = await api.get<unknown>(`/${resource}`);
  return saveResource(resource, response.data);
}

async function flushResourceBatch() {
  batchScheduled = false;
  const resources = [...batchWaiters.keys()];
  if (!resources.length) return;

  try {
    const response = await api.get<BootstrapResponse>("/bootstrap", {
      params: { resources: resources.join(",") },
    });
    const data = response.data?.data ?? {};
    const errors = response.data?.errors ?? {};

    await mapWithLimit(resources, 3, async (resource) => {
      const waiters = batchWaiters.get(resource) ?? [];
      batchWaiters.delete(resource);
      if (Object.prototype.hasOwnProperty.call(data, resource)) {
        const value = saveResource(resource, data[resource]);
        waiters.forEach(({ resolve }) => resolve(value));
        return;
      }

      // Um erro isolado no batch não derruba as outras telas: tenta a rota normal.
      try {
        const value = await fetchResourceDirect(resource);
        waiters.forEach(({ resolve }) => resolve(value));
      } catch (error) {
        const reason = errors[resource] ? new Error(errors[resource]) : error;
        waiters.forEach(({ reject }) => reject(reason));
      }
    });
  } catch {
    // Se o endpoint de batch estiver indisponível, preserva compatibilidade com a API antiga.
    await mapWithLimit(resources, 3, async (resource) => {
      const waiters = batchWaiters.get(resource) ?? [];
      batchWaiters.delete(resource);
      try {
        const value = await fetchResourceDirect(resource);
        waiters.forEach(({ resolve }) => resolve(value));
      } catch (error) {
        waiters.forEach(({ reject }) => reject(error));
      }
    });
  }
}

function enqueueResource(resource: string) {
  return new Promise<unknown>((resolve, reject) => {
    const current = batchWaiters.get(resource) ?? [];
    current.push({ resolve, reject });
    batchWaiters.set(resource, current);
    if (!batchScheduled) {
      batchScheduled = true;
      setTimeout(() => { void flushResourceBatch(); }, 0);
    }
  });
}

export function getResourceCollection<T>(resource: string, force = false): Promise<T[]> {
  // Mesmo uma revalidação forçada compartilha a request já em andamento. Isso
  // evita que componentes diferentes abram consultas duplicadas ao mesmo recurso.
  const inflight = resourceInflight.get(resource);
  if (inflight) return inflight as Promise<T[]>;

  if (!force) {
    const cached = freshResourceCollection<T>(resource);
    if (cached) return Promise.resolve(cached);
  }

  const request = (BATCHABLE_RESOURCES.has(resource)
    ? enqueueResource(resource)
    : fetchResourceDirect(resource)) as Promise<T[]>;

  resourceInflight.set(resource, request);
  const releaseInflight = () => {
    if (resourceInflight.get(resource) === request) resourceInflight.delete(resource);
  };
  // Usamos os dois ramos de then em vez de finally solto para não criar uma
  // Promise rejeitada sem consumidor quando a API falha.
  void request.then(releaseInflight, releaseInflight);
  return request;
}

export function setAccessToken(token: string | null) {
  invalidateResourceCache();
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}
