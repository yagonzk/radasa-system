import { test } from "node:test";
import assert from "node:assert/strict";
import {
  serviceEndpoint,
  parseDeclaration,
  messagesFrom,
  generatedOperationId,
  paymentEntries,
} from "../server/services/antt-ciot.protocol.ts";

test("business services use /api once; generator uses service root", () => {
  assert.equal(
    serviceEndpoint(
      "https://appservices-hml.antt.gov.br/pefServices",
      "DeclaracaoOperacaoTransporte",
    ),
    "https://appservices-hml.antt.gov.br/pefServices/api/DeclaracaoOperacaoTransporte",
  );
  assert.equal(
    serviceEndpoint(
      "https://appservices-hml.antt.gov.br/pefServices/api/",
      "ConsultarCIOTGerado",
    ),
    "https://appservices-hml.antt.gov.br/pefServices/api/ConsultarCIOTGerado",
  );
  assert.equal(
    serviceEndpoint(
      "https://appservices.antt.gov.br/pefServices/api",
      "gerar",
      true,
    ),
    "https://appservices.antt.gov.br/pefServices/gerar",
  );
});
test("HTTP 200 or an echoed ID never authorizes a rejected operation", () => {
  assert.equal(
    parseDeclaration(
      {
        IdOperacaoTransporte: "560000123456",
        CodigoVerificador: "1234",
        Codigo: "205",
      },
      "560000123456",
    ).success,
    false,
  );
  assert.equal(
    parseDeclaration(
      { IdOperacaoTransporte: "560000123456", Codigo: "110" },
      "560000123456",
    ).success,
    false,
  );
});
test("authorization requires success code and matching official ID; preserves verifier zeros", () => {
  const r = parseDeclaration(
    {
      IdOperacaoTransporte: "560000123456",
      CodigoVerificador: 4,
      Codigo: "110",
    },
    "560000123456",
  );
  assert.equal(r.success, true);
  assert.equal(r.verifier, "0004");
  assert.equal(
    parseDeclaration(
      {
        IdOperacaoTransporte: "560000999999",
        CodigoVerificador: "1234",
        Codigo: "110",
      },
      "560000123456",
    ).success,
    false,
  );
});
test("rejections encoded as JSON arrays remain readable", () => {
  assert.deepEqual(
    messagesFrom({ Mensagem: '["RNTRC inválido","Placa inválida"]' }),
    ["RNTRC inválido", "Placa inválida"],
  );
});
test("generator returns only a validated official identifier", () => {
  assert.equal(
    generatedOperationId({ Sucesso: true, Dados: { CIOT: "560000123456" } }),
    "560000123456",
  );
  assert.throws(() =>
    generatedOperationId({ Sucesso: false, Dados: { CIOT: "560000123456" } }),
  );
  assert.throws(() =>
    generatedOperationId({ Sucesso: true, Dados: { CIOT: "invalid" } }),
  );
});
test("installments are individual InfPagamento entries, never nested Parcelas", () => {
  const entries = paymentEntries({ TipoPagamento: 2, IndPagamento: 1 }, [
    { numeroParcela: 1, dataVencimento: "2026-10-20", valorParcela: 100 },
    { numeroParcela: 2, dataVencimento: "2026-10-30", valorParcela: 200 },
  ]);
  assert.equal(entries.length, 2);
  assert.equal(entries[1].NumeroParcela, 2);
  assert.equal(entries[1].ValorParcela, 200);
  assert.equal("Parcelas" in entries[0], false);
  assert.deepEqual(
    paymentEntries({ IndPagamento: 0 }, [
      { numeroParcela: 1, dataVencimento: "2026-10-20", valorParcela: 100 },
    ]),
    [{ IndPagamento: 0 }],
  );
});
