import axios from "axios";

const TOKEN_KEY = "radasa_access_token";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  const token = sessionStorage.getItem(TOKEN_KEY);
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error("Erro na API:", error.response?.data ?? error.message);
    if (error.response?.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event("radasa:unauthorized"));
    }
    return Promise.reject(error);
  }
);

type ResourceCacheEntry = { data: unknown; expiresAt: number };
type BootstrapResponse = {
  data?: Record<string, unknown>;
  errors?: Record<string, string>;
};

const resourceCache = new Map<string, ResourceCacheEntry>();
const resourceInflight = new Map<string, Promise<unknown>>();
const batchWaiters = new Map<string, Array<{ resolve: (value: unknown) => void; reject: (reason?: unknown) => void }>>();
let batchScheduled = false;

const BATCHABLE_RESOURCES = new Set([
  "motoristas", "chapas", "clientes", "empresa", "produtos", "locais",
  "veiculos", "viagens", "fechamentos", "manifestos", "abastecimentos", "pneus",
]);

function resourceTtl(resource: string) {
  if (["abastecimentos", "manifestos", "viagens", "fechamentos", "pneus"].includes(resource)) return 3_000;
  return 15_000;
}

function saveResource(resource: string, data: unknown) {
  resourceCache.set(resource, { data, expiresAt: Date.now() + resourceTtl(resource) });
  return data;
}

export function peekResourceCollection<T>(resource: string): T[] | undefined {
  const cached = resourceCache.get(resource);
  if (!cached || cached.expiresAt <= Date.now() || !Array.isArray(cached.data)) return undefined;
  return cached.data as T[];
}

export function invalidateResourceCache(resource?: string) {
  if (resource) resourceCache.delete(resource);
  else resourceCache.clear();
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

    await Promise.all(resources.map(async (resource) => {
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
    }));
  } catch {
    // Se o endpoint de batch estiver indisponível, preserva compatibilidade com a API antiga.
    await Promise.all(resources.map(async (resource) => {
      const waiters = batchWaiters.get(resource) ?? [];
      batchWaiters.delete(resource);
      try {
        const value = await fetchResourceDirect(resource);
        waiters.forEach(({ resolve }) => resolve(value));
      } catch (error) {
        waiters.forEach(({ reject }) => reject(error));
      }
    }));
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
  if (!force) {
    const cached = peekResourceCollection<T>(resource);
    if (cached) return Promise.resolve(cached);
    const inflight = resourceInflight.get(resource);
    if (inflight) return inflight as Promise<T[]>;
  }

  const request = (BATCHABLE_RESOURCES.has(resource)
    ? enqueueResource(resource)
    : fetchResourceDirect(resource)) as Promise<T[]>;

  resourceInflight.set(resource, request);
  void request.finally(() => {
    if (resourceInflight.get(resource) === request) resourceInflight.delete(resource);
  });
  return request;
}

export function setAccessToken(token: string | null) {
  invalidateResourceCache();
  if (token) sessionStorage.setItem(TOKEN_KEY, token);
  else sessionStorage.removeItem(TOKEN_KEY);
}
