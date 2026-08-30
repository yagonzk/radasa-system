// sefaz-agent/index.ts
import "dotenv/config";

// server/services/sefaz-dfe.service.ts
import https from "node:https";
import { gunzipSync } from "node:zlib";
import { XMLParser as XMLParser2 } from "fast-xml-parser";

// server/lib/prisma.ts
import { AsyncLocalStorage } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
var requestPrisma = new AsyncLocalStorage();
var nodePrisma;
function connectionString() {
  const hyperdriveUrl = globalThis.__RADASA_DATABASE_URL;
  if (hyperdriveUrl) return hyperdriveUrl;
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL n\xE3o foi configurada para o Prisma.");
  return value;
}
function isUsingHyperdrive() {
  return Boolean(globalThis.__RADASA_DATABASE_URL);
}
function createPrismaClient(connection) {
  const adapter = new PrismaPg({
    connectionString: connection,
    // Hyperdrive já faz pooling global. O pequeno pool local só permite que
    // Promise.all dentro da mesma request execute algumas queries em paralelo.
    max: isUsingHyperdrive() ? 3 : 2,
    connectionTimeoutMillis: 1e4,
    idleTimeoutMillis: 3e3
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}
function currentPrisma() {
  const scoped = requestPrisma.getStore();
  if (scoped) return scoped;
  if (!nodePrisma) nodePrisma = createPrismaClient(connectionString());
  return nodePrisma;
}
var prisma = new Proxy({}, {
  get(_target, property) {
    const client = currentPrisma();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  }
});

// server/services/abastecimento-xml.service.ts
import { XMLParser } from "fast-xml-parser";

// server/services/abastecimento-posto.service.ts
function digits(value) {
  return String(value ?? "").replace(/\D/g, "");
}
function normalizeText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").trim().toUpperCase();
}
function firstText(...values) {
  for (const value of values) {
    const text2 = String(value ?? "").trim();
    if (text2) return text2;
  }
  return "";
}
function enderecoFiscal(input) {
  return [input.emitenteEndereco, input.emitenteCidade, input.emitenteUf].map((value) => String(value ?? "").trim()).filter(Boolean).join(" - ");
}
function codigoPosto(cnpj, nome) {
  if (cnpj.length === 14) return `POSTO-${cnpj.slice(-8)}`;
  const slug = normalizeText(nome).replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 70);
  return `POSTO-${slug || "SEM-CNPJ"}`;
}
function postoPayload(input) {
  const cnpj = digits(input.emitenteCnpj);
  const nomeFantasia = firstText(
    input.emitenteNomeFantasia,
    input.emitenteRazaoSocial,
    cnpj ? `Posto ${cnpj}` : ""
  );
  const razaoSocial = firstText(input.emitenteRazaoSocial, nomeFantasia);
  return {
    cnpj,
    nomeFantasia,
    razaoSocial,
    codigoInterno: codigoPosto(cnpj, nomeFantasia || razaoSocial),
    email: "",
    telefone: "",
    enderecoFiscal: enderecoFiscal(input)
  };
}
async function resolveOrCreatePostoFromEmitente(tx, input, fallbackClienteId) {
  const payload = postoPayload(input);
  const cnpj = payload.cnpj;
  const nome = firstText(payload.nomeFantasia, payload.razaoSocial);
  if (cnpj.length === 14) {
    let existing = await tx.cliente.findFirst({
      where: { cnpj },
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        enderecoFiscal: true
      }
    });
    if (!existing) {
      const legacyCandidates = await tx.cliente.findMany({
        where: { cnpj: { not: "" } },
        select: {
          id: true,
          cnpj: true,
          nomeFantasia: true,
          razaoSocial: true,
          enderecoFiscal: true
        }
      });
      existing = legacyCandidates.find((candidate) => digits(candidate.cnpj) === cnpj) ?? null;
    }
    if (existing) {
      const updates = {};
      if (!String(existing.nomeFantasia ?? "").trim() && payload.nomeFantasia) {
        updates.nomeFantasia = payload.nomeFantasia;
      }
      if (!String(existing.razaoSocial ?? "").trim() && payload.razaoSocial) {
        updates.razaoSocial = payload.razaoSocial;
      }
      if (!String(existing.enderecoFiscal ?? "").trim() && payload.enderecoFiscal) {
        updates.enderecoFiscal = payload.enderecoFiscal;
      }
      if (Object.keys(updates).length) {
        await tx.cliente.update({ where: { id: existing.id }, data: updates });
      }
      return existing.id;
    }
    const created2 = await tx.cliente.create({
      data: payload,
      select: { id: true }
    });
    return created2.id;
  }
  if (nome) {
    const existing = await tx.cliente.findFirst({
      where: {
        OR: [
          { nomeFantasia: { equals: nome, mode: "insensitive" } },
          { razaoSocial: { equals: nome, mode: "insensitive" } }
        ]
      },
      select: { id: true }
    });
    if (existing) return existing.id;
    const created2 = await tx.cliente.create({
      data: payload,
      select: { id: true }
    });
    return created2.id;
  }
  return String(fallbackClienteId ?? "").trim() || null;
}
var HISTORICAL_SYNC_INTERVAL_MS = 5 * 60 * 1e3;

