import https from "node:https";
import { getCiotCompany } from "./ciot-company.service.js";
import { AppError } from "../utils/app-error.js";
import tls from "node:tls";
import axios, { type AxiosInstance } from "axios";
import { prisma } from "../lib/prisma.js";
import { env } from "../config/env.js";
import { getRuntimeAnttMtls, getRuntimeAnttConnector } from "../lib/runtime-bindings.js";
import { safeConnectorRejection } from "./ciot-connector-diagnostics.js";
import {
  serviceEndpoint,
  upstreamResponseSummary,
  parseDeclaration,
  generatedOperationId,
  paymentEntries,
  messagesFrom,
  codesFrom,
} from "./antt-ciot.protocol.js";

const digits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const text = (value: unknown) => String(value ?? "").trim();
const numeric = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const compactPlate = (value: unknown) =>
  text(value)
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase();
const asArray = (value: unknown): unknown[] =>
  value === undefined || value === null
    ? []
    : Array.isArray(value)
      ? value
      : [value];

function decodeCertificate(value: string) {
  const normalized = value.trim();
  if (!normalized)
    throw new AppError(422, "Certificado digital não cadastrado.");
  const comma = normalized.indexOf(",");
  const base64 =
    normalized.startsWith("data:") && comma >= 0
      ? normalized.slice(comma + 1)
      : normalized;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length)
    throw new AppError(
      422,
      "O certificado digital cadastrado está vazio ou inválido.",
    );
  return buffer;
}

function normalizeRntrc(value: unknown) {
  const normalized = digits(value);
  return normalized.length === 8 ? `0${normalized}` : normalized;
}

function serviceUrl(path: string, generator = false) {
  const url = serviceEndpoint(env.ANTT_CIOT_BASE_URL, path, generator);
  const production = new URL(url).hostname === "appservices.antt.gov.br";
  if (production !== (env.ANTT_CIOT_ENVIRONMENT === "producao"))
    throw new AppError(
      422,
      "Ambiente e endereço ANTT incompatíveis. Corrija a configuração antes de enviar.",
    );
  return url;
}
function cloudflareRuntime() {
  return Boolean((globalThis as any).__RADASA_CLOUDFLARE);
}

function validatedConnectorUrl(value: string) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.hostname !== "ciot.radasa.com.br" ||
      url.port || url.username || url.password || url.search || url.hash ||
      (url.pathname !== "/" && url.pathname !== ""))
    throw new AppError(503, "Endereço do conector CIOT inválido. Use https://ciot.radasa.com.br.");
  return `${url.origin}/v1/antt`;
}

