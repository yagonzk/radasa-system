/**
 * Emitentes NF-e do Agro. Dados e PFX permanecem criptografados no computador,
 * dentro da pasta protegida do conector. Somente Worker autenticado acessa APIs.
 * Nesta etapa há validação de certificado e status de homologação, SEM emissão.
 */
import fs from "node:fs/promises";
import path from "node:path";
import https from "node:https";
import tls from "node:tls";
import { randomBytes, createCipheriv, createDecipheriv, scryptSync } from "node:crypto";

const MAX_BYTES = 5 * 1024 * 1024;
const VALID_UFS = new Set("AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO".split(" "));
const NFE_STATUS_HOMOLOGACAO = Object.freeze({
  MT: { cUF: "51", url: "https://homologacao.sefaz.mt.gov.br/nfews/v2/services/NfeStatusServico4" },
  RO: { cUF: "11", url: "https://nfe-homologacao.svrs.rs.gov.br/ws/NfeStatusServico/NfeStatusServico4.asmx" },
});
const onlyDigits = (v) => String(v ?? "").replace(/\D/g, "");
export function validCnpj(value) {
  const digits = onlyDigits(value);
  if (!/^\d{14}$/.test(digits) || /^(\d)\1{13}$/.test(digits)) return false;
  const check = (length) => {
    const factors = length === 12 ? [5,4,3,2,9,8,7,6,5,4,3,2] : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    const sum = factors.reduce((s, n, i) => s + Number(digits[i]) * n, 0);
    const mod = sum % 11;
    return String(mod < 2 ? 0 : 11 - mod) === digits[length];
  };
  return check(12) && check(13);
}
export function validateIssuerInput(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("INVALID_REQUEST");
  const cnpj = onlyDigits(body.cnpj);
  const uf = String(body.uf || "").toUpperCase().trim();
  const ie = onlyDigits(body.inscricaoEstadual);
  const nome = String(body.nome || "").trim().slice(0, 120);
  if (!validCnpj(cnpj)) throw new Error("INVALID_CNPJ");
  if (!VALID_UFS.has(uf)) throw new Error("INVALID_UF");
  if (ie.length < 2 || ie.length > 14) throw new Error("INVALID_INSCRICAO_ESTADUAL");
  if (!/^[A-Za-z0-9+/]+={0,2}$/.test(String(body.pfxBase64 || ""))) throw new Error("INVALID_PFX");
  const pfx = Buffer.from(body.pfxBase64, "base64");
  if (pfx.length < 200 || pfx.length > 3 * 1024 * 1024) throw new Error("INVALID_PFX_SIZE");
  if (typeof body.pfxPassword !== "string" || !body.pfxPassword.length || body.pfxPassword.length > 512)
    throw new Error("INVALID_PFX_PASSWORD");
  return { cnpj, uf, ie, nome, pfx, password: body.pfxPassword };
}

// O próprio Node apresenta o PFX em um handshake TLS APENAS em localhost para
// inspecionar o certificado público, sem utilitários externos e sem exportar a chave.
export async function inspectPfx(pfx, password, cnpj) {
  let server;
  try {
    tls.createSecureContext({ pfx, passphrase: password, minVersion: "TLSv1.2" });
    server = tls.createServer({ pfx, passphrase: password, minVersion: "TLSv1.2" }, (socket) => socket.end());
    await new Promise((resolve, reject) => {
      server.once("error", reject);
      server.listen(0, "127.0.0.1", () => { server.off("error", reject); resolve(); });
    });
    const port = server.address().port;
    const cert = await new Promise((resolve, reject) => {
      const socket = tls.connect({ host: "127.0.0.1", port, rejectUnauthorized: false, servername: undefined, timeout: 5000 }, () => {
        const result = socket.getPeerCertificate();
        socket.end();
        if (!result?.subject?.CN) reject(new Error("CERTIFICATE_NO_IDENTITY"));
        else resolve(result);
      });
      socket.once("error", reject);
      socket.once("timeout", () => { socket.destroy(); reject(new Error("CERTIFICATE_TIMEOUT")); });
    });
    const commonName = String(cert.subject.CN || "");
    // e-CNPJ ICP-Brasil tem CPF/CNPJ no CN; falha fechado se não houver prova.
    if (!commonName.includes(`:${cnpj}`) && !commonName.includes(`/${cnpj}`))
      throw new Error("CERTIFICATE_CNPJ_MISMATCH");
    const expiry = new Date(cert.valid_to);
    if (!Number.isFinite(expiry.getTime()) || expiry.getTime() <= Date.now()) throw new Error("CERTIFICATE_EXPIRED");
    const start = new Date(cert.valid_from);
    if (start.getTime() > Date.now()) throw new Error("CERTIFICATE_NOT_YET_VALID");
    return { titular: commonName.slice(0, 120), expiresAt: expiry.toISOString(), serialNumber: String(cert.serialNumber || "").slice(0, 100) };
  } catch (error) {
    if (/^CERTIFICATE_/.test(String(error?.message || ""))) throw error;
    throw new Error("INVALID_CERTIFICATE_OR_PASSWORD");
  } finally {
    if (server) await new Promise((resolve) => server.close(() => resolve()));
  }
}

