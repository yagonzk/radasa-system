import { XMLParser } from "fast-xml-parser";
import { prisma } from "../lib/prisma";

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  parseTagValue: false,
});

function asArray<T>(value: T | T[] | null | undefined): T[] {
  if (value === null || value === undefined) return [];
  return Array.isArray(value) ? value : [value];
}

function onlyDigits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }

  return "";
}

function decimalValue(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return 0;

  // Nos campos numéricos oficiais da NF-e o separador decimal é ponto.
  const normalized =
    raw.includes(",") && raw.includes(".")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw.replace(",", ".");

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeSearch(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function findInfNfe(root: any) {
  return (
    root?.nfeProc?.NFe?.infNFe ??
    root?.NFe?.infNFe ??
    root?.infNFe ??
    null
  );
}

function joinAddress(address: any) {
  return [
    firstText(address?.xLgr),
    firstText(address?.nro),
    firstText(address?.xCpl),
    firstText(address?.xBairro),
    firstText(address?.xMun),
    firstText(address?.UF),
    onlyDigits(address?.CEP),
  ]
    .filter(Boolean)
    .join(", ");
}

function noteTexts(infNfe: any) {
  const obsCont = asArray(infNfe?.infAdic?.obsCont)
    .flatMap((item: any) => [
      item?.["@_xCampo"],
      item?.xTexto,
      item?.["@_xTexto"],
    ]);

  const obsFisco = asArray(infNfe?.infAdic?.obsFisco)
    .flatMap((item: any) => [
      item?.["@_xCampo"],
      item?.xTexto,
      item?.["@_xTexto"],
    ]);

  const itemNotes = asArray(infNfe?.det).flatMap((det: any) => [
    det?.infAdProd,
    det?.prod?.xProd,
  ]);

  return [
    infNfe?.infAdic?.infCpl,
    infNfe?.infAdic?.infAdFisco,
    ...obsCont,
    ...obsFisco,
    ...itemNotes,
  ]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
}

function parseOdometerCandidate(raw: string) {
  const cleaned = raw.trim().replace(/\s/g, "");

  // 231.481,0 -> 231481
  // 231,481 -> 231481 quando usado após um rótulo de quilometragem
  // 231481 -> 231481
  const integerPart = cleaned.split(",")[0];
  const digits = onlyDigits(integerPart || cleaned);
  const value = Number(digits);

  if (!Number.isFinite(value)) return null;
  if (value < 100) return null;
  if (value > 99_999_999) return null;

  return value;
}

export function extrairHodometro(texts: string[]) {
  const aliases = [
    "quilometragem atual",
    "quilometragem",
    "hodometro",
    "hodômetro",
    "odometro",
    "odômetro",
    "horimetro",
    "horímetro",
    "km atual",
    "km",
    "hd",
    "ho",
    "od",
  ];

  const candidates: Array<{
    value: number;
    alias: string;
    source: string;
    confidence: number;
  }> = [];

  for (const source of texts) {
    const normalizedSource = source
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");

    for (const alias of aliases) {
      const normalizedAlias = alias
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");

      const escaped = normalizedAlias.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

      const patterns = [
        new RegExp(
          `(?:^|[^a-z0-9])${escaped}\\s*(?:atual)?\\s*[:=\\-]?\\s*(\\d{3,8}(?:[\\.,]\\d{1,3})?)`,
          "i",
        ),
        new RegExp(
          `(\\d{3,8}(?:[\\.,]\\d{1,3})?)\\s*${escaped}(?:\\b|$)`,
          "i",
        ),
      ];

      for (const pattern of patterns) {
        const match = normalizedSource.match(pattern);
        if (!match?.[1]) continue;

        const value = parseOdometerCandidate(match[1]);
        if (value === null) continue;

        const confidence =
          normalizedAlias.length > 3
            ? 100
            : normalizedAlias === "km"
              ? 85
              : 70;

        candidates.push({
          value,
          alias,
          source: source.slice(0, 500),
          confidence,
        });
      }
    }
  }

  candidates.sort(
    (a, b) => b.confidence - a.confidence || b.value - a.value,
  );

  return candidates[0] ?? null;
}

function extractPlate(infNfe: any, texts: string[]) {
  const direct = firstText(
    infNfe?.transp?.veicTransp?.placa,
    infNfe?.transp?.reboque?.placa,
    asArray(infNfe?.transp?.reboque)[0]?.placa,
  )
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

  if (/^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(direct)) {
    return direct;
  }

  for (const text of texts) {
    const match = text
      .toUpperCase()
      .match(/\b([A-Z]{3}[-\s]?[0-9][A-Z0-9][0-9]{2})\b/);

    if (match?.[1]) {
      return match[1].replace(/[-\s]/g, "");
    }
  }

  return "";
}

export interface AbastecimentoXmlProduto {
  codigo: string;
  ean: string;
  nome: string;
  ncm: string;
  cfop: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  desconto: number;
  combustivel: {
    codigoAnp: string;
    descricaoAnp: string;
    ufConsumo: string;
  } | null;
}

export interface AbastecimentoXmlInterpretado {
  chaveNfe: string;
  numero: string;
  serie: string;
  dataEmissao: string;
  naturezaOperacao: string;
  emitente: {
    cnpj: string;
    razaoSocial: string;
    nomeFantasia: string;
    inscricaoEstadual: string;
    endereco: string;
    cidade: string;
    uf: string;
  };
  destinatario: {
    cnpjCpf: string;
    razaoSocial: string;
    endereco: string;
    cidade: string;
    uf: string;
  };
  placa: string;
  hodometro: number | null;
  hodometroOrigem: string;
  hodometroConfianca: number;
  produtos: AbastecimentoXmlProduto[];
  totais: {
    produtos: number;
    desconto: number;
    frete: number;
    seguro: number;
    outros: number;
    nota: number;
    icms: number;
    pis: number;
    cofins: number;
  };
  informacoesComplementares: string;
}

export function interpretarAbastecimentoXml(
  xml: string,
): AbastecimentoXmlInterpretado {
  const root = parser.parse(xml);
  const infNfe = findInfNfe(root);

  if (!infNfe) {
    throw new Error("O arquivo não contém uma estrutura válida de NF-e.");
  }

  const ide = infNfe.ide ?? {};
  const emit = infNfe.emit ?? {};
  const dest = infNfe.dest ?? {};
  const total = infNfe.total?.ICMSTot ?? {};
  const texts = noteTexts(infNfe);
  const odometer = extrairHodometro(texts);

  const produtos = asArray(infNfe.det).map((det: any) => {
    const prod = det?.prod ?? {};
    const imposto = det?.imposto ?? {};
    const comb = prod?.comb ?? null;

    return {
      codigo: firstText(prod.cProd),
      ean: firstText(prod.cEAN, prod.cEANTrib),
      nome: firstText(prod.xProd),
      ncm: firstText(prod.NCM),
      cfop: firstText(prod.CFOP),
      unidade: firstText(prod.uCom, prod.uTrib),
      quantidade: decimalValue(prod.qCom ?? prod.qTrib),
      valorUnitario: decimalValue(prod.vUnCom ?? prod.vUnTrib),
      valorTotal: decimalValue(prod.vProd),
      desconto: decimalValue(prod.vDesc),
      combustivel: comb
        ? {
            codigoAnp: firstText(comb.cProdANP),
            descricaoAnp: firstText(comb.descANP),
            ufConsumo: firstText(comb.UFCons).toUpperCase(),
          }
        : null,
    };
  });

  const chaveNfe = onlyDigits(
    infNfe?.["@_Id"] ??
      root?.nfeProc?.protNFe?.infProt?.chNFe ??
      root?.protNFe?.infProt?.chNFe,
  ).replace(/^NFe/, "");

  return {
    chaveNfe,
    numero: firstText(ide.nNF),
    serie: firstText(ide.serie),
    dataEmissao: firstText(ide.dhEmi, ide.dEmi).slice(0, 10),
    naturezaOperacao: firstText(ide.natOp),
    emitente: {
      cnpj: onlyDigits(emit.CNPJ ?? emit.CPF),
      razaoSocial: firstText(emit.xNome),
      nomeFantasia: firstText(emit.xFant),
      inscricaoEstadual: firstText(emit.IE),
      endereco: joinAddress(emit.enderEmit),
      cidade: firstText(emit.enderEmit?.xMun),
      uf: firstText(emit.enderEmit?.UF).toUpperCase(),
    },
    destinatario: {
      cnpjCpf: onlyDigits(dest.CNPJ ?? dest.CPF),
      razaoSocial: firstText(dest.xNome),
      endereco: joinAddress(dest.enderDest),
      cidade: firstText(dest.enderDest?.xMun),
      uf: firstText(dest.enderDest?.UF).toUpperCase(),
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
      cofins: decimalValue(total.vCOFINS),
    },
    informacoesComplementares: texts.join("\n"),
  };
}

async function findClienteSuggestion(document: AbastecimentoXmlInterpretado) {
  const cnpj = document.emitente.cnpj;

  if (cnpj) {
    const exact = await prisma.cliente.findFirst({
      where: { cnpj },
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        cnpj: true,
      },
    });

    if (exact) return exact;
  }

  const name = firstText(
    document.emitente.nomeFantasia,
    document.emitente.razaoSocial,
  );

  if (!name) return null;

  const words = normalizeSearch(name)
    .split(" ")
    .filter((word) => word.length >= 3)
    .slice(0, 3);

  if (!words.length) return null;

  return prisma.cliente.findFirst({
    where: {
      OR: words.flatMap((word) => [
        { nomeFantasia: { contains: word, mode: "insensitive" } },
        { razaoSocial: { contains: word, mode: "insensitive" } },
      ]),
    },
    select: {
      id: true,
      nomeFantasia: true,
      razaoSocial: true,
      cnpj: true,
    },
  });
}

async function findVehicleSuggestion(plate: string) {
  if (!plate) return null;

  return prisma.veiculo.findFirst({
    where: {
      placa: {
        equals: plate,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      placa: true,
      modelo: true,
    },
  });
}

async function findProductSuggestion(product: AbastecimentoXmlProduto) {
  const code = product.codigo.trim();

  if (code) {
    const byCode = await prisma.produto.findFirst({
      where: {
        codigoInterno: {
          equals: code,
          mode: "insensitive",
        },
      },
      select: {
        id: true,
        nome: true,
        codigoInterno: true,
      },
    });

    if (byCode) return byCode;
  }

  const normalizedName = normalizeSearch(
    product.combustivel?.descricaoAnp || product.nome,
  );

  const terms = normalizedName
    .split(" ")
    .filter((term) => term.length >= 3)
    .slice(0, 4);

  if (!terms.length) return null;

  return prisma.produto.findFirst({
    where: {
      OR: terms.map((term) => ({
        nome: {
          contains: term,
          mode: "insensitive",
        },
      })),
    },
    select: {
      id: true,
      nome: true,
      codigoInterno: true,
    },
  });
}

export async function sugerirVinculosAbastecimento(
  document: AbastecimentoXmlInterpretado,
) {
  const [cliente, veiculo, produtos] = await Promise.all([
    findClienteSuggestion(document),
    findVehicleSuggestion(document.placa),
    Promise.all(
      document.produtos.map(async (produto) => ({
        produto,
        cadastro: await findProductSuggestion(produto),
      })),
    ),
  ]);

  return {
    cliente,
    veiculo,
    produtos,
  };
}
