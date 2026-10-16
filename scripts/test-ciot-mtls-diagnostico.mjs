import assert from "node:assert/strict";
import { test } from "node:test";
import { buildConsultationPayload, summarizeConsultation, runDiagnostic } from "./diagnosticar-antt-mtls.mjs";

test("consulta RNTRC usa os mesmos campos do Worker sem emitir CIOT", () => {
  const result = buildConsultationPayload("15.209.274/0001-62", "51312577");
  assert.deepEqual(result, {
    CpfCnpjInteressado: "15209274000162",
    CpfCnpjTransportador: "15209274000162",
    RNTRCTransportador: "051312577",
  });
});

test("bloqueia CNPJ e RNTRC inválidos antes de acessar certificado", () => {
  assert.throws(() => buildConsultationPayload("a", "1"), /CNPJ/);
  assert.throws(() => buildConsultationPayload("15209274000162", "1"), /RNTRC/);
});

test("mantém só campos públicos essenciais de um resultado oficial", () => {
  const result = summarizeConsultation(200, { server: "Microsoft-IIS/10", "content-type": "application/json" },
    JSON.stringify({ Codigo: "111", RNTRCAtivo: true, TipoTransportador: "ETC", EquiparadoTAC: false, Senha: "NÃO_EXIBIR" }));
  assert.equal(result.codigo, "111");
  assert.equal(result.rntrcAtivo, true);
  assert.equal(JSON.stringify(result).includes("NÃO_EXIBIR"), false);
});

test("500 sem conteúdo preserva metadados e oculta corpo", () => {
  assert.deepEqual(summarizeConsultation(500, { server: "cloudflare", "cf-ray": "x-ABC", "content-type": "" }, ""), {
    httpStatus: 500, contentType: "", server: "cloudflare", cfRay: "x-ABC", responseEmpty: true, jsonValid: false,
  });
});

test("falha de ambiente antes de iniciar consulta externa", async () => {
  await assert.rejects(runDiagnostic({ environment: "outro", pfxFile: "/missing", passphrase: "x", cnpj: "", rntrc: "" }), /Ambiente/);
});
