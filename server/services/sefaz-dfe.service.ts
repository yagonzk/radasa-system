import https from "node:https";
import { connect as tlsConnect, createSecureContext } from "node:tls";
import { gunzipSync } from "node:zlib";
import { XMLParser } from "fast-xml-parser";
import { prisma } from "../lib/prisma.js";
import { interpretarAbastecimentoXml, sugerirVinculosAbastecimento } from "./abastecimento-xml.service.js";
import { abastecimentosService } from "./abastecimentos.service.js";

const ENDPOINT = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
const SOAP_ACTION = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";
const NFE_NS = "http://www.portalfiscal.inf.br/nfe";
const WS_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";
const MAX_DOCS_PER_SYNC = 10;
const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, trimValues: true, parseTagValue: false });
const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const text = (v: unknown) => String(v ?? "").trim();
const padNsu = (v: unknown) => (digits(v) || "0").padStart(15, "0");

const ufCodes: Record<string, string> = { AC:"12",AL:"27",AP:"16",AM:"13",BA:"29",CE:"23",DF:"53",ES:"32",GO:"52",MA:"21",MT:"51",MS:"50",MG:"31",PA:"15",PB:"25",PR:"41",PE:"26",PI:"22",RJ:"33",RN:"24",RS:"43",RO:"11",RR:"14",SC:"42",SP:"35",SE:"28",TO:"17" };

type MtlsFetcher = {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
};

function runtimeFlags() {
  const g = globalThis as typeof globalThis & {
    __RADASA_CLOUDFLARE?: boolean;
    __RADASA_SEFAZ_MTLS?: MtlsFetcher;
    __RADASA_SEFAZ_AGENT?: boolean;
  };
  return {
    cloudflare: Boolean(g.__RADASA_CLOUDFLARE),
    mtls: g.__RADASA_SEFAZ_MTLS,
    agent: Boolean(g.__RADASA_SEFAZ_AGENT),
  };
}

async function postSoapWithCloudflareMtls(body: string) {
  const runtime = runtimeFlags();
  if (!runtime.mtls) {
    throw new Error("Binding SEFAZ_MTLS não configurado no Cloudflare. Vincule o certificado A1 ao Worker antes de sincronizar.");
  }

  const payload = Buffer.from(body, "utf8");
  console.info("[sefaz-mtls] iniciando consulta DF-e", {
    endpoint: ENDPOINT,
    payloadBytes: payload.byteLength,
    transport: "cloudflare-mtls-binding",
  });

  const response = await runtime.mtls.fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${SOAP_ACTION}"`,
      Accept: "text/xml, application/xml",
      "Accept-Encoding": "identity",
    },
    body,
  });

  const responseText = await response.text();
  console.info("[sefaz-mtls] resposta DF-e recebida", {
    status: response.status,
    bodyBytes: Buffer.byteLength(responseText),
  });

  return { status: response.status, text: responseText };
}

async function postSoapWithNodeHttps(pfx: Buffer, passphrase: string, body: string) {
  const endpoint = new URL(ENDPOINT);
  const payload = Buffer.from(body, "utf8");
  console.info("[sefaz-agent] iniciando consulta DF-e", {
    host: endpoint.hostname,
    path: endpoint.pathname,
    payloadBytes: payload.byteLength,
    transport: "node:https-pfx",
  });

  return await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const request = https.request({
      protocol: "https:",
      hostname: endpoint.hostname,
      port: Number(endpoint.port || 443),
      path: `${endpoint.pathname}${endpoint.search}`,
      method: "POST",
      pfx,
      passphrase,
      minVersion: "TLSv1.2",
      rejectUnauthorized: true,
      servername: endpoint.hostname,
      headers: {
        "Content-Type": "text/xml; charset=utf-8",
        SOAPAction: `"${SOAP_ACTION}"`,
        Accept: "text/xml, application/xml",
        "Accept-Encoding": "identity",
        "Content-Length": String(payload.byteLength),
        Connection: "close",
      },
    }, (response) => {
      const chunks: Buffer[] = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const text = Buffer.concat(chunks).toString("utf8");
        console.info("[sefaz-agent] resposta DF-e recebida", {
          status: response.statusCode || 0,
          bodyBytes: Buffer.byteLength(text),
        });
        resolve({ status: response.statusCode || 0, text });
      });
    });

    request.setTimeout(45000, () => request.destroy(new Error("Timeout de 45s ao consultar o Ambiente Nacional da NF-e.")));
    request.on("error", (error: any) => {
      const code = String(error?.code || "");
      const msg = error instanceof Error ? error.message : String(error);
      reject(new Error(`Falha HTTPS/mTLS no serviço auxiliar SEFAZ: ${msg}${code ? ` (${code})` : ""}`));
    });
    request.end(payload);
  });
}

