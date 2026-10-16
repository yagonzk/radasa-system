import { beforeEach, expect, it, vi } from "vitest";
const state = vi.hoisted(() => ({
  row: null as any,
  companies: [] as any[],
  companyBinding: null as any,
  bindingWinner: null as any,
  workerRedirectValidation: false,
  redirectResponse: false,
  upstreamHtml: "",
  upstreamStatus: 500,
  transportFailure: false,
  mtlsCnpj: "15209274000162",
  calls: [] as string[],
  declareCount: 0,
  failDeclaration: false,
  reject: false,
  locks: 0,
  equiparado: false,
  foreignPlate: false,
}));
vi.mock("../server/config/env.js", () => ({
  env: {
    ANTT_CIOT_ENVIRONMENT: "homologacao",
    ANTT_CIOT_BASE_URL: "https://appservices-hml.antt.gov.br/pefServices",
    ANTT_CIOT_ENABLE_NETWORK: true,
    ANTT_CIOT_TIMEOUT_MS: 1000,
    ANTT_CIOT_PATH_DECLARE: "DeclaracaoOperacaoTransporte",
    ANTT_CIOT_PATH_QUERY: "ConsultarCIOTGerado",
    ANTT_CIOT_PATH_TRANSPORTER: "ConsultarSituacaoTransportador",
    ANTT_CIOT_PATH_FLEET: "ConsultarFrotaTransportador",
  },
}));
vi.mock("../server/lib/prisma.js", () => ({
  prisma: {
    empresa: {
      findUnique: async ({ where }: any) =>
        structuredClone(state.companies.find((c) => c.id === where.id) ?? null),
      findMany: async () =>
        structuredClone(state.companies.filter((c) => c.ativa)),
      findFirst: async () =>
        structuredClone(state.companies.find((c) => c.ativa) ?? null),
    },
    configuracaoSistema: {
      findUnique: async () => structuredClone(state.companyBinding),
      upsert: async ({ create }: any) => {
        state.companyBinding ??= structuredClone(state.bindingWinner || create);
        return structuredClone(state.companyBinding);
      },
    },
    ciot: {
      findUnique: async () => structuredClone(state.row),
      update: async ({ data, where }: any) => {
        if (where.status && !where.status.in.includes(state.row.status))
          throw new Error("Conflict");
        Object.assign(state.row, data);
        return structuredClone(state.row);
      },
      updateMany: async () => {
        if (
          !["RASCUNHO", "PRONTO_ENVIO", "REJEITADO"].includes(state.row.status)
        )
          return { count: 0 };
        state.row.status = "PROCESSANDO";
        state.locks++;
        return { count: 1 };
      },
    },
  },
}));
vi.mock("../server/lib/runtime-bindings.js", () => ({
  getRuntimeAnttMtls: () => ({
    cnpj: state.mtlsCnpj,
    binding: {
      fetch: async (input: URL, init: RequestInit) => {
        if (
          state.workerRedirectValidation &&
          !["manual", "follow"].includes(String(init.redirect))
        )
          throw new TypeError(
            'Invalid redirect value, must be one of "follow" or "manual"',
          );
        const path = new URL(input).pathname;
        state.calls.push(path);
        if (state.transportFailure) throw new TypeError("Private TLS diagnostic password=private-value");
        if (state.upstreamHtml)
          return new Response(state.upstreamHtml, {
            status: state.upstreamStatus,
            headers: {
              "content-type": "text/html",
              server: "Microsoft-IIS/8.5",
              "set-cookie": "private-cookie",
            },
          });
        if (state.redirectResponse)
          return new Response("<html>Moved</html>", {
            status: 302,
            headers: { Location: "https://other.example/secret" },
          });
        if (path.endsWith("/gerar"))
          return Response.json({
            Sucesso: true,
            Dados: { CIOT: "560000123456" },
          });
        if (path.endsWith("/ConsultarSituacaoTransportador"))
          return Response.json({
            Codigo: "111",
            RNTRCAtivo: true,
            TipoTransportador: "ETC",
            EquiparadoTAC: state.equiparado,
          });
        if (path.endsWith("/ConsultarFrotaTransportador"))
          return Response.json({
            Codigo: "111",
            RNTRCAtivo: true,
            Frota: [
              {
                PlacaVeiculo: "RAX6E36",
                SituacaoVeiculoFrotaTransportador: !state.foreignPlate,
              },
            ],
          });
        if (path.endsWith("/DeclaracaoOperacaoTransporte")) {
          state.declareCount++;
          if (state.failDeclaration) throw new Error("timeout");
          const body = JSON.parse(String(init.body));
          expect(body.IdOperacaoTransporte).toBe("560000123456");
          expect(state.row.payloadAntt.antt.idOperacaoTransporte).toBe(
            "560000123456",
          );
          return Response.json({
            IdOperacaoTransporte: "560000123456",
            CodigoVerificador: "0004",
            Codigo: state.reject ? "205" : "110",
            Mensagem: state.reject ? '["RNTRC inválido"]' : "Autorizado",
          });
        }
        return Response.json({
          CodigoIdentificacaoOperacao: "560000123456",
          CodigoVerificador: "0004",
          Codigo: "111",
          Mensagem: "Consulta realizada",
        });
      },
    },
  }),
}));
import { protectCiotCompany } from "../server/services/ciot-company.service.js";
import {
  anttCiotService,
  prepareOfficialPayload,
} from "../server/services/antt-ciot.service.js";
beforeEach(() => {
  (globalThis as any).__RADASA_CLOUDFLARE = true;
  state.calls = [];
  state.declareCount = 0;
  state.failDeclaration = false;
  state.reject = false;
  state.locks = 0;
  state.equiparado = false;
  state.foreignPlate = false;
  state.companyBinding = null;
  state.bindingWinner = null;
  state.workerRedirectValidation = false;
  state.redirectResponse = false;
  state.upstreamHtml = "";
  state.upstreamStatus = 500;
  state.transportFailure = false;
  state.mtlsCnpj = "15209274000162";
  state.row = {
    id: "ciot-1",
    empresaId: "company-1",
    status: "RASCUNHO",
    empresa: {
      id: "company-1",
      ativa: true,
      empresaPadrao: true,
      cnpj: "15209274000162",
      rntrc: "51312577",
      certificadoArquivo: "fake",
      certificadoSenha: "fake",
    },
    ctes: [],
    veiculo: { placa: "RAX6E36" },
    motorista: { nome: "Motorista", cpf: "12345678909" },
    motoristaId: "driver-1",
    veiculoId: "truck-1",
    tipoOperacao: "LOTACAO",
    contratanteCnpj: "15209274000162",
    pesoKg: 1000,
    valorFrete: 5000,
    dataInicio: new Date("2026-10-20"),
    dataFim: new Date("2026-10-21"),
    createdAt: new Date("2026-10-15"),
    payloadAntt: {
      antt: {
        camposComplementares: {
          cpfCnpjDestinatario: "15209274000162",
          distanciaPercorrida: 100,
          codigoMunicipioOrigem: 5104526,
          codigoMunicipioDestino: 5102637,
          codigoNaturezaCarga: 2201,
          codigoTipoCarga: 5,
          numeroEixos: 4,
          tipoPagamento: 5,
          cpfCnpjCreditado: "15209274000162",
        },
      },
    },
  };
  state.companies = [structuredClone(state.row.empresa)];
});
it("manual operation can be validated without inventing an official ID or requiring XML", async () => {
  const p = await prepareOfficialPayload("ciot-1");
  expect(p.missing).toEqual([]);
  expect(p.payload.IdOperacaoTransporte).toBe("");
});
it("generates and persists official ID before declaring and authorizes only real success", async () => {
  const r = await anttCiotService.emit("ciot-1");
  expect(r.success).toBe(true);
  expect(state.row.status).toBe("AUTORIZADO");
  expect(state.row.codigoVerificador).toBe("0004");
});
it("concurrent emissions declare only once", async () => {
  const r = await Promise.allSettled([
    anttCiotService.emit("ciot-1"),
    anttCiotService.emit("ciot-1"),
  ]);
  expect(state.declareCount).toBe(1);
  expect(r.filter((v) => v.status === "rejected")).toHaveLength(1);
});
it("HTTP 200 rejection is not authorization", async () => {
  state.reject = true;
  const r = await anttCiotService.emit("ciot-1");
  expect(r.success).toBe(false);
  expect(state.row.status).toBe("REJEITADO");
  expect(state.row.numeroCiot).toBe(null);
});
it("ambiguous timeout remains locked and a query can recover authorization", async () => {
  state.failDeclaration = true;
  await expect(anttCiotService.emit("ciot-1")).rejects.toThrow();
  expect(state.row.status).toBe("PROCESSANDO");
  await expect(anttCiotService.emit("ciot-1")).rejects.toThrow();
  expect(state.declareCount).toBe(1);
  await anttCiotService.query("ciot-1");
  expect(state.row.status).toBe("AUTORIZADO");
});
it("client-supplied official ID is ignored", async () => {
  const p = await prepareOfficialPayload("ciot-1", {
    idOperacaoTransporte: "999999999999",
  });
  expect(p.payload.IdOperacaoTransporte).toBe("");
});
it("blocked prepare cannot reset an authorized record", async () => {
  state.row.status = "AUTORIZADO";
  await expect(anttCiotService.prepare("ciot-1")).rejects.toThrow();
  expect(state.row.status).toBe("AUTORIZADO");
});

