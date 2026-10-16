import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { validCnpj, validateIssuerInput, inspectPfx, sealPayload, openPayload, nfeStatusSoap, parseNfeStatus, createAgroNfeHandler } from "../ciot-conector/agro-nfe.mjs";

const cnpj = "15209274000162";
test("CNPJ correto e dígitos verificadores", () => {
  assert.equal(validCnpj(cnpj), true);
  assert.equal(validCnpj("15.209.274/0001-62"), true);
  assert.equal(validCnpj("15209274000163"), false);
  assert.equal(validCnpj("11111111111111"), false);
});
test("PFX e senha obrigatórios, tamanho e IE", () => {
  const fake = Buffer.alloc(300, 3).toString("base64");
  assert.throws(() => validateIssuerInput({cnpj, uf: "MT", inscricaoEstadual: "123456", pfxBase64: fake, pfxPassword: ""}), /INVALID_PFX_PASSWORD/);
  assert.throws(() => validateIssuerInput({cnpj, uf: "XX", inscricaoEstadual: "123456", pfxBase64: fake, pfxPassword: "ok"}), /INVALID_UF/);
  assert.throws(() => validateIssuerInput({cnpj: "123", uf: "MT", inscricaoEstadual: "123456", pfxBase64: fake, pfxPassword: "ok"}), /INVALID_CNPJ/);
});
test("cofre criptografado: sem texto claro e adulteração bloqueada", () => {
  const key = "f".repeat(64);
  const secret = { issuers: {[cnpj]:{password:"SEGREDO-MUITO-SENSIVEL", pfxBase64:"BASE64-SENSIVEL"}} };
  const encrypted = sealPayload(secret, key);
  assert.equal(encrypted.includes(Buffer.from("SEGREDO-MUITO-SENSIVEL")), false);
  assert.deepEqual(openPayload(encrypted, key), secret);
  assert.throws(() => openPayload(encrypted, "e".repeat(64)), /ISSUER_VAULT_UNREADABLE/);
  const changed = Buffer.from(encrypted); changed[changed.length-1] ^= 1;
  assert.throws(() => openPayload(changed, key), /ISSUER_VAULT_UNREADABLE/);
});
test("SOAP somente homologação, UF=MT; interpretação de retorno 107", () => {
  assert.match(nfeStatusSoap("51"), /<tpAmb>2<\/tpAmb>/);
  assert.match(nfeStatusSoap("51"), /<cUF>51<\/cUF>/);
  assert.equal(parseNfeStatus('<nfe:cStat>107</nfe:cStat><nfe:xMotivo>Servico em Operacao</nfe:xMotivo>').disponivel, true);
  assert.equal(parseNfeStatus('<cStat>108</cStat>').disponivel, false);
  assert.equal(parseNfeStatus('<nfeStatus>111</nfeStatus>').disponivel, false);
});

test("certificado PFX: CN pertence ao CNPJ, senha, datas e isolamento do cofre", async (t) => {
  let dir = "";
  try {
    dir = await mkdtemp(path.join(os.tmpdir(), "radasa-nfe-test-"));
    const key = path.join(dir,"key.pem"), crt = path.join(dir,"cert.pem"), pfx = path.join(dir,"demo.pfx");
    execFileSync("openssl", ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", crt, "-subj", `/CN=EMITENTE-TESTE:${cnpj}`, "-days", "3"], {stdio: "ignore"});
    execFileSync("openssl", ["pkcs12", "-export", "-out", pfx, "-inkey", key, "-in", crt, "-passout", "pass:senha123"], {stdio: "ignore"});
    const bytes = await readFile(pfx);
    const info = await inspectPfx(bytes, "senha123", cnpj);
    assert.match(info.titular, /EMITENTE-TESTE/);
    await assert.rejects(() => inspectPfx(bytes, "senhaErrada", cnpj), /INVALID_CERTIFICATE_OR_PASSWORD/);
    await assert.rejects(() => inspectPfx(bytes, "senha123", "11222333000181"), /CERTIFICATE_CNPJ_MISMATCH/);
    const vaultPath = path.join(dir, "emitentes.enc");
    const handler = createAgroNfeHandler({token: "z".repeat(64), vaultPath});
    const posted = await handler("POST", "/v1/agro/nfe/emitentes", {cnpj, uf: "MT", inscricaoEstadual: "123456789", nome: "Produtor Demo", pfxBase64: bytes.toString("base64"), pfxPassword: "senha123"});
    assert.equal(posted.validacao, "CERTIFICADO_VALIDADO");
    const list = await handler("GET", "/v1/agro/nfe/emitentes", {});
    assert.equal(list.emitentes.length, 1);
    assert.equal(list.emitentes[0].cnpj, cnpj);
    assert.equal(JSON.stringify(list).includes("senha123"), false);
    const raw = await readFile(vaultPath);
    assert.equal(raw.includes(Buffer.from("senha123")), false);
    assert.equal(raw.includes(bytes), false);
    assert.deepEqual(await handler("DELETE", `/v1/agro/nfe/emitentes/${cnpj}`, {}), {ok:true});
    assert.equal((await handler("GET", "/v1/agro/nfe/emitentes", {})).emitentes.length, 0);
  } catch (err) {
    if (err?.code === "ENOENT") t.skip("OpenSSL não instalado neste ambiente de teste");
    else throw err;
  } finally {
    if (dir) await rm(dir, {recursive:true, force:true});
  }
});

test("roteamento protegido do conector, sem exposição de senha no log", async () => {
  const { readFileSync } = await import("node:fs");
  const root = path.resolve(import.meta.dirname, "..");
  const server = readFileSync(path.join(root, "ciot-conector/servidor.mjs"), "utf8");
  const backend = readFileSync(path.join(root, "server/routes/agro-nfe.routes.ts"), "utf8");
  const audit = readFileSync(path.join(root, "server/middlewares/audit-log.ts"), "utf8");
  assert.match(server, /constantTimeTokenMatch/);
  assert.match(backend, /requireRole\("ADMIN"\)/);
  assert.match(backend, /redirect: "manual"/);
  assert.match(audit, /"pfxBase64", "pfxPassword"/);
  assert.match(backend, /ciot\.radasa\.com\.br/);
});