function decodeCertificate(value: string) {
  const normalized = value.trim();
  const comma = normalized.indexOf(",");
  const base64 = normalized.startsWith("data:") && comma >= 0 ? normalized.slice(comma + 1) : normalized;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("Certificado A1 vazio ou inválido.");
  return buffer;
}

function decodeChunkedBody(body: Buffer): Buffer {
  const chunks: Buffer[] = [];
  let offset = 0;

  while (offset < body.length) {
    const lineEnd = body.indexOf("\r\n", offset, "latin1");
    if (lineEnd < 0) throw new Error("Resposta HTTP chunked inválida: tamanho do bloco ausente.");

    const sizeLine = body.subarray(offset, lineEnd).toString("latin1").trim();
    const sizeHex = sizeLine.split(";", 1)[0]?.trim() || "";
    const size = Number.parseInt(sizeHex, 16);
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(`Resposta HTTP chunked inválida: tamanho de bloco '${sizeLine}'.`);
    }

    offset = lineEnd + 2;
    if (size === 0) break;

    const chunkEnd = offset + size;
    if (chunkEnd > body.length) {
      throw new Error("Resposta HTTP chunked incompleta: bloco maior que os bytes recebidos.");
    }

    chunks.push(body.subarray(offset, chunkEnd));
    offset = chunkEnd;

    if (body.subarray(offset, offset + 2).toString("latin1") !== "\r\n") {
      throw new Error("Resposta HTTP chunked inválida: separador CRLF ausente.");
    }
    offset += 2;
  }

  return Buffer.concat(chunks);
}