it("does not allocate or declare when ANTT classifies the company as TAC-equivalent", async () => {
  state.equiparado = true;
  await expect(anttCiotService.emit("ciot-1")).rejects.toThrow();
  expect(state.declareCount).toBe(0);
  expect(state.calls.some((p) => p.endsWith("/gerar"))).toBe(false);
});
it("does not declare a vehicle outside the company RNTRC fleet", async () => {
  state.foreignPlate = true;
  await expect(anttCiotService.emit("ciot-1")).rejects.toThrow();
  expect(state.declareCount).toBe(0);
});

it("preparing in a different environment cannot relabel and reuse the previous official ID", async () => {
  state.row.payloadAntt.antt.ambiente = "producao";
  state.row.payloadAntt.antt.idOperacaoTransporte = "520000123456";
  state.row.payloadAntt.antt.anoDeclaracao = 2025;
  await anttCiotService.prepare("ciot-1");
  expect(state.row.payloadAntt.antt.idOperacaoTransporte).toBeUndefined();
  expect(state.row.payloadAntt.antt.anoDeclaracao).toBeUndefined();
});

it("automatically uses the active registered company, never an inactive default", async () => {
  state.companies.unshift({
    ...state.companies[0],
    id: "inactive",
    cnpj: "42294937000167",
    ativa: false,
  });
  const result = await anttCiotService.configuration();
  expect(result.company.id).toBe("company-1");
  expect(result.company.cnpj).toBe("15209274000162");
});
it("blocks a forged company ID before allocating an official operation", async () => {
  await anttCiotService.configuration();
  state.row.empresaId = "foreign";
  state.row.empresa = {
    ...state.row.empresa,
    id: "foreign",
    cnpj: "42294937000167",
  };
  state.companies.push(state.row.empresa);
  await expect(anttCiotService.emit("ciot-1")).rejects.toThrow(/CNPJ|empresa/i);
  expect(state.calls).toEqual([]);
});
it("cannot silently switch the bound CNPJ after another company becomes default", async () => {
  await anttCiotService.configuration();
  state.companies[0].empresaPadrao = false;
  state.companies.unshift({
    ...state.companies[0],
    id: "other",
    cnpj: "42294937000167",
    empresaPadrao: true,
  });
  const result = await anttCiotService.configuration();
  expect(result.company.id).toBe("company-1");
});
it("does not fall back to another active CNPJ when the bound company is inactive", async () => {
  await anttCiotService.configuration();
  state.companies[0].ativa = false;
  state.companies.push({
    ...state.companies[0],
    id: "other",
    cnpj: "42294937000167",
    ativa: true,
  });
  await expect(anttCiotService.configuration()).rejects.toThrow(/inativa/i);
});
it("blocks changed CNPJ in the original bound company record", async () => {
  await anttCiotService.configuration();
  state.companies[0].cnpj = "42294937000167";
  await expect(anttCiotService.emit("ciot-1")).rejects.toThrow(/CNPJ/i);
  expect(state.calls).toEqual([]);
});
it("ambiguous active companies require a single default in Cadastros > Empresa", async () => {
  state.companies[0].empresaPadrao = false;
  state.companies.push({
    ...state.companies[0],
    id: "other",
    cnpj: "42294937000167",
  });
  await expect(anttCiotService.configuration()).rejects.toThrow(/padrão/i);
  expect(state.companyBinding).toBeNull();
});
it("does not require manually configuring a CNPJ environment variable", async () => {
  state.mtlsCnpj = "";
  const result = await anttCiotService.configuration();
  expect(result.company.cnpj).toBe("15209274000162");
  expect(result.certificate.ok).toBe(true);
});

