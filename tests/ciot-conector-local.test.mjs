import test from "node:test";
import assert from "node:assert/strict";
import {
  constantTimeTokenMatch, validateBridgeRequest, CIOT_ALLOWED_SERVICES,
} from "../ciot-conector/servidor.mjs";

const cnpj = "15209274000162";
const environment = "homologacao";
const inquiry = {
  companyCnpj: cnpj, environment, method: "POST", generator: false,
  path: "ConsultarSituacaoTransportador", headers: {},
  payload: { CpfCnpjTransportador: cnpj, RNTRCTransportador: "051312577" },
};
test("chave segura em comparação constante e rejeição de diferença", () => {
  const key = "a".repeat(64);
  assert.equal(constantTimeTokenMatch(key, key), true);
  assert.equal(constantTimeTokenMatch("b".repeat(64), key), false);
  assert.equal(constantTimeTokenMatch("short", key), false);
  assert.equal(constantTimeTokenMatch("", key), false);
});
test("consulta RNTRC é permitida em homologação sem alterar o payload", () => {
  assert.ok(CIOT_ALLOWED_SERVICES.has("ConsultarSituacaoTransportador"));
  const output = validateBridgeRequest(inquiry, cnpj, environment);
  assert.equal(output.path, inquiry.path);
  assert.deepEqual(output.payload, inquiry.payload);
});
test("CNPJ não pode ser trocado no lado do Worker", () => {
  assert.throws(() => validateBridgeRequest({ ...inquiry, companyCnpj: "11111111111111" }, cnpj, environment), /COMPANY_MISMATCH/);
});
test("impede apontar produção com conector de homologação", () => {
  assert.throws(() => validateBridgeRequest({ ...inquiry, environment: "producao" }, cnpj, environment), /ENVIRONMENT_MISMATCH/);
});
test("rejeita caminhos arbitrários, mesmo com autenticação", () => {
  assert.throws(() => validateBridgeRequest({ ...inquiry, path: "../../admin" }, cnpj, environment), /SERVICE_NOT_ALLOWED/);
  assert.throws(() => validateBridgeRequest({ ...inquiry, path: "https://example.com" }, cnpj, environment), /SERVICE_NOT_ALLOWED/);
});
test("valida serviços de emissão por whitelist e sem métodos perigosos", () => {
  assert.equal(validateBridgeRequest({ ...inquiry, path: "DeclaracaoOperacaoTransporte" }, cnpj, environment).path, "DeclaracaoOperacaoTransporte");
  assert.throws(() => validateBridgeRequest({ ...inquiry, method: "DELETE" }, cnpj, environment), /METHOD_NOT_ALLOWED/);
});
test("chamadas de gerador exigem sinalizador e POST", () => {
  assert.throws(() => validateBridgeRequest({ ...inquiry, path: "token" }, cnpj, environment), /SERVICE_NOT_ALLOWED/);
  assert.equal(validateBridgeRequest({ ...inquiry, generator: true, path: "token" }, cnpj, environment).path, "token");
  assert.throws(() => validateBridgeRequest({ ...inquiry, generator: true, path: "gerar", method: "GET" }, cnpj, environment), /METHOD_NOT_ALLOWED/);
});
test("cabeçalhos arbitrários e injeção de linhas são proibidos", () => {
  assert.throws(() => validateBridgeRequest({ ...inquiry, headers: { Host: "example.com" } }, cnpj, environment), /HEADER_NOT_ALLOWED/);
  assert.throws(() => validateBridgeRequest({ ...inquiry, generator: true, path: "gerar", headers: { Authorization: "Bearer ok\r\nX-Test: 1" } }, cnpj, environment), /INVALID_HEADER/);
  assert.equal(validateBridgeRequest({ ...inquiry, generator: true, path: "gerar", headers: { Authorization: "Bearer token" } }, cnpj, environment).headers.Authorization, "Bearer token");
});