async function postSoapWithStoredCertificate(pfx: Buffer, passphrase: string, body: string) {
  const endpoint = new URL(ENDPOINT);
  const payload = Buffer.from(body, "utf8");

  console.info("[sefaz-transport] iniciando consulta DF-e", {
    host: endpoint.hostname,
    port: Number(endpoint.port || 443),
    path: `${endpoint.pathname}${endpoint.search}`,
    soapAction: SOAP_ACTION,
    payloadBytes: payload.byteLength,
    transport: "node:tls-direct",
  });

  return await new Promise<{ status: number; text: string }>((resolve, reject) => {
    const chunks: Buffer[] = [];
    let settled = false;
    let secureConnected = false;
    let authorized: boolean | undefined;
    let authorizationError = "";

    const done = (fn: () => void) => {
      if (settled) return;
      settled = true;
      fn();
    };
    const fail = (error: unknown) => done(() => reject(error instanceof Error ? error : new Error(String(error))));

    let secureContext;
    try {
      secureContext = createSecureContext({ pfx, passphrase, minVersion: "TLSv1.2" });
    } catch (error) {
      fail(new Error(`Não foi possível abrir o certificado A1/PFX cadastrado na Empresa: ${error instanceof Error ? error.message : String(error)}`));
      return;
    }

    const socket = tlsConnect(
      {
        host: endpoint.hostname,
        port: Number(endpoint.port || 443),
        servername: endpoint.hostname,
        secureContext,
      },
      () => {
        secureConnected = true;
        authorized = socket.authorized;
        authorizationError = String(socket.authorizationError || "");
        console.info("[sefaz-transport] TLS conectado", {
          host: endpoint.hostname,
          authorized,
          authorizationError: authorizationError || null,
          alpnProtocol: socket.alpnProtocol || null,
          protocol: socket.getProtocol?.() || null,
        });

        const requestHead = [
          `POST ${endpoint.pathname}${endpoint.search} HTTP/1.1`,
          `Host: ${endpoint.host}`,
          "Content-Type: text/xml; charset=utf-8",
          `SOAPAction: "${SOAP_ACTION}"`,
          "Accept: text/xml, application/xml",
          "Accept-Encoding: identity",
          `Content-Length: ${payload.byteLength}`,
          "Connection: close",
          "",
          "",
        ].join("\r\n");
        socket.write(requestHead);
        socket.write(payload);
      },
    );

    socket.setTimeout?.(45000, () => {
      socket.destroy();
      fail(new Error("Timeout de 45s na conexão direta TLS com o Ambiente Nacional da NF-e."));
    });
    socket.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    socket.on("error", (error: any) => {
      const code = String(error?.code || "");
      const msg = error instanceof Error ? error.message : String(error);
      fail(new Error(`Falha TLS direta ao consultar ${endpoint.hostname}${endpoint.pathname}: ${msg}${code ? ` (${code})` : ""}`));
    });

    const finalizeResponse = () => {
      if (settled) return;
      try {
        const raw = Buffer.concat(chunks);
        if (!raw.length) {
          const tlsInfo = secureConnected
            ? `TLS conectado (authorized=${String(authorized)}, authorizationError=${authorizationError || "nenhum"}), mas o servidor encerrou sem enviar bytes HTTP.`
            : "A conexão foi encerrada antes do handshake TLS ser concluído.";
          throw new Error(`SEFAZ não retornou resposta HTTP. ${tlsInfo}`);
        }

        const headerEnd = raw.indexOf("\r\n\r\n", 0, "utf8");
        if (headerEnd < 0) {
          const firstBytes = raw.subarray(0, Math.min(raw.length, 120)).toString("latin1").replace(/[^\x20-\x7E]/g, ".");
          throw new Error(`Resposta HTTP inválida da SEFAZ (${raw.length} bytes). Início recebido: ${firstBytes}`);
        }

        const headerText = raw.subarray(0, headerEnd).toString("latin1");
        const statusLine = headerText.split("\r\n", 1)[0] || "";
        const status = Number(statusLine.match(/^HTTP\/\d(?:\.\d)?\s+(\d{3})/i)?.[1] || 0);
        let responseBody = raw.subarray(headerEnd + 4);

        if (/transfer-encoding:\s*chunked/i.test(headerText)) {
          responseBody = decodeChunkedBody(responseBody);
        }

        const responseText = responseBody.toString("utf8");
        console.info("[sefaz-transport] resposta DF-e recebida", {
          host: endpoint.hostname,
          path: endpoint.pathname,
          status,
          statusLine,
          headerBytes: headerEnd,
          bodyBytes: responseBody.byteLength,
        });
        done(() => resolve({ status, text: responseText }));
      } catch (error) {
        fail(error);
      }
    };

    socket.on("end", finalizeResponse);
    socket.on("close", finalizeResponse);
  });
}
function soapEnvelope(cnpj: string, cUf: string, ultNsu: string) {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    <nfeDistDFeInteresse xmlns="${WS_NS}">
      <nfeDadosMsg xmlns="${WS_NS}">
        <distDFeInt xmlns="${NFE_NS}" versao="1.01">
          <tpAmb>1</tpAmb><cUFAutor>${cUf}</cUFAutor><CNPJ>${cnpj}</CNPJ>
          <distNSU><ultNSU>${padNsu(ultNsu)}</ultNSU></distNSU>
        </distDFeInt>
      </nfeDadosMsg>
    </nfeDistDFeInteresse>
  </soap:Body>
</soap:Envelope>`;
}

function findDeep(obj: any, key: string): any {
  if (!obj || typeof obj !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const value of Object.values(obj)) {
    const found = findDeep(value, key);
    if (found) return found;
  }
  return null;
}

function arr<T>(v: T | T[] | null | undefined): T[] { return v == null ? [] : Array.isArray(v) ? v : [v]; }
function extractKey(xml: string) {
  const m = xml.match(/(?:Id=["']NFe|<chNFe>)(\d{44})/i) || xml.match(/(?<!\d)\d{44}(?!\d)/);
  return m?.[1] || m?.[0] || "";
}

function classifyXml(xml: string) {
  const normalized = xml.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/DIESEL|OLEO DIESEL|GASOLINA|ETANOL|ARLA\s*32|COMBUSTIVEL/.test(normalized)) return "ABASTECIMENTO";
  if (/PNEU|FILTRO|LUBRIFICANTE|OLEO MOTOR|PASTILHA|LONA DE FREIO|ROLAMENTO|MOLA|AMORTECEDOR|PECAS|MANUTENCAO|OFICINA|MECANIC/.test(normalized)) return "MANUTENCAO";
  return "OUTRO";
}

function parseSummary(xml: string) {
  try {
    const root = parser.parse(xml);
    const res = findDeep(root, "resNFe") || findDeep(root, "procNFe") || root;
    return {
      numero: "",
      serie: "",
      dataEmissao: text(res?.dhEmi).slice(0, 10) || null,
      emitenteCnpj: digits(res?.CNPJ || res?.CPF),
      emitenteNome: text(res?.xNome),
      valorTotal: Number(String(res?.vNF || 0).replace(",", ".")) || 0,
      placa: "",
      hodometro: null as number | null,
    };
  } catch {
    return { numero:"", serie:"", dataEmissao:null, emitenteCnpj:"", emitenteNome:"", valorTotal:0, placa:"", hodometro:null as number|null };
  }
}

type AutoImportResult = {
  status: "IGNORADO" | "ERRO" | "IMPORTADO";
  reason: string;
  abastecimentoId?: string | null;
};

async function tryAutoImport(xml: string): Promise<AutoImportResult> {
  const doc = interpretarAbastecimentoXml(xml);
  const hasFuel = doc.produtos.some((p: any) => p?.combustivel || /DIESEL|GASOLINA|ETANOL|ARLA|COMBUST/i.test(`${p?.nome ?? ""} ${p?.combustivel?.descricaoAnp ?? ""}`));
  // Um XML completo nunca deve ficar preso em PENDENTE. Quando não há
  // combustível de fato, finalizamos como IGNORADO. Quando a NF-e é de
  // abastecimento, mas falta vínculo/campo obrigatório, finalizamos como ERRO
  // com o motivo explícito para permitir correção sem criar pendência eterna.
  if (!hasFuel) return { status: "IGNORADO", reason: "NF-e sem item de combustível reconhecido." };
  const suggestions = await sugerirVinculosAbastecimento(doc);
  if (!suggestions.cliente) return { status: "ERRO", reason: "Posto/emitente não identificado para importação automática." };
  if (!suggestions.veiculo) return { status: "ERRO", reason: "Veículo/placa não identificado no XML para importação automática." };
  if (!doc.dataEmissao) return { status: "ERRO", reason: "Data de emissão ausente no XML." };

  const payload = {
    clienteId: suggestions.cliente.id,
    veiculoId: suggestions.veiculo.id,
    chaveNfe: doc.chaveNfe,
    numeroNfe: doc.numero,
    serieNfe: doc.serie,
    emitenteCnpj: doc.emitente.cnpj,
    emitenteRazaoSocial: doc.emitente.razaoSocial,
    emitenteNomeFantasia: doc.emitente.nomeFantasia,
    emitenteInscricaoEstadual: doc.emitente.inscricaoEstadual,
    emitenteEndereco: doc.emitente.endereco,
    emitenteCidade: doc.emitente.cidade,
    emitenteUf: doc.emitente.uf,
    destinatarioCnpjCpf: doc.destinatario.cnpjCpf,
    destinatarioRazaoSocial: doc.destinatario.razaoSocial,
    destinatarioEndereco: doc.destinatario.endereco,
    destinatarioCidade: doc.destinatario.cidade,
    destinatarioUf: doc.destinatario.uf,
    naturezaOperacao: doc.naturezaOperacao,
    placaXml: doc.placa,
    hodometroOrigem: doc.hodometroOrigem,
    valorProdutos: doc.totais.produtos,
    valorFrete: doc.totais.frete,
    valorSeguro: doc.totais.seguro,
    valorOutros: doc.totais.outros,
    valorIcms: doc.totais.icms,
    valorPis: doc.totais.pis,
    valorCofins: doc.totais.cofins,
    informacoesComplementares: doc.informacoesComplementares,
    dataEmissao: doc.dataEmissao,
    valorDesconto: doc.totais.desconto,
    hodometro: doc.hodometro ?? 0,
    xmlUrl: `data:application/xml;base64,${Buffer.from(xml, "utf8").toString("base64")}`,
    produtos: doc.produtos.filter((p) => p.quantidade > 0).map((p, index) => ({
      produtoId: suggestions.produtos[index]?.cadastro?.id,
      quantidadeLitros: p.quantidade,
      valorUnitario: p.valorUnitario,
      produtoXml: { codigo:p.codigo, ean:p.ean, nome:p.nome, ncm:p.ncm, cfop:p.cfop, unidade:p.unidade, combustivel:p.combustivel },
    })),
  };
  const result = await abastecimentosService.importBatch([payload], "IGNORAR");
  const first: any = result.resultados?.[0];
  return { status: first?.acao === "ERRO" ? "ERRO" : "IMPORTADO", reason: first?.erro || "", abastecimentoId: first?.item?.id || null };
}

async function saveDoc(empresaId: string, item: any) {
  const schema = text(item?.["@_schema"]);
  const nsu = padNsu(item?.["@_NSU"]);
  const xml = gunzipSync(Buffer.from(text(item?.["#text"]), "base64")).toString("utf8");
  const chave = extractKey(xml);
  if (!chave || chave.length !== 44) return { saved:false, imported:false };

  const classification = classifyXml(xml);
  let meta = parseSummary(xml);
  // resNFe é um estado de distribuição da SEFAZ, não uma falha de processamento.
  // Mantemos separado de PENDENTE para que o painel não mostre uma pendência
  // permanente enquanto aguarda o XML completo (procNFe).
  let status = schema.toLowerCase().startsWith("resnfe") ? "AGUARDANDO_XML" : "NOVO";
  let erro = status === "AGUARDANDO_XML" ? "A SEFAZ entregou apenas o resumo da NF-e; aguardando o XML completo em uma próxima distribuição." : "";
  let abastecimentoId: string | null = null;

  if (!schema.toLowerCase().startsWith("resnfe")) {
    try {
      const d = interpretarAbastecimentoXml(xml);
      meta = { numero:d.numero, serie:d.serie, dataEmissao:d.dataEmissao || null, emitenteCnpj:d.emitente.cnpj, emitenteNome:d.emitente.nomeFantasia || d.emitente.razaoSocial, valorTotal:d.totais.nota, placa:d.placa, hodometro:d.hodometro };
      if (classification === "ABASTECIMENTO") {
        const imported = await tryAutoImport(xml);
        status = imported.status;
        erro = imported.reason;
        abastecimentoId = imported.abastecimentoId ?? null;
      }
    } catch (e) {
      status = "ERRO";
      erro = e instanceof Error ? e.message : String(e);
    }
  }

  const xmlUrl = `data:application/xml;base64,${Buffer.from(xml, "utf8").toString("base64")}`;
  await prisma.sefazDocumento.upsert({
    where: { chave },
    create: { empresaId, chave, nsu, schema, tipo: schema.toLowerCase().startsWith("resnfe") ? "RESNFE" : "NFE", classificacao:classification, status, numero:meta.numero, serie:meta.serie, dataEmissao:meta.dataEmissao ? new Date(`${meta.dataEmissao}T00:00:00.000Z`) : null, emitenteCnpj:meta.emitenteCnpj, emitenteNome:meta.emitenteNome, valorTotal:meta.valorTotal, placa:meta.placa || "", hodometro:meta.hodometro, xmlUrl, dados:{ schema, nsu }, erro, abastecimentoId, importedAt: status === "IMPORTADO" ? new Date() : null },
    update: { nsu, schema, tipo: schema.toLowerCase().startsWith("resnfe") ? "RESNFE" : "NFE", classificacao:classification, status, numero:meta.numero, serie:meta.serie, dataEmissao:meta.dataEmissao ? new Date(`${meta.dataEmissao}T00:00:00.000Z`) : null, emitenteCnpj:meta.emitenteCnpj, emitenteNome:meta.emitenteNome, valorTotal:meta.valorTotal, placa:meta.placa || "", hodometro:meta.hodometro, xmlUrl, erro, abastecimentoId, importedAt: status === "IMPORTADO" ? new Date() : undefined },
  });
  return { saved:true, imported:status === "IMPORTADO" };
}

async function getCompany(empresaId?: string, options: { requireCertificate?: boolean } = {}) {
  const company = empresaId
    ? await prisma.empresa.findUnique({ where: { id: empresaId } })
    : await prisma.empresa.findFirst({
        where: { ativa: true },
        orderBy: [{ empresaPadrao: "desc" }, { createdAt: "desc" }],
      });

  if (!company) throw new Error("Empresa não encontrada.");

  const cnpj = digits(company.cnpj);
  if (cnpj.length !== 14) throw new Error("CNPJ da empresa inválido.");

  if (options.requireCertificate) {
    if (!company.certificadoArquivo?.trim()) {
      throw new Error("A empresa não possui certificado A1 cadastrado.");
    }
    if (!company.certificadoSenha?.trim()) {
      throw new Error("A senha do certificado A1 não está cadastrada.");
    }
  }

  return company;
}

export const sefazDfeService = {
  async status(empresaId?: string) {
    const company = await getCompany(empresaId);
    const state = await prisma.sefazSyncState.findUnique({ where:{ empresaId:company.id } });
    const latestImported = await prisma.sefazDocumento.findFirst({
      where: { empresaId: company.id, status: "IMPORTADO", importedAt: { not: null } },
      orderBy: { importedAt: "desc" },
      select: { importedAt: true, chave: true, numero: true, emitenteNome: true },
    });
    const counts = await prisma.sefazDocumento.groupBy({ by:["status"], where:{ empresaId:company.id }, _count:{ _all:true } });

    const runtime = runtimeFlags();
    const certificateConfigured = Boolean(company.certificadoArquivo?.trim() && company.certificadoSenha?.trim());
    const agentLastSeenAt = state?.agentLastSeenAt ?? null;
    const agentOnline = Boolean(agentLastSeenAt && Date.now() - agentLastSeenAt.getTime() < 2 * 60 * 1000);
    const lastQueryAt = state?.lastQueryAt ?? null;
    const lastCStat = String(state?.lastCStat ?? "");
    const lastMessage = String(state?.lastMessage ?? "");
    const caughtUp = Boolean(
      lastCStat === "138" &&
      state?.ultNsu &&
      state?.maxNsu &&
      state.maxNsu !== "000000000000000" &&
      Number(state.ultNsu) >= Number(state.maxNsu),
    );
    // Além de 137/656, quando uma resposta 138 já alcançou maxNSU não há mais
    // documentos pendentes. Nesse ponto também aguardamos 1 hora antes de uma
    // nova consulta para evitar Rejeição 656 (Consumo Indevido).
    const waitingSefaz = lastCStat === "137" || lastCStat === "656" || caughtUp;
    const nextScheduledAt = lastQueryAt
      ? new Date(lastQueryAt.getTime() + 90 * 60 * 1000)
      : null;
    const hasError = Boolean(lastQueryAt && lastCStat && !["137", "138", "656"].includes(lastCStat));

    return {
      active: company.ativa && certificateConfigured && (!runtime.cloudflare || agentOnline),
      frequencyMinutes: 90,
      sefazMinimumWaitMinutes: waitingSefaz ? 60 : 0,
      lastCheckAt: lastQueryAt,
      nextScheduledAt,
      lastImportedAt: latestImported?.importedAt ?? null,
      lastImported: latestImported ? {
        chave: latestImported.chave,
        numero: latestImported.numero,
        emitenteNome: latestImported.emitenteNome,
      } : null,
      status: !certificateConfigured ? "CERTIFICADO_AUSENTE" : runtime.cloudflare && !agentOnline ? "AGENTE_OFFLINE" : hasError ? "ERRO" : waitingSefaz ? "AGUARDANDO_SEFAZ" : lastQueryAt ? "ATIVA" : "AGUARDANDO_PRIMEIRA_EXECUCAO",
      message: !certificateConfigured
        ? "Cadastre o certificado A1 e a senha na aba Empresa."
        : runtime.cloudflare && !agentOnline
          ? "Agente SEFAZ local offline. Inicie o Agente SEFAZ no computador da empresa."
          : lastMessage || (lastQueryAt ? "Sincronização automática ativa pelo Agente SEFAZ local." : "Agente online; aguardando a primeira execução automática."),
      certificate: {
        configured: certificateConfigured,
        validUntil: company.certificadoValidade,
        transport: runtime.cloudflare ? "windows-local-agent" : "node:https-pfx",
        agentOnline,
        agentLastSeenAt,
      },
      empresa: { id:company.id, razaoSocial:company.razaoSocial, cnpj:company.cnpj, uf:company.uf },
      counts:Object.fromEntries(counts.map((x:any)=>[x.status,x._count._all])),
    };
  },

  async list(empresaId?: string, filters: { status?: string; classificacao?: string; search?: string } = {}) {
    const company = await getCompany(empresaId);
    const where:any = { empresaId:company.id };
    if (filters.status) where.status = filters.status;
    if (filters.classificacao) where.classificacao = filters.classificacao;
    if (filters.search) where.OR = [{chave:{contains:filters.search}},{emitenteNome:{contains:filters.search,mode:"insensitive"}},{emitenteCnpj:{contains:digits(filters.search)}},{numero:{contains:filters.search}},{placa:{contains:filters.search,mode:"insensitive"}}];
    return prisma.sefazDocumento.findMany({ where, omit:{ xmlUrl:true }, orderBy:[{dataEmissao:"desc"},{createdAt:"desc"}], take:500 });
  },

  async getXml(id: string) {
    const doc = await prisma.sefazDocumento.findUnique({ where:{ id }, select:{ xmlUrl:true, chave:true } });
    if (!doc?.xmlUrl) throw new Error("XML não armazenado.");
    return { url:doc.xmlUrl, nome:`${doc.chave}-nfe.xml` };
  },

  async retryPendingFuelImports(empresaId?: string, limit = 50) {
    const company = await getCompany(empresaId);

    // Corrige automaticamente registros antigos que ficaram como PENDENTE.
    // Resumos (resNFe) aguardam o XML completo; documentos não-abastecimento
    // são finalizados como IGNORADO. Assim PENDENTE fica reservado apenas a
    // estados transitórios e não permanece indefinidamente no painel.
    const normalizedSummaries = await prisma.sefazDocumento.updateMany({
      where: {
        empresaId: company.id,
        status: "PENDENTE",
        OR: [{ tipo: "RESNFE" }, { schema: { startsWith: "resNFe", mode: "insensitive" } }],
      },
      data: {
        status: "AGUARDANDO_XML",
        erro: "A SEFAZ entregou apenas o resumo da NF-e; aguardando o XML completo em uma próxima distribuição.",
      },
    });

    const normalizedNonFuel = await prisma.sefazDocumento.updateMany({
      where: {
        empresaId: company.id,
        status: "PENDENTE",
        classificacao: { not: "ABASTECIMENTO" },
      },
      data: {
        status: "IGNORADO",
        erro: "Documento finalizado automaticamente: não classificado como abastecimento.",
      },
    });

    const docs = await prisma.sefazDocumento.findMany({
      where: {
        empresaId: company.id,
        classificacao: "ABASTECIMENTO",
        tipo: "NFE",
        status: { in: ["NOVO", "PENDENTE"] },
        xmlUrl: { not: "" },
      },
      orderBy: [{ dataEmissao: "asc" }, { createdAt: "asc" }],
      take: Math.max(1, Math.min(200, limit)),
      select: { id: true, xmlUrl: true, status: true },
    });

    let imported = 0;
    let ignored = 0;
    let errors = 0;
    for (const stored of docs) {
      try {
        const storedXml = stored.xmlUrl;
        if (!storedXml) {
          errors += 1;
          await prisma.sefazDocumento.update({
            where: { id: stored.id },
            data: { status: "ERRO", erro: "XML não armazenado para reprocessamento." },
          });
          continue;
        }
        const encoded = storedXml.includes(",") ? storedXml.slice(storedXml.indexOf(",") + 1) : storedXml;
        const xml = Buffer.from(encoded, "base64").toString("utf8");
        const result = await tryAutoImport(xml);
        if (result.status === "IMPORTADO") imported += 1;
        else if (result.status === "IGNORADO") ignored += 1;
        else errors += 1;
        await prisma.sefazDocumento.update({
          where: { id: stored.id },
          data: {
            status: result.status,
            erro: result.reason || "",
            abastecimentoId: result.abastecimentoId ?? undefined,
            importedAt: result.status === "IMPORTADO" ? new Date() : undefined,
          },
        });
      } catch (error) {
        errors += 1;
        await prisma.sefazDocumento.update({
          where: { id: stored.id },
          data: { status: "ERRO", erro: error instanceof Error ? error.message : String(error) },
        }).catch(() => undefined);
      }
    }
    return {
      checked: docs.length,
      imported,
      ignored,
      errors,
      normalized: normalizedSummaries.count + normalizedNonFuel.count,
      awaitingXml: normalizedSummaries.count,
    };
  },

  async syncLocal(empresaId?: string) {
    const runtime = runtimeFlags();
    const company = await getCompany(empresaId, { requireCertificate: !runtime.cloudflare });
    const cnpj = digits(company.cnpj);
    const cUf = ufCodes[text(company.uf).toUpperCase()] || "51";
    const state = await prisma.sefazSyncState.upsert({ where:{ empresaId:company.id }, create:{ empresaId:company.id }, update:{} });
    const caughtUp = Boolean(
      state.lastCStat === "138" &&
      state.maxNsu !== "000000000000000" &&
      Number(state.ultNsu) >= Number(state.maxNsu),
    );
    const requiresCooldown = state.lastCStat === "137" || state.lastCStat === "656" || caughtUp;
    if (requiresCooldown && state.lastQueryAt) {
      const elapsed = Date.now() - state.lastQueryAt.getTime();
      const waitMs = 60 * 60 * 1000;
      if (elapsed < waitMs) {
        const minutes = Math.ceil((waitMs - elapsed) / 60000);
        const reason = caughtUp ? "último NSU já alcançou o maxNSU" : `cStat ${state.lastCStat}`;
        // O agente continua em loop, mas NÃO envia requisição à SEFAZ durante a janela
        // obrigatória. Isso evita cStat 656 sem parar o atualizador nem impedir o
        // processamento/importação local das NF-e que já foram recebidas.
        return {
          cStat: state.lastCStat || "AGUARDANDO",
          xMotivo: `Aguardando janela SEFAZ (${reason}). Nova consulta em aproximadamente ${minutes} minuto(s).`,
          ultNsu: state.ultNsu,
          maxNsu: state.maxNsu,
          received: 0,
          processed: 0,
          imported: 0,
          hasMore: false,
          batchLimit: MAX_DOCS_PER_SYNC,
          skippedCooldown: true,
          retryAfterMinutes: minutes,
        };
      }
    }
    const body = soapEnvelope(cnpj,cUf,state.ultNsu);
    let responseStatus = 0;
    let responseText = "";
    try {
      const response = runtime.cloudflare
        ? await postSoapWithCloudflareMtls(body)
        : await postSoapWithNodeHttps(
            decodeCertificate(company.certificadoArquivo || ""),
            company.certificadoSenha || "",
            body,
          );
      responseStatus = response.status;
      responseText = response.text;

      if (!responseStatus) {
        throw new Error("A SEFAZ encerrou a conexão sem retornar um status HTTP.");
      }
      if (responseStatus < 200 || responseStatus >= 300) {
        const preview = responseText.replace(/\s+/g, " ").trim().slice(0, 300);
        throw new Error(`SEFAZ DF-e (${new URL(ENDPOINT).hostname}${new URL(ENDPOINT).pathname}) respondeu HTTP ${responseStatus}${preview ? `: ${preview}` : "."}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await prisma.sefazSyncState.update({
        where: { empresaId: company.id },
        data: {
          lastCStat: "TRANSPORT_ERROR",
          lastMessage: message,
          lastQueryAt: new Date(),
        },
      }).catch(() => undefined);
      throw error;
    }
    const root = parser.parse(responseText);
    const ret = findDeep(root, "retDistDFeInt");
    if (!ret) throw new Error("Resposta da SEFAZ sem retDistDFeInt.");
    const cStat = text(ret.cStat);
    const xMotivo = text(ret.xMotivo);
    const sefazUltNsu = padNsu(ret.ultNSU || state.ultNsu);
    const maxNsu = padNsu(ret.maxNSU || sefazUltNsu);
    const docs = arr(ret?.loteDistDFeInt?.docZip);
    const batch = docs.slice(0, MAX_DOCS_PER_SYNC);
    let received=0, imported=0;
    let processedUltNsu = state.ultNsu;

    // Processa um lote pequeno por execução para evitar timeout/erro 500 no Worker
    // quando há muitas NF-e acumuladas. O NSU só avança até o último documento
    // realmente tratado; o restante fica para a próxima execução automática/manual.
    for (const item of batch) {
      received += 1;
      try {
        const r = await saveDoc(company.id,item);
        if (r.imported) imported += 1;
        processedUltNsu = padNsu(item?.["@_NSU"] || processedUltNsu);
      } catch (e) {
        console.error("[sefaz] falha ao processar docZip", e);
        // Interrompe o lote para não pular um NSU que falhou no processamento.
        break;
      }
    }

    const ultNsu = batch.length > 0 ? padNsu(processedUltNsu) : sefazUltNsu;
    const pendingInCurrentResponse = docs.length > received;
    const hasMore = cStat === "138" && (pendingInCurrentResponse || Number(ultNsu) < Number(maxNsu));
    const statusMessage = hasMore
      ? `${xMotivo || "Documentos localizados."} Lote limitado a ${MAX_DOCS_PER_SYNC} documento(s); há mais documentos pendentes para as próximas execuções.`
      : xMotivo;

    await prisma.sefazSyncState.update({ where:{ empresaId:company.id }, data:{ ultNsu, maxNsu, lastCStat:cStat, lastMessage:statusMessage, lastQueryAt:new Date() } });
    return { cStat, xMotivo: statusMessage, ultNsu, maxNsu, received, processed: received, imported, hasMore, batchLimit: MAX_DOCS_PER_SYNC };
  },


  async sync(empresaId?: string) {
    const runtime = runtimeFlags();
    if (!runtime.cloudflare) return sefazDfeService.syncLocal(empresaId);

    const company = await getCompany(empresaId);
    const state = await prisma.sefazSyncState.upsert({
      where: { empresaId: company.id },
      create: { empresaId: company.id, forceRequestedAt: new Date() },
      update: { forceRequestedAt: new Date() },
    });
    const agentOnline = Boolean(state.agentLastSeenAt && Date.now() - state.agentLastSeenAt.getTime() < 2 * 60 * 1000);
    return {
      queued: true,
      agentOnline,
      message: agentOnline
        ? "Atualização solicitada ao Agente SEFAZ local. Se houver janela liberada pela SEFAZ, ela será executada em até 30 segundos; durante o bloqueio de 1 hora nenhuma consulta é enviada."
        : "Solicitação registrada, mas o Agente SEFAZ local está offline. Inicie-o no computador da empresa.",
    };
  },

  async syncAllActive() {
    // No Cloudflare Worker, o transporte SEFAZ é delegado ao Agente local.
    // O cron do Worker não deve tentar consultar o Ambiente Nacional nem
    // criar solicitações forçadas automaticamente. O próprio agente executa
    // o ciclo periódico usando syncLocal().
    if (runtimeFlags().cloudflare) return [];

    const companies = await prisma.empresa.findMany({
      where: { ativa: true, certificadoArquivo: { not: "" }, certificadoSenha: { not: "" } },
      select: { id: true, razaoSocial: true },
      orderBy: [{ empresaPadrao: "desc" }, { createdAt: "asc" }],
    });
    const results: Array<{ empresaId: string; empresa: string; imported: number; received: number; error?: string }> = [];

    for (const company of companies) {
      let imported = 0;
      let received = 0;
      try {
        // Um único lote pequeno por empresa em cada disparo do cron. Assim uma fila
        // grande é drenada aos poucos (a cada 1h30) sem sobrecarregar o Worker.
        const result = await sefazDfeService.syncLocal(company.id);
        imported += result.imported;
        received += result.received;
        results.push({ empresaId: company.id, empresa: company.razaoSocial, imported, received });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        // cStat 137/656 possui janela mínima de consulta; é esperado que algumas
        // execuções do cron apenas aguardem a próxima janela sem quebrar o Worker.
        console.warn(`[sefaz-cron] ${company.razaoSocial}: ${message}`);
        results.push({ empresaId: company.id, empresa: company.razaoSocial, imported, received, error: message });
      }
    }
    return results;
  },
};
