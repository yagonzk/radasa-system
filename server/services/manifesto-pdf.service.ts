import pdfParse from "pdf-parse";
import { prisma } from "../lib/prisma";

export type TipoManifestoPdf =
  | "Bonificação - Lebrinha"
  | "Acertar c/ Lebrinha"
  | "Receber c/ Cliente";

export interface ManifestoPdfProduto {
  romaneio: string;
  data: string;
  item: string;
  codigo: string;
  descricao: string;
  quantidade: number;
  valorUnitario: number;
  valorTotal: number;
  instrucaoCobranca: string;
  notaFiscal: string;
  serie: string;
  tipoManifesto: TipoManifestoPdf;
}

export interface ManifestoPdfInterpretado {
  dataEmissao: string;
  transportadoraCodigo: string;
  transportadoraNome: string;
  veiculoCodigo: string;
  placaVeiculo: string;
  modeloVeiculo: string;
  clientes: Array<{ codigo: string; nome: string }>;
  produtos: ManifestoPdfProduto[];
  romaneios: string[];
  notasFiscais: string[];
  valorTotal: number;
  avisos: string[];
}

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

const digits = (value: string) => value.replace(/\D/g, "");

function parseBrazilianNumber(value: string) {
  const cleaned = value.trim().replace(/\s/g, "");
  if (!cleaned) return 0;
  const normalized = cleaned.includes(",")
    ? cleaned.replace(/\./g, "").replace(",", ".")
    : cleaned;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2]}-${match[1]}`;
}

function compactLine(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function inferTipo(instruction: string, total: number): TipoManifestoPdf {
  const normalized = normalize(instruction);
  if (normalized.includes("RECEBERCCLIENTE")) return "Receber c/ Cliente";
  if (
    normalized.includes("ACERTARCCLEBRINHA") ||
    normalized.includes("INCLUSONF")
  ) {
    return "Acertar c/ Lebrinha";
  }
  if (total === 0) return "Bonificação - Lebrinha";
  return "Bonificação - Lebrinha";
}

function parseProductLine(line: string): ManifestoPdfProduto | null {
  const compact = compactLine(line);
  const match = compact.match(
    /^(\d{5,8})(\d{2}\/\d{2}\/\d{2})(\d{2})(\d{4,10})-(.+?)(\d{1,8},\d{2,3})(\d{1,8},\d{2})([\d.]+,\d{2})(.*?)(\d{5,9})\/(\d{2,4})$/i,
  );

  if (!match) return null;

  const quantidade = parseBrazilianNumber(match[6]);
  const valorUnitario = parseBrazilianNumber(match[7]);
  const valorTotal = parseBrazilianNumber(match[8]);
  const instrucaoCobranca = match[9]
    .replace(/([a-záéíóúç])([A-ZÁÉÍÓÚÇ])/g, "$1 $2")
    .replace(/-/g, " ")
    .trim();

  return {
    romaneio: match[1],
    data: toIsoDate(match[2]),
    item: match[3],
    codigo: match[4],
    descricao: match[5].replace(/(?<=\D)(?=\d{1,3}L?$)/i, " ").trim(),
    quantidade,
    valorUnitario,
    valorTotal,
    instrucaoCobranca,
    notaFiscal: match[10],
    serie: match[11],
    tipoManifesto: inferTipo(instrucaoCobranca, valorTotal),
  };
}

export async function interpretarManifestoPdf(
  buffer: Buffer,
): Promise<ManifestoPdfInterpretado> {
  const parsed = await pdfParse(buffer);
  const text = String(parsed.text ?? "").replace(/\r/g, "");
  const lines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  const compact = compactLine(text);
  const avisos: string[] = [];

  const emissionMatch = compact.match(/(?:EMISSAO|DT\.REF\.?):(\d{2}\/\d{2}\/\d{4})/i);
  const dataEmissao = emissionMatch ? toIsoDate(emissionMatch[1]) : "";

  const transporterMatch = compact.match(
    /TRANSPORTADORA:(\d+)-(.+?)(?:CODVEICULO|COD\.VEICULO|PLACAVEICULO):/i,
  );
  const vehicleCodeMatch = compact.match(/COD(?:\.|IGO)?VEICULO:(\d+)/i);
  const vehicleMatch = compact.match(
    /PLACAVEICULO:([A-Z]{3}[0-9A-Z][0-9][A-Z0-9]{2})-(.+?)(?:PERIODO:|CLIENTE:|$)/i,
  );

  const clientes: Array<{ codigo: string; nome: string }> = [];
  const clientRegex = /CLIENTE:(\d+\/\d+)-(.+?)(?=\d{5,8}\d{2}\/\d{2}\/\d{2}|CLIENTE:|RESUMO|$)/gi;
  for (const match of compact.matchAll(clientRegex)) {
    const item = { codigo: match[1], nome: match[2].trim() };
    if (!clientes.some((cliente) => cliente.codigo === item.codigo)) clientes.push(item);
  }

  const produtos = lines
    .map(parseProductLine)
    .filter((item): item is ManifestoPdfProduto => Boolean(item));

  const totalMatch = compact.match(/TOTAL\.{0,}:?([\d.]+,\d{2})(?:$|\D)/i);
  const valorTotal = totalMatch
    ? parseBrazilianNumber(totalMatch[1])
    : produtos.reduce((sum, produto) => sum + produto.valorTotal, 0);

  if (!dataEmissao) avisos.push("Data de emissão não identificada.");
  if (!transporterMatch) avisos.push("Transportadora não identificada.");
  if (!vehicleMatch) avisos.push("Placa ou modelo do veículo não identificado.");
  if (!clientes.length) avisos.push("Cliente não identificado.");
  if (!produtos.length) avisos.push("Nenhuma linha de produto foi identificada.");

  return {
    dataEmissao,
    transportadoraCodigo: transporterMatch?.[1] ?? "",
    transportadoraNome: transporterMatch?.[2]?.trim() ?? "",
    veiculoCodigo: vehicleCodeMatch?.[1] ?? "",
    placaVeiculo: vehicleMatch?.[1] ?? "",
    modeloVeiculo: vehicleMatch?.[2]?.trim() ?? "",
    clientes,
    produtos,
    romaneios: Array.from(new Set(produtos.map((produto) => produto.romaneio))),
    notasFiscais: Array.from(
      new Set(produtos.map((produto) => `${produto.notaFiscal}/${produto.serie}`)),
    ),
    valorTotal,
    avisos,
  };
}

export async function sugerirVinculosManifestoPdf(
  documento: ManifestoPdfInterpretado,
) {
  const [clientes, produtos] = await Promise.all([
    prisma.cliente.findMany({
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        codigoInterno: true,
        cnpj: true,
      },
    }),
    prisma.produto.findMany({
      select: { id: true, nome: true, codigoInterno: true },
    }),
  ]);

  const clientePdf = documento.clientes[0];
  const cliente = clientePdf
    ? clientes.find((item) => {
        const pdfCode = digits(clientePdf.codigo.split("/")[0]);
        return (
          (pdfCode && digits(item.codigoInterno ?? "") === pdfCode) ||
          normalize(item.nomeFantasia ?? "") === normalize(clientePdf.nome) ||
          normalize(item.razaoSocial ?? "") === normalize(clientePdf.nome)
        );
      }) ?? null
    : null;

  const productSuggestions = documento.produtos.map((produtoPdf) => {
    const normalizedDescription = normalize(produtoPdf.descricao);
    const normalizedCode = digits(produtoPdf.codigo);
    const cadastro =
      produtos.find(
        (item) =>
          normalizedCode && digits(item.codigoInterno ?? "") === normalizedCode,
      ) ??
      produtos.find((item) => {
        const itemName = normalize(item.nome);
        return (
          itemName === normalizedDescription ||
          (itemName.length >= 5 && normalizedDescription.includes(itemName)) ||
          (normalizedDescription.length >= 5 && itemName.includes(normalizedDescription))
        );
      }) ??
      null;

    return { produto: produtoPdf, cadastro };
  });

  return { cliente, produtos: productSuggestions };
}