it("honors the concurrent winning CNPJ binding instead of the local candidate", async () => {
  state.bindingWinner = {
    valor: { empresaId: "other", cnpj: "42294937000167" },
  };
  await expect(anttCiotService.configuration("company-1")).rejects.toThrow(
    /CNPJ|empresa/i,
  );
  expect(state.calls).toEqual([]);
});

it("normalizes a formatted CNPJ from the company registration", async () => {
  state.companies[0].cnpj = "15.209.274/0001-62";
  const result = await anttCiotService.configuration();
  expect(result.company.cnpj).toBe("15209274000162");
});
it("protects the bound company CNPJ and deletion while allowing ordinary profile edits", async () => {
  await anttCiotService.configuration();
  await expect(
    protectCiotCompany("company-1", "42.294.937/0001-67"),
  ).rejects.toThrow(/CNPJ/i);
  await expect(
    protectCiotCompany("company-1", undefined, true),
  ).rejects.toThrow(/excluído/i);
  await expect(
    protectCiotCompany("company-1", "15.209.274/0001-62"),
  ).resolves.toBeUndefined();
  await expect(protectCiotCompany("company-1")).resolves.toBeUndefined();
});

it("uses a redirect mode supported by Cloudflare for RNTRC and fleet requests", async () => {
  state.workerRedirectValidation = true;
  await expect(anttCiotService.diagnostic()).resolves.toMatchObject({
    ok: true,
  });
  await expect(
    anttCiotService.fleet(undefined, ["RAX6E36"]),
  ).resolves.toMatchObject({ Codigo: "111" });
});
it("blocks ANTT redirects explicitly before parsing HTML or following another host", async () => {
  state.redirectResponse = true;
  await expect(anttCiotService.diagnostic()).rejects.toMatchObject({
    statusCode: 422,
    message: expect.stringMatching(/redirecionamento.*302/i),
  });
  expect(state.calls).toHaveLength(1);
});

