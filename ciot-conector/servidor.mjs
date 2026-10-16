/** Conector CIOT local: recebe somente chamadas autenticadas do Worker e aplica mTLS com PFX no PC. */
import http from "node:http";
import https from "node:https";
import fs from "node:fs/promises";
import { timingSafeEqual } from "node:crypto";
import { pathToFileURL } from "node:url";
import path from "node:path";
import { createAgroNfeHandler, AGRO_NFE_MAX_BYTES } from "./agro-nfe.mjs";

export const CIOT_ALLOWED_SERVICES = Object.freeze(new Set([
  "ConsultarSituacaoTransportador", "ConsultarFrotaTransportador",
  "DeclaracaoOperacaoTransporte", "CancelamentoOperacaoTransporte",
  "RetificacaoOperacaoTransporte", "EncerramentoOperacaoTransporte",
  "ConsultarCIOTGerado", "ConsultarExcecao",
]));
const GENERATOR_SERVICES = new Set(["token", "gerar"]);
const HOSTS = Object.freeze({
  homologacao: "appservices-hml.antt.gov.br",
  producao: "appservices.antt.gov.br",
});
const MAX_INPUT_BYTES = 512 * 1024;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;

const digits = (value) => String(value ?? "").replace(/\D/g, "");
const badRequest = (code) => Object.assign(new Error(code), { publicCode: code });
export function constantTimeTokenMatch(provided, expected) {
  if (!provided || !expected || provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}
export function validateBridgeRequest(input, cnpj, environment) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw badRequest("INVALID_REQUEST");
  if (digits(input.companyCnpj) !== cnpj) throw badRequest("COMPANY_MISMATCH");
  if (input.environment !== environment) throw badRequest("ENVIRONMENT_MISMATCH");
  const path = input.path;
  const generator = input.generator === true;
  if (typeof path !== "string" || !(generator ? GENERATOR_SERVICES : CIOT_ALLOWED_SERVICES).has(path))
    throw badRequest("SERVICE_NOT_ALLOWED");
  if (!['GET', 'POST'].includes(input.method)) throw badRequest("METHOD_NOT_ALLOWED");
  if (generator && input.method !== "POST") throw badRequest("METHOD_NOT_ALLOWED");
  if (input.method === "GET" && (!input.payload || typeof input.payload !== "object" || Array.isArray(input.payload)))
    throw badRequest("INVALID_QUERY");
  const headers = input.headers || {};
  if (!headers || typeof headers !== "object" || Array.isArray(headers) ||
      Object.keys(headers).some((key) => !["chave", "Authorization"].includes(key)))
    throw badRequest("HEADER_NOT_ALLOWED");
  for (const value of Object.values(headers)) {
    if (typeof value !== "string" || value.length > 2048 || /[\r\n]/.test(value))
      throw badRequest("INVALID_HEADER");
  }
  if (!generator && Object.keys(headers).length) throw badRequest("HEADER_NOT_ALLOWED");
  return { path, generator, method: input.method, payload: input.payload, headers };
}

export function anttRequest({ pfx, password, environment, timeoutMs = 60_000 }, job) {
  const hostname = HOSTS[environment];
  if (!hostname) throw badRequest("ENVIRONMENT_MISMATCH");
  let pathname = `/pefServices/${job.generator ? "" : "api/"}${job.path}`;
  if (job.method === "GET") {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(job.payload)) {
      if (!/^[A-Za-z0-9_]{1,80}$/.test(key) || !["string", "number", "boolean"].includes(typeof value))
        throw badRequest("INVALID_QUERY");
      query.set(key, String(value));
    }
    pathname += `?${query.toString()}`;
  }
  const body = job.method === "POST" ? JSON.stringify(job.payload ?? {}) : null;
  if (body && Buffer.byteLength(body) > MAX_INPUT_BYTES) throw badRequest("PAYLOAD_TOO_LARGE");
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: "https:", hostname, port: 443, path: pathname,
      method: job.method, pfx, passphrase: password,
      minVersion: "TLSv1.2", rejectUnauthorized: true,
      timeout: timeoutMs,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(body ? { "Content-Length": Buffer.byteLength(body) } : {}),
        ...job.headers,
      },
    }, (res) => {
      let total = 0;
      const parts = [];
      res.on("data", (chunk) => {
        total += chunk.length;
        if (total > MAX_OUTPUT_BYTES) { req.destroy(badRequest("RESPONSE_TOO_LARGE")); return; }
        parts.push(chunk);
      });
      res.on("error", reject);
      res.on("end", () => resolve({
        httpStatus: res.statusCode ?? 502,
        contentType: String(res.headers["content-type"] ?? "").slice(0, 100),
        server: String(res.headers.server ?? "").slice(0, 100),
        cfRay: String(res.headers["cf-ray"] ?? "").slice(0, 80),
        body: Buffer.concat(parts).toString("utf8"),
      }));
    });
    req.on("timeout", () => req.destroy(new Error("TIMEOUT")));
    req.on("error", reject);
    req.end(body || undefined);
  });
}

