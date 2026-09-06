import { AsyncLocalStorage } from "node:async_hooks";

type HyperdriveBinding = { connectionString: string };

export type WorkerRuntimeBindings = {
  HYPERDRIVE?: HyperdriveBinding;
  RESEND_API_KEY?: string;
};

type RuntimeBindingScope = {
  databaseUrl?: string;
  resendApiKey?: string;
};

const runtimeBindings = new AsyncLocalStorage<RuntimeBindingScope>();

export function runWithRuntimeBindings<T>(
  bindings: WorkerRuntimeBindings,
  callback: () => T,
): T {
  const scope: RuntimeBindingScope = {
    databaseUrl: bindings.HYPERDRIVE?.connectionString,
    resendApiKey: bindings.RESEND_API_KEY,
  };
  return runtimeBindings.run(scope, callback);
}

export function getRuntimeDatabaseUrl() {
  return runtimeBindings.getStore()?.databaseUrl;
}

export function getRuntimeResendApiKey() {
  return runtimeBindings.getStore()?.resendApiKey;
}
