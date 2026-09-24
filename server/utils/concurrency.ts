export type IdDiff = {
  toRemove: string[];
  toAdd: string[];
  toKeep: string[];
};

export function diffIds(current: Iterable<string>, next: Iterable<string>): IdDiff {
  const currentSet = new Set(Array.from(current, (value) => String(value)).filter(Boolean));
  const nextSet = new Set(Array.from(next, (value) => String(value)).filter(Boolean));
  return {
    toRemove: [...currentSet].filter((id) => !nextSet.has(id)),
    toAdd: [...nextSet].filter((id) => !currentSet.has(id)),
    toKeep: [...nextSet].filter((id) => currentSet.has(id)),
  };
}

export function assertEditVersion(expected: number, received: unknown) {
  if (received == null || received === "") return;
  const parsed = Number(received);
  if (Number.isInteger(parsed) && parsed === expected) return;
  const error = new Error(
    "Este acerto foi alterado por outra requisição. Reabra a viagem antes de salvar novamente.",
  ) as Error & { code?: string; statusCode?: number };
  error.code = "EDIT_VERSION_CONFLICT";
  error.statusCode = 409;
  throw error;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return [];
  const concurrency = Math.max(1, Math.min(Math.floor(limit) || 1, items.length));
  const results = new Array<R>(items.length);
  let cursor = 0;

  const runners = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor++;
      if (index >= items.length) return;
      results[index] = await worker(items[index], index);
    }
  });

  await Promise.all(runners);
  return results;
}

type AsyncTask<T = unknown> = () => Promise<T>;

/**
 * Executa consultas heterogeneas respeitando o pequeno pool local do Prisma.
 * Mantem a ordem dos resultados para permitir destructuring com tipagem de tupla.
 */
export async function runWithConcurrency<T extends readonly AsyncTask<any>[]>(
  tasks: T,
  limit = 2,
): Promise<{ [K in keyof T]: T[K] extends AsyncTask<infer R> ? R : never }> {
  const results = new Array<unknown>(tasks.length);
  await mapWithConcurrency(tasks, limit, async (task, index) => {
    results[index] = await task();
  });
  return results as { [K in keyof T]: T[K] extends AsyncTask<infer R> ? R : never };
}