async function requestViaLocalConnector(
  company: { cnpj: string }, path: string, method: "GET" | "POST",
  payload: unknown, generator: boolean, headers: Record<string, string>,
): Promise<Response> {
  const connector = getRuntimeAnttConnector();
  // A configuração do conector é explícita: nunca fazer fallback para outro
  // transporte em caso de timeout ou pane, sobretudo ao emitir/cancelar CIOT.
  if (!connector.url || !connector.token || connector.token.length < 48)
    throw new AppError(503, "Conector CIOT incompleto no Cloudflare. Configure URL e chave antes de consultar a ANTT.", {
      diagnosticCode: "ANTT_CONNECTOR_NOT_CONFIGURED",
    });
  const connectorEndpoint = validatedConnectorUrl(connector.url);
  let response: Response;
  try {
    response = await fetch(connectorEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${connector.token}` },
      body: JSON.stringify({
        companyCnpj: digits(company.cnpj), path, method, payload, generator, headers,
        environment: env.ANTT_CIOT_ENVIRONMENT,
      }),
      signal: AbortSignal.timeout(env.ANTT_CIOT_TIMEOUT_MS + 5_000),
      redirect: "manual",
    });
  } catch {
    throw new AppError(503, "Conector CIOT indisponível. Verifique se o PC e o túnel Cloudflare estão ligados. Não reenvie a operação sem consultar o estado.", {
      diagnosticCode: "ANTT_CONNECTOR_OFFLINE",
      transport: "pc-node-mtls-tunnel",
    });
  }
  if (!response.ok) {
    // O conector devolve um código curto e seguro (ex.: ENVIRONMENT_MISMATCH).
    // Nunca encaminhar seu corpo bruto: gateways podem devolver HTML, IDs, tokens ou caminhos internos.
    let rejectionBody = "";
    const declaredLength = Number(response.headers.get("content-length") || 0);
    if (!declaredLength || declaredLength <= 4096) {
      try {
        const reader = response.body?.getReader();
        if (reader) {
          const chunks: Uint8Array[] = [];
          let length = 0;
          while (length <= 4096) {
            const part = await reader.read();
            if (part.done) break;
            length += part.value.byteLength;
            if (length > 4096) { await reader.cancel(); break; }
            chunks.push(part.value);
          }
          if (length <= 4096) {
            const bytes = new Uint8Array(length);
            let offset = 0;
            for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
            rejectionBody = new TextDecoder().decode(bytes);
          }
        }
      } catch { /* Resposta do gateway pode não permitir leitura. */ }
    }
    const rejection = safeConnectorRejection(response.status, rejectionBody);
    throw new AppError(503,
      rejection.connectorCode === "ENVIRONMENT_MISMATCH"
        ? "CIOT bloqueado: o ambiente da ANTT no Radasa é diferente do ambiente do conector no PC. Confira /health antes de emitir."
        : rejection.connectorCode === "COMPANY_MISMATCH"
          ? "CIOT bloqueado: o CNPJ emitente do Radasa não corresponde ao CNPJ configurado no conector."
          : "Conector CIOT rejeitou a requisição. Consulte o retorno técnico e não reenvie a operação sem consultar seu estado.", {
      diagnosticCode: "ANTT_CONNECTOR_HTTP_ERROR",
      httpStatus: response.status,
      transport: "pc-node-mtls-tunnel",
      ...(rejection.connectorCode ? { connectorCode: rejection.connectorCode } : {}),
      recommendedNextStep: rejection.recommendedNextStep,
    });
  }
  let result: any;
  try { result = await response.json(); } catch { /* resposta inválida do conector */ }
  if (!result || !Number.isInteger(result.httpStatus) || result.httpStatus < 200 || result.httpStatus > 599 ||
      typeof result.body !== "string" || result.body.length > 2 * 1024 * 1024) {
    throw new AppError(503, "Conector CIOT retornou um envelope inválido. Consulte o estado antes de reenviar.", {
      diagnosticCode: "ANTT_CONNECTOR_BAD_RESPONSE",
    });
  }
  return new Response([204, 205, 304].includes(result.httpStatus) ? null : result.body, {
    status: result.httpStatus,
    headers: {
      "content-type": String(result.contentType || "").slice(0, 100),
      "x-antt-upstream-server": String(result.server || "").slice(0, 100),
      "x-antt-upstream-ray": String(result.cfRay || "").slice(0, 80),
    },
  });
}
function assertMtlsCompany(company: { cnpj: string }) {
  const runtime = getRuntimeAnttMtls();
  if (!runtime.binding)
    throw new AppError(
      422,
      "Vincule o certificado da empresa ao Cloudflare (ANTT_CIOT_MTLS ou SEFAZ_MTLS). O cadastro da empresa já é utilizado automaticamente.",
    );
  if (runtime.cnpj && digits(runtime.cnpj) !== digits(company.cnpj))
    throw new AppError(
      422,
      "ANTT_CIOT_MTLS_CNPJ deve corresponder ao CNPJ da empresa selecionada.",
    );
  return runtime.binding;
}

async function getCompany(companyId?: string | null) {
  return getCiotCompany(companyId);
}

type Company = Awaited<ReturnType<typeof getCompany>>;

function validateCertificateLocally(company: Company) {
  try {
    if (cloudflareRuntime()) {
      if (getRuntimeAnttConnector().url || getRuntimeAnttConnector().token) {
        const connector = getRuntimeAnttConnector();
        if (!connector.url || !connector.token || connector.token.length < 48)
          throw new AppError(503, "Conector CIOT com URL ou chave incompleta no Cloudflare.");
        validatedConnectorUrl(connector.url);
      } else {
        assertMtlsCompany(company);
      }
      return {
        ok: true as const,
        message: getRuntimeAnttConnector().url
          ? "Conector CIOT configurado. O certificado A1 será validado na comunicação pelo PC; execute o diagnóstico ANTT."
          : "Vínculo mTLS disponível. A ANTT valida a identidade do certificado na conexão; execute o diagnóstico.",
      };
    }
    if (!company.certificadoArquivo?.trim() || !company.certificadoSenha?.trim())
      throw new AppError(422, "Cadastre o certificado A1 e a senha em Cadastros > Empresa.");
    tls.createSecureContext({
      pfx: decodeCertificate(company.certificadoArquivo ?? ""),
      passphrase: company.certificadoSenha ?? "",
      minVersion: "TLSv1.2",
    });
    return {
      ok: true as const,
      message: "Certificado A1 e senha validados localmente.",
    };
  } catch (error) {
    return {
      ok: false as const,
      message: error instanceof Error ? error.message : String(error),
    };
  }
}

function createClient(company: Company): AxiosInstance {
  const agent = new https.Agent({
    pfx: decodeCertificate(company.certificadoArquivo ?? ""),
    passphrase: company.certificadoSenha ?? "",
    minVersion: "TLSv1.2",
    rejectUnauthorized: true,
    keepAlive: false,
  });

  return axios.create({
    timeout: env.ANTT_CIOT_TIMEOUT_MS,
    httpsAgent: agent,
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    validateStatus: () => true,
  });
}

async function requestService(
  company: Company,
  path: string,
  method: "GET" | "POST",
  payload: unknown,
  generator = false,
  headers: Record<string, string> = {},
) {
  const endpoint = new URL(serviceUrl(path, generator));
  if (method === "GET")
    Object.entries(payload as Record<string, unknown>).forEach(([key, value]) =>
      endpoint.searchParams.set(key, String(value)),
    );
  let status: number;
  let data: any;
  if (cloudflareRuntime()) {
    // Conector local (quando habilitado) ou binding mTLS legado, nunca ambos por tentativa.
    const connectorConfig = getRuntimeAnttConnector();
    const connectorEnabled = Boolean(connectorConfig.url || connectorConfig.token);
    // Em produção, esta instalação utiliza exclusivamente o conector Node.js validado.
    // Nunca desviar silenciosamente para mTLS do Worker se o túnel/chave estiver ausente.
    if (env.ANTT_CIOT_ENVIRONMENT === "producao" && !connectorEnabled) {
      throw new AppError(503, "Emissão oficial bloqueada: configure o conector CIOT do PC antes de usar produção.", {
        diagnosticCode: "ANTT_PRODUCTION_CONNECTOR_REQUIRED",
      });
    }
    let response: Response;
    try {
      response = connectorEnabled
        ? await requestViaLocalConnector(company, path, method, payload, generator, headers)
        : await assertMtlsCompany(company).fetch(endpoint, {
        method,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...headers,
        },
        ...(method === "POST" ? { body: JSON.stringify(payload) } : {}),
        signal: AbortSignal.timeout(env.ANTT_CIOT_TIMEOUT_MS),
        redirect: "manual",
      });
    } catch (error) {
      if (error instanceof AppError) throw error;
      const failureType = error instanceof Error &&
        ["AbortError", "TimeoutError", "TypeError"].includes(error.name)
          ? error.name
          : "TransportError";
      throw new AppError(
        502,
        "A conexão mTLS do Cloudflare com a ANTT falhou antes de receber uma resposta HTTP. Não reenvie uma emissão sem consultar seu estado.",
        {
          service: path,
          method,
          endpoint: `${endpoint.origin}${endpoint.pathname}`,
          environment: env.ANTT_CIOT_ENVIRONMENT,
          transport: "cloudflare-mtls-binding",
          diagnosticCode: "ANTT_MTLS_TRANSPORT_FAILURE",
          failureType,
          recommendedNextStep: "Confira a vigência e o vínculo do certificado mTLS. Compare a consulta RNTRC usando o diagnóstico local Node.js com o mesmo certificado.",
        },
      );
    }
    status = response.status;
    if (status >= 300 && status < 400)
      throw new AppError(
        422,
        `A ANTT retornou redirecionamento HTTP ${status}. O destino não foi seguido; verifique o endereço do serviço e o ambiente configurado.`,
      );
    let raw = "";
    try {
      raw = await response.text();
      data = JSON.parse(raw);
    } catch {
      const guidance = path.startsWith("Consultar")
        ? "Confira o retorno técnico para identificar a resposta externa."
        : "Consulte a operação antes de tentar novamente.";
      throw new AppError(
        status >= 500 ? 502 : 422,
        `ANTT respondeu HTTP ${status} sem JSON válido. ${guidance}`,
        {
          service: path,
          method,
          endpoint: `${endpoint.origin}${endpoint.pathname}`,
          httpStatus: status,
          contentType: response.headers.get("content-type") || "",
          server: response.headers.get("x-antt-upstream-server") || response.headers.get("server") || "",
          cfRay: (response.headers.get("x-antt-upstream-ray") || response.headers.get("cf-ray") || "").slice(0, 80),
          requestId: (response.headers.get("x-request-id") || "").slice(0, 80),
          environment: env.ANTT_CIOT_ENVIRONMENT,
          companyCnpj: digits(company.cnpj),
          transport: connectorEnabled ? "pc-node-mtls-tunnel" : "cloudflare-mtls-binding",
          diagnosticCode: status >= 500 && !raw.trim()
            ? "ANTT_UPSTREAM_EMPTY_HTTP_5XX"
            : "ANTT_UPSTREAM_NON_JSON",
          recommendedNextStep: status >= 500
            ? "Uma resposta HTTP externa não comprova falha do certificado. Compare a mesma consulta no Node.js com o mesmo A1 e encaminhe o identificador cfRay à equipe responsável pelo serviço, se houver."
            : "Confirme URL, ambiente e formato da resposta do serviço ANTT.",
          ...upstreamResponseSummary(raw),
        },
      );
    }
  } else {
    try {
      const response = await createClient(company).request({
        url: endpoint.toString(),
        method,
        ...(method === "POST" ? { data: payload } : {}),
        headers,
        maxRedirects: 0,
      });
      status = response.status;
      data = response.data;
    } catch {
      // Axios errors may retain request headers and PFX data; never propagate them.
      throw new AppError(
        422,
        "Falha de comunicação mTLS com a ANTT. Consulte a operação antes de reenviar.",
      );
    }
  }
  if (status < 200 || status >= 300)
    throw new AppError(
      422,
      `ANTT respondeu HTTP ${status}. ${messagesFrom(data).join(" | ")}`,
    );
  if (!data || typeof data !== "object" || Array.isArray(data))
    throw new AppError(
      422,
      "Resposta ANTT inválida. Consulte a operação antes de reenviar.",
    );
  return data;
}
async function postService(company: Company, path: string, payload: unknown) {
  return requestService(company, path, "POST", payload);
}
async function getService(
  company: Company,
  path: string,
  payload: Record<string, unknown>,
) {
  return requestService(company, path, "GET", payload);
}
async function generateId(company: Company) {
  let headers: Record<string, string> = {};
  // Use only a key legitimately supplied for the official generator; none is embedded in this project.
  if (env.ANTT_CIOT_GENERATOR_KEY) {
    const auth = await requestService(company, "token", "POST", {}, true, {
      chave: env.ANTT_CIOT_GENERATOR_KEY,
    });
    if (typeof auth.token !== "string" || !auth.token)
      throw new AppError(
        422,
        "O gerador oficial não retornou um token válido.",
      );
    headers = { Authorization: `Bearer ${auth.token}` };
  }
  const result = await requestService(
    company,
    "gerar",
    "POST",
    { cpfCnpj: digits(company.cnpj) },
    true,
    headers,
  );
  try {
    return generatedOperationId(result);
  } catch (error) {
    throw new AppError(
      422,
      error instanceof Error
        ? error.message
        : "Resposta inválida do gerador ANTT.",
    );
  }
}

function preservedAntt(payload: unknown) {
  const previous = (payload as any)?.antt;
  return previous?.ambiente === env.ANTT_CIOT_ENVIRONMENT ? previous : {};
}

function firstUseful(...values: unknown[]) {
  return values.find(
    (value) => value !== undefined && value !== null && value !== "",
  );
}

export type PisoMinimoResult = {
  aplicavel: boolean;
  tabela: "A" | "C" | null;
  codigoTipoCarga: number | null;
  numeroEixos: number | null;
  distanciaKm: number;
  ccd: number | null;
  cc: number | null;
  valorPiso: number | null;
  valorFrete: number;
  diferenca: number | null;
  abaixoDoPiso: boolean;
  fundamento: string;
};

type CoeficientePiso = { ccd: number; cc: number };
type TabelaPiso = Record<number, Partial<Record<number, CoeficientePiso>>>;

// Resolução ANTT nº 6.084/2026, Tabelas A e C.
const PISO_TABELA_A: TabelaPiso = {
  1: {
    2: { ccd: 4.0144, cc: 460.59 },
    3: { ccd: 5.1355, cc: 552.24 },
    4: { ccd: 5.8118, cc: 597 },
    5: { ccd: 6.6983, cc: 664.83 },
    6: { ccd: 7.3841, cc: 680.01 },
    7: { ccd: 8.0516, cc: 820.34 },
    9: { ccd: 9.2231, cc: 908.91 },
  },
  2: {
    2: { ccd: 4.0884, cc: 471.98 },
    3: { ccd: 5.2311, cc: 569.57 },
    4: { ccd: 5.9661, cc: 621.52 },
    5: { ccd: 6.8661, cc: 693.08 },
    6: { ccd: 7.5572, cc: 709.72 },
    7: { ccd: 8.19, cc: 840.5 },
    9: { ccd: 9.3822, cc: 934.76 },
  },
  3: {
    2: { ccd: 4.7095, cc: 520.07 },
    3: { ccd: 6.0159, cc: 623.27 },
    4: { ccd: 6.8646, cc: 686.63 },
    5: { ccd: 7.8666, cc: 757.98 },
    6: { ccd: 8.6661, cc: 772.35 },
    7: { ccd: 9.5884, cc: 982.76 },
    9: { ccd: 10.887, cc: 1067.06 },
  },
  4: {
    3: { ccd: 5.1082, cc: 544.75 },
    4: { ccd: 5.7396, cc: 577.15 },
    5: { ccd: 6.6345, cc: 647.29 },
    6: { ccd: 7.3186, cc: 662.01 },
    7: { ccd: 8.0492, cc: 819.69 },
    9: { ccd: 9.1399, cc: 886.05 },
  },
  5: {
    2: { ccd: 3.9826, cc: 451.84 },
    3: { ccd: 5.0977, cc: 541.86 },
    4: { ccd: 5.7822, cc: 588.86 },
    5: { ccd: 6.6718, cc: 657.56 },
    6: { ccd: 7.3547, cc: 671.93 },
    7: { ccd: 8.0927, cc: 831.66 },
    9: { ccd: 9.2027, cc: 903.32 },
  },
  6: {
    2: { ccd: 3.6023, cc: 451.84 },
    3: { ccd: 5.0962, cc: 541.44 },
    4: { ccd: 5.8094, cc: 596.35 },
    5: { ccd: 6.6718, cc: 657.56 },
    6: { ccd: 7.3547, cc: 671.93 },
    7: { ccd: 8.0927, cc: 831.66 },
    9: { ccd: 9.2027, cc: 903.32 },
  },
  7: {
    2: { ccd: 4.7845, cc: 608.79 },
    3: { ccd: 5.9154, cc: 703.16 },
    4: { ccd: 6.6285, cc: 753.03 },
    5: { ccd: 7.515, cc: 820.86 },
    6: { ccd: 8.2008, cc: 836.04 },
    7: { ccd: 8.8866, cc: 981.39 },
    9: { ccd: 10.066, cc: 1072.15 },
  },
  8: {
    2: { ccd: 4.871, cc: 632.58 },
    3: { ccd: 6.0236, cc: 732.9 },
    4: { ccd: 6.7628, cc: 789.96 },
    5: { ccd: 7.6628, cc: 861.51 },
    6: { ccd: 8.3539, cc: 878.16 },
    7: { ccd: 9.0049, cc: 1013.95 },
    9: { ccd: 10.2051, cc: 1110.41 },
  },
  9: {
    2: { ccd: 5.3176, cc: 630.88 },
    3: { ccd: 6.6369, cc: 737.63 },
    4: { ccd: 7.502, cc: 807.63 },
    5: { ccd: 8.5039, cc: 878.98 },
    6: { ccd: 9.3034, cc: 893.35 },
    7: { ccd: 10.2495, cc: 1110.28 },
    9: { ccd: 11.5584, cc: 1197.43 },
  },
  10: {
    3: { ccd: 5.4926, cc: 645.45 },
    4: { ccd: 6.1608, cc: 682.95 },
    5: { ccd: 7.0556, cc: 753.1 },
    6: { ccd: 7.7398, cc: 767.81 },
    7: { ccd: 8.4886, cc: 930.51 },
    9: { ccd: 9.5873, cc: 999.06 },
  },
  11: {
    2: { ccd: 4.3571, cc: 549.81 },
    3: { ccd: 5.4821, cc: 642.55 },
    4: { ccd: 6.2033, cc: 694.66 },
    5: { ccd: 7.093, cc: 763.36 },
    6: { ccd: 7.7758, cc: 777.73 },
    7: { ccd: 8.5321, cc: 942.48 },
    9: { ccd: 9.6501, cc: 1016.33 },
  },
  12: {
    5: { ccd: 7.0364, cc: 757.81 },
    6: { ccd: 7.7652, cc: 784.82 },
    9: { ccd: 9.7444, cc: 1052.26 },
  },
};

const PISO_TABELA_C: TabelaPiso = {
  1: {
    2: { ccd: 3.3964, cc: 174.38 },
    3: { ccd: 4.3276, cc: 198.05 },
    4: { ccd: 4.9441, cc: 215.03 },
    5: { ccd: 5.6725, cc: 229.64 },
    6: { ccd: 6.3229, cc: 232.91 },
    7: { ccd: 6.7071, cc: 270.36 },
    9: { ccd: 7.6912, cc: 292.59 },
  },
  2: {
    2: { ccd: 3.4439, cc: 176.84 },
    3: { ccd: 4.3828, cc: 201.78 },
    4: { ccd: 5.0412, cc: 220.31 },
    5: { ccd: 5.7745, cc: 235.73 },
    6: { ccd: 6.4268, cc: 239.32 },
    7: { ccd: 6.7985, cc: 274.7 },
    9: { ccd: 7.7901, cc: 298.16 },
  },
  3: {
    2: { ccd: 4.0647, cc: 205.65 },
    3: { ccd: 5.1615, cc: 232.97 },
    4: { ccd: 5.9203, cc: 256.16 },
    5: { ccd: 6.756, cc: 271.54 },
    6: { ccd: 7.522, cc: 274.63 },
    7: { ccd: 8.0108, cc: 329.34 },
    9: { ccd: 9.1377, cc: 351.6 },
  },
  4: {
    3: { ccd: 4.3178, cc: 196.43 },
    4: { ccd: 4.9182, cc: 210.75 },
    5: { ccd: 5.6496, cc: 225.87 },
    6: { ccd: 6.2994, cc: 229.04 },
    7: { ccd: 6.7062, cc: 270.22 },
    9: { ccd: 7.6614, cc: 287.67 },
  },
  5: {
    2: { ccd: 3.385, cc: 172.5 },
    3: { ccd: 4.3141, cc: 195.81 },
    4: { ccd: 4.9335, cc: 213.27 },
    5: { ccd: 5.663, cc: 228.08 },
    6: { ccd: 6.3124, cc: 231.17 },
    7: { ccd: 6.7218, cc: 272.8 },
    9: { ccd: 7.6839, cc: 291.39 },
  },
  6: {
    2: { ccd: 3.0047, cc: 172.5 },
    3: { ccd: 4.3135, cc: 195.72 },
    4: { ccd: 4.9432, cc: 214.89 },
    5: { ccd: 5.663, cc: 228.08 },
    6: { ccd: 6.3124, cc: 231.17 },
    7: { ccd: 6.7218, cc: 272.8 },
    9: { ccd: 7.6839, cc: 291.39 },
  },
  7: {
    2: { ccd: 3.9329, cc: 224.77 },
    3: { ccd: 4.8748, cc: 250.19 },
    4: { ccd: 5.5294, cc: 270.47 },
    5: { ccd: 6.2578, cc: 285.09 },
    6: { ccd: 6.9083, cc: 288.36 },
    7: { ccd: 7.3121, cc: 329.05 },
    9: { ccd: 8.3048, cc: 352.7 },
  },
  8: {
    2: { ccd: 3.964, cc: 229.89 },
    3: { ccd: 4.9136, cc: 256.6 },
    4: { ccd: 5.5777, cc: 278.43 },
    5: { ccd: 6.3109, cc: 293.85 },
    6: { ccd: 6.9633, cc: 297.43 },
    7: { ccd: 7.3546, cc: 336.06 },
    9: { ccd: 8.3548, cc: 360.94 },
  },
  9: {
    2: { ccd: 4.5599, cc: 253.51 },
    3: { ccd: 5.6705, cc: 283.12 },
    4: { ccd: 6.4476, cc: 310.6 },
    5: { ccd: 7.2833, cc: 325.98 },
    6: { ccd: 8.0493, cc: 329.07 },
    7: { ccd: 8.5636, cc: 388 },
    9: { ccd: 9.7016, cc: 412.1 },
  },
  10: {
    3: { ccd: 4.5865, cc: 237.75 },
    4: { ccd: 5.225, cc: 255.37 },
    5: { ccd: 5.9564, cc: 270.49 },
    6: { ccd: 6.6062, cc: 273.66 },
    7: { ccd: 7.0327, cc: 318.08 },
    9: { ccd: 7.9965, cc: 336.95 },
  },
  11: {
    2: { ccd: 3.643, cc: 212.06 },
    3: { ccd: 4.5827, cc: 237.13 },
    4: { ccd: 5.2403, cc: 257.89 },
    5: { ccd: 5.9698, cc: 272.7 },
    6: { ccd: 6.6192, cc: 275.79 },
    7: { ccd: 7.0483, cc: 320.66 },
    9: { ccd: 8.019, cc: 340.67 },
  },
  12: {
    5: { ccd: 5.7939, cc: 249.68 },
    6: { ccd: 6.4598, cc: 255.5 },
    9: { ccd: 7.8784, cc: 323.48 },
  },
};

function calculatePisoMinimo(
  ciot: { tipoOperacao: string; valorFrete: unknown },
  fields: AnttCiotOverrides,
): PisoMinimoResult {
  const valorFrete = numeric(ciot.valorFrete);
  const distanciaKm = numeric(fields.distanciaPercorrida);
  const codigoTipoCarga = fields.codigoTipoCarga ?? null;
  const numeroEixos = fields.numeroEixos ?? null;
  const aplicavel = ciot.tipoOperacao === "LOTACAO";
  const tabela = aplicavel ? (fields.indAltoDesempenho ? "C" : "A") : null;
  const coeficiente =
    aplicavel && codigoTipoCarga && numeroEixos
      ? (tabela === "C" ? PISO_TABELA_C : PISO_TABELA_A)[codigoTipoCarga]?.[
          numeroEixos
        ]
      : undefined;
  const valorPiso =
    coeficiente && distanciaKm > 0
      ? Number((distanciaKm * coeficiente.ccd + coeficiente.cc).toFixed(2))
      : null;
  const diferenca =
    valorPiso === null ? null : Number((valorFrete - valorPiso).toFixed(2));
  return {
    aplicavel,
    tabela,
    codigoTipoCarga,
    numeroEixos,
    distanciaKm,
    ccd: coeficiente?.ccd ?? null,
    cc: coeficiente?.cc ?? null,
    valorPiso,
    valorFrete,
    diferenca,
    abaixoDoPiso: valorPiso !== null && valorFrete < valorPiso,
    fundamento: "Resolução ANTT nº 6.084/2026",
  };
}

export type AnttInstallment = {
  numeroParcela: number;
  dataVencimento: string;
  valorParcela: number;
};

export type AnttCiotOverrides = {
  idOperacaoTransporte?: string;
  distanciaPercorrida?: number;
  codigoMunicipioOrigem?: number;
  codigoMunicipioDestino?: number;
  cepOrigem?: string;
  cepDestino?: string;
  latitudeOrigem?: number;
  longitudeOrigem?: number;
  latitudeDestino?: number;
  longitudeDestino?: number;
  codigoNaturezaCarga?: number;
  codigoTipoCarga?: number;
  numeroEixos?: number;
  tipoPagamento?: number;
  codigoInstituicaoFinanceira?: number;
  numeroAgencia?: string;
  numeroConta?: string;
  chavePix?: string;
  cpfCnpjCreditado?: string;
  codigoPagamento?: number;
  identificadorPix?: string;
  indPagamento?: number;
  parcelas?: AnttInstallment[];
  indAltoDesempenho?: boolean;
  indRetornoVazio?: boolean;
  composicaoVeicular?: boolean;
  indContingencia?: boolean;
  justificativaContingencia?: string;
  rntrcContratante?: string;
  cpfCnpjDestinatario?: string;
  veiculosAdicionais?: Array<{
    placa: string;
    rntrc: string;
    numeroEixos: number;
  }>;
};

function locationObject(
  prefix: "origem" | "destino",
  fields: AnttCiotOverrides,
) {
  const object: Record<string, unknown> = {};
  if (prefix === "origem") {
    if (fields.codigoMunicipioOrigem)
      object.CodigoMunicipioOrigem = fields.codigoMunicipioOrigem;
    if (digits(fields.cepOrigem).length === 8)
      object.CepOrigem = digits(fields.cepOrigem);
    if (fields.latitudeOrigem !== undefined)
      object.LatitudeOrigem = fields.latitudeOrigem;
    if (fields.longitudeOrigem !== undefined)
      object.LongitudeOrigem = fields.longitudeOrigem;
  } else {
    if (fields.codigoMunicipioDestino)
      object.CodigoMunicipioDestino = fields.codigoMunicipioDestino;
    if (digits(fields.cepDestino).length === 8)
      object.CepDestino = digits(fields.cepDestino);
    if (fields.latitudeDestino !== undefined)
      object.LatitudeDestino = fields.latitudeDestino;
    if (fields.longitudeDestino !== undefined)
      object.LongitudeDestino = fields.longitudeDestino;
  }
  return object;
}

function hasLocation(prefix: "origem" | "destino", fields: AnttCiotOverrides) {
  if (prefix === "origem") {
    return Boolean(
      fields.codigoMunicipioOrigem ||
      digits(fields.cepOrigem).length === 8 ||
      (fields.latitudeOrigem !== undefined &&
        fields.longitudeOrigem !== undefined),
    );
  }
  return Boolean(
    fields.codigoMunicipioDestino ||
    digits(fields.cepDestino).length === 8 ||
    (fields.latitudeDestino !== undefined &&
      fields.longitudeDestino !== undefined),
  );
}

export async function prepareOfficialPayload(
  ciotId: string,
  overrides: AnttCiotOverrides = {},
) {
  const ciot = await prisma.ciot.findUnique({
    where: { id: ciotId },
    include: { ctes: true, veiculo: true, motorista: true },
  });
  if (!ciot) throw new AppError(422, "CIOT não encontrado.");

  const company = await getCompany(ciot.empresaId);
  const cte = ciot.ctes[0];
  const rawPayload = (ciot.payloadAntt ?? {}) as any;
  const savedOverrides = (rawPayload?.antt?.camposComplementares ??
    rawPayload?.camposComplementares ??
    {}) as AnttCiotOverrides;
  const fields: AnttCiotOverrides = { ...savedOverrides, ...overrides };
  if (!fields.tipoPagamento && /pix/i.test(text(ciot.formaPagamento)))
    fields.tipoPagamento = 6;
  if (!text(fields.chavePix) && text(ciot.favorecidoPix))
    fields.chavePix = text(ciot.favorecidoPix);
  if (!text(fields.cpfCnpjCreditado))
    fields.cpfCnpjCreditado = digits(company.cnpj);

  const typeMap: Record<string, number> = {
    LOTACAO: 1,
    FRACIONADA: 2,
    TAC_AGREGADO: 3,
  };
  const contractorCnpj = digits(
    firstUseful(ciot.contratanteCnpj, cte?.tomadorCnpj, cte?.remetenteCnpj, ""),
  );
  const recipientCnpj = digits(
    firstUseful(fields.cpfCnpjDestinatario, cte?.destinatarioCnpj, ""),
  );
  // Only a server-persisted ID may be sent. A client cannot inject an official number.
  const operationId =
    rawPayload?.antt?.ambiente === env.ANTT_CIOT_ENVIRONMENT
      ? digits(rawPayload?.antt?.idOperacaoTransporte)
      : "";

  const payment: Record<string, unknown> = {
    TipoPagamento: fields.tipoPagamento,
    CpfCnpjCreditado: digits(fields.cpfCnpjCreditado || company.cnpj),
    IndPagamento: fields.indPagamento ?? 0,
  };
  if ([1, 2, 3, 4].includes(fields.tipoPagamento ?? 0)) {
    if (fields.codigoInstituicaoFinanceira)
      payment.CodigoInstituicaoFinanceira = fields.codigoInstituicaoFinanceira;
    if (text(fields.numeroAgencia))
      payment.NumeroAgencia = text(fields.numeroAgencia);
    if (text(fields.numeroConta))
      payment.NumeroConta = text(fields.numeroConta);
  }
  if (fields.tipoPagamento === 6) {
    if (text(fields.chavePix)) payment.ChavePix = text(fields.chavePix);
    if (text(fields.identificadorPix))
      payment.IdentificadorPix = text(fields.identificadorPix);
  }
  if (fields.codigoPagamento) payment.CodigoPagamento = fields.codigoPagamento;

  const origemDestino = {
    Origem: locationObject("origem", fields),
    Destino: locationObject("destino", fields),
    DistanciaPercorrida: fields.distanciaPercorrida,
  };

  const payload: Record<string, unknown> = {
    IdOperacaoTransporte: operationId,
    TipoOperacao: typeMap[ciot.tipoOperacao],
    CpfCnpjContratado: digits(company.cnpj),
    RNTRCContratado: normalizeRntrc(company.rntrc),
    CpfCnpjContratante: contractorCnpj,
    ...(normalizeRntrc(fields.rntrcContratante)
      ? { RNTRCContratante: normalizeRntrc(fields.rntrcContratante) }
      : {}),
    ...(ciot.tipoOperacao !== "TAC_AGREGADO"
      ? { CpfCnpjDestinatario: recipientCnpj }
      : {}),
    ValorFrete: numeric(ciot.valorFrete),
    DataDeclaracao:
      new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString().slice(0, 19) +
      "-03:00",
    IndContingencia: fields.indContingencia ?? false,
    ...(fields.indContingencia && text(fields.justificativaContingencia)
      ? { JustificativaContingencia: text(fields.justificativaContingencia) }
      : {}),
    DataInicioViagem: ciot.dataInicio.toISOString().slice(0, 10),
    ...(ciot.dataFim
      ? { DataFimViagem: ciot.dataFim.toISOString().slice(0, 10) }
      : {}),
    Veiculos: [
      {
        Placa: compactPlate(ciot.veiculo.placa),
        RNTRCVeiculo: normalizeRntrc(company.rntrc),
        NumeroEixos: fields.numeroEixos,
      },
      ...(fields.veiculosAdicionais ?? []).map((vehicle) => ({
        Placa: compactPlate(vehicle.placa),
        RNTRCVeiculo: normalizeRntrc(vehicle.rntrc || company.rntrc),
        NumeroEixos: vehicle.numeroEixos,
      })),
    ],
    OrigemDestino: [origemDestino],
    DadosCarga: {
      CodigoNaturezaCarga: fields.codigoNaturezaCarga,
      PesoCarga: numeric(ciot.pesoKg),
      CodigoTipoCarga: fields.codigoTipoCarga,
      ...(ciot.tipoOperacao === "FRACIONADA"
        ? {
            ContratantesCargFrac: ciot.cnpjsCargaFracionada
              .split(",")
              .map(digits)
              .filter(Boolean),
          }
        : {}),
    },
    InfPagamento: paymentEntries(payment, fields.parcelas),
    ...(ciot.tipoOperacao === "LOTACAO"
      ? {
          InfIndicadoresOperacionais: {
            IndAltoDesempenho: fields.indAltoDesempenho ?? false,
            IndRetornoVazio: fields.indRetornoVazio ?? false,
            ComposicaoVeicular: fields.composicaoVeicular ?? false,
          },
        }
      : {}),
  };

  const missing: string[] = [];
  if (ciot.tipoOperacao === "TAC_AGREGADO")
    missing.push(
      "Emissão direta disponível somente para frota própria de ETC não equiparada a TAC",
    );
  if (!ciot.dataFim) missing.push("data de término da viagem");
  if (ciot.dataFim && ciot.dataFim < ciot.dataInicio)
    missing.push("data final anterior ao início");
  if (!Number.isInteger(fields.distanciaPercorrida))
    missing.push("distância inteira em km");
  if (ciot.tipoOperacao !== "TAC_AGREGADO" && numeric(ciot.pesoKg) <= 0)
    missing.push("peso da carga maior que zero");
  if (![2, 3, 4, 5, 6].includes(fields.tipoPagamento ?? 0))
    missing.push("tipo de pagamento permitido para emissão direta (2 a 6)");
  if (!/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(compactPlate(ciot.veiculo.placa)))
    missing.push("placa do veículo válida");
  if (fields.numeroEixos && ![2, 3, 4].includes(fields.numeroEixos))
    missing.push(
      "veículo automotor com 2, 3 ou 4 eixos; informe reboques separadamente",
    );
  if (
    (fields.veiculosAdicionais ?? []).some(
      (v) =>
        !/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(compactPlate(v.placa)) ||
        ![1, 2, 3, 4].includes(v.numeroEixos) ||
        normalizeRntrc(v.rntrc || company.rntrc).length !== 9,
    )
  )
    missing.push("dados dos implementos válidos");
  if (
    [2, 3, 4].includes(fields.tipoPagamento ?? 0) &&
    (!text(fields.numeroAgencia) || !text(fields.numeroConta))
  )
    missing.push("agência e conta do creditado");
  if (
    fields.indPagamento === 1 &&
    (fields.parcelas ?? []).some(
      (p) =>
        p.valorParcela <= 0 || !/^\d{4}-\d{2}-\d{2}$/.test(p.dataVencimento),
    )
  )
    missing.push("valor e vencimento de cada parcela");
  if (
    fields.indPagamento === 1 &&
    Math.abs(
      (fields.parcelas ?? []).reduce((total, p) => total + p.valorParcela, 0) -
        numeric(ciot.valorFrete),
    ) > 0.01
  )
    missing.push("soma das parcelas igual ao valor do frete");
  if (digits(company.cnpj).length !== 14)
    missing.push("CNPJ válido da empresa transportadora");
  if (normalizeRntrc(company.rntrc).length !== 9)
    missing.push("RNTRC da empresa com 8 ou 9 dígitos");
  if (![11, 14].includes(contractorCnpj.length))
    missing.push("CPF/CNPJ do contratante");
  if (
    ciot.tipoOperacao !== "TAC_AGREGADO" &&
    ![11, 14].includes(recipientCnpj.length)
  )
    missing.push("CPF/CNPJ do destinatário");
  if (!fields.distanciaPercorrida || fields.distanciaPercorrida <= 0)
    missing.push("distância percorrida em km");
  if (!hasLocation("origem", fields))
    missing.push("localização oficial da origem (IBGE, CEP ou coordenadas)");
  if (!hasLocation("destino", fields))
    missing.push("localização oficial do destino (IBGE, CEP ou coordenadas)");
  if (!fields.codigoNaturezaCarga)
    missing.push("código ANTT da natureza da carga");
  if (!fields.codigoTipoCarga) missing.push("código ANTT do tipo de carga");
  if (!fields.numeroEixos || fields.numeroEixos < 2)
    missing.push("quantidade de eixos do veículo");
  if (!fields.tipoPagamento) missing.push("tipo de pagamento conforme DCS");
  if (
    ![11, 14].includes(digits(fields.cpfCnpjCreditado || company.cnpj).length)
  )
    missing.push("CPF/CNPJ do creditado");
  if (fields.tipoPagamento === 6 && !text(fields.chavePix))
    missing.push("chave PIX");
  if (fields.tipoPagamento === 6 && !text(fields.identificadorPix))
    missing.push("identificador PIX");
  if (
    [1, 2, 3, 4].includes(fields.tipoPagamento ?? 0) &&
    !fields.codigoInstituicaoFinanceira
  )
    missing.push("código da instituição financeira");
  if ((fields.indPagamento ?? 0) === 1 && !fields.parcelas?.length)
    missing.push("parcelas do pagamento a prazo");
  if (fields.indContingencia && !text(fields.justificativaContingencia))
    missing.push("justificativa de contingência");

  const pisoMinimo = calculatePisoMinimo(ciot, {
    ...fields,
    numeroEixos:
      (fields.numeroEixos ?? 0) +
      (fields.veiculosAdicionais ?? []).reduce((n, v) => n + v.numeroEixos, 0),
  });
  // Local coefficients are only an estimate. The current official floor is validated by ANTT.

  const uniqueMissing = Array.from(new Set(missing));
  const checklist = [
    {
      key: "certificado",
      label: "Certificado A1 cadastrado",
      ok: cloudflareRuntime()
        ? Boolean(getRuntimeAnttMtls().binding)
        : Boolean(company.certificadoArquivo?.trim()),
    },
    {
      key: "rntrc",
      label: "RNTRC da empresa válido",
      ok: normalizeRntrc(company.rntrc).length === 9,
    },
    { key: "cte", label: "CT-es vinculados ou preenchimento manual", ok: true },
    {
      key: "motorista",
      label: "Motorista selecionado",
      ok: Boolean(ciot.motoristaId),
    },
    {
      key: "veiculo",
      label: "Veículo e placa selecionados",
      ok: Boolean(compactPlate(ciot.veiculo.placa)),
    },
    {
      key: "localizacao",
      label: "Origem e destino oficiais",
      ok: hasLocation("origem", fields) && hasLocation("destino", fields),
    },
    {
      key: "carga",
      label: "Tipo de carga e eixos informados",
      ok: Boolean(fields.codigoTipoCarga && fields.numeroEixos),
    },
    {
      key: "pagamento",
      label: "Pagamento configurado",
      ok: Boolean(fields.tipoPagamento),
    },
    { key: "piso", label: "Piso mínimo será validado pela ANTT", ok: true },
    {
      key: "payload",
      label: "Payload sem pendências",
      ok: uniqueMissing.length === 0,
    },
  ];

  return {
    ciot,
    company,
    payload,
    missing: uniqueMissing,
    fields,
    pisoMinimo,
    checklist,
  };
}

function fullCiotCode(ciot: {
  numeroCiot: string | null;
  codigoVerificador: string | null;
}) {
  const direct = digits(ciot.numeroCiot);
  if (direct.length === 16) return direct;
  const verifier = digits(ciot.codigoVerificador);
  return `${direct}${verifier}`;
}

async function loadAuthorizedCiot(ciotId: string) {
  const ciot = await prisma.ciot.findUnique({
    where: { id: ciotId },
  });
  if (!ciot) throw new AppError(422, "CIOT não encontrado.");
  const company = await getCompany(ciot.empresaId);
  if ((ciot.payloadAntt as any)?.antt?.ambiente !== env.ANTT_CIOT_ENVIRONMENT)
    throw new AppError(422, "O CIOT pertence a outro ambiente ANTT.");
  if (ciot.status !== "AUTORIZADO")
    throw new AppError(422, "A ação exige CIOT autorizado e ativo.");
  const code = fullCiotCode(ciot);
  if (code.length !== 16)
    throw new AppError(
      422,
      "O CIOT ainda não possui código completo de 16 dígitos.",
    );
  return { ciot, company, code };
}

export const anttCiotService = {
  async configuration(companyId?: string | null) {
    const company = await getCompany(companyId);
    const certificateValidation = validateCertificateLocally(company);
    return {
      company: {
        id: company.id,
        razaoSocial: company.razaoSocial,
        nomeFantasia: company.nomeFantasia,
        cnpj: digits(company.cnpj),
        rntrc: normalizeRntrc(company.rntrc),
        certificateConfigured: cloudflareRuntime()
          ? Boolean(getRuntimeAnttConnector().url || getRuntimeAnttMtls().binding)
          : Boolean(company.certificadoArquivo?.trim()),
        passwordConfigured: Boolean(company.certificadoSenha?.trim()),
        certificateValidity: company.certificadoValidade?.toISOString() ?? null,
        active: company.ativa,
        default: company.empresaPadrao,
      },
      integration: {
        environment: env.ANTT_CIOT_ENVIRONMENT,
        baseUrl: env.ANTT_CIOT_BASE_URL,
        networkEnabled: env.ANTT_CIOT_ENABLE_NETWORK,
        transport: cloudflareRuntime()
          ? (getRuntimeAnttConnector().url || getRuntimeAnttConnector().token
            ? "PC local (Node.js + Cloudflare Tunnel)" : "Cloudflare mTLS")
          : "Node.js A1",
        generatorKeyConfigured: Boolean(env.ANTT_CIOT_GENERATOR_KEY),
        timeoutMs: env.ANTT_CIOT_TIMEOUT_MS,
      },
      certificate: certificateValidation,
    };
  },

  async certificate(companyId?: string | null) {
    const company = await getCompany(companyId);
    const validation = validateCertificateLocally(company);
    return {
      ok: validation.ok,
      message: validation.message,
      companyId: company.id,
      cnpj: digits(company.cnpj),
      rntrc: normalizeRntrc(company.rntrc),
      validity: company.certificadoValidade?.toISOString() ?? null,
    };
  },
  async diagnostic(companyId?: string | null) {
    const company = await getCompany(companyId);
    const certificateValidation = validateCertificateLocally(company);
    const local = {
      companyId: company.id,
      cnpj: digits(company.cnpj),
      rntrc: normalizeRntrc(company.rntrc),
      certificateConfigured: cloudflareRuntime()
        ? Boolean(getRuntimeAnttConnector().url || getRuntimeAnttMtls().binding)
        : Boolean(company.certificadoArquivo?.trim()),
      passwordConfigured: Boolean(company.certificadoSenha?.trim()),
      environment: env.ANTT_CIOT_ENVIRONMENT,
      baseUrl: env.ANTT_CIOT_BASE_URL,
      networkEnabled: env.ANTT_CIOT_ENABLE_NETWORK,
      transport: cloudflareRuntime()
        ? (getRuntimeAnttConnector().url || getRuntimeAnttConnector().token
          ? "PC local (Node.js + Cloudflare Tunnel)" : "Cloudflare mTLS")
        : "Node.js A1",
      generatorKeyConfigured: Boolean(env.ANTT_CIOT_GENERATOR_KEY),
      certificateValidation,
    };
    if (!certificateValidation.ok) {
      return {
        ok: false,
        local,
        message: `Certificado inválido: ${certificateValidation.message}`,
      };
    }
    if (!env.ANTT_CIOT_ENABLE_NETWORK) {
      return {
        ok: true,
        local,
        message:
          "Configuração local validada. Chamadas externas estão desativadas.",
      };
    }
    const result = await postService(company, env.ANTT_CIOT_PATH_TRANSPORTER, {
      CpfCnpjInteressado: digits(company.cnpj),
      CpfCnpjTransportador: digits(company.cnpj),
      RNTRCTransportador: normalizeRntrc(company.rntrc),
    });
    return { ok: Boolean(result?.RNTRCAtivo), local, antt: result };
  },

  async fleet(companyId: string | undefined, plates: string[]) {
    const company = await getCompany(companyId);
    const normalizedPlates = Array.from(
      new Set(plates.map(compactPlate).filter(Boolean)),
    );
    if (!normalizedPlates.length)
      throw new AppError(
        422,
        "Informe ao menos uma placa para consultar a frota.",
      );
    if (!env.ANTT_CIOT_ENABLE_NETWORK) {
      return {
        simulated: true,
        payload: {
          CpfCnpjInteressado: digits(company.cnpj),
          CpfCnpjTransportador: digits(company.cnpj),
          RNTRCTransportador: normalizeRntrc(company.rntrc),
          Placas: normalizedPlates,
        },
      };
    }
    return postService(company, env.ANTT_CIOT_PATH_FLEET, {
      CpfCnpjInteressado: digits(company.cnpj),
      CpfCnpjTransportador: digits(company.cnpj),
      RNTRCTransportador: normalizeRntrc(company.rntrc),
      Placas: normalizedPlates,
    });
  },

  async prepare(ciotId: string, overrides: AnttCiotOverrides = {}) {
    const prepared = await prepareOfficialPayload(ciotId, overrides);
    if (
      ["AUTORIZADO", "CANCELADO", "ENCERRADO", "PROCESSANDO"].includes(
        prepared.ciot.status,
      )
    )
      throw new AppError(
        422,
        "A operação já foi enviada. Consulte seu resultado antes de alterar.",
      );
    await prisma.ciot.update({
      where: {
        id: ciotId,
        status: { in: ["RASCUNHO", "PRONTO_ENVIO", "REJEITADO"] },
      },
      data: {
        payloadAntt: {
          antt: {
            ...preservedAntt(prepared.ciot.payloadAntt),
            versaoDcs: "1.1",
            ambiente: env.ANTT_CIOT_ENVIRONMENT,
            camposComplementares: prepared.fields as any,
            declaracaoOperacaoTransporte: prepared.payload as any,
            pendencias: prepared.missing,
            pisoMinimo: prepared.pisoMinimo as any,
            checklist: prepared.checklist as any,
          },
        },
        preparadoEm: new Date(),
        status: prepared.missing.length ? "RASCUNHO" : "PRONTO_ENVIO",
        mensagemRetorno: prepared.missing.length
          ? `Pendências ANTT: ${prepared.missing.join(", ")}`
          : "Payload DCS v1.1 validado e pronto para homologação.",
      },
    });
    return {
      payload: prepared.payload,
      missing: prepared.missing,
      fields: prepared.fields,
      pisoMinimo: prepared.pisoMinimo,
      checklist: prepared.checklist,
    };
  },

  async simulate(ciotId: string, overrides: AnttCiotOverrides = {}) {
    const prepared = await prepareOfficialPayload(ciotId, overrides);
    if (
      ["AUTORIZADO", "CANCELADO", "ENCERRADO", "PROCESSANDO"].includes(
        prepared.ciot.status,
      )
    )
      throw new AppError(
        422,
        "A operação já foi enviada. Consulte seu resultado antes de alterar.",
      );
    const certificate = validateCertificateLocally(prepared.company);
    const blockers = prepared.checklist
      .filter((item) => !item.ok)
      .map((item) => item.label);

    if (!certificate.ok) blockers.push("Certificado ou binding mTLS inválido");
    const warnings: string[] = [];
    if (env.ANTT_CIOT_ENVIRONMENT !== "homologacao") {
      warnings.push(
        "O ambiente configurado não é homologação. A simulação não realizou chamada externa.",
      );
    }
    if (env.ANTT_CIOT_ENABLE_NETWORK) {
      warnings.push(
        "A rede externa está habilitada, mas o modo simulação nunca envia dados à ANTT.",
      );
    }
    if (!certificate.ok) {
      warnings.push(`Certificado A1: ${certificate.message}`);
    }

    const report = {
      mode: "SIMULACAO",
      generatedAt: new Date().toISOString(),
      ciotId,
      environment: env.ANTT_CIOT_ENVIRONMENT,
      externalRequestPerformed: false,
      readyForHomologation: blockers.length === 0,
      company: {
        id: prepared.company.id,
        cnpj: digits(prepared.company.cnpj),
        rntrc: normalizeRntrc(prepared.company.rntrc),
        certificateConfigured: Boolean(
          prepared.company.certificadoArquivo?.trim(),
        ),
        certificateValid: certificate.ok,
        certificateMessage: certificate.message,
        certificateValidity:
          prepared.company.certificadoValidade?.toISOString() ?? null,
      },
      summary: {
        checklistTotal: prepared.checklist.length,
        checklistOk: prepared.checklist.filter((item) => item.ok).length,
        blockers: blockers.length,
        warnings: warnings.length,
        floorApplicable: prepared.pisoMinimo.aplicavel,
        belowMinimumFloor: prepared.pisoMinimo.abaixoDoPiso,
      },
      blockers,
      warnings,
      checklist: prepared.checklist,
      minimumFreightFloor: prepared.pisoMinimo,
      complementaryFields: prepared.fields,
      officialPayload: prepared.payload,
    };

    const currentPayload =
      prepared.ciot.payloadAntt &&
      typeof prepared.ciot.payloadAntt === "object" &&
      !Array.isArray(prepared.ciot.payloadAntt)
        ? (prepared.ciot.payloadAntt as Record<string, unknown>)
        : {};

    await prisma.ciot.update({
      where: {
        id: ciotId,
        status: { in: ["RASCUNHO", "PRONTO_ENVIO", "REJEITADO"] },
      },
      data: {
        payloadAntt: {
          ...currentPayload,
          antt: {
            ...preservedAntt(prepared.ciot.payloadAntt),
            versaoDcs: "1.1",
            ambiente: env.ANTT_CIOT_ENVIRONMENT,
            camposComplementares: prepared.fields as any,
            declaracaoOperacaoTransporte: prepared.payload as any,
            pendencias: prepared.missing,
            pisoMinimo: prepared.pisoMinimo as any,
            checklist: prepared.checklist as any,
            ultimaSimulacao: report as any,
          },
        },
        preparadoEm: new Date(),
        status: blockers.length ? "RASCUNHO" : "PRONTO_ENVIO",
        mensagemRetorno: blockers.length
          ? `Simulação concluída com ${blockers.length} bloqueio(s): ${blockers.join(", ")}`
          : "Simulação concluída sem bloqueios. CIOT pronto para homologação.",
      },
    });

    return report;
  },

  async emit(ciotId: string, overrides: AnttCiotOverrides = {}) {
    if (!env.ANTT_CIOT_ENABLE_NETWORK)
      throw new AppError(
        422,
        "Ative ANTT_CIOT_ENABLE_NETWORK na configuração para enviar à ANTT.",
      );
    const prepared = await prepareOfficialPayload(ciotId, overrides);
    if (prepared.missing.length)
      throw new AppError(
        422,
        `Campos obrigatórios pendentes: ${prepared.missing.join(", ")}`,
      );
    const cert = validateCertificateLocally(prepared.company);
    if (!cert.ok) throw new AppError(422, cert.message);
    const existing: any = (prepared.ciot.payloadAntt as any)?.antt ?? {};
    const lock = await prisma.ciot.updateMany({
      where: {
        id: ciotId,
        status: { in: ["RASCUNHO", "PRONTO_ENVIO", "REJEITADO"] },
      },
      data: { status: "PROCESSANDO" },
    });
    if (lock.count !== 1)
      throw new AppError(
        422,
        "Operação já enviada ou em processamento. Consulte o resultado antes de reenviar.",
      );
    let declarationStarted = false;
    let stored: any = existing;
    try {
      const transportPayload = {
        CpfCnpjInteressado: digits(prepared.company.cnpj),
        CpfCnpjTransportador: digits(prepared.company.cnpj),
        RNTRCTransportador: normalizeRntrc(prepared.company.rntrc),
      };
      const transporter: any = await postService(
        prepared.company,
        env.ANTT_CIOT_PATH_TRANSPORTER,
        transportPayload,
      );
      if (
        !codesFrom(transporter).includes("111") ||
        transporter.RNTRCAtivo !== true ||
        transporter.TipoTransportador !== "ETC" ||
        transporter.EquiparadoTAC !== false
      )
        throw new AppError(
          422,
          "A ANTT não confirmou ETC ativa e não equiparada a TAC. Revise o cadastro ou utilize uma instituição habilitada.",
        );
      const plates = (
        prepared.payload.Veiculos as Array<{ Placa: string }>
      ).map((v) => v.Placa);
      const fleet: any = await postService(
        prepared.company,
        env.ANTT_CIOT_PATH_FLEET,
        { ...transportPayload, Placas: plates },
      );
      const belongs = (value: unknown) =>
        value === true || value === 1 || value === "true" || value === "1";
      if (
        !codesFrom(fleet).includes("111") ||
        !plates.every((plate) =>
          asArray(fleet.Frota).some(
            (vehicle: any) =>
              compactPlate(vehicle.PlacaVeiculo) === plate &&
              belongs(vehicle.SituacaoVeiculoFrotaTransportador),
          ),
        )
      )
        throw new AppError(
          422,
          "A ANTT não confirmou todos os veículos na frota RNTRC da empresa.",
        );
      // Keep the same ID on explicit rejections and never allocate again after an ambiguous timeout.
      const id =
        existing.ambiente === env.ANTT_CIOT_ENVIRONMENT &&
        /^\d{12}$/.test(existing.idOperacaoTransporte ?? "")
          ? existing.idOperacaoTransporte
          : await generateId(prepared.company);
      prepared.payload.IdOperacaoTransporte = id;
      stored = {
        ...existing,
        ambiente: env.ANTT_CIOT_ENVIRONMENT,
        versaoDcs: "1.1",
        idOperacaoTransporte: id,
        anoDeclaracao: existing.anoDeclaracao ?? new Date().getUTCFullYear(),
        camposComplementares: prepared.fields,
        declaracaoOperacaoTransporte: prepared.payload,
      };
      await prisma.ciot.update({
        where: { id: ciotId },
        data: { payloadAntt: { antt: stored }, preparadoEm: new Date() },
      });
      declarationStarted = true;
      const result: any = await postService(
        prepared.company,
        env.ANTT_CIOT_PATH_DECLARE,
        prepared.payload,
      );
      const parsed = parseDeclaration(result, id);
      const definitiveRejection =
        codesFrom(result).length > 0 && !codesFrom(result).includes("110");
      const status = parsed.success
        ? "AUTORIZADO"
        : definitiveRejection
          ? "REJEITADO"
          : "PROCESSANDO";
      const updated = await prisma.ciot.update({
        where: { id: ciotId },
        data: {
          status,
          numeroCiot: parsed.success ? parsed.id : null,
          codigoVerificador: parsed.success ? parsed.verifier : null,
          protocolo: text(result.Protocolo) || null,
          mensagemRetorno:
            messagesFrom(result)
              .concat(text(result.AvisoTransportador) || [])
              .join(" | ") ||
            "Retorno inconclusivo. Consulte a operação antes de reenviar.",
          payloadAntt: { antt: { ...stored, retornoDeclaracao: result } },
        },
        include: { ctes: true },
      });
      return {
        item: updated,
        result,
        codes: codesFrom(result),
        success: parsed.success,
      };
    } catch (error) {
      await prisma.ciot.update({
        where: { id: ciotId },
        data: {
          status: declarationStarted ? "PROCESSANDO" : "REJEITADO",
          mensagemRetorno:
            error instanceof Error
              ? error.message
              : "Falha na comunicação com ANTT.",
        },
      });
      throw error;
    }
  },

  async query(ciotId: string) {
    const ciot = await prisma.ciot.findUnique({
      where: { id: ciotId },
      });
    if (!ciot) throw new AppError(422, "CIOT não encontrado.");
    const stored: any = (ciot.payloadAntt as any)?.antt ?? {};
    if (stored.ambiente !== env.ANTT_CIOT_ENVIRONMENT)
      throw new AppError(
        422,
        "Consulte o CIOT no mesmo ambiente em que foi enviado.",
      );
    const id =
      stored.idOperacaoTransporte || digits(ciot.numeroCiot).slice(0, 12);
    if (!/^\d{12}$/.test(id))
      throw new AppError(
        422,
        "Não há identificador oficial persistido para consulta.",
      );
    if (!env.ANTT_CIOT_ENABLE_NETWORK)
      throw new AppError(422, "A consulta externa está desativada.");
    const company = await getCompany(ciot.empresaId);
    const result: any = await postService(company, env.ANTT_CIOT_PATH_QUERY, {
      CodigoIdentificacaoOperacao: id,
      AnoDeclaracao: stored.anoDeclaracao ?? ciot.createdAt.getUTCFullYear(),
    });
    // Query returns code 111 rather than declaration's 110.
    const parsed = parseDeclaration(
      {
        ...result,
        Codigo: codesFrom(result).includes("111") ? "110" : result.Codigo,
      },
      id,
    );
    await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        ...(parsed.success && ciot.status === "PROCESSANDO"
          ? {
              status: "AUTORIZADO",
              numeroCiot: parsed.id,
              codigoVerificador: parsed.verifier,
            }
          : {}),
        protocolo: text(result.Protocolo) || ciot.protocolo,
        mensagemRetorno:
          messagesFrom(result).join(" | ") || ciot.mensagemRetorno,
        payloadAntt: {
          ...((ciot.payloadAntt as any) ?? {}),
          ultimaConsulta: result,
        },
      },
    });
    return { ...result, reconciled: parsed.success };
  },

  async cancel(ciotId: string, reason: string) {
    const { ciot, company, code } = await loadAuthorizedCiot(ciotId);
    if (!text(reason))
      throw new AppError(422, "Informe o motivo do cancelamento.");
    if (!env.ANTT_CIOT_ENABLE_NETWORK)
      throw new AppError(422, "O cancelamento externo está desativado.");
    const result: any = await postService(company, env.ANTT_CIOT_PATH_CANCEL, {
      CodigoIdentificacaoOperacao: code,
      MotivoCancelamento: text(reason).slice(0, 500),
    });
    const success =
      codesFrom(result).includes("110") && Boolean(result?.DataCancelamento);
    const updated = await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        status: success ? "CANCELADO" : ciot.status,
        protocolo: text(result?.Protocolo) || ciot.protocolo,
        mensagemRetorno:
          messagesFrom(result).join(" | ") || JSON.stringify(result),
        payloadAntt: {
          ...((ciot.payloadAntt as any) ?? {}),
          retornoCancelamento: result,
        },
      },
    });
    return { item: updated, result, success };
  },

  async rectify(ciotId: string, overrides: AnttCiotOverrides = {}) {
    const { ciot, company, code } = await loadAuthorizedCiot(ciotId);
    if (!env.ANTT_CIOT_ENABLE_NETWORK)
      throw new AppError(422, "A retificação externa está desativada.");
    if (ciot.tipoOperacao === "LOTACAO")
      throw new AppError(
        422,
        "A ANTT não permite retificação de carga lotação.",
      );
    const prepared = await prepareOfficialPayload(ciotId, overrides);
    const declaration: any = prepared.payload;
    const payload = {
      CodigoIdentificacaoOperacao: code,
      ValorFrete: numeric(ciot.valorFrete),
      ...(ciot.dataFim
        ? { DataFimViagem: ciot.dataFim.toISOString().slice(0, 10) }
        : {}),
      ...(ciot.tipoOperacao === "TAC_AGREGADO"
        ? {
            OrigemDestino: declaration.OrigemDestino,
            DadosCarga: declaration.DadosCarga,
          }
        : {}),
    };
    const result: any = await postService(
      company,
      env.ANTT_CIOT_PATH_RECTIFY,
      payload,
    );
    const success =
      codesFrom(result).includes("110") && Boolean(result?.DataRetificacao);
    await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        protocolo: text(result?.Protocolo) || ciot.protocolo,
        mensagemRetorno:
          messagesFrom(result).join(" | ") || JSON.stringify(result),
        payloadAntt: {
          ...((ciot.payloadAntt as any) ?? {}),
          retornoRetificacao: result,
        },
      },
    });
    return { result, success };
  },

  async close(
    ciotId: string,
    overrides: AnttCiotOverrides & { quantidadeViagens?: number } = {},
  ) {
    const { ciot, company, code } = await loadAuthorizedCiot(ciotId);
    if (!env.ANTT_CIOT_ENABLE_NETWORK)
      throw new AppError(422, "O encerramento externo está desativado.");
    const payload: Record<string, unknown> = {
      CodigoIdentificacaoOperacao: code,
    };
    if (ciot.tipoOperacao === "TAC_AGREGADO") {
      payload.OrigemDestino = [
        {
          Origem: locationObject("origem", overrides),
          Destino: locationObject("destino", overrides),
          DistanciaPercorrida: overrides.distanciaPercorrida,
          QtdViagens: overrides.quantidadeViagens,
        },
      ];
    }
    if (ciot.tipoOperacao === "LOTACAO")
      payload.DadosCarga = { PesoTotalCarga: numeric(ciot.pesoKg) };
    const result: any = await postService(
      company,
      env.ANTT_CIOT_PATH_CLOSE,
      payload,
    );
    const success =
      codesFrom(result).includes("110") && Boolean(result?.DataEncerramento);
    const updated = await prisma.ciot.update({
      where: { id: ciotId },
      data: {
        status: success ? "ENCERRADO" : ciot.status,
        protocolo: text(result?.Protocolo) || ciot.protocolo,
        mensagemRetorno:
          messagesFrom(result).join(" | ") || JSON.stringify(result),
        payloadAntt: {
          ...((ciot.payloadAntt as any) ?? {}),
          retornoEncerramento: result,
        },
      },
    });
    return { item: updated, result, success };
  },

  async exception(companyId?: string) {
    const company = await getCompany(companyId);
    if (!env.ANTT_CIOT_ENABLE_NETWORK)
      throw new AppError(422, "A consulta externa está desativada.");
    return getService(company, env.ANTT_CIOT_PATH_EXCEPTION, {
      CPFCNPJTransportador: digits(company.cnpj),
    });
  },
};
