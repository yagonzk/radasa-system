/**
 * Consulta exclusivamente RNTRC, sem emitir, cancelar ou alterar CIOT.
 * O arquivo PFX e a senha nunca são transmitidos ao Radasa ou salvos em disco.
 * Execute localmente em Node.js com um certificado A1 de uso autorizado.
 */
import fs from "node:fs/promises";
import https from "node:https";
import { pathToFileURL } from "node:url";

const HOSTS = {
  homologacao: "appservices-hml.antt.gov.br",
  producao: "appservices.antt.gov.br",
};
const MAX_RESPONSE_BYTES = 16 * 1024;

export function buildConsultationPayload(cnpjValue, rntrcValue) {
  const cnpj = String(cnpjValue ?? "").replace(/\D/g, "");
  const rntrcDigits = String(rntrcValue ?? "").replace(/\D/g, "");
  const rntrc = rntrcDigits.length === 8 ? `0${rntrcDigits}` : rntrcDigits;
  if (!/^\d{14}$/.test(cnpj)) throw new Error("CNPJ deve possuir 14 dígitos.");
  if (!/^\d{9}$/.test(rntrc)) throw new Error("RNTRC deve possuir 9 dígitos (8 são completados à esquerda).");
  return {
    CpfCnpjInteressado: cnpj,
    CpfCnpjTransportador: cnpj,
    RNTRCTransportador: rntrc,
  };
}

export function summarizeConsultation(status, headers, body) {
  const contentType = String(headers["content-type"] ?? "").slice(0, 100);
  const server = String(headers.server ?? "").slice(0, 100);
  const cfRay = String(headers["cf-ray"] ?? "").slice(0, 80);
  const result = {
    httpStatus: status,
    contentType,
    server,
    cfRay,
    responseEmpty: !body.trim(),
    jsonValid: false,
  };
  try {
    const json = JSON.parse(body);
    if (json && typeof json === "object" && !Array.isArray(json)) {
      return {
        ...result,
        jsonValid: true,
        codigo: String(json.Codigo ?? "").slice(0, 24),
        rntrcAtivo: json.RNTRCAtivo ?? null,
        tipoTransportador: String(json.TipoTransportador ?? "").slice(0, 32),
        equiparadoTac: json.EquiparadoTAC ?? null,
      };
    }
  } catch { /* não imprimir corpo bruto para evitar dados pessoais e tokens */ }
  return result;
}

function argsFrom(argv) {
  const params = {};
  for (let i = 0; i < argv.length; i += 2) {
    const key = argv[i];
    if (!key.startsWith("--") || !argv[i + 1] || argv[i + 1].startsWith("--"))
      throw new Error("Parâmetro incompleto. Use --help.");
    params[key.slice(2)] = argv[i + 1];
  }
  if (!params.pfx) throw new Error("Informe --pfx com o caminho LOCAL do certificado A1.");
  if (!HOSTS[params.environment ?? "homologacao"])
    throw new Error("Ambiente inválido: use homologacao ou producao.");
  return params;
}

export async function runDiagnostic({ pfxFile, passphrase, cnpj, rntrc, environment = "homologacao" }) {
  const host = HOSTS[environment];
  if (!host) throw new Error("Ambiente inválido.");
  if (!passphrase) throw new Error("Senha A1 ausente: defina ANTT_PFX_PASSWORD apenas no processo local.");
  const payload = buildConsultationPayload(cnpj, rntrc);
  const pfx = await fs.readFile(pfxFile);
  const body = JSON.stringify(payload);
  return new Promise((resolve, reject) => {
    const req = https.request({
      protocol: "https:",
      hostname: host,
      port: 443,
      path: "/pefServices/api/ConsultarSituacaoTransportador",
      method: "POST",
      pfx,
      passphrase,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      timeout: 45_000,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "Content-Length": Buffer.byteLength(body),
      },
    }, (res) => {
      const chunks = [];
      let size = 0;
      res.on("data", (chunk) => {
        size += chunk.length;
        if (size > MAX_RESPONSE_BYTES) {
          req.destroy(new Error("RESPONSE_TOO_LARGE"));
          return;
        }
        chunks.push(chunk);
      });
      res.on("end", () => resolve({
        environment,
        transport: "node-https-mtls-pfx",
        ...summarizeConsultation(res.statusCode ?? 0, res.headers, Buffer.concat(chunks).toString("utf8")),
      }));
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("TIMEOUT")));
    req.on("error", reject);
    req.end(body);
  });
}

const usage = `Consulta ANTT RNTRC via mTLS local (sem alterar registros):
  node scripts/diagnosticar-antt-mtls.mjs --pfx "C:\\caminho\\certificado.pfx" --cnpj 00000000000000 --rntrc 000000000 --environment homologacao

Requer a variável ANTT_PFX_PASSWORD no ambiente LOCAL (não passe a senha como argumento).
Não anexe nem publique seu PFX ou sua senha. A consulta não emite CIOT.`;

async function main() {
  if (process.argv.includes("--help")) {
    process.stdout.write(`${usage}\n`);
    return;
  }
  try {
    const opts = argsFrom(process.argv.slice(2));
    const result = await runDiagnostic({
      pfxFile: opts.pfx,
      passphrase: process.env.ANTT_PFX_PASSWORD,
      cnpj: opts.cnpj,
      rntrc: opts.rntrc,
      environment: opts.environment ?? "homologacao",
    });
    console.log(JSON.stringify(result, null, 2));
    if (result.httpStatus !== 200 || !result.jsonValid) process.exitCode = 1;
  } catch (error) {
    // Não imprimir objetos de erro TLS, pois podem conter opções com a senha/PFX.
    const safeMessages = [
      "CNPJ deve possuir 14 dígitos.",
      "RNTRC deve possuir 9 dígitos (8 são completados à esquerda).",
      "Ambiente inválido.",
      "Ambiente inválido: use homologacao ou producao.",
      "Senha A1 ausente: defina ANTT_PFX_PASSWORD apenas no processo local.",
      "Informe --pfx com o caminho LOCAL do certificado A1.",
      "Parâmetro incompleto. Use --help.",
    ];
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    const code = error && typeof error === "object" && "code" in error && typeof error.code === "string"
      ? error.code.replace(/[^A-Z0-9_]/g, "").slice(0, 50)
      : "";
    console.error(JSON.stringify({
      ok: false,
      errorType: error instanceof Error ? error.name : "Error",
      code,
      message: safeMessages.includes(message) ? message : "Erro de transporte/certificado ou arquivo local. Verifique o PFX, senha, conexão e logs seguros no dispositivo.",
    }, null, 2));
    process.exitCode = 1;
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
