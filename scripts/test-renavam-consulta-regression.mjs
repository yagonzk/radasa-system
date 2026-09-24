import assert from "node:assert/strict";
import { buildRenavamConsultaRequest } from "../server/services/renavam-request.js";

const req = buildRenavamConsultaRequest({
  baseUrl: "https://consulta.exemplo/api",
  renavam: "01264380841",
  placa: "RAU-3I63",
  cnpj: "12.345.678/0001-90",
  token: "abc123",
});
assert.equal(req.method, "GET");
assert.match(req.url, /renavam=01264380841/);
assert.match(req.url, /placa=RAU3I63/);
assert.match(req.url, /cnpj=12345678000190/);
assert.equal(req.headers.Authorization, "Bearer abc123");
assert.equal("x-cpf-usuario" in req.headers, false);

const templated = buildRenavamConsultaRequest({
  baseUrl: "https://consulta.exemplo/{cnpj}/{placa}/{renavam}",
  renavam: "01264380841", placa: "RAU-3I63", cnpj: "12.345.678/0001-90"
});
assert.equal(templated.url, "https://consulta.exemplo/12345678000190/RAU3I63/01264380841");
console.log("renavam consulta regression: ok");