it("captures a sanitized upstream 500 diagnosis instead of losing the HTML error response", async () => {
  state.upstreamHtml =
    '<h1>Client certificate missing</h1><p>token=private-token password="private-password"</p><script>private-script</script>-----BEGIN PRIVATE KEY-----private-key-----END PRIVATE KEY-----';
  try {
    await anttCiotService.diagnostic();
    throw new Error("Expected upstream rejection");
  } catch (error: any) {
    expect(error.statusCode).toBe(502);
    expect(error.details).toMatchObject({
      httpStatus: 500,
      service: "ConsultarSituacaoTransportador",
      method: "POST",
      contentType: "text/html",
      server: "Microsoft-IIS/8.5",
      environment: "homologacao",
      companyCnpj: "15209274000162",
      responseExcerpt: expect.stringContaining("Client certificate missing"),
    });
    expect(JSON.stringify(error.details)).not.toMatch(
      /private-token|private-password|private-script|private-key|private-cookie/,
    );
    expect(error.message).not.toMatch(/Consulte a operação/);
  }
});
it("bounds non-JSON response excerpts and rejects a 200 HTML response", async () => {
  state.upstreamHtml = "<h1>Error</h1>" + "x".repeat(10000);
  state.upstreamStatus = 200;
  try {
    await anttCiotService.fleet(undefined, ["RAX6E36"]);
    throw new Error("Expected invalid response rejection");
  } catch (error: any) {
    expect(error.details.httpStatus).toBe(200);
    expect(error.details.responseExcerpt.length).toBeLessThanOrEqual(1600);
    expect(error.details.responseTruncated).toBe(true);
  }
});

it("reports mTLS transport failure separately from an ANTT HTTP response without leaking transport secrets", async () => {
  state.transportFailure = true;
  try {
    await anttCiotService.diagnostic();
    throw new Error("Expected transport rejection");
  } catch (error: any) {
    expect(error.statusCode).toBe(502);
    expect(error.details).toMatchObject({
      diagnosticCode: "ANTT_MTLS_TRANSPORT_FAILURE",
      failureType: "TypeError",
      transport: "cloudflare-mtls-binding",
    });
    expect(JSON.stringify({ message: error.message, details: error.details })).not.toContain("private-value");
  }
});

it("classifies an empty 500 from the external Cloudflare edge without asserting the certificate is invalid", async () => {
  state.upstreamHtml = " ";
  try {
    await anttCiotService.diagnostic();
    throw new Error("Expected HTTP 500 rejection");
  } catch (error: any) {
    expect(error.statusCode).toBe(502);
    expect(error.details).toMatchObject({
      diagnosticCode: "ANTT_UPSTREAM_EMPTY_HTTP_5XX",
      httpStatus: 500,
      transport: "cloudflare-mtls-binding",
    });
    expect(error.details.recommendedNextStep).toMatch(/Node.js/);
  }
});
