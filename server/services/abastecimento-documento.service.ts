import pdf from "pdf-parse";
import {
  interpretarAbastecimentoXml,
  type AbastecimentoXmlInterpretado,
} from "./abastecimento-xml.service";

export interface DocumentoProdutoInterpretado {
  codigo?: string | null;
  descricao: string;
  quantidadeLitros: number;
  valorUnitario: number;
  valorTotal: number;
}

export interface DocumentoAbastecimentoInterpretado {
  origem: "XML" | "PDF";
  numeroNota: string | null;
  dataEmissao: string | null;
  fornecedorCnpj: string | null;
  fornecedorNome: string | null;
  placa: string | null;
  hodometro: number | null;
  valorTotal: number | null;
  valorDesconto: number | null;
  produtos: DocumentoProdutoInterpretado[];
  avisos: string[];
}

function normalizePlate(value: unknown) {
  const plate = String(value ?? "")
    .replace(/[^A-Za-z0-9]/g, "")
    .toUpperCase();

  return /^[A-Z]{3}[0-9][A-Z0-9][0-9]{2}$/.test(plate) ? plate : "";
}

function extractLabeledPlate(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const patterns = [
    /(?:^|[\s;|])PLACA\s*(?:DO\s+VEICULO|VEICULO|CAVALO|TRATOR)?\s*[:=\-]?\s*([A-Z]{3}[\s.-]?[0-9][A-Z0-9][0-9]{2})\b/i,
    /(?:^|[\s;|])VEICULO\s*[-/]?\s*PLACA\s*[:=\-]?\s*([A-Z]{3}[\s.-]?[0-9][A-Z0-9][0-9]{2})\b/i,
  ];

  for (const pattern of patterns) {
    const match = normalized.match(pattern);
    const plate = normalizePlate(match?.[1]);
    if (plate) return plate;
  }

  return "";
}

function extractAnyPlate(text: string) {
  const matches = text
    .toUpperCase()
    .match(/\b[A-Z]{3}[\s.-]?[0-9][A-Z0-9][0-9]{2}\b/g);

  for (const match of matches ?? []) {
    const plate = normalizePlate(match);
    if (plate) return plate;
  }

  return "";
}

function parseBrazilianNumber(value: unknown) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;

  const normalized = raw.includes(",")
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseDate(text: string) {
  const iso = text.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  const br = text.match(/\b(\d{2})\/(\d{2})\/(20\d{2})\b/);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;

  return null;
}

function parseOdometer(text: string) {
  const normalized = text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
  const match = normalized.match(
    /(?:HODOMETRO|ODOMETRO|QUILOMETRAGEM|KM\s*ATUAL)\s*[:=\-]?\s*([0-9.]{3,12}(?:,[0-9]+)?)/i,
  );
  if (!match?.[1]) return null;

  const integer = match[1].split(",")[0].replace(/\D/g, "");
  const value = Number(integer);
  return Number.isFinite(value) && value >= 0 ? value : null;
}

function xmlToDocument(
  document: AbastecimentoXmlInterpretado,
): DocumentoAbastecimentoInterpretado {
  const produtos = document.produtos.map((produto) => ({
    codigo: produto.codigo || null,
    descricao: produto.combustivel?.descricaoAnp || produto.nome,
    quantidadeLitros: produto.quantidade,
    valorUnitario: produto.valorUnitario,
    valorTotal: produto.valorTotal,
  }));

  return {
    origem: "XML",
    numeroNota: document.numero || null,
    dataEmissao: document.dataEmissao || null,
    fornecedorCnpj: document.emitente.cnpj || null,
    fornecedorNome:
      document.emitente.nomeFantasia || document.emitente.razaoSocial || null,
    placa: document.placa || null,
    hodometro: document.hodometro,
    valorTotal: document.totais.nota || null,
    valorDesconto: document.totais.desconto || 0,
    produtos,
    avisos: [
      ...(!document.placa
        ? ["A placa não foi encontrada no XML. Se ela estiver no rodapé, confira as informações complementares da NF-e."]
        : []),
      ...(document.hodometro === null
        ? ["O odômetro não foi encontrado automaticamente."]
        : []),
    ],
  };
}

export async function interpretarDocumentoAbastecimento(file: {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
}): Promise<DocumentoAbastecimentoInterpretado> {
  const extension = file.originalname.split(".").pop()?.toLowerCase();

  if (extension === "xml" || file.mimetype.toLowerCase().includes("xml")) {
    const xml = file.buffer.toString("utf8");
    return xmlToDocument(interpretarAbastecimentoXml(xml));
  }

  if (extension === "pdf" || file.mimetype === "application/pdf") {
    const parsed = await pdf(file.buffer);
    const text = String(parsed.text ?? "");

    if (!text.trim()) {
      throw new Error(
        "O PDF não possui texto pesquisável. Utilize o XML da NF-e.",
      );
    }

    const plate = extractLabeledPlate(text) || extractAnyPlate(text);
    const totalMatch = text.match(
      /(?:VALOR\s+TOTAL(?:\s+DA\s+NOTA)?|TOTAL\s+DA\s+NOTA)\s*[:=\-]?\s*R?\$?\s*([0-9.]+,[0-9]{2})/i,
    );

    return {
      origem: "PDF",
      numeroNota:
        text.match(/(?:NF[-\s]?E|NOTA\s+FISCAL)\s*(?:N[º°O.]*)?\s*[:=\-]?\s*(\d{1,12})/i)?.[1] ??
        null,
      dataEmissao: parseDate(text),
      fornecedorCnpj:
        text.match(/CNPJ\s*[:=\-]?\s*([0-9./-]{14,18})/i)?.[1]?.replace(/\D/g, "") ??
        null,
      fornecedorNome: null,
      placa: plate || null,
      hodometro: parseOdometer(text),
      valorTotal: parseBrazilianNumber(totalMatch?.[1]),
      valorDesconto: 0,
      produtos: [],
      avisos: [
        "A leitura de PDF é auxiliar. Confira os dados antes de cadastrar.",
        ...(!plate ? ["A placa não foi encontrada no PDF."] : []),
        "Para preencher produtos e valores com precisão, prefira o XML da NF-e.",
      ],
    };
  }

  throw new Error("Selecione um arquivo XML ou PDF de nota fiscal.");
}