export async function startConnector(config = process.env) {
  const pfxFile = config.CIOT_BRIDGE_PFX;
  const password = config.CIOT_BRIDGE_PFX_PASSWORD;
  const token = config.CIOT_BRIDGE_SHARED_TOKEN;
  const cnpj = digits(config.CIOT_BRIDGE_CNPJ);
  const environment = config.CIOT_BRIDGE_ENVIRONMENT || "homologacao";
  if (!pfxFile || !password || !token || token.length < 48 || !/^\d{14}$/.test(cnpj) || !HOSTS[environment])
    throw new Error("Configuração local CIOT incompleta ou inválida.");
  if (environment === "producao" && config.CIOT_BRIDGE_ALLOW_PRODUCTION !== "SIM")
    throw new Error("Produção bloqueada: exige habilitação explícita e revisão operacional.");
  const port = Number(config.CIOT_BRIDGE_PORT || 8789);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error("Porta do conector inválida.");
  const pfx = await fs.readFile(pfxFile);
  // Falha no startup se certificado/senha não forem válidos, sem imprimir segredos.
  const secureContext = await import("node:tls");
  secureContext.createSecureContext({ pfx, passphrase: password, minVersion: "TLSv1.2" });
  const handleAgro = createAgroNfeHandler({ token, vaultPath: path.join(path.dirname(pfxFile), "agro-nfe-emissores.enc") });
  const server = http.createServer(async (req, res) => {
    const send = (status, value) => {
      res.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" });
      res.end(JSON.stringify(value));
    };
    if (req.method === "GET" && req.url === "/health") return send(200, { ok: true, service: "ciot-local", environment });
    const agro = /^\/v1\/agro\/nfe\/emitentes(?:\/\d{14}(?:\/homologacao)?)?$/.test(String(req.url || ""));
    if (!agro && (req.method !== "POST" || req.url !== "/v1/antt")) return send(404, { error: "NOT_FOUND" });
    const provided = /^Bearer (.+)$/.exec(String(req.headers.authorization || ""))?.[1] || "";
    if (!constantTimeTokenMatch(provided, token)) return send(401, { error: "UNAUTHORIZED" });
    let bytes = 0;
    const chunks = [];
    try {
      for await (const chunk of req) {
        bytes += chunk.length;
        if (bytes > (agro ? AGRO_NFE_MAX_BYTES : MAX_INPUT_BYTES)) throw badRequest("PAYLOAD_TOO_LARGE");
        chunks.push(chunk);
      }
      let input;
      try { input = bytes ? JSON.parse(Buffer.concat(chunks).toString("utf8")) : {}; }
      catch { throw badRequest("INVALID_JSON"); }
      if (agro) {
        const output = await handleAgro(req.method, req.url, input);
        return send(200, output);
      }
      const job = validateBridgeRequest(input, cnpj, environment);
      const result = await anttRequest({ pfx, password, environment }, job);
      return send(200, result);
    } catch (error) {
      const publicCode = error?.publicCode || "UPSTREAM_TRANSPORT_FAILURE";
      const safeCode = /^[A-Z][A-Z0-9_]{2,80}$/.test(String(publicCode)) ? publicCode : "UPSTREAM_TRANSPORT_FAILURE";
      return send(safeCode === "UPSTREAM_TRANSPORT_FAILURE" ? 502 : safeCode === "ISSUER_NOT_FOUND" ? 404 : 400, { error: safeCode });
    }
  });
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, "127.0.0.1", () => { server.off("error", reject); resolve(); });
  });
  console.log(`Conector CIOT pronto em http://127.0.0.1:${port} (${environment}).`);
  return server;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  startConnector().catch((error) => {
    // Apenas codigo de erro seguro: nunca expor senha, certificado, token ou dados da requisicao.
    const rawCode = String(error?.code || "");
    const safeCode = /^[A-Z][A-Z0-9_]{0,79}$/.test(rawCode) ? rawCode : "STARTUP_ERROR";
    console.error(`CIOT_STARTUP_FAILED:${safeCode}`);
    process.exitCode = 1;
  });
}
