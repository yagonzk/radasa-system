import { completarDadosAnttCte } from "./cte-antt-auto.service.js";
import { AppError } from "../utils/app-error.js";

export const VIAGENS_MANIFESTO_PARSER_VERSION = "2026.08.21.02";

export type ManifestoViagemInterpretado = {
  parserVersion: string;
  numeroManifesto: string;
  chaveAcesso: string;
  dataManifesto: string;
  placa: string;
  motoristaNome: string;
  origemCidade: string;
  origemUf: string;
  cidadeDestino: string;
  destinoUf: string;
  valorFrete: number;
  distanciaKm: number;
  distanciaFonte: "manifesto" | "rota" | "";
  avisos: string[];
};

const normalize = (value: unknown) => String(value ?? "")
  .normalize("NFD")
  .replace(/[\u0300-\u036f]/g, "")
  .toUpperCase();

function cleanText(value: string) {
  return String(value ?? "")
    .replace(/\[\[RADASA_[A-Z_]+\]\]/g, "")
    .replace(/\r/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .trim();
}

function parseBrazilianNumber(value: string) {
  const raw = String(value ?? "").replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function toIsoDate(value: string) {
  const match = String(value ?? "").match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
}

function findBlock(text: string, start: RegExp, end?: RegExp, max = 1800) {
  const startMatch = start.exec(text);
  if (!startMatch || startMatch.index == null) return "";
  const tail = text.slice(startMatch.index, startMatch.index + max);
  if (!end) return tail;
  const endMatch = end.exec(tail.slice(startMatch[0].length));
  if (!endMatch || endMatch.index == null) return tail;
  return tail.slice(0, startMatch[0].length + endMatch.index);
}

function extractDate(text: string) {
  const patterns = [
    /Data\s+e\s+hora\s+da\s+emiss[aã]o[\s\S]{0,240}?(\d{2}\/\d{2}\/\d{4})/i,
    /Protocolo\s+de\s+Autoriza[cç][aã]o[\s\S]{0,200}?(\d{2}\/\d{2}\/\d{4})/i,
    /\b(\d{2}\/\d{2}\/\d{4})\s+\d{2}:\d{2}(?::\d{2})?\b/,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const iso = toIsoDate(match?.[1] ?? "");
    if (iso) return iso;
  }
  return "";
}

function extractPlate(text: string) {
  const block = findBlock(text, /\bVe[ií]culo\b/i, /Vale\s+Ped[aá]gio/i, 1600) || text;
  const plates = block.match(/\b[A-Z]{3}(?:\d[A-Z]\d{2}|\d{4})\b/gi) ?? [];
  return (plates[0] ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
}

function extractDriver(text: string) {
  const block = findBlock(text, /\bCondutor\b/i, /(?:Vale\s+Ped[aá]gio|Origem\s*\/\s*Destino)/i, 1800) || text;
  const cpfName = block.match(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\s+([A-ZÀ-Ü][A-ZÀ-Ü .'-]{3,100})/i);
  if (cpfName?.[1]) return cpfName[1].replace(/\s{2,}/g, " ").trim();
  const labeled = block.match(/(?:Nome|Condutor)\s*[:\-]?\s*([A-ZÀ-Ü][A-ZÀ-Ü .'-]{3,100})/i);
  return labeled?.[1]?.replace(/\s{2,}/g, " ").trim() ?? "";
}

function extractCityUfPairs(value: string) {
  return Array.from(value.matchAll(/([A-ZÀ-Ü][A-Za-zÀ-ÿ.' -]{2,70}?)\s*\/\s*([A-Z]{2})\b/g))
    .map((match) => ({
      cidade: match[1]
        .replace(/\s{2,}/g, " ")
        .replace(/^(?:RAD|FILIAL\s+(?:ORIG\.?|DEST\.?))\s+/i, "")
        .trim(),
      uf: match[2].toUpperCase(),
    }))
    .filter((item) => item.cidade.length >= 2);
}

function extractOriginDestination(text: string) {
  const block = findBlock(text, /Origem\s*\/\s*Destino/i, /Dados\s+do\s+Seguro/i, 1800);
  const lines = block
    .split("\n")
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  // Regra principal do DAMDFE: CIDADE DE ENTREGA deve vir EXCLUSIVAMENTE
  // do campo "Municipio Destino". No layout de referência, os cabeçalhos
  // "Municipio Origem" e "Municipio Destino" aparecem na mesma linha e,
  // logo abaixo, aparecem "Ipiranga do Norte / MT  Colniza / MT".
  const headerIndex = lines.findIndex(
    (line) => /Munic[ií]pio\s+Origem/i.test(line) && /Munic[ií]pio\s+Destino/i.test(line),
  );

  if (headerIndex >= 0) {
    const pairs: Array<{ cidade: string; uf: string }> = [];
    for (let index = headerIndex + 1; index < Math.min(lines.length, headerIndex + 7); index += 1) {
      if (/Filial\s+Orig\.?/i.test(lines[index])) break;
      pairs.push(...extractCityUfPairs(lines[index]));
      if (pairs.length >= 2) break;
    }
    if (pairs.length >= 2) {
      return {
        origemCidade: pairs[0].cidade,
        origemUf: pairs[0].uf,
        cidadeDestino: pairs[1].cidade,
        destinoUf: pairs[1].uf,
      };
    }
  }

  // Fallback ainda preso ao bloco Origem/Destino: usa as duas primeiras
  // ocorrências Município/UF e nunca tenta inferir destino por cliente/endereço.
  const pairs = extractCityUfPairs(block);
  if (pairs.length >= 2) {
    return {
      origemCidade: pairs[0].cidade,
      origemUf: pairs[0].uf,
      cidadeDestino: pairs[1].cidade,
      destinoUf: pairs[1].uf,
    };
  }

  // Layout alternativo em que o OCR mantém "Municipio Destino" junto do valor.
  const direct = block.match(/Munic[ií]pio\s+Destino[\s:\-]*([A-ZÀ-Ü][A-Za-zÀ-ÿ.' -]{2,70}?)\s*\/\s*([A-Z]{2})\b/i);
  return {
    origemCidade: "",
    origemUf: "",
    cidadeDestino: direct?.[1]?.replace(/\s{2,}/g, " ").trim() ?? "",
    destinoUf: direct?.[2]?.toUpperCase() ?? "",
  };
}

function extractFreightTotal(text: string) {
  const numberPattern = /\d{1,3}(?:\.\d{3})*,\d{1,3}|\d+,\d{1,3}/g;
  const lines = text.split("\n");
  const totalsLine = [...lines].reverse().find((line) => /\bTotais\s*:/i.test(line));
  if (totalsLine) {
    const values = (totalsLine.match(numberPattern) ?? []).map(parseBrazilianNumber);
    // DAMDFE: Peso | Volume | Vlr Merc | Vlr Frete | Vlr ICMS.
    if (values.length >= 5) return Number(values.at(-2) ?? 0);
  }

  let total = 0;
  let found = false;
  for (const line of lines) {
    if (!/^\s*CTe\b/i.test(line)) continue;
    const values = (line.match(numberPattern) ?? []).map(parseBrazilianNumber);
    if (values.length >= 5) {
      total += Number(values.at(-2) ?? 0);
      found = true;
    }
  }
  return found ? Number(total.toFixed(2)) : 0;
}

function extractDistance(text: string) {
  const patterns = [
    /(?:DIST[ÂA]NCIA(?:\s+(?:TOTAL|DA\s+VIAGEM|DA\s+ROTA))?|QUILOMETRAGEM(?:\s+TOTAL)?|KM\s+(?:TOTAL|DA\s+VIAGEM|DA\s+ROTA|ROTA|VIAGEM))\s*[:\-]?\s*([0-9][0-9.,]{0,12})\s*(?:KM)?\b/i,
    /(?:TOTAL\s+KM|KM\s+PERCORRIDO)\s*[:\-]?\s*([0-9][0-9.,]{0,12})/i,
  ];
  for (const pattern of patterns) {
    const value = parseBrazilianNumber(text.match(pattern)?.[1] ?? "");
    if (value > 0 && value < 100000) return value;
  }
  return 0;
}

function extractManifestNumber(text: string) {
  const header = findBlock(text, /DAMDFE/i, /Modelo\s+Rodovi[aá]rio/i, 1200) || text;
  return header.match(/N[uú]mero[\s\S]{0,180}?\b(\d{6,12})\b/i)?.[1] ?? "";
}

function extractAccessKey(text: string) {
  const dotted = text.match(/\b(?:\d{4}\.){10}\d{4}\b/);
  if (dotted) return dotted[0].replace(/\D/g, "");
  for (const match of text.matchAll(/[\d.\s]{44,80}/g)) {
    const digits = match[0].replace(/\D/g, "");
    if (digits.length === 44) return digits;
  }
  return "";
}

export function parseManifestoViagemText(rawText: string): ManifestoViagemInterpretado {
  const text = cleanText(rawText);
  if (!/DAMDFE|Manifesto\s+Eletr[oô]nico\s+de\s+Documentos\s+Fiscais/i.test(text)) {
    throw new AppError(400, "O arquivo não parece ser um DAMDFE/MDF-e válido.");
  }

  const route = extractOriginDestination(text);
  const distanciaKm = extractDistance(text);
  const avisos: string[] = [];
  const parsed: ManifestoViagemInterpretado = {
    parserVersion: VIAGENS_MANIFESTO_PARSER_VERSION,
    numeroManifesto: extractManifestNumber(text),
    chaveAcesso: extractAccessKey(text),
    dataManifesto: extractDate(text),
    placa: extractPlate(text),
    motoristaNome: extractDriver(text),
    origemCidade: route.origemCidade,
    origemUf: route.origemUf,
    cidadeDestino: route.cidadeDestino,
    destinoUf: route.destinoUf,
    valorFrete: extractFreightTotal(text),
    distanciaKm,
    distanciaFonte: distanciaKm > 0 ? "manifesto" : "",
    avisos,
  };

  if (!parsed.dataManifesto) avisos.push("Data de emissão do manifesto não identificada.");
  if (!parsed.placa) avisos.push("Placa do veículo não identificada no manifesto.");
  if (!parsed.motoristaNome) avisos.push("Condutor não identificado no manifesto.");
  if (!parsed.cidadeDestino) avisos.push("Município de destino não identificado no manifesto.");
  if (!(parsed.valorFrete > 0)) avisos.push("Valor total do frete não identificado no manifesto.");
  return parsed;
}

export async function interpretarManifestoViagem(rawText: string) {
  const parsed = parseManifestoViagemText(rawText);
  if (!(parsed.distanciaKm > 0) && parsed.origemCidade && parsed.origemUf && parsed.cidadeDestino && parsed.destinoUf) {
    try {
      const calculated = await completarDadosAnttCte({
        origemCidade: parsed.origemCidade,
        origemUf: parsed.origemUf,
        destinoCidade: parsed.cidadeDestino,
        destinoUf: parsed.destinoUf,
      });
      if (calculated.distanciaPercorrida > 0) {
        parsed.distanciaKm = calculated.distanciaPercorrida;
        parsed.distanciaFonte = "rota";
      }
      parsed.avisos.push(...calculated.warnings);
    } catch {
      parsed.avisos.push("Não foi possível calcular automaticamente a distância rodoviária do manifesto.");
    }
  }
  return parsed;
}
