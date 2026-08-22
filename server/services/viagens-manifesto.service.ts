import { completarDadosAnttCte } from "./cte-antt-auto.service.js";
import { AppError } from "../utils/app-error.js";

export const VIAGENS_MANIFESTO_PARSER_VERSION = "2026.08.21.03";

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

function cleanRouteCity(value: string) {
  return String(value ?? "")
    .replace(/^(?:RAD)\s+/i, "")
    .replace(/^(?:FILIAL\s+(?:ORIG\.?|DEST\.?))\s+/i, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractCitySlashValues(value: string) {
  return Array.from(value.matchAll(/([A-ZÀ-Ü][A-Za-zÀ-ÿ.' -]{2,90}?)\s*\/(?:\s*([A-Z]{2})\b)?/gi))
    .map((match) => ({
      cidade: cleanRouteCity(match[1]),
      uf: (match[2] ?? "").toUpperCase(),
    }))
    .filter((item) => {
      const key = normalize(item.cidade).replace(/[^A-Z0-9]+/g, " ").trim();
      return item.cidade.length >= 2
        && !/^(?:MUNICIPIO|MUNICÍPIO|FILIAL|ORIGEM|DESTINO|VALE PEDAGIO|VALE PEDÁGIO)$/.test(key);
    });
}

const UF_CODES = new Set([
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
]);

function extractUnloadUf(text: string) {
  const lines = text
    .split("\n")
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  const headerIndex = lines.findIndex((line) => /UF\s+Descareg\.?/i.test(line));
  if (headerIndex >= 0) {
    const states: string[] = [];
    for (let index = headerIndex + 1; index < Math.min(lines.length, headerIndex + 9); index += 1) {
      if (/CONTROLE\s+DO\s+FISCO/i.test(lines[index])) break;
      for (const token of lines[index].match(/\b[A-Z]{2}\b/g) ?? []) {
        if (UF_CODES.has(token)) states.push(token);
      }
    }
    // No DAMDFE, após os cabeçalhos vêm UF Carreg. e UF Descareg. nesta ordem.
    // Se ambas estiverem presentes, a última antes de CONTROLE DO FISCO é a descarga.
    if (states.length) return states.at(-1) ?? "";
  }

  const direct = text.match(/UF\s+Descareg\.?\s*[:\-]?\s*(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i);
  return direct?.[1]?.toUpperCase() ?? "";
}

function findRouteHeaderLine(lines: string[], label: RegExp) {
  return lines.findIndex((line) => label.test(line));
}

function extractOriginFromRouteLines(lines: string[]) {
  const originHeaderIndex = findRouteHeaderLine(lines, /Munic[ií]pio\s+Origem/i);
  if (originHeaderIndex < 0) return { cidade: "", uf: "" };

  for (let index = originHeaderIndex; index < Math.min(lines.length, originHeaderIndex + 7); index += 1) {
    const line = index === originHeaderIndex
      ? lines[index].replace(/^.*?Munic[ií]pio\s+Origem/i, "")
      : lines[index];
    if (index > originHeaderIndex && /Filial\s+Orig\.?/i.test(line)) break;
    const values = extractCitySlashValues(line);
    if (values.length) return values[0];
  }
  return { cidade: "", uf: "" };
}

function extractDestinationFromRouteLines(
  lines: string[],
  origin: { cidade: string; uf: string },
) {
  const destinationHeaderIndex = findRouteHeaderLine(lines, /Munic[ií]pio\s+Destino/i);
  const originKey = normalize(origin.cidade).replace(/[^A-Z0-9]+/g, " ").trim();

  // PDF.js e leitores de PDF podem devolver o DAMDFE de duas maneiras:
  // 1) cada coluna em uma linha: Municipio Destino -> RAD -> São José... /
  // 2) cabeçalhos em uma linha e valores na seguinte:
  //    Ipiranga do Norte / MT  RAD  São José do Rio Claro /
  // Em ambos os casos escolhemos a primeira cidade DIFERENTE do Município Origem.
  const scanStart = destinationHeaderIndex >= 0 ? destinationHeaderIndex : 0;
  const scanEnd = destinationHeaderIndex >= 0
    ? Math.min(lines.length, destinationHeaderIndex + 8)
    : lines.length;

  for (let index = scanStart; index < scanEnd; index += 1) {
    if (index > scanStart && /(?:Filial\s+Dest\.?|Dados\s+do\s+Seguro)/i.test(lines[index])) break;

    let line = lines[index];
    if (index === destinationHeaderIndex) {
      line = line.replace(/^.*?Munic[ií]pio\s+Destino/i, "");
    }
    if (/^(?:RAD|Filial\s+(?:Orig\.?|Dest\.?))$/i.test(line.trim())) continue;

    const values = extractCitySlashValues(line);
    for (const value of values) {
      const key = normalize(value.cidade).replace(/[^A-Z0-9]+/g, " ").trim();
      if (!key || key === originKey) continue;
      return value;
    }
  }

  // Quando a ordem lógica do PDF coloca a linha física de valores ANTES da
  // linha "Municipio Destino", procura no bloco inteiro pela segunda cidade.
  for (const line of lines) {
    const values = extractCitySlashValues(line);
    for (const value of values) {
      const key = normalize(value.cidade).replace(/[^A-Z0-9]+/g, " ").trim();
      if (!key || key === originKey) continue;
      return value;
    }
  }

  return { cidade: "", uf: "" };
}

function extractOriginDestination(text: string) {
  const block = findBlock(text, /Origem\s*\/\s*Destino/i, /Dados\s+do\s+Seguro/i, 2200);
  const lines = block
    .split("\n")
    .map((line) => line.replace(/\s{2,}/g, " ").trim())
    .filter(Boolean);

  const origin = extractOriginFromRouteLines(lines);
  let destination = extractDestinationFromRouteLines(lines, origin);

  // Fallback físico do cabeçalho: em algumas extrações os dois municípios
  // ficam na mesma linha e o destino pode vir sem UF, por exemplo:
  // "Ipiranga do Norte / MT São José do Rio Claro /".
  if (!destination.cidade) {
    const allValues = lines.flatMap(extractCitySlashValues);
    const originKey = normalize(origin.cidade).replace(/[^A-Z0-9]+/g, " ").trim();
    destination = allValues.find((value) => {
      const key = normalize(value.cidade).replace(/[^A-Z0-9]+/g, " ").trim();
      return key && key !== originKey;
    }) ?? { cidade: "", uf: "" };
  }

  const unloadUf = extractUnloadUf(text);
  return {
    origemCidade: origin.cidade,
    origemUf: origin.uf,
    cidadeDestino: destination.cidade,
    destinoUf: destination.uf || unloadUf,
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
