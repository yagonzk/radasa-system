import { AsyncLocalStorage } from "node:async_hooks";

type HyperdriveBinding = { connectionString: string };

export type WorkerRuntimeBindings = {
  HYPERDRIVE?: HyperdriveBinding;
  RESEND_API_KEY?: string;
  VEICULO_CONSULTA_API_URL?: string;
  VEICULO_CONSULTA_API_TOKEN?: string;
  SENATRAN_RENAVAM_API_URL?: string;
  SENATRAN_API_TOKEN?: string;
  SENATRAN_CPF_USUARIO?: string;
};

type RuntimeBindingScope = {
  databaseUrl?: string;
  resendApiKey?: string;
  vehicleLookupApiUrl?: string;
  vehicleLookupApiToken?: string;
  senatranRenavamApiUrl?: string;
  senatranApiToken?: string;
  senatranCpfUsuario?: string;
};

const runtimeBindings = new AsyncLocalStorage<RuntimeBindingScope>();

export function runWithRuntimeBindings<T>(
  bindings: WorkerRuntimeBindings,
  callback: () => T,
): T {
  const scope: RuntimeBindingScope = {
    databaseUrl: bindings.HYPERDRIVE?.connectionString,
    resendApiKey: bindings.RESEND_API_KEY,
    vehicleLookupApiUrl: bindings.VEICULO_CONSULTA_API_URL,
    vehicleLookupApiToken: bindings.VEICULO_CONSULTA_API_TOKEN,
    senatranRenavamApiUrl: bindings.SENATRAN_RENAVAM_API_URL,
    senatranApiToken: bindings.SENATRAN_API_TOKEN,
    senatranCpfUsuario: bindings.SENATRAN_CPF_USUARIO,
  };
  return runtimeBindings.run(scope, callback);
}

export function getRuntimeDatabaseUrl() {
  return runtimeBindings.getStore()?.databaseUrl;
}

export function getRuntimeResendApiKey() {
  return runtimeBindings.getStore()?.resendApiKey;
}

export function getRuntimeSenatranConfig() {
  const scope=runtimeBindings.getStore();
  return {
    baseUrl: scope?.senatranRenavamApiUrl || process.env.SENATRAN_RENAVAM_API_URL || "",
    token: scope?.senatranApiToken || process.env.SENATRAN_API_TOKEN || "",
    cpfUsuario: scope?.senatranCpfUsuario || process.env.SENATRAN_CPF_USUARIO || "",
  };
}

export function getRuntimeVehicleLookupConfig() {
  const scope=runtimeBindings.getStore();
  return {
    baseUrl: scope?.vehicleLookupApiUrl || process.env.VEICULO_CONSULTA_API_URL || scope?.senatranRenavamApiUrl || process.env.SENATRAN_RENAVAM_API_URL || "",
    token: scope?.vehicleLookupApiToken || process.env.VEICULO_CONSULTA_API_TOKEN || scope?.senatranApiToken || process.env.SENATRAN_API_TOKEN || "",
  };
}
