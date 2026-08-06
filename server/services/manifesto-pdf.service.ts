import pdfParse from "pdf-parse";
import { prisma } from "../lib/prisma";

export const ROMANEIO_PARSER_VERSION = "2026.08.06.2";

export type TipoRomaneioPdf =
  | "Bonificação - Lebrinha"
  | "Acertar c/ Lebrinha"
  | "Receber c/ Cliente";

export interface RomaneioPdfCliente {
  codigo: string;
  nome: string;
}

export interface RomaneioPdfProduto {
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
  tipoManifesto: TipoRomaneioPdf;
  clienteCodigo: string;
  clienteNome: string;
}

export interface RomaneioPdfInterpretado {
  parserVersion: string;
  dataEmissao: string;
  transportadoraCodigo: string;
  transportadoraNome: string;
  veiculoCodigo: string;
  placaVeiculo: string;
  modeloVeiculo: string;
  clientes: RomaneioPdfCliente[];
  produtos: RomaneioPdfProduto[];
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

function normalizeVisualLine(value: string) {
  return value
    .trim()
    .split(/\s{2,}/)
    .map((part) => part.replace(/\s+/g, ""))
    .join(" ")
    .replace(/\s*:\s*/g, ":")
    .replace(/\s*-\s*/g, "-")
    .trim();
}

function compactLine(value: string) {
  return value.replace(/\s+/g, "").trim();
}

function parseBrazilianNumber(value: string) {
  const normalized = value.replace(/\s/g, "").replace(/\./g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value: string) {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{2}|\d{4})$/);
  if (!match) return "";
  const year = match[3].length === 2 ? `20${match[3]}` : match[3];
  return `${year}-${match[2]}-${match[1]}`;
}