function cipherKey(token) { return scryptSync(token, "radasa-agro-nfe-emissores-v1", 32); }
export function sealPayload(payload, token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", cipherKey(token), iv);
  const data = Buffer.concat([cipher.update(JSON.stringify(payload), "utf8"), cipher.final()]);
  return Buffer.concat([Buffer.from("AGNE1"), iv, cipher.getAuthTag(), data]);
}
export function openPayload(buffer, token) {
  if (buffer.subarray(0, 5).toString() !== "AGNE1" || buffer.length < 33) throw new Error("ISSUER_VAULT_CORRUPTED");
  try {
    const decipher = createDecipheriv("aes-256-gcm", cipherKey(token), buffer.subarray(5, 17));
    decipher.setAuthTag(buffer.subarray(17, 33));
    return JSON.parse(Buffer.concat([decipher.update(buffer.subarray(33)), decipher.final()]).toString("utf8"));
  } catch { throw new Error("ISSUER_VAULT_UNREADABLE"); }
}
const publicIssuer = (i) => ({ cnpj: i.cnpj, nome: i.nome, uf: i.uf, inscricaoEstadual: i.ie,
  titularCertificado: i.cert.titular, certificadoValidoAte: i.cert.expiresAt,
  homologacao: i.homologacao || null, ultimaValidacao: i.ultimaValidacao || null });

export function nfeStatusSoap(cUF) {
  return `<?xml version="1.0" encoding="utf-8"?><soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope"><soap12:Body><nfeDadosMsg xmlns="http://www.portalfiscal.inf.br/nfe/wsdl/NFeStatusServico4"><consStatServ versao="4.00" xmlns="http://www.portalfiscal.inf.br/nfe"><tpAmb>2</tpAmb><cUF>${cUF}</cUF><xServ>STATUS</xServ></consStatServ></nfeDadosMsg></soap12:Body></soap12:Envelope>`;
}
export function parseNfeStatus(xml) {
  const status = /<(?:[\w-]+:)?cStat(?:\s[^>]*)?>\s*(\d{3})\s*<\/(?:[\w-]+:)?cStat>/.exec(xml)?.[1];
  const reason = /<(?:[\w-]+:)?xMotivo(?:\s[^>]*)?>\s*([^<]{1,250})\s*<\/(?:[\w-]+:)?xMotivo>/.exec(xml)?.[1];
  return { cStat: status || null, motivo: reason || null, disponivel: status === "107" };
}
export async function testNfeHomologacao(issuer) {
  const config = NFE_STATUS_HOMOLOGACAO[issuer.uf];
  if (!config) throw new Error("UF_HOMOLOGATION_NOT_IMPLEMENTED");
  const requestBody = nfeStatusSoap(config.cUF);
  const url = new URL(config.url);
  return new Promise((resolve, reject) => {
    const req = https.request({ hostname: url.hostname, port: 443, path: url.pathname, method: "POST",
      pfx: Buffer.from(issuer.pfxBase64, "base64"), passphrase: issuer.password,
      rejectUnauthorized: true, minVersion: "TLSv1.2", timeout: 15000,
      headers: { "Content-Type": "application/soap+xml; charset=utf-8", "Accept": "application/soap+xml, text/xml",
        "Content-Length": Buffer.byteLength(requestBody) } }, (res) => {
      let bytes = 0; const chunks = [];
      res.on("data", (c) => { bytes += c.length; if (bytes > 100_000) req.destroy(new Error("RESPONSE_TOO_LARGE")); else chunks.push(c); });
      res.on("end", () => { const body = Buffer.concat(chunks).toString("utf8");
        const parsed = parseNfeStatus(body);
        resolve({ ambiente: "homologacao", uf: issuer.uf, httpStatus: res.statusCode, ...parsed,
          conectividade: res.statusCode === 200 && parsed.disponivel ? "OK" : "FALHOU",
          mensagem: parsed.motivo || (res.statusCode === 200 ? "Resposta SEFAZ sem cStat reconhecido." : "Serviço SEFAZ indisponível ou rejeitou a requisição."),
          // StatusServico não comprova IE habilitada ou autorização de emissão.
          observacao: "Teste de comunicação mTLS e status da SEFAZ; não confirma credenciamento para emissão." });
      });
      res.on("error", reject);
    });
    req.on("timeout", () => req.destroy(new Error("SEFAZ_TIMEOUT")));
    req.on("error", reject);
    req.end(requestBody);
  });
}