// server/services/abastecimento-xml.service.ts
var parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false
});
function asArray(value) {
  if (value === null || value === void 0) return [];
  return Array.isArray(value) ? value : [value];
}
function onlyDigits(value) {
  return String(value ?? "").replace(/\D/g, "");
}
function firstText2(...values) {
  for (const value of values) {
    const text2 = String(value ?? "").trim();
    if (text2) return text2;
  }
  return "";
}
function decimalValue(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const normalized = raw.includes(",") && raw.includes(".") ? raw.replace(/\./g, "").replace(",", ".") : raw.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}
function normalizeSearch(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
function findInfNfe(root) {
  return root?.nfeProc?.NFe?.infNFe ?? root?.NFe?.infNFe ?? root?.infNFe ?? null;
}
function joinAddress(address) {
  return [
    firstText2(address?.xLgr),
    firstText2(address?.nro),
    firstText2(address?.xCpl),
    firstText2(address?.xBairro),
    firstText2(address?.xMun),
    firstText2(address?.UF),
    onlyDigits(address?.CEP)
  ].filter(Boolean).join(", ");
}
function noteTexts(infNfe) {
  const combinedObservations = [
    ...asArray(infNfe?.infAdic?.obsCont),
    ...asArray(infNfe?.infAdic?.obsFisco)
  ].flatMap((item) => {
    const field = firstText2(item?.["@_xCampo"]);
    const value = firstText2(item?.xTexto, item?.["@_xTexto"]);
    return [
      field && value ? `${field}: ${value}` : "",
      value
    ].filter(Boolean);
  });
  const itemNotes = asArray(infNfe?.det).flatMap((det) => [
    det?.infAdProd,
    det?.prod?.xProd
  ]);
  return [
    infNfe?.infAdic?.infCpl,
    infNfe?.infAdic?.infAdFisco,
    ...combinedObservations,
    ...itemNotes
  ].map((value) => String(value ?? "").trim()).filter(Boolean);
}
function parseOdometerCandidate(raw) {
  const cleaned = raw.trim().replace(/\s/g, "").replace(/[^0-9.,]/g, "");
  if (!cleaned) return null;
  let value;
  if (cleaned.includes(",")) {
    const integerPart = cleaned.split(",")[0];
    value = Number(onlyDigits(integerPart));
  } else if (cleaned.includes(".")) {
    const parts = cleaned.split(".");
    const decimalPart = parts.at(-1) ?? "";
    if (parts.length === 2 && decimalPart.length <= 2) {
      value = Math.trunc(Number(cleaned));
    } else {
      value = Number(onlyDigits(cleaned));
    }
  } else {
    value = Number(cleaned);
  }
  if (!Number.isFinite(value)) return null;
  if (value < 100) return null;
  if (value > 1999999) return null;
  return Math.trunc(value);
}
function normalizePlate(value) {
  return String(value ?? "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
}
function isStrictPlate(value) {
  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(value);
}
function isLoosePlateCandidate(value) {
  const letters = (value.match(/[A-Z]/g) ?? []).length;
  const digits3 = (value.match(/[0-9]/g) ?? []).length;
  return value.length >= 5 && value.length <= 8 && letters >= 2 && digits3 >= 2;
}
function findLabeledPlate(text2) {
  const normalized = text2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  const patterns = [
    /\bPLACA\s*\/\s*(?:KM|HM|ODOM(?:ETRO)?)\s*[:=\-]?\s*([A-Z0-9.\s/_-]{5,14})/,
    /\b(?:PLACA|VEICULO|CAVALO|TRATOR|FROTA|PREFIXO)(?:\s+(?:DO\s+)?(?:VEICULO|CAVALO|TRATOR))?\s*[:=\-#]?\s*([A-Z0-9.\s/_-]{5,14})/,
    /\b(?:PCA|PLAQ)\s*[:=\-#]?\s*([A-Z0-9.\s/_-]{5,14})/
  ];
  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    if (!match?.[1]) continue;
    const token = match[1].split(
      /\s+(?:KM|HM|HODOMETRO|ODOMETRO|HORIMETRO|QUILOMETRAGEM|MOTORISTA|FRETISTA|VEICULO)\b|\||;|,|\//
    )[0];
    const candidate = normalizePlate(token);
    if (isStrictPlate(candidate) || isLoosePlateCandidate(candidate)) {
      return candidate;
    }
  }
  return "";
}
function extrairHodometro(texts) {
  const candidates = [];
  const patterns = [
    {
      alias: "PLACA/KM",
      confidence: 125,
      regex: /\bPLACA\s*\/\s*(?:KM|KMS?|OD(?:OM(?:ETRO)?)?|HOD(?:OM(?:ETRO)?)?|HD|HO|HM|HORIMETRO)\s*[:=\-#.]?\s*[A-Z0-9.\s/_-]{5,14}\s*[\/;|,\-]\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i
    },
    {
      alias: "PLACA + ODOMETRO",
      confidence: 123,
      regex: /\bPLACA\s*[:=\-#.]?\s*[A-Z0-9.-]{5,10}.{0,100}?\b(?:KM|KMS?|OD|ODOM|ODOMETRO|HOD|HODOM|HODOMETRO|HD|HO|HM|HORIMETRO|QUILOMETRAGEM)\s*[:=\-/#.]?\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i
    },
    {
      alias: "ODOMETRO COMPLETO",
      confidence: 121,
      regex: /\b(?:HODOMETRO|ODOMETRO|HORIMETRO|QUILOMETRAGEM)(?:\s+(?:ATUAL|FINAL|INICIAL|VEICULO|RODADO|TOTAL))?\s*[:=\-/#.]?\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i
    },
    {
      alias: "KM QUALIFICADO",
      confidence: 119,
      regex: /(?:^|[\s;|,(])(?:-\s*)?KM(?:S)?(?:\s+(?:ATUAL|FINAL|INICIAL|VEICULO|RODADO|TOTAL|ODOMETRO|HODOMETRO))?\s*[:=\-/#.]?\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i
    },
    {
      alias: "ABREVIACAO ODOMETRO",
      confidence: 117,
      regex: /(?:^|[\s;|,(])(?:ODOM|HODOM|HOD|OD|HD|HO|HM)\.?\s*(?:ATUAL|FINAL|INICIAL|VEICULO|RODADO|TOTAL)?\s*[:=\-/#.]?\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i
    },
    {
      alias: "KM/ODOMETRO",
      confidence: 115,
      regex: /\b(?:KM|ODOMETRO|HODOMETRO|ODOM|HODOM|OD|HOD)\s*\/\s*(?:HM|HD|HO|HORIMETRO|ODOM(?:ETRO)?|HODOM(?:ETRO)?)\s*[:=\-/]\s*(\d{3,8}(?:[\.,]\d{1,3})?)/i
    },
    {
      alias: "ROTULO CURTO COLADO",
      confidence: 110,
      regex: /(?:^|[\s;|,(])(?:KM|KMS|ODOM|HODOM|HOD|OD|HD|HO|HM)\.?\s*(\d{3,8})(?=\D|$)/i
    },
    {
      alias: "PLACA E NUMERO",
      confidence: 103,
      regex: /\b[A-Z]{2,3}[0-9A-Z]{3,5}\s*[;|,/\-]\s*(\d{4,8})(?=\D|$)/i
    }
  ];
  for (const source of texts) {
    const normalizedSource = source.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    for (const pattern of patterns) {
      const match = normalizedSource.match(pattern.regex);
      if (!match?.[1]) continue;
      const value = parseOdometerCandidate(match[1]);
      if (value === null) continue;
      candidates.push({
        value,
        alias: pattern.alias,
        source: source.slice(0, 500),
        confidence: pattern.confidence
      });
    }
    const adjacent = normalizedSource.match(
      /(?:^|;|\||,)\s*([A-Z0-9-]{5,9})\s*[;|/,\-]\s*(\d{3,8})(?:;|\||,|$)/i
    );
    if (adjacent?.[1] && adjacent?.[2]) {
      const plate = normalizePlate(adjacent[1]);
      const value = parseOdometerCandidate(adjacent[2]);
      if (isLoosePlateCandidate(plate) && value !== null) {
        candidates.push({
          value,
          alias: "PLACA/OD\xD4METRO SEM R\xD3TULO",
          source: source.slice(0, 500),
          confidence: 90
        });
      }
    }
  }
  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates[0] ?? null;
}
function extractPlate(infNfe, texts) {
  const directCandidates = [
    infNfe?.transp?.veicTransp?.placa,
    ...asArray(infNfe?.transp?.reboque).map((item) => item?.placa)
  ];
  for (const candidate of directCandidates) {
    const plate = normalizePlate(candidate);
    if (isStrictPlate(plate)) return plate;
  }
  for (const text2 of texts) {
    const plate = findLabeledPlate(text2);
    if (plate) return plate;
  }
  for (const text2 of texts) {
    const normalizedText = text2.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const match = normalizedText.match(
      /(?:^|[^A-Z0-9])([A-Z]{3})[\s.\-]?([0-9][A-Z0-9][0-9]{2})(?![A-Z0-9])/
    );
    if (match?.[1] && match?.[2]) {
      return `${match[1]}${match[2]}`;
    }
    const adjacent = normalizedText.match(
      /(?:^|;|\||,)\s*([A-Z0-9-]{5,9})\s*[;|/,\-]\s*\d{3,8}(?:;|\||,|$)/
    );
    const candidate = normalizePlate(adjacent?.[1]);
    if (isLoosePlateCandidate(candidate)) return candidate;
  }
  return "";
}
function levenshteinDistance(left, right) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      const substitutionCost = left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] + substitutionCost
      );
    }
    for (let index = 0; index < current.length; index += 1) {
      previous[index] = current[index];
    }
  }
  return previous[right.length];
}
function interpretarAbastecimentoXml(xml) {
  const root = parser.parse(xml);
  const infNfe = findInfNfe(root);
  if (!infNfe) {
    throw new Error("O arquivo n\xE3o cont\xE9m uma estrutura v\xE1lida de NF-e.");
  }
  const ide = infNfe.ide ?? {};
  const emit = infNfe.emit ?? {};
  const dest = infNfe.dest ?? {};
  const total = infNfe.total?.ICMSTot ?? {};
  const texts = noteTexts(infNfe);
  const odometer = extrairHodometro(texts);
  const produtos = asArray(infNfe.det).map((det) => {
    const prod = det?.prod ?? {};
    const imposto = det?.imposto ?? {};
    const comb = prod?.comb ?? null;
    return {
      codigo: firstText2(prod.cProd),
      ean: firstText2(prod.cEAN, prod.cEANTrib),
      nome: firstText2(prod.xProd),
      ncm: firstText2(prod.NCM),
      cfop: firstText2(prod.CFOP),
      unidade: firstText2(prod.uCom, prod.uTrib),
      quantidade: decimalValue(prod.qCom ?? prod.qTrib),
      valorUnitario: decimalValue(prod.vUnCom ?? prod.vUnTrib),
      valorTotal: decimalValue(prod.vProd),
      desconto: decimalValue(prod.vDesc),
      combustivel: comb ? {
        codigoAnp: firstText2(comb.cProdANP),
        descricaoAnp: firstText2(comb.descANP),
        ufConsumo: firstText2(comb.UFCons).toUpperCase()
      } : null
    };
  });
  const chaveNfe = onlyDigits(
    infNfe?.["@_Id"] ?? root?.nfeProc?.protNFe?.infProt?.chNFe ?? root?.protNFe?.infProt?.chNFe
  ).replace(/^NFe/, "");
  return {
    chaveNfe,
    numero: firstText2(ide.nNF),
    serie: firstText2(ide.serie),
    dataEmissao: firstText2(ide.dhEmi, ide.dEmi).slice(0, 10),
    naturezaOperacao: firstText2(ide.natOp),
    emitente: {
      cnpj: onlyDigits(emit.CNPJ ?? emit.CPF),
      razaoSocial: firstText2(emit.xNome),
      nomeFantasia: firstText2(emit.xFant),
      inscricaoEstadual: firstText2(emit.IE),
      endereco: joinAddress(emit.enderEmit),
      cidade: firstText2(emit.enderEmit?.xMun),
      uf: firstText2(emit.enderEmit?.UF).toUpperCase()
    },
    destinatario: {
      cnpjCpf: onlyDigits(dest.CNPJ ?? dest.CPF),
      razaoSocial: firstText2(dest.xNome),
      endereco: joinAddress(dest.enderDest),
      cidade: firstText2(dest.enderDest?.xMun),
      uf: firstText2(dest.enderDest?.UF).toUpperCase()
    },
    placa: extractPlate(infNfe, texts),
    hodometro: odometer?.value ?? null,
    hodometroOrigem: odometer?.source ?? "",
    hodometroConfianca: odometer?.confidence ?? 0,
    produtos,
    totais: {
      produtos: decimalValue(total.vProd),
      desconto: decimalValue(total.vDesc),
      frete: decimalValue(total.vFrete),
      seguro: decimalValue(total.vSeg),
      outros: decimalValue(total.vOutro),
      nota: decimalValue(total.vNF),
      icms: decimalValue(total.vICMS),
      pis: decimalValue(total.vPIS),
      cofins: decimalValue(total.vCOFINS)
    },
    informacoesComplementares: texts.join("\n")
  };
}
function findClienteSuggestionFromContext(document, context) {
  const cnpj = document.emitente.cnpj;
  if (cnpj) {
    const exact = context.clientes.find(
      (cliente) => onlyDigits(cliente.cnpj) === onlyDigits(cnpj)
    );
    return exact ?? null;
  }
  const name = firstText2(
    document.emitente.nomeFantasia,
    document.emitente.razaoSocial
  );
  if (!name) return null;
  const normalizedName = normalizeSearch(name);
  return context.clientes.find(
    (cliente) => [cliente.nomeFantasia, cliente.razaoSocial].some(
      (candidate) => normalizeSearch(candidate) === normalizedName
    )
  ) ?? null;
}
async function findClienteSuggestion(document) {
  const cnpj = document.emitente.cnpj;
  if (cnpj) {
    const exact = await prisma.cliente.findFirst({
      where: { cnpj },
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        cnpj: true
      }
    });
    return exact ?? null;
  }
  const name = firstText2(
    document.emitente.nomeFantasia,
    document.emitente.razaoSocial
  );
  if (!name) return null;
  return prisma.cliente.findFirst({
    where: {
      OR: [
        { nomeFantasia: { equals: name, mode: "insensitive" } },
        { razaoSocial: { equals: name, mode: "insensitive" } }
      ]
    },
    select: {
      id: true,
      nomeFantasia: true,
      razaoSocial: true,
      cnpj: true
    }
  });
}
function findVehicleSuggestionFromContext(plate, context) {
  const normalizedPlate = normalizePlate(plate);
  if (!normalizedPlate) return null;
  const normalizedCandidates = context.veiculos.map((vehicle) => ({
    vehicle,
    normalized: normalizePlate(vehicle.placa)
  }));
  const exact = normalizedCandidates.find(
    (candidate) => candidate.normalized === normalizedPlate
  );
  if (exact) return exact.vehicle;
  if (!isLoosePlateCandidate(normalizedPlate)) return null;
  const ranked = normalizedCandidates.map((candidate) => ({
    ...candidate,
    distance: levenshteinDistance(normalizedPlate, candidate.normalized)
  })).filter((candidate) => candidate.distance <= 1).sort((a, b) => a.distance - b.distance);
  if (!ranked.length) return null;
  const bestDistance = ranked[0].distance;
  const bestMatches = ranked.filter(
    (candidate) => candidate.distance === bestDistance
  );
  return bestMatches.length === 1 ? bestMatches[0].vehicle : null;
}
async function findVehicleSuggestion(plate) {
  const normalizedPlate = normalizePlate(plate);
  if (!normalizedPlate) return null;
  const candidates = await prisma.veiculo.findMany({
    select: {
      id: true,
      placa: true,
      modelo: true
    }
  });
  const normalizedCandidates = candidates.map((vehicle) => ({
    vehicle,
    normalized: normalizePlate(vehicle.placa)
  }));
  const exact = normalizedCandidates.find(
    (candidate) => candidate.normalized === normalizedPlate
  );
  if (exact) return exact.vehicle;
  if (!isLoosePlateCandidate(normalizedPlate)) return null;
  const ranked = normalizedCandidates.map((candidate) => ({
    ...candidate,
    distance: levenshteinDistance(normalizedPlate, candidate.normalized)
  })).filter((candidate) => candidate.distance <= 1).sort((a, b) => a.distance - b.distance);
  if (!ranked.length) return null;
  const bestDistance = ranked[0].distance;
  const bestMatches = ranked.filter(
    (candidate) => candidate.distance === bestDistance
  );
  return bestMatches.length === 1 ? bestMatches[0].vehicle : null;
}
function fuelSignature(value) {
  const normalized = normalizeSearch(String(value ?? ""));
  if (/\barla\s*32\b|\barla\b|agente\s+redutor|ureia\s+automotiva/.test(normalized)) return "arla";
  if (/\bgnv\b|gas natural veicular/.test(normalized)) return "gnv";
  if (/etanol|alcool/.test(normalized)) return "etanol";
  if (/gasolina/.test(normalized)) {
    return /aditiv/.test(normalized) ? "gasolina-aditivada" : "gasolina";
  }
  if (/diesel|\bs\s*-?\s*10\b|\bs10\b/.test(normalized)) {
    if (/s\s*-?\s*10|s10/.test(normalized)) return "diesel-s10";
    if (/s\s*500|s500/.test(normalized)) return "diesel-s500";
    return "diesel";
  }
  return "";
}
function xmlFuelSignature(product) {
  return fuelSignature(
    [product.nome, product.combustivel?.descricaoAnp, product.combustivel?.codigoAnp].filter(Boolean).join(" ")
  );
}
function compatibleFuelSignature(source, candidateName) {
  if (!source) return true;
  const target = fuelSignature(candidateName);
  if (!target) return false;
  if (source === target) return true;
  if (source === "diesel" && target.startsWith("diesel")) return true;
  if (target === "diesel" && source.startsWith("diesel")) return true;
  return false;
}
async function findProductSuggestion(product) {
  const code = product.codigo.trim();
  const sourceSignature = xmlFuelSignature(product);
  if (code) {
    const byCode = await prisma.produto.findFirst({
      where: {
        categoriaEstoque: { equals: "Combust\xEDvel", mode: "insensitive" },
        codigoInterno: {
          equals: code,
          mode: "insensitive"
        }
      },
      select: {
        id: true,
        nome: true,
        codigoInterno: true
      }
    });
    if (byCode && compatibleFuelSignature(sourceSignature, byCode.nome)) {
      return { ...byCode, criadoAutomaticamente: false };
    }
  }
  const normalizedName = normalizeSearch(
    product.combustivel?.descricaoAnp || product.nome
  );
  const exactName = await prisma.produto.findFirst({
    where: {
      categoriaEstoque: { equals: "Combust\xEDvel", mode: "insensitive" },
      nome: { equals: product.combustivel?.descricaoAnp || product.nome, mode: "insensitive" }
    },
    select: { id: true, nome: true, codigoInterno: true }
  });
  if (exactName && compatibleFuelSignature(sourceSignature, exactName.nome)) {
    return { ...exactName, criadoAutomaticamente: false };
  }
  const terms = normalizedName.split(" ").filter((term) => term.length >= 3).slice(0, 4);
  const candidates = terms.length ? await prisma.produto.findMany({
    where: {
      categoriaEstoque: { equals: "Combust\xEDvel", mode: "insensitive" },
      OR: terms.map((term) => ({
        nome: {
          contains: term,
          mode: "insensitive"
        }
      }))
    },
    select: {
      id: true,
      nome: true,
      codigoInterno: true
    },
    take: 30
  }) : [];
  const ranked = candidates.filter((candidate) => compatibleFuelSignature(sourceSignature, candidate.nome)).map((candidate) => {
    const candidateName = normalizeSearch(candidate.nome);
    const hits = terms.filter((term) => candidateName.includes(term)).length;
    return { candidate, hits };
  }).filter((entry) => entry.hits > 0).sort((a, b) => b.hits - a.hits);
  if (ranked.length) {
    return { ...ranked[0].candidate, criadoAutomaticamente: false };
  }
  return null;
}
function findProductInContext(product, context) {
  const sourceSignature = xmlFuelSignature(product);
  const code = normalizeSearch(product.codigo).replace(/\s+/g, "");
  if (code) {
    const byCode = context.produtos.find(
      (candidate) => normalizeSearch(candidate.codigoInterno).replace(/\s+/g, "") === code && compatibleFuelSignature(sourceSignature, candidate.nome)
    );
    if (byCode) return { ...byCode, criadoAutomaticamente: false };
  }
  const normalizedName = normalizeSearch(
    product.combustivel?.descricaoAnp || product.nome
  );
  const terms = normalizedName.split(" ").filter((term) => term.length >= 3).slice(0, 4);
  const exactName = context.produtos.find(
    (candidate) => normalizeSearch(candidate.nome) === normalizedName && compatibleFuelSignature(sourceSignature, candidate.nome)
  );
  if (exactName) return { ...exactName, criadoAutomaticamente: false };
  if (!terms.length) return null;
  const ranked = context.produtos.filter((candidate) => compatibleFuelSignature(sourceSignature, candidate.nome)).map((candidate) => {
    const candidateName = normalizeSearch(candidate.nome);
    const hits = terms.filter((term) => candidateName.includes(term)).length;
    return { candidate, hits };
  }).filter((entry) => entry.hits > 0).sort((a, b) => b.hits - a.hits);
  if (!ranked.length) return null;
  return { ...ranked[0].candidate, criadoAutomaticamente: false };
}
async function findProductSuggestionFromContext(product, context) {
  const cached = findProductInContext(product, context);
  if (cached) return cached;
  return null;
}
async function sugerirVinculosAbastecimento(document, context) {
  let cliente = context ? findClienteSuggestionFromContext(document, context) : await findClienteSuggestion(document);
  const veiculo = context ? findVehicleSuggestionFromContext(document.placa, context) : await findVehicleSuggestion(document.placa);
  if (!cliente && (document.emitente.cnpj || document.emitente.razaoSocial || document.emitente.nomeFantasia)) {
    const clienteId = await prisma.$transaction(
      (tx) => resolveOrCreatePostoFromEmitente(
        tx,
        {
          emitenteCnpj: document.emitente.cnpj,
          emitenteRazaoSocial: document.emitente.razaoSocial,
          emitenteNomeFantasia: document.emitente.nomeFantasia,
          emitenteEndereco: document.emitente.endereco,
          emitenteCidade: document.emitente.cidade,
          emitenteUf: document.emitente.uf
        },
        null
      )
    );
    if (clienteId) {
      cliente = await prisma.cliente.findUnique({
        where: { id: clienteId },
        select: {
          id: true,
          nomeFantasia: true,
          razaoSocial: true,
          cnpj: true
        }
      });
    }
  }
  const produtos = [];
  for (const produto of document.produtos) {
    produtos.push({
      produto,
      cadastro: context ? await findProductSuggestionFromContext(produto, context) : await findProductSuggestion(produto)
    });
  }
  return {
    cliente,
    veiculo,
    produtos
  };
}

// server/utils/app-error.ts
var AppError = class extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = "AppError";
  }
};

// server/utils/date.ts
function parseDateOnly(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new AppError(400, "Data inv\xE1lida. Utilize AAAA-MM-DD.");
  }
  const date = /* @__PURE__ */ new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) throw new AppError(400, "Data inv\xE1lida.");
  return date;
}
function formatDateOnly(value) {
  return value.toISOString().slice(0, 10);
}

// server/utils/serialize.ts
var number = (value) => Number(value);
var created = (value) => value.toISOString();
var dateOnly = formatDateOnly;

// server/services/abastecimentos.service.ts
var include = { produtos: true };
var serialize = (item) => ({
  ...item,
  valorDesconto: number(item.valorDesconto),
  valorTotal: number(item.valorTotal),
  hodometro: number(item.hodometro),
  chaveNfe: item.chaveNfe ?? null,
  numeroNfe: item.numeroNfe ?? "",
  serieNfe: item.serieNfe ?? "",
  emitenteCnpj: item.emitenteCnpj ?? "",
  emitenteRazaoSocial: item.emitenteRazaoSocial ?? "",
  emitenteNomeFantasia: item.emitenteNomeFantasia ?? "",
  emitenteInscricaoEstadual: item.emitenteInscricaoEstadual ?? "",
  emitenteEndereco: item.emitenteEndereco ?? "",
  emitenteCidade: item.emitenteCidade ?? "",
  emitenteUf: item.emitenteUf ?? "",
  destinatarioCnpjCpf: item.destinatarioCnpjCpf ?? "",
  destinatarioRazaoSocial: item.destinatarioRazaoSocial ?? "",
  destinatarioEndereco: item.destinatarioEndereco ?? "",
  destinatarioCidade: item.destinatarioCidade ?? "",
  destinatarioUf: item.destinatarioUf ?? "",
  naturezaOperacao: item.naturezaOperacao ?? "",
  placaXml: item.placaXml ?? "",
  hodometroOrigem: item.hodometroOrigem ?? "",
  valorProdutos: number(item.valorProdutos),
  valorFrete: number(item.valorFrete),
  valorSeguro: number(item.valorSeguro),
  valorOutros: number(item.valorOutros),
  valorIcms: number(item.valorIcms),
  valorPis: number(item.valorPis),
  valorCofins: number(item.valorCofins),
  informacoesComplementares: item.informacoesComplementares ?? "",
  dataEmissao: dateOnly(item.dataEmissao),
  // Nas listagens os documentos pesados não são enviados. Apenas estes flags
  // informam ao frontend que PDF/XML existem e podem ser carregados sob demanda.
  pdfStored: item.pdfStored ?? Boolean(item.pdfUrl),
  xmlStored: item.xmlStored ?? Boolean(item.xmlUrl),
  createdAt: created(item.createdAt),
  produtos: (item.produtos ?? []).map((produto) => ({
    produtoId: produto.produtoId,
    quantidadeLitros: number(produto.quantidadeLitros),
    valorUnitario: number(produto.valorUnitario),
    valorTotal: number(produto.valorTotal)
  }))
});
async function ensureReferences(clienteId, veiculoId, produtoIds) {
  const [cliente, veiculo, produtos] = await Promise.all([
    prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } }),
    prisma.veiculo.findUnique({ where: { id: veiculoId }, select: { id: true } }),
    prisma.produto.findMany({ where: { id: { in: produtoIds } }, select: { id: true } })
  ]);
  if (!cliente) throw new AppError(404, "Cliente n\xE3o encontrado.");
  if (!veiculo) throw new AppError(404, "Ve\xEDculo n\xE3o encontrado.");
  if (produtos.length !== new Set(produtoIds).size) throw new AppError(404, "Um ou mais produtos n\xE3o foram encontrados.");
}
function buildProducts(produtos) {
  return produtos.map((produto) => {
    const quantidadeLitros = Number(produto.quantidadeLitros);
    const valorUnitario = Number(produto.valorUnitario);
    return {
      produtoId: produto.produtoId,
      quantidadeLitros,
      valorUnitario,
      valorTotal: Number((quantidadeLitros * valorUnitario).toFixed(2))
    };
  });
}
function normalizeProductText(value) {
  return String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toUpperCase();
}
function xmlProductName(produtoXml) {
  return String(
    produtoXml?.nome || produtoXml?.combustivel?.descricaoAnp || ""
  ).trim();
}
function xmlProductCode(produtoXml) {
  const raw = String(
    produtoXml?.codigo || produtoXml?.combustivel?.codigoAnp || produtoXml?.ean || produtoXml?.ncm || ""
  ).trim();
  if (raw) return raw.slice(0, 100);
  const name = normalizeProductText(xmlProductName(produtoXml)).replace(/[^A-Z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  return `ABAST-${name || "PRODUTO"}`;
}
async function ensureClienteVeiculo(tx, clienteId, veiculoId) {
  const [cliente, veiculo] = await Promise.all([
    tx.cliente.findUnique({ where: { id: clienteId }, select: { id: true } }),
    tx.veiculo.findUnique({ where: { id: veiculoId }, select: { id: true } })
  ]);
  if (!cliente) throw new AppError(404, "Cliente n\xE3o encontrado.");
  if (!veiculo) throw new AppError(404, "Ve\xEDculo n\xE3o encontrado.");
}
async function resolveProdutoImportacao(tx, produto) {
  const requestedId = String(produto.produtoId ?? "").trim();
  if (requestedId) {
    const existingById = await tx.produto.findUnique({
      where: { id: requestedId },
      select: { id: true }
    });
    if (existingById) {
      return { produtoId: existingById.id, criadoAutomaticamente: false };
    }
  }
  const nome = xmlProductName(produto.produtoXml);
  if (!nome) {
    throw new AppError(
      400,
      "Produto n\xE3o cadastrado e o XML n\xE3o possui nome suficiente para cri\xE1-lo automaticamente."
    );
  }
  const codigoBase = xmlProductCode(produto.produtoXml);
  if (codigoBase) {
    const existingByCode = await tx.produto.findFirst({
      where: {
        codigoInterno: { equals: codigoBase, mode: "insensitive" },
        categoriaEstoque: { equals: "Combust\xEDvel", mode: "insensitive" }
      },
      select: { id: true }
    });
    if (existingByCode) {
      return { produtoId: existingByCode.id, criadoAutomaticamente: false };
    }
  }
  const existingByName = await tx.produto.findFirst({
    where: {
      nome: { equals: nome, mode: "insensitive" },
      categoriaEstoque: { equals: "Combust\xEDvel", mode: "insensitive" }
    },
    select: { id: true }
  });
  if (existingByName) {
    return { produtoId: existingByName.id, criadoAutomaticamente: false };
  }
  let codigoInterno = codigoBase;
  let suffix = 2;
  while (await tx.produto.findFirst({
    where: { codigoInterno: { equals: codigoInterno, mode: "insensitive" } },
    select: { id: true }
  })) {
    const suffixText = `-${suffix}`;
    codigoInterno = `${codigoBase.slice(0, 100 - suffixText.length)}${suffixText}`;
    suffix += 1;
  }
  const created2 = await tx.produto.create({
    data: {
      nome,
      codigoInterno,
      categoriaEstoque: "Combust\xEDvel"
    },
    select: { id: true }
  });
  return { produtoId: created2.id, criadoAutomaticamente: true };
}
async function buildImportedProducts(tx, produtos) {
  const resolved = [];
  let produtosCriados = 0;
  for (const produto of produtos) {
    const cadastro = await resolveProdutoImportacao(tx, produto);
    if (cadastro.criadoAutomaticamente) produtosCriados += 1;
    const quantidadeLitros = Number(produto.quantidadeLitros);
    const valorUnitario = Number(produto.valorUnitario);
    resolved.push({
      produtoId: cadastro.produtoId,
      quantidadeLitros,
      valorUnitario,
      valorTotal: Number((quantidadeLitros * valorUnitario).toFixed(2))
    });
  }
  return { produtos: resolved, produtosCriados };
}
function buildHeader(input, produtos) {
  const valorDesconto = Number(input.valorDesconto ?? 0);
  const valorBruto = produtos.reduce((sum, produto) => sum + produto.valorTotal, 0);
  if (valorDesconto > valorBruto) {
    throw new AppError(400, "O valor do desconto n\xE3o pode ser maior que o valor bruto.");
  }
  return {
    clienteId: input.clienteId,
    veiculoId: input.veiculoId,
    chaveNfe: input.chaveNfe || null,
    numeroNfe: input.numeroNfe || "",
    serieNfe: input.serieNfe || "",
    emitenteCnpj: input.emitenteCnpj || "",
    emitenteRazaoSocial: input.emitenteRazaoSocial || "",
    emitenteNomeFantasia: input.emitenteNomeFantasia || "",
    emitenteInscricaoEstadual: input.emitenteInscricaoEstadual || "",
    emitenteEndereco: input.emitenteEndereco || "",
    emitenteCidade: input.emitenteCidade || "",
    emitenteUf: input.emitenteUf || "",
    destinatarioCnpjCpf: input.destinatarioCnpjCpf || "",
    destinatarioRazaoSocial: input.destinatarioRazaoSocial || "",
    destinatarioEndereco: input.destinatarioEndereco || "",
    destinatarioCidade: input.destinatarioCidade || "",
    destinatarioUf: input.destinatarioUf || "",
    naturezaOperacao: input.naturezaOperacao || "",
    placaXml: input.placaXml || "",
    hodometroOrigem: input.hodometroOrigem || "",
    valorProdutos: input.valorProdutos || 0,
    valorFrete: input.valorFrete || 0,
    valorSeguro: input.valorSeguro || 0,
    valorOutros: input.valorOutros || 0,
    valorIcms: input.valorIcms || 0,
    valorPis: input.valorPis || 0,
    valorCofins: input.valorCofins || 0,
    informacoesComplementares: input.informacoesComplementares || "",
    dataEmissao: parseDateOnly(input.dataEmissao),
    valorDesconto,
    valorTotal: Number((valorBruto - valorDesconto).toFixed(2)),
    hodometro: Number.isFinite(Number(input.hodometro)) && Number(input.hodometro) > 0 ? Number(input.hodometro) : 0,
    pdfUrl: input.pdfUrl || null,
    xmlUrl: input.xmlUrl || null,
    ...input.createdAt ? { createdAt: new Date(input.createdAt) } : {}
  };
}
async function importarItem(tx, input, politica) {
  const chaveNfe = String(input.chaveNfe ?? "").replace(/\D/g, "");
  if (chaveNfe.length !== 44) {
    throw new AppError(400, "A chave da NF-e deve possuir 44 d\xEDgitos.");
  }
  const existing = await tx.abastecimento.findUnique({
    where: { chaveNfe },
    include
  });
  if (existing && politica === "IGNORAR") {
    return {
      acao: "IGNORADO",
      item: serialize(existing),
      produtosCriados: 0
    };
  }
  const requestedClienteId = String(input.clienteId ?? "").trim();
  const emitenteCnpj = String(input.emitenteCnpj ?? "").replace(/\D/g, "");
  let resolvedClienteId = "";
  if (requestedClienteId) {
    const selectedCliente = await tx.cliente.findUnique({
      where: { id: requestedClienteId },
      select: { id: true, cnpj: true }
    });
    const selectedCnpj = String(selectedCliente?.cnpj ?? "").replace(/\D/g, "");
    if (selectedCliente && (!emitenteCnpj || selectedCnpj === emitenteCnpj)) {
      resolvedClienteId = selectedCliente.id;
    }
  }
  if (!resolvedClienteId) {
    resolvedClienteId = await resolveOrCreatePostoFromEmitente(tx, input, requestedClienteId) ?? "";
  }
  if (!resolvedClienteId) {
    throw new AppError(400, "N\xE3o foi poss\xEDvel identificar o posto emitente da NF-e.");
  }
  await ensureClienteVeiculo(tx, resolvedClienteId, input.veiculoId);
  const resolvedProducts = await buildImportedProducts(tx, input.produtos);
  const produtos = resolvedProducts.produtos;
  const data = {
    ...buildHeader(
      {
        ...input,
        clienteId: resolvedClienteId,
        chaveNfe
      },
      produtos
    ),
    chaveNfe,
    numeroNfe: input.numeroNfe || "",
    serieNfe: input.serieNfe || "",
    emitenteCnpj: String(input.emitenteCnpj ?? "").replace(/\D/g, ""),
    emitenteRazaoSocial: input.emitenteRazaoSocial || ""
  };
  if (existing) {
    await tx.abastecimentoProduto.deleteMany({
      where: { abastecimentoId: existing.id }
    });
    const updatedItem = await tx.abastecimento.update({
      where: { id: existing.id },
      data: {
        ...data,
        produtos: { create: produtos }
      },
      include
    });
    return {
      acao: "ATUALIZADO",
      item: serialize(updatedItem),
      produtosCriados: resolvedProducts.produtosCriados
    };
  }
  const createdItem = await tx.abastecimento.create({
    data: {
      ...data,
      produtos: { create: produtos }
    },
    include
  });
  return {
    acao: "CRIADO",
    item: serialize(createdItem),
    produtosCriados: resolvedProducts.produtosCriados
  };
}
var abastecimentosService = {
  async list() {
    const [items, documentState] = await Promise.all([
      prisma.abastecimento.findMany({
        include,
        omit: { pdfUrl: true, xmlUrl: true },
        orderBy: [{ dataEmissao: "desc" }, { createdAt: "desc" }, { hodometro: "desc" }]
      }),
      prisma.$queryRaw`
        SELECT
          "id",
          ("pdfUrl" IS NOT NULL) AS "pdfStored",
          ("xmlUrl" IS NOT NULL) AS "xmlStored"
        FROM "abastecimentos"
        WHERE "pdfUrl" IS NOT NULL OR "xmlUrl" IS NOT NULL
      `
    ]);
    const documentsById = new Map(documentState.map((item) => [item.id, item]));
    return items.map(
      (item) => serialize({
        ...item,
        pdfStored: documentsById.get(item.id)?.pdfStored ?? false,
        xmlStored: documentsById.get(item.id)?.xmlStored ?? false
      })
    );
  },
  async get(id) {
    const item = await prisma.abastecimento.findUnique({ where: { id }, include });
    if (!item) throw new AppError(404, "Abastecimento n\xE3o encontrado.");
    return serialize(item);
  },
  async getDocumento(id, tipo) {
    if (tipo === "pdf") {
      const item2 = await prisma.abastecimento.findUnique({
        where: { id },
        select: { pdfUrl: true }
      });
      if (!item2) throw new AppError(404, "Abastecimento n\xE3o encontrado.");
      if (!item2.pdfUrl) throw new AppError(404, "PDF n\xE3o armazenado para este abastecimento.");
      return { url: item2.pdfUrl };
    }
    const item = await prisma.abastecimento.findUnique({
      where: { id },
      select: { xmlUrl: true }
    });
    if (!item) throw new AppError(404, "Abastecimento n\xE3o encontrado.");
    if (!item.xmlUrl) throw new AppError(404, "XML n\xE3o armazenado para este abastecimento.");
    return { url: item.xmlUrl };
  },
  async create(input) {
    const produtos = buildProducts(input.produtos);
    const resolvedClienteId = await prisma.$transaction(
      (tx) => resolveOrCreatePostoFromEmitente(tx, input, input.clienteId)
    );
    if (!resolvedClienteId) {
      throw new AppError(400, "Selecione o posto/cliente do abastecimento.");
    }
    const normalizedInput = { ...input, clienteId: resolvedClienteId };
    await ensureReferences(
      resolvedClienteId,
      input.veiculoId,
      produtos.map((p) => p.produtoId)
    );
    return serialize(await prisma.abastecimento.create({
      data: {
        ...buildHeader(normalizedInput, produtos),
        produtos: { create: produtos }
      },
      include
    }));
  },
  async update(id, input) {
    const current = await prisma.abastecimento.findUnique({ where: { id }, include });
    if (!current) throw new AppError(404, "Abastecimento n\xE3o encontrado.");
    const merged = {
      clienteId: input.clienteId ?? current.clienteId,
      veiculoId: input.veiculoId ?? current.veiculoId,
      dataEmissao: input.dataEmissao ?? dateOnly(current.dataEmissao),
      chaveNfe: input.chaveNfe === void 0 ? current.chaveNfe : input.chaveNfe,
      numeroNfe: input.numeroNfe ?? current.numeroNfe,
      serieNfe: input.serieNfe ?? current.serieNfe,
      emitenteCnpj: input.emitenteCnpj ?? current.emitenteCnpj,
      emitenteRazaoSocial: input.emitenteRazaoSocial ?? current.emitenteRazaoSocial,
      emitenteNomeFantasia: input.emitenteNomeFantasia ?? current.emitenteNomeFantasia,
      emitenteInscricaoEstadual: input.emitenteInscricaoEstadual ?? current.emitenteInscricaoEstadual,
      emitenteEndereco: input.emitenteEndereco ?? current.emitenteEndereco,
      emitenteCidade: input.emitenteCidade ?? current.emitenteCidade,
      emitenteUf: input.emitenteUf ?? current.emitenteUf,
      destinatarioCnpjCpf: input.destinatarioCnpjCpf ?? current.destinatarioCnpjCpf,
      destinatarioRazaoSocial: input.destinatarioRazaoSocial ?? current.destinatarioRazaoSocial,
      destinatarioEndereco: input.destinatarioEndereco ?? current.destinatarioEndereco,
      destinatarioCidade: input.destinatarioCidade ?? current.destinatarioCidade,
      destinatarioUf: input.destinatarioUf ?? current.destinatarioUf,
      naturezaOperacao: input.naturezaOperacao ?? current.naturezaOperacao,
      placaXml: input.placaXml ?? current.placaXml,
      hodometroOrigem: input.hodometroOrigem ?? current.hodometroOrigem,
      valorProdutos: input.valorProdutos ?? number(current.valorProdutos),
      valorFrete: input.valorFrete ?? number(current.valorFrete),
      valorSeguro: input.valorSeguro ?? number(current.valorSeguro),
      valorOutros: input.valorOutros ?? number(current.valorOutros),
      valorIcms: input.valorIcms ?? number(current.valorIcms),
      valorPis: input.valorPis ?? number(current.valorPis),
      valorCofins: input.valorCofins ?? number(current.valorCofins),
      informacoesComplementares: input.informacoesComplementares ?? current.informacoesComplementares,
      produtos: input.produtos ?? current.produtos.map((p) => ({
        produtoId: p.produtoId,
        quantidadeLitros: number(p.quantidadeLitros),
        valorUnitario: number(p.valorUnitario)
      })),
      valorDesconto: input.valorDesconto ?? number(current.valorDesconto),
      hodometro: input.hodometro ?? number(current.hodometro),
      pdfUrl: input.pdfUrl === void 0 ? current.pdfUrl : input.pdfUrl,
      xmlUrl: input.xmlUrl === void 0 ? current.xmlUrl : input.xmlUrl
    };
    const resolvedClienteId = await prisma.$transaction(
      (tx) => resolveOrCreatePostoFromEmitente(tx, merged, merged.clienteId)
    );
    if (!resolvedClienteId) {
      throw new AppError(400, "Selecione o posto/cliente do abastecimento.");
    }
    merged.clienteId = resolvedClienteId;
    const produtos = buildProducts(merged.produtos);
    await ensureReferences(merged.clienteId, merged.veiculoId, produtos.map((p) => p.produtoId));
    return serialize(await prisma.$transaction(async (tx) => {
      await tx.abastecimentoProduto.deleteMany({ where: { abastecimentoId: id } });
      return tx.abastecimento.update({
        where: { id },
        data: {
          ...buildHeader(merged, produtos),
          produtos: { create: produtos }
        },
        include
      });
    }));
  },
  async importBatch(inputs, politica) {
    if (!inputs.length) {
      throw new AppError(400, "Nenhum abastecimento foi enviado para importa\xE7\xE3o.");
    }
    if (inputs.length > 1e3) {
      throw new AppError(400, "Importe no m\xE1ximo 1000 abastecimentos por lote.");
    }
    const repeatedInBatch = /* @__PURE__ */ new Set();
    const seen = /* @__PURE__ */ new Set();
    for (const input of inputs) {
      const key = String(input.chaveNfe ?? "").replace(/\D/g, "");
      if (seen.has(key)) repeatedInBatch.add(key);
      seen.add(key);
    }
    if (repeatedInBatch.size) {
      throw new AppError(
        400,
        `Existem chaves repetidas no lote: ${Array.from(repeatedInBatch).slice(0, 5).join(", ")}.`
      );
    }
    const resultados = [];
    const normalizedKeys = inputs.map(
      (input) => String(input.chaveNfe ?? "").replace(/\D/g, "")
    );
    const existingKeys = politica === "IGNORAR" ? new Set(
      (await prisma.abastecimento.findMany({
        where: { chaveNfe: { in: normalizedKeys } },
        select: { chaveNfe: true }
      })).map((item) => String(item.chaveNfe ?? "")).filter(Boolean)
    ) : /* @__PURE__ */ new Set();
    for (let index = 0; index < inputs.length; index += 1) {
      const input = inputs[index];
      const chaveNfe = normalizedKeys[index];
      if (politica === "IGNORAR" && existingKeys.has(chaveNfe)) {
        resultados.push({
          indice: index,
          chaveNfe,
          acao: "IGNORADO",
          produtosCriados: 0
        });
        continue;
      }
      try {
        const result = await prisma.$transaction(
          (tx) => importarItem(tx, input, politica)
        );
        resultados.push({
          indice: index,
          chaveNfe: String(input.chaveNfe ?? "").replace(/\D/g, ""),
          acao: result.acao,
          item: result.item,
          produtosCriados: result.produtosCriados
        });
      } catch (error) {
        resultados.push({
          indice: index,
          chaveNfe: String(input.chaveNfe ?? "").replace(/\D/g, ""),
          acao: "ERRO",
          erro: error instanceof Error ? error.message : "N\xE3o foi poss\xEDvel importar o abastecimento."
        });
      }
    }
    return {
      resultados,
      resumo: {
        total: resultados.length,
        criados: resultados.filter((item) => item.acao === "CRIADO").length,
        atualizados: resultados.filter((item) => item.acao === "ATUALIZADO").length,
        ignorados: resultados.filter((item) => item.acao === "IGNORADO").length,
        erros: resultados.filter((item) => item.acao === "ERRO").length,
        produtosCriados: resultados.reduce(
          (total, item) => total + Number(item.produtosCriados ?? 0),
          0
        )
      }
    };
  },
  async remove(id) {
    await prisma.abastecimento.delete({ where: { id } });
  }
};

// server/services/sefaz-dfe.service.ts
var ENDPOINT = "https://www1.nfe.fazenda.gov.br/NFeDistribuicaoDFe/NFeDistribuicaoDFe.asmx";
var SOAP_ACTION = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe/nfeDistDFeInteresse";
var NFE_NS = "http://www.portalfiscal.inf.br/nfe";
var WS_NS = "http://www.portalfiscal.inf.br/nfe/wsdl/NFeDistribuicaoDFe";
var MAX_DOCS_PER_SYNC = 10;
var parser2 = new XMLParser2({ ignoreAttributes: false, attributeNamePrefix: "@_", removeNSPrefix: true, trimValues: true, parseTagValue: false });
var digits2 = (v) => String(v ?? "").replace(/\D/g, "");
var text = (v) => String(v ?? "").trim();
var padNsu = (v) => (digits2(v) || "0").padStart(15, "0");
var ufCodes = { AC: "12", AL: "27", AP: "16", AM: "13", BA: "29", CE: "23", DF: "53", ES: "32", GO: "52", MA: "21", MT: "51", MS: "50", MG: "31", PA: "15", PB: "25", PR: "41", PE: "26", PI: "22", RJ: "33", RN: "24", RS: "43", RO: "11", RR: "14", SC: "42", SP: "35", SE: "28", TO: "17" };
function runtimeFlags() {
  const g = globalThis;
  return {
    cloudflare: Boolean(g.__RADASA_CLOUDFLARE),
    mtls: g.__RADASA_SEFAZ_MTLS,
    agent: Boolean(g.__RADASA_SEFAZ_AGENT)
  };
}
async function postSoapWithCloudflareMtls(body) {
  const runtime = runtimeFlags();
  if (!runtime.mtls) {
    throw new Error("Binding SEFAZ_MTLS n\xE3o configurado no Cloudflare. Vincule o certificado A1 ao Worker antes de sincronizar.");
  }
  const payload = Buffer.from(body, "utf8");
  console.info("[sefaz-mtls] iniciando consulta DF-e", {
    endpoint: ENDPOINT,
    payloadBytes: payload.byteLength,
    transport: "cloudflare-mtls-binding"
  });
  const response = await runtime.mtls.fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"${SOAP_ACTION}"`,
      Accept: "text/xml, application/xml",
      "Accept-Encoding": "identity"
    },
    body
  });
  const responseText = await response.text();
  console.info("[sefaz-mtls] resposta DF-e recebida", {
    status: response.status,
    bodyBytes: Buffer.byteLength(responseText)
  });
  return { status: response.status, text: responseText };
}
async function postSoapWithNodeHttps(pfx, passphrase, body) {
  const endpoint = new URL(ENDPOINT);
  const payload = Buffer.from(body, "utf8");
  console.info("[sefaz-agent] iniciando consulta DF-e", {
    host: endpoint.hostname,
    path: endpoint.pathname,
    payloadBytes: payload.byteLength,
    transport: "node:https-pfx"
  });
  return await new Promise((resolve, reject) => {
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
        Connection: "close"
      }
    }, (response) => {
      const chunks = [];
      response.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      response.on("end", () => {
        const text2 = Buffer.concat(chunks).toString("utf8");
        console.info("[sefaz-agent] resposta DF-e recebida", {
          status: response.statusCode || 0,
          bodyBytes: Buffer.byteLength(text2)
        });
        resolve({ status: response.statusCode || 0, text: text2 });
      });
    });
    request.setTimeout(45e3, () => request.destroy(new Error("Timeout de 45s ao consultar o Ambiente Nacional da NF-e.")));
    request.on("error", (error) => {
      const code = String(error?.code || "");
      const msg = error instanceof Error ? error.message : String(error);
      reject(new Error(`Falha HTTPS/mTLS no servi\xE7o auxiliar SEFAZ: ${msg}${code ? ` (${code})` : ""}`));
    });
    request.end(payload);
  });
}
function decodeCertificate(value) {
  const normalized = value.trim();
  const comma = normalized.indexOf(",");
  const base64 = normalized.startsWith("data:") && comma >= 0 ? normalized.slice(comma + 1) : normalized;
  const buffer = Buffer.from(base64, "base64");
  if (!buffer.length) throw new Error("Certificado A1 vazio ou inv\xE1lido.");
  return buffer;
}
function soapEnvelope(cnpj, cUf, ultNsu) {
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
function findDeep(obj, key) {
  if (!obj || typeof obj !== "object") return null;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const value of Object.values(obj)) {
    const found = findDeep(value, key);
    if (found) return found;
  }
  return null;
}
function arr(v) {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}
function extractKey(xml) {
  const m = xml.match(/(?:Id=["']NFe|<chNFe>)(\d{44})/i) || xml.match(/(?<!\d)\d{44}(?!\d)/);
  return m?.[1] || m?.[0] || "";
}
function classifyXml(xml) {
  const normalized = xml.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
  if (/DIESEL|OLEO DIESEL|GASOLINA|ETANOL|ARLA\s*32|COMBUSTIVEL/.test(normalized)) return "ABASTECIMENTO";
  if (/PNEU|FILTRO|LUBRIFICANTE|OLEO MOTOR|PASTILHA|LONA DE FREIO|ROLAMENTO|MOLA|AMORTECEDOR|PECAS|MANUTENCAO|OFICINA|MECANIC/.test(normalized)) return "MANUTENCAO";
  return "OUTRO";
}
function parseSummary(xml) {
  try {
    const root = parser2.parse(xml);
    const res = findDeep(root, "resNFe") || findDeep(root, "procNFe") || root;
    return {
      numero: "",
      serie: "",
      dataEmissao: text(res?.dhEmi).slice(0, 10) || null,
      emitenteCnpj: digits2(res?.CNPJ || res?.CPF),
      emitenteNome: text(res?.xNome),
      valorTotal: Number(String(res?.vNF || 0).replace(",", ".")) || 0,
      placa: "",
      hodometro: null
    };
  } catch {
    return { numero: "", serie: "", dataEmissao: null, emitenteCnpj: "", emitenteNome: "", valorTotal: 0, placa: "", hodometro: null };
  }
}
async function tryAutoImport(xml) {
  const doc = interpretarAbastecimentoXml(xml);
  const hasFuel = doc.produtos.some((p) => p?.combustivel || /DIESEL|GASOLINA|ETANOL|ARLA|COMBUST/i.test(`${p?.nome ?? ""} ${p?.combustivel?.descricaoAnp ?? ""}`));
  if (!hasFuel) return { status: "PENDENTE", reason: "NF-e classificada como abastecimento, mas sem item de combust\xEDvel reconhecido." };
  const suggestions = await sugerirVinculosAbastecimento(doc);
  if (!suggestions.cliente) return { status: "PENDENTE", reason: "Posto/emitente n\xE3o identificado." };
  if (!suggestions.veiculo) return { status: "PENDENTE", reason: "Ve\xEDculo/placa n\xE3o identificado no XML." };
  if (!doc.dataEmissao) return { status: "PENDENTE", reason: "Data de emiss\xE3o ausente." };
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
      produtoXml: { codigo: p.codigo, ean: p.ean, nome: p.nome, ncm: p.ncm, cfop: p.cfop, unidade: p.unidade, combustivel: p.combustivel }
    }))
  };
  const result = await abastecimentosService.importBatch([payload], "IGNORAR");
  const first = result.resultados?.[0];
  return { status: first?.acao === "ERRO" ? "ERRO" : "IMPORTADO", reason: first?.erro || "", abastecimentoId: first?.item?.id || null };
}
async function saveDoc(empresaId, item) {
  const schema = text(item?.["@_schema"]);
  const nsu = padNsu(item?.["@_NSU"]);
  const xml = gunzipSync(Buffer.from(text(item?.["#text"]), "base64")).toString("utf8");
  const chave = extractKey(xml);
  if (!chave || chave.length !== 44) return { saved: false, imported: false };
  const classification = classifyXml(xml);
  let meta = parseSummary(xml);
  let status = schema.toLowerCase().startsWith("resnfe") ? "PENDENTE" : "NOVO";
  let erro = status === "PENDENTE" ? "A SEFAZ entregou apenas o resumo da NF-e; o XML completo ainda n\xE3o est\xE1 dispon\xEDvel nesta consulta." : "";
  let abastecimentoId = null;
  if (!schema.toLowerCase().startsWith("resnfe")) {
    try {
      const d = interpretarAbastecimentoXml(xml);
      meta = { numero: d.numero, serie: d.serie, dataEmissao: d.dataEmissao || null, emitenteCnpj: d.emitente.cnpj, emitenteNome: d.emitente.nomeFantasia || d.emitente.razaoSocial, valorTotal: d.totais.nota, placa: d.placa, hodometro: d.hodometro };
      if (classification === "ABASTECIMENTO") {
        const imported = await tryAutoImport(xml);
        status = imported.status;
        erro = imported.reason;
        abastecimentoId = imported.abastecimentoId;
      }
    } catch (e) {
      status = "ERRO";
      erro = e instanceof Error ? e.message : String(e);
    }
  }
  const xmlUrl = `data:application/xml;base64,${Buffer.from(xml, "utf8").toString("base64")}`;
  await prisma.sefazDocumento.upsert({
    where: { chave },
    create: { empresaId, chave, nsu, schema, tipo: schema.toLowerCase().startsWith("resnfe") ? "RESNFE" : "NFE", classificacao: classification, status, numero: meta.numero, serie: meta.serie, dataEmissao: meta.dataEmissao ? /* @__PURE__ */ new Date(`${meta.dataEmissao}T00:00:00.000Z`) : null, emitenteCnpj: meta.emitenteCnpj, emitenteNome: meta.emitenteNome, valorTotal: meta.valorTotal, placa: meta.placa || "", hodometro: meta.hodometro, xmlUrl, dados: { schema, nsu }, erro, abastecimentoId, importedAt: status === "IMPORTADO" ? /* @__PURE__ */ new Date() : null },
    update: { nsu, schema, tipo: schema.toLowerCase().startsWith("resnfe") ? "RESNFE" : "NFE", classificacao: classification, status, numero: meta.numero, serie: meta.serie, dataEmissao: meta.dataEmissao ? /* @__PURE__ */ new Date(`${meta.dataEmissao}T00:00:00.000Z`) : null, emitenteCnpj: meta.emitenteCnpj, emitenteNome: meta.emitenteNome, valorTotal: meta.valorTotal, placa: meta.placa || "", hodometro: meta.hodometro, xmlUrl, erro, abastecimentoId, importedAt: status === "IMPORTADO" ? /* @__PURE__ */ new Date() : void 0 }
  });
  return { saved: true, imported: status === "IMPORTADO" };
}
async function getCompany(empresaId, options = {}) {
  const company = empresaId ? await prisma.empresa.findUnique({ where: { id: empresaId } }) : await prisma.empresa.findFirst({
    where: { ativa: true },
    orderBy: [{ empresaPadrao: "desc" }, { createdAt: "desc" }]
  });
  if (!company) throw new Error("Empresa n\xE3o encontrada.");
  const cnpj = digits2(company.cnpj);
  if (cnpj.length !== 14) throw new Error("CNPJ da empresa inv\xE1lido.");
  if (options.requireCertificate) {
    if (!company.certificadoArquivo?.trim()) {
      throw new Error("A empresa n\xE3o possui certificado A1 cadastrado.");
    }
    if (!company.certificadoSenha?.trim()) {
      throw new Error("A senha do certificado A1 n\xE3o est\xE1 cadastrada.");
    }
  }
  return company;
}
var sefazDfeService = {
  async status(empresaId) {
    const company = await getCompany(empresaId);
    const state = await prisma.sefazSyncState.findUnique({ where: { empresaId: company.id } });
    const latestImported = await prisma.sefazDocumento.findFirst({
      where: { empresaId: company.id, status: "IMPORTADO", importedAt: { not: null } },
      orderBy: { importedAt: "desc" },
      select: { importedAt: true, chave: true, numero: true, emitenteNome: true }
    });
    const counts = await prisma.sefazDocumento.groupBy({ by: ["status"], where: { empresaId: company.id }, _count: { _all: true } });
    const runtime = runtimeFlags();
    const certificateConfigured = Boolean(company.certificadoArquivo?.trim() && company.certificadoSenha?.trim());
    const agentLastSeenAt = state?.agentLastSeenAt ?? null;
    const agentOnline = Boolean(agentLastSeenAt && Date.now() - agentLastSeenAt.getTime() < 2 * 60 * 1e3);
    const lastQueryAt = state?.lastQueryAt ?? null;
    const lastCStat = String(state?.lastCStat ?? "");
    const lastMessage = String(state?.lastMessage ?? "");
    const caughtUp = Boolean(
      lastCStat === "138" && state?.ultNsu && state?.maxNsu && state.maxNsu !== "000000000000000" && Number(state.ultNsu) >= Number(state.maxNsu)
    );
    const waitingSefaz = lastCStat === "137" || lastCStat === "656" || caughtUp;
    const nextScheduledAt = lastQueryAt ? new Date(lastQueryAt.getTime() + 90 * 60 * 1e3) : null;
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
        emitenteNome: latestImported.emitenteNome
      } : null,
      status: !certificateConfigured ? "CERTIFICADO_AUSENTE" : runtime.cloudflare && !agentOnline ? "AGENTE_OFFLINE" : hasError ? "ERRO" : waitingSefaz ? "AGUARDANDO_SEFAZ" : lastQueryAt ? "ATIVA" : "AGUARDANDO_PRIMEIRA_EXECUCAO",
      message: !certificateConfigured ? "Cadastre o certificado A1 e a senha na aba Empresa." : runtime.cloudflare && !agentOnline ? "Agente SEFAZ local offline. Inicie o Agente SEFAZ no computador da empresa." : lastMessage || (lastQueryAt ? "Sincroniza\xE7\xE3o autom\xE1tica ativa pelo Agente SEFAZ local." : "Agente online; aguardando a primeira execu\xE7\xE3o autom\xE1tica."),
      certificate: {
        configured: certificateConfigured,
        validUntil: company.certificadoValidade,
        transport: runtime.cloudflare ? "windows-local-agent" : "node:https-pfx",
        agentOnline,
        agentLastSeenAt
      },
      empresa: { id: company.id, razaoSocial: company.razaoSocial, cnpj: company.cnpj, uf: company.uf },
      counts: Object.fromEntries(counts.map((x) => [x.status, x._count._all]))
    };
  },
  async list(empresaId, filters = {}) {
    const company = await getCompany(empresaId);
    const where = { empresaId: company.id };
    if (filters.status) where.status = filters.status;
    if (filters.classificacao) where.classificacao = filters.classificacao;
    if (filters.search) where.OR = [{ chave: { contains: filters.search } }, { emitenteNome: { contains: filters.search, mode: "insensitive" } }, { emitenteCnpj: { contains: digits2(filters.search) } }, { numero: { contains: filters.search } }, { placa: { contains: filters.search, mode: "insensitive" } }];
    return prisma.sefazDocumento.findMany({ where, omit: { xmlUrl: true }, orderBy: [{ dataEmissao: "desc" }, { createdAt: "desc" }], take: 500 });
  },
  async getXml(id) {
    const doc = await prisma.sefazDocumento.findUnique({ where: { id }, select: { xmlUrl: true, chave: true } });
    if (!doc?.xmlUrl) throw new Error("XML n\xE3o armazenado.");
    return { url: doc.xmlUrl, nome: `${doc.chave}-nfe.xml` };
  },
  async retryPendingFuelImports(empresaId, limit = 50) {
    const company = await getCompany(empresaId);
    const docs = await prisma.sefazDocumento.findMany({
      where: {
        empresaId: company.id,
        classificacao: "ABASTECIMENTO",
        tipo: "NFE",
        status: { in: ["NOVO", "PENDENTE", "ERRO"] },
        xmlUrl: { not: "" }
      },
      orderBy: [{ dataEmissao: "asc" }, { createdAt: "asc" }],
      take: Math.max(1, Math.min(200, limit)),
      select: { id: true, xmlUrl: true, status: true }
    });
    let imported = 0;
    let pending = 0;
    let errors = 0;
    for (const stored of docs) {
      try {
        const encoded = stored.xmlUrl.includes(",") ? stored.xmlUrl.slice(stored.xmlUrl.indexOf(",") + 1) : stored.xmlUrl;
        const xml = Buffer.from(encoded, "base64").toString("utf8");
        const result = await tryAutoImport(xml);
        if (result.status === "IMPORTADO") imported += 1;
        else if (result.status === "ERRO") errors += 1;
        else pending += 1;
        await prisma.sefazDocumento.update({
          where: { id: stored.id },
          data: {
            status: result.status,
            erro: result.reason || "",
            abastecimentoId: result.abastecimentoId || void 0,
            importedAt: result.status === "IMPORTADO" ? /* @__PURE__ */ new Date() : void 0
          }
        });
      } catch (error) {
        errors += 1;
        await prisma.sefazDocumento.update({
          where: { id: stored.id },
          data: { status: "ERRO", erro: error instanceof Error ? error.message : String(error) }
        }).catch(() => void 0);
      }
    }
    return { checked: docs.length, imported, pending, errors };
  },
  async syncLocal(empresaId) {
    const runtime = runtimeFlags();
    const company = await getCompany(empresaId, { requireCertificate: !runtime.cloudflare });
    const cnpj = digits2(company.cnpj);
    const cUf = ufCodes[text(company.uf).toUpperCase()] || "51";
    const state = await prisma.sefazSyncState.upsert({ where: { empresaId: company.id }, create: { empresaId: company.id }, update: {} });
    const caughtUp = Boolean(
      state.lastCStat === "138" && state.maxNsu !== "000000000000000" && Number(state.ultNsu) >= Number(state.maxNsu)
    );
    const requiresCooldown = state.lastCStat === "137" || state.lastCStat === "656" || caughtUp;
    if (requiresCooldown && state.lastQueryAt) {
      const elapsed = Date.now() - state.lastQueryAt.getTime();
      const waitMs = 60 * 60 * 1e3;
      if (elapsed < waitMs) {
        const minutes = Math.ceil((waitMs - elapsed) / 6e4);
        const reason = caughtUp ? "\xFAltimo NSU j\xE1 alcan\xE7ou o maxNSU" : `cStat ${state.lastCStat}`;
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
          retryAfterMinutes: minutes
        };
      }
    }
    const body = soapEnvelope(cnpj, cUf, state.ultNsu);
    let responseStatus = 0;
    let responseText = "";
    try {
      const response = runtime.cloudflare ? await postSoapWithCloudflareMtls(body) : await postSoapWithNodeHttps(
        decodeCertificate(company.certificadoArquivo || ""),
        company.certificadoSenha || "",
        body
      );
      responseStatus = response.status;
      responseText = response.text;
      if (!responseStatus) {
        throw new Error("A SEFAZ encerrou a conex\xE3o sem retornar um status HTTP.");
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
          lastQueryAt: /* @__PURE__ */ new Date()
        }
      }).catch(() => void 0);
      throw error;
    }
    const root = parser2.parse(responseText);
    const ret = findDeep(root, "retDistDFeInt");
    if (!ret) throw new Error("Resposta da SEFAZ sem retDistDFeInt.");
    const cStat = text(ret.cStat);
    const xMotivo = text(ret.xMotivo);
    const sefazUltNsu = padNsu(ret.ultNSU || state.ultNsu);
    const maxNsu = padNsu(ret.maxNSU || sefazUltNsu);
    const docs = arr(ret?.loteDistDFeInt?.docZip);
    const batch = docs.slice(0, MAX_DOCS_PER_SYNC);
    let received = 0, imported = 0;
    let processedUltNsu = state.ultNsu;
    for (const item of batch) {
      received += 1;
      try {
        const r = await saveDoc(company.id, item);
        if (r.imported) imported += 1;
        processedUltNsu = padNsu(item?.["@_NSU"] || processedUltNsu);
      } catch (e) {
        console.error("[sefaz] falha ao processar docZip", e);
        break;
      }
    }
    const ultNsu = batch.length > 0 ? padNsu(processedUltNsu) : sefazUltNsu;
    const pendingInCurrentResponse = docs.length > received;
    const hasMore = cStat === "138" && (pendingInCurrentResponse || Number(ultNsu) < Number(maxNsu));
    const statusMessage = hasMore ? `${xMotivo || "Documentos localizados."} Lote limitado a ${MAX_DOCS_PER_SYNC} documento(s); h\xE1 mais documentos pendentes para as pr\xF3ximas execu\xE7\xF5es.` : xMotivo;
    await prisma.sefazSyncState.update({ where: { empresaId: company.id }, data: { ultNsu, maxNsu, lastCStat: cStat, lastMessage: statusMessage, lastQueryAt: /* @__PURE__ */ new Date() } });
    return { cStat, xMotivo: statusMessage, ultNsu, maxNsu, received, processed: received, imported, hasMore, batchLimit: MAX_DOCS_PER_SYNC };
  },
  async sync(empresaId) {
    const runtime = runtimeFlags();
    if (!runtime.cloudflare) return sefazDfeService.syncLocal(empresaId);
    const company = await getCompany(empresaId);
    const state = await prisma.sefazSyncState.upsert({
      where: { empresaId: company.id },
      create: { empresaId: company.id, forceRequestedAt: /* @__PURE__ */ new Date() },
      update: { forceRequestedAt: /* @__PURE__ */ new Date() }
    });
    const agentOnline = Boolean(state.agentLastSeenAt && Date.now() - state.agentLastSeenAt.getTime() < 2 * 60 * 1e3);
    return {
      queued: true,
      agentOnline,
      message: agentOnline ? "Atualiza\xE7\xE3o solicitada ao Agente SEFAZ local. Se houver janela liberada pela SEFAZ, ela ser\xE1 executada em at\xE9 30 segundos; durante o bloqueio de 1 hora nenhuma consulta \xE9 enviada." : "Solicita\xE7\xE3o registrada, mas o Agente SEFAZ local est\xE1 offline. Inicie-o no computador da empresa."
    };
  },
  async syncAllActive() {
    if (runtimeFlags().cloudflare) return [];
    const companies = await prisma.empresa.findMany({
      where: { ativa: true, certificadoArquivo: { not: "" }, certificadoSenha: { not: "" } },
      select: { id: true, razaoSocial: true },
      orderBy: [{ empresaPadrao: "desc" }, { createdAt: "asc" }]
    });
    const results = [];
    for (const company of companies) {
      let imported = 0;
      let received = 0;
      try {
        const result = await sefazDfeService.syncLocal(company.id);
        imported += result.imported;
        received += result.received;
        results.push({ empresaId: company.id, empresa: company.razaoSocial, imported, received });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[sefaz-cron] ${company.razaoSocial}: ${message}`);
        results.push({ empresaId: company.id, empresa: company.razaoSocial, imported, received, error: message });
      }
    }
    return results;
  }
};