function humanizeProduct(value: string) {
  return value
    .replace(/(?<=[A-ZÀ-Ü])(?=\d)/g, " ")
    .replace(/(?<=\d)(?=[A-ZÀ-Ü])/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function humanizeInstruction(value: string, total: number) {
  const normalized = normalize(value);
  if (normalized.includes("RECEBERCCLIENTE")) return "Receber c/ Cliente";
  if (normalized.includes("ACERTARCCLEBRINHA") || normalized.includes("INCLUSONF")) {
    return "Incluso NF - Acertar c/ Lebrinha";
  }
  if (total === 0 || normalized === "X") return "Bonificação - Lebrinha";
  return value.replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

function inferTipo(instruction: string, total: number): TipoRomaneioPdf {
  const normalized = normalize(instruction);
  if (normalized.includes("RECEBERCCLIENTE")) return "Receber c/ Cliente";
  if (normalized.includes("ACERTARCCLEBRINHA") || normalized.includes("INCLUSONF")) {
    return "Acertar c/ Lebrinha";
  }
  return total === 0 ? "Bonificação - Lebrinha" : "Bonificação - Lebrinha";
}

function parseClientLine(line: string): RomaneioPdfCliente | null {
  const normalized = normalizeVisualLine(line);
  const match = normalized.match(
    /CLIENTE:(\d+\/\d+)-(.+?)(?=\s+\d{5,8}\s+\d{2}\/\d{2}\/\d{2}|$)/i,
  );
  if (!match) return null;
  return {
    codigo: match[1],
    nome: match[2].replace(/\s+/g, " ").trim(),
  };
}

function parseProductLine(
  line: string,
  cliente: RomaneioPdfCliente,
): RomaneioPdfProduto | null {
  const visual = normalizeVisualLine(line);
  const visualMatch = visual.match(
    /^(\d{5,8})\s+(\d{2}\/\d{2}\/\d{2})\s+(\d{2})\s+(\d{4,10})-(.+?)\s+([\d.]+,\d{2,3})\s+([\d.]+,\d{2})\s+([\d.]+,\d{2})(.*?)(\d{5,9})\/(\d{2,4})$/i,
  );
  const compactMatch = compactLine(line).match(
    /^(\d{5,8})(\d{2}\/\d{2}\/\d{2})(\d{2})(\d{4,10})-(.+?)([\d.]+,\d{2,3})([\d.]+,\d{2})([\d.]+,\d{2})(.*?)(\d{5,9})\/(\d{3})/i,
  );
  const match = visualMatch ?? compactMatch;
  if (!match) return null;

  let description = match[5];
  let quantityText = match[6];
  if (!visualMatch && description.endsWith("/")) {
    const [integer, decimals = "00"] = quantityText.split(",");
    const quantityDigits = integer.replace(/\./g, "");
    const packageSize = ["12", "24", "6"].find((candidate) => {
      if (!quantityDigits.startsWith(candidate)) return false;
      const remaining = Number(quantityDigits.slice(candidate.length));
      return remaining > 0 && remaining <= 5000;
    });
    if (packageSize) {
      description += packageSize;
      quantityText = `${quantityDigits.slice(packageSize.length)},${decimals}`;
    }
  }

  const quantidade = parseBrazilianNumber(quantityText);
  const valorUnitario = parseBrazilianNumber(match[7]);
  const valorTotal = parseBrazilianNumber(match[8]);
  const instrucaoCobranca = humanizeInstruction(match[9], valorTotal);

  return {
    romaneio: match[1],
    data: toIsoDate(match[2]),
    item: match[3],
    codigo: match[4],
    descricao: humanizeProduct(description),
    quantidade,
    valorUnitario,
    valorTotal,
    instrucaoCobranca,
    notaFiscal: match[10],
    serie: match[11],
    tipoManifesto: inferTipo(instrucaoCobranca, valorTotal),
    clienteCodigo: cliente.codigo,
    clienteNome: cliente.nome,
  };
}

function productKey(item: RomaneioPdfProduto) {
  return [item.romaneio, item.item, item.codigo, item.notaFiscal, item.serie].join("|");
}

function parseClientsFromDocument(text: string) {
  const sections = text.split(/(?=C\s*L\s*I\s*E\s*N\s*T\s*E\s*:)/i);
  const clients: RomaneioPdfCliente[] = [];
  for (const section of sections) {
    const client = parseClientLine(section);
    if (client && !clients.some((item) => digits(item.codigo) === digits(client.codigo))) {
      clients.push(client);
    }
  }
  return clients;
}

/**
 * Alguns builds do PDF.js entregam o mesmo PDF sem as quebras de linha/colunas
 * usadas na impressão. Este fallback interpreta um fluxo totalmente compacto,
 * delimitando cada cliente e cada início de item pelos campos fixos do romaneio.
 */
function parseCompactDocument(
  text: string,
  knownClients: RomaneioPdfCliente[],
): RomaneioPdfProduto[] {
  const compact = compactLine(text);
  const sections = compact.split(/(?=CLIENTE:)/i).filter((section) =>
    /^CLIENTE:/i.test(section),
  );
  const result: RomaneioPdfProduto[] = [];
  const itemBoundary = /(?:^|\d{5,9}\/\d{3})(\d{5,8})(?=\d{2}\/\d{2}\/\d{2}\d{2}\d{4,10}-)/g;

  for (const section of sections) {
    const header = section.match(
      /^CLIENTE:(\d+\/\d+)-(.+?)(?=\d{5,8}\d{2}\/\d{2}\/\d{2}\d{2}\d{4,10}-)/i,
    );
    if (!header) continue;

    const code = header[1];
    const known = knownClients.find((client) => digits(client.codigo) === digits(code));
    const client = known ?? {
      codigo: code,
      nome: humanizeProduct(header[2]),
    };
    const payload = section.slice(header[0].length);
    const starts = Array.from(payload.matchAll(itemBoundary), (match) =>
      match.index + match[0].length - match[1].length,
    );
    const candidates = starts.map((start, index) =>
      payload.slice(start, starts[index + 1] ?? payload.length),
    );

    for (const candidate of candidates) {
      const product = parseProductLine(candidate, client);
      if (product && !result.some((item) => productKey(item) === productKey(product))) {
        result.push(product);
      }
    }
  }

  return result;
}

export async function interpretarManifestoPdf(
  buffer: Buffer,
): Promise<RomaneioPdfInterpretado> {
  const parsed = await pdfParse(buffer);
  return interpretarTextoManifestoPdf(String(parsed.text ?? ""));
}

export function interpretarTextoManifestoPdf(
  rawText: string,
): RomaneioPdfInterpretado {
  const text = rawText.replace(/\r/g, "");
  if (!text.trim()) throw new Error("O PDF não possui texto pesquisável.");

  const lines = text.split("\n").map((line) => line.trim()).filter(Boolean);
  const compact = compactLine(text);
  const avisos: string[] = [];

  const emissionMatch = compact.match(/(?:EMISSAO|DT\.REF\.?):(\d{2}\/\d{2}\/\d{4})/i);
  const dataEmissao = emissionMatch ? toIsoDate(emissionMatch[1]) : "";

  const headerLine = lines.find((line) => normalize(line).includes("TRANSPORTADORA"));
  const header = normalizeVisualLine(headerLine ?? "");
  const headerCompact = compactLine(header);
  const transporterVisualMatch = header.match(/TRANSPORTADORA:(\d+)-(.+?)\s+(?:Cod\s*Veiculo|COD\.VEICULO|PLACA\s*VEICULO):/i);
  const transporterMatch = transporterVisualMatch ?? headerCompact.match(
    /TRANSPORTADORA:(\d+)-(.+?)(?:CODVEICULO|COD\.VEICULO|PLACAVEICULO):/i,
  );
  const vehicleCodeMatch = headerCompact.match(/COD(?:\.|IGO)?VEICULO:(\d+)/i);
  const vehicleMatch = headerCompact.match(
    /PLACAVEICULO:([A-Z]{3}[0-9][A-Z0-9][0-9]{2})-(.+?)(?:PERIODO:|CLIENTE:|$)/i,
  );

  const clientes: RomaneioPdfCliente[] = [];
  const produtos: RomaneioPdfProduto[] = [];
  let currentClient: RomaneioPdfCliente | null = null;

  for (let index = 0; index < lines.length; index += 1) {
    const parsedClient = parseClientLine(lines[index]);
    if (parsedClient) {
      currentClient = parsedClient;
      if (!clientes.some((item) => digits(item.codigo) === digits(parsedClient.codigo))) {
        clientes.push(parsedClient);
      }
      continue;
    }
    if (!currentClient || normalize(lines[index]).includes("RESUMO")) continue;

    const candidates = [
      lines[index],
      lines.slice(index, index + 2).join(" "),
      lines.slice(index, index + 3).join(" "),
    ];
    const product = candidates
      .map((candidate) => parseProductLine(candidate, currentClient!))
      .find(Boolean);
    if (product && !produtos.some((item) =>
      productKey(item) === productKey(product),
    )) {
      produtos.push(product);
    }
  }

  for (const client of parseClientsFromDocument(text)) {
    if (!clientes.some((item) => digits(item.codigo) === digits(client.codigo))) {
      clientes.push(client);
    }
  }

  const compactProducts = parseCompactDocument(text, clientes);
  let recoveredItems = 0;
  for (const product of compactProducts) {
    if (!produtos.some((item) => productKey(item) === productKey(product))) {
      produtos.push(product);
      recoveredItems += 1;
    }
  }
  if (recoveredItems > 0) {
    avisos.push(`${recoveredItems} item(ns) recuperado(s) pela leitura alternativa do PDF.`);
  }

  if (!dataEmissao) avisos.push("Data de emissão não identificada.");
  if (!transporterMatch) avisos.push("Transportadora não identificada.");
  if (!vehicleMatch) avisos.push("Placa ou modelo do veículo não identificado.");
  if (!clientes.length) avisos.push("Nenhum cliente foi identificado.");
  if (!produtos.length) avisos.push("Nenhuma linha de produto foi identificada.");

  return {
    parserVersion: ROMANEIO_PARSER_VERSION,
    dataEmissao: dataEmissao || produtos[0]?.data || "",
    transportadoraCodigo: transporterMatch?.[1] ?? "",
    transportadoraNome: transporterMatch?.[2]?.replace(/\s+/g, " ").trim() ?? "",
    veiculoCodigo: vehicleCodeMatch?.[1] ?? "",
    placaVeiculo: vehicleMatch?.[1] ?? "",
    modeloVeiculo: humanizeProduct(vehicleMatch?.[2] ?? ""),
    clientes,
    produtos,
    romaneios: Array.from(new Set(produtos.map((produto) => produto.romaneio))),
    notasFiscais: Array.from(new Set(produtos.map((produto) => `${produto.notaFiscal}/${produto.serie}`))),
    valorTotal: produtos.reduce((sum, produto) => sum + produto.valorTotal, 0),
    avisos,
  };
}

export async function sugerirVinculosManifestoPdf(documento: RomaneioPdfInterpretado) {
  const clientes = await prisma.cliente.findMany();
  const produtos = await prisma.produto.findMany();
  const clientesCriados = new Set<string>();
  const produtosCriados = new Set<string>();

  async function ensureCliente(pdf: RomaneioPdfCliente) {
    const code = digits(pdf.codigo);
    let cadastro = clientes.find((item) =>
      (code && digits(item.codigoInterno ?? "") === code) ||
      normalize(item.nomeFantasia ?? "") === normalize(pdf.nome),
    );
    if (!cadastro) {
      cadastro = await prisma.cliente.create({
        data: {
          nomeFantasia: pdf.nome,
          razaoSocial: pdf.nome,
          codigoInterno: pdf.codigo,
          cnpj: "",
          email: "",
          telefone: "",
          enderecoFiscal: "",
        },
      });
      clientes.push(cadastro);
      clientesCriados.add(cadastro.id);
    }
    return cadastro;
  }

  async function ensureProduto(pdf: RomaneioPdfProduto) {
    const code = digits(pdf.codigo);
    let cadastro = produtos.find((item) =>
      (code && digits(item.codigoInterno ?? "") === code) ||
      normalize(item.nome ?? "") === normalize(pdf.descricao),
    );
    if (!cadastro) {
      cadastro = await prisma.produto.create({
        data: {
          nome: pdf.descricao,
          codigoInterno: pdf.codigo,
          categoriaEstoque: "Produtos de gás",
        },
      });
      produtos.push(cadastro);
      produtosCriados.add(cadastro.id);
    }
    return cadastro;
  }

  const clientesPorCodigo = new Map<string, Awaited<ReturnType<typeof ensureCliente>>>();
  for (const clientePdf of documento.clientes) {
    clientesPorCodigo.set(digits(clientePdf.codigo), await ensureCliente(clientePdf));
  }

  const itens = [];
  for (const produtoPdf of documento.produtos) {
    const cliente = clientesPorCodigo.get(digits(produtoPdf.clienteCodigo)) ??
      await ensureCliente({ codigo: produtoPdf.clienteCodigo, nome: produtoPdf.clienteNome });
    const cadastro = await ensureProduto(produtoPdf);
    itens.push({
      produto: produtoPdf,
      cliente: { ...cliente, criadoAutomaticamente: clientesCriados.has(cliente.id) },
      cadastro: { ...cadastro, criadoAutomaticamente: produtosCriados.has(cadastro.id) },
    });
  }

  return {
    cliente: itens[0]?.cliente ?? null,
    clientes: Array.from(clientesPorCodigo.values()).map((cliente) => ({
      ...cliente,
      criadoAutomaticamente: clientesCriados.has(cliente.id),
    })),
    produtos: itens,
    clientesCriados: clientesCriados.size,
    produtosCriados: produtosCriados.size,
  };
}

export type ManifestoPdfInterpretado = RomaneioPdfInterpretado;
export type ManifestoPdfProduto = RomaneioPdfProduto;