export function createAgroNfeHandler({ token, vaultPath }) {
  let lock = Promise.resolve();
  async function load() {
    try { return openPayload(await fs.readFile(vaultPath), token); }
    catch (e) { if (e?.code === "ENOENT") return { issuers: {} }; throw e; }
  }
  async function save(payload) {
    const tmp = `${vaultPath}.${process.pid}.tmp`;
    await fs.writeFile(tmp, sealPayload(payload, token), { mode: 0o600, flag: "w" });
    await fs.rename(tmp, vaultPath);
  }
  function mutate(fn) {
    const task = lock.then(fn);
    lock = task.catch(() => undefined);
    return task;
  }
  return async function agroNfeHandler(method, route, input) {
    if (method === "GET" && route === "/v1/agro/nfe/emitentes") {
      const { issuers } = await load();
      return { emitentes: Object.values(issuers).map(publicIssuer).sort((a, b) => a.cnpj.localeCompare(b.cnpj)) };
    }
    if (method === "POST" && route === "/v1/agro/nfe/emitentes") return mutate(async () => {
      const submitted = validateIssuerInput(input);
      const cert = await inspectPfx(submitted.pfx, submitted.password, submitted.cnpj);
      const vault = await load();
      const previous = vault.issuers[submitted.cnpj];
      const issuer = { cnpj: submitted.cnpj, uf: submitted.uf, ie: submitted.ie, nome: submitted.nome,
        cert, pfxBase64: submitted.pfx.toString("base64"), password: submitted.password,
        homologacao: null, ultimaValidacao: null };
      vault.issuers[submitted.cnpj] = issuer;
      await save(vault);
      return { emitente: publicIssuer(issuer), atualizado: Boolean(previous), validacao: "CERTIFICADO_VALIDADO" };
    });
    const testMatch = /^\/v1\/agro\/nfe\/emitentes\/(\d{14})\/homologacao$/.exec(route);
    if (method === "POST" && testMatch) return mutate(async () => {
      const vault = await load(); const issuer = vault.issuers[testMatch[1]];
      if (!issuer) throw new Error("ISSUER_NOT_FOUND");
      let result;
      try { result = await testNfeHomologacao(issuer); }
      catch (error) { result = { ambiente: "homologacao", uf: issuer.uf, conectividade: "FALHOU", mensagem: String(error?.message || "CONNECTION_FAILED").slice(0, 120) }; }
      issuer.homologacao = result;
      issuer.ultimaValidacao = new Date().toISOString();
      await save(vault);
      return { emitente: publicIssuer(issuer), resultado: result };
    });
    if (method === "DELETE" && /^\/v1\/agro\/nfe\/emitentes\/\d{14}$/.test(route)) return mutate(async () => {
      const cnpj = route.split("/").pop(); const vault = await load();
      if (!vault.issuers[cnpj]) throw new Error("ISSUER_NOT_FOUND");
      delete vault.issuers[cnpj]; await save(vault);
      return { ok: true };
    });
    throw new Error("NOT_FOUND");
  };
}

export const AGRO_NFE_MAX_BYTES = MAX_BYTES;