// sefaz-agent/index.ts
globalThis.__RADASA_SEFAZ_AGENT = true;
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL n\xE3o configurada. Use o mesmo banco Neon do Radasa.");
var POLL_MS = Math.max(15e3, Number(process.env.SEFAZ_AGENT_POLL_SECONDS || 30) * 1e3);
var AUTO_MS = Math.max(6e4, Number(process.env.SEFAZ_AGENT_AUTO_MINUTES || 90) * 6e4);
var lastAuto = 0;
var running = false;
async function heartbeat() {
  const companies = await prisma.empresa.findMany({ where: { ativa: true }, select: { id: true } });
  const now = /* @__PURE__ */ new Date();
  for (const company of companies) {
    await prisma.sefazSyncState.upsert({
      where: { empresaId: company.id },
      create: { empresaId: company.id, agentLastSeenAt: now },
      update: { agentLastSeenAt: now }
    });
  }
}
async function syncUntilCaughtUp(empresaId) {
  let totalImported = 0;
  let totalReceived = 0;
  let batches = 0;
  let previousUltNsu = "";
  let lastResult = null;
  while (batches < 100) {
    const result = await sefazDfeService.syncLocal(empresaId);
    lastResult = result;
    totalImported += result.imported;
    totalReceived += result.received;
    batches += 1;
    console.log("[sefaz-agent] lote processado", {
      empresaId,
      lote: batches,
      cStat: result.cStat,
      ultNsu: result.ultNsu,
      maxNsu: result.maxNsu,
      received: result.received,
      imported: result.imported,
      hasMore: result.hasMore,
      skippedCooldown: "skippedCooldown" in result ? result.skippedCooldown : false
    });
    if ("skippedCooldown" in result && result.skippedCooldown || !result.hasMore || result.cStat === "137" || result.cStat === "656") break;
    if (previousUltNsu && previousUltNsu === result.ultNsu) {
      console.warn("[sefaz-agent] NSU n\xE3o avan\xE7ou; drenagem interrompida para evitar Consumo Indevido.", { empresaId, ultNsu: result.ultNsu });
      break;
    }
    previousUltNsu = result.ultNsu;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }
  return {
    imported: totalImported,
    received: totalReceived,
    batches,
    cStat: lastResult?.cStat ?? "",
    ultNsu: lastResult?.ultNsu ?? "",
    maxNsu: lastResult?.maxNsu ?? "",
    hasMore: lastResult?.hasMore ?? false
  };
}
async function importPendingFuelInvoices() {
  const companies = await prisma.empresa.findMany({
    where: { ativa: true },
    select: { id: true, razaoSocial: true },
    orderBy: [{ empresaPadrao: "desc" }, { createdAt: "asc" }]
  });
  for (const company of companies) {
    try {
      const result = await sefazDfeService.retryPendingFuelImports(company.id, 50);
      if (result.checked || result.imported) {
        console.log("[sefaz-agent] fila local de abastecimentos", { empresaId: company.id, empresa: company.razaoSocial, ...result });
      }
    } catch (error) {
      console.warn(`[sefaz-agent] falha ao reprocessar abastecimentos de ${company.razaoSocial}:`, error instanceof Error ? error.message : error);
    }
  }
}
async function syncAllCompanies() {
  const companies = await prisma.empresa.findMany({
    where: { ativa: true, certificadoArquivo: { not: "" }, certificadoSenha: { not: "" } },
    select: { id: true, razaoSocial: true },
    orderBy: [{ empresaPadrao: "desc" }, { createdAt: "asc" }]
  });
  const results = [];
  for (const company of companies) {
    try {
      const result = await syncUntilCaughtUp(company.id);
      results.push({ empresaId: company.id, empresa: company.razaoSocial, ...result });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[sefaz-agent] ${company.razaoSocial}: ${message}`);
      results.push({ empresaId: company.id, empresa: company.razaoSocial, imported: 0, received: 0, error: message });
    }
  }
  return results;
}
async function cycle() {
  if (running) return;
  running = true;
  try {
    await heartbeat();
    await importPendingFuelInvoices();
    const now = Date.now();
    const forceStates = await prisma.sefazSyncState.findMany({
      where: { forceRequestedAt: { not: null } },
      select: { empresaId: true, forceRequestedAt: true, lastQueryAt: true }
    });
    const forced = forceStates.filter((s) => s.forceRequestedAt && (!s.lastQueryAt || s.forceRequestedAt > s.lastQueryAt));
    if (forced.length) {
      for (const state of forced) {
        try {
          const r = await syncUntilCaughtUp(state.empresaId);
          console.log("[sefaz-agent] atualiza\xE7\xE3o solicitada conclu\xEDda", state.empresaId, r);
        } catch (e) {
          console.warn("[sefaz-agent] atualiza\xE7\xE3o solicitada n\xE3o executada", state.empresaId, e instanceof Error ? e.message : e);
        } finally {
          await prisma.sefazSyncState.update({ where: { empresaId: state.empresaId }, data: { forceRequestedAt: null, agentLastSeenAt: /* @__PURE__ */ new Date() } }).catch(() => void 0);
        }
      }
    } else if (now - lastAuto >= AUTO_MS) {
      lastAuto = now;
      const results = await syncAllCompanies();
      console.log("[sefaz-agent] ciclo autom\xE1tico", results);
    }
  } catch (e) {
    console.error("[sefaz-agent] erro no ciclo", e);
  } finally {
    running = false;
  }
}
console.log(`[sefaz-agent] iniciado em loop. Fila local a cada ${POLL_MS / 1e3}s; tentativa de consulta SEFAZ a cada ${AUTO_MS / 6e4}min (respeitando cooldown oficial).`);
void cycle();
var timer = setInterval(() => void cycle(), POLL_MS);
async function shutdown(signal) {
  console.log(`[sefaz-agent] encerrando (${signal})`);
  clearInterval(timer);
  await prisma.$disconnect().catch(() => void 0);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
