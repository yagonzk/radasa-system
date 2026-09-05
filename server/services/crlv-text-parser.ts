export type CrlvInterpretado = {
  placa: string;
  renavam: string;
  chassi: string;
  marca: string;
  modelo: string;
  anoFabricacao: number | null;
  anoModelo: number | null;
  cor: string;
  combustivel: string;
  proprietario: string;
  subcategoria: "CAMINHAO" | "CARRO" | "MOTO" | null;
  exercicio: number | null;
  avisos: string[];
};

function normalizeLabel(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

function clean(value: string) {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\r/g, "")
    .trim();
}

function normalizePlate(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 7);
}

function formatPlate(value: string) {
  const plate = normalizePlate(value);
  return plate.length === 7 ? `${plate.slice(0, 3)}-${plate.slice(3)}` : plate;
}

function digits(value: string) {
  return String(value ?? "").replace(/\D/g, "");
}

function firstGroup(text: string, patterns: RegExp[]) {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = match?.[1]?.trim();
    if (value) return value;
  }
  return "";
}

function valueAfterLabel(lines: string[], labels: RegExp[], maxDistance = 3) {
  for (let i = 0; i < lines.length; i += 1) {
    const normalized = normalizeLabel(lines[i]);
    if (!labels.some((label) => label.test(normalized))) continue;

    const inline = lines[i].match(/:\s*(.+)$/)?.[1]?.trim();
    if (inline) return inline;

    for (let d = 1; d <= maxDistance; d += 1) {
      const candidate = lines[i + d]?.trim() ?? "";
      if (!candidate) continue;
      const candidateNormalized = normalizeLabel(candidate);
      if (/^(PLACA|RENAVAM|CHASSI|ANO|MARCA|MODELO|COR|COMBUSTIVEL|NOME|PROPRIETARIO|CATEGORIA|ESPECIE|TIPO|EXERCICIO)\b/.test(candidateNormalized)) break;
      return candidate;
    }
  }
  return "";
}

function safeYear(value: string) {
  const match = value.match(/\b(19\d{2}|20\d{2}|21\d{2})\b/);
  return match ? Number(match[1]) : null;
}

function splitMarcaModelo(value: string) {
  const cleaned = value.replace(/^MARCA\s*\/?\s*MODELO(?:\s*\/?\s*VERSAO)?\s*:?\s*/i, "").trim();
  const parts = cleaned.split("/").map((item) => item.trim()).filter(Boolean);
  if (parts.length >= 2) return { marca: parts[0], modelo: parts.slice(1).join("/") };
  return { marca: "", modelo: cleaned };
}

function inferSubcategoria(text: string): CrlvInterpretado["subcategoria"] {
  const normalized = normalizeLabel(text);
  if (/\b(MOTOCICLETA|MOTONETA|CICLOMOTOR|TRICICLO)\b/.test(normalized)) return "MOTO";
  if (/\b(CAMINHAO|CAMINHAO TRATOR|CAMINHONETE|CARGA)\b/.test(normalized)) return "CAMINHAO";
  if (/\b(AUTOMOVEL|PASSAGEIRO)\b/.test(normalized)) return "CARRO";
  return null;
}

export function interpretarTextoCrlv(rawText: string): CrlvInterpretado {
  const text = clean(rawText);
  const lines = text.split("\n").map((line) => clean(line)).filter(Boolean);
  const flat = lines.join(" ");
  const normalizedFlat = normalizeLabel(flat);

  const plateRaw = valueAfterLabel(lines, [/^PLACA(?:\s+ANTERIOR)?$/]) || firstGroup(flat, [
    /\bPLACA\s*[:\-]?\s*([A-Z]{3}[0-9A-Z][0-9A-Z]{3})\b/i,
  ]);
  const placa = formatPlate(plateRaw);

  const renavamRaw = valueAfterLabel(lines, [/^(?:CODIGO\s+)?RENAVAM$/]) || firstGroup(flat, [
    /(?:CODIGO\s+)?RENAVAM\s*[:\-]?\s*([0-9 .-]{9,16})/i,
  ]);
  const renavam = digits(renavamRaw).slice(0, 11);

  const chassiRaw = valueAfterLabel(lines, [/^CHASSI$/]) || firstGroup(flat, [
    /\bCHASSI\s*[:\-]?\s*([A-HJ-NPR-Z0-9]{17})\b/i,
  ]);
  const chassi = chassiRaw.toUpperCase().replace(/[^A-HJ-NPR-Z0-9]/g, "").slice(0, 17);

  let anoFabricacao = safeYear(valueAfterLabel(lines, [/^ANO\s+FABRICACAO$/]));
  let anoModelo = safeYear(valueAfterLabel(lines, [/^ANO\s+MODELO$/]));
  if (!anoFabricacao || !anoModelo) {
    const pair = flat.match(/ANO\s+FABRICA(?:C|Ç)(?:A|Ã)O\s*\/?\s*MODELO\s*[:\-]?\s*(19\d{2}|20\d{2}|21\d{2})\s*\/?\s*(19\d{2}|20\d{2}|21\d{2})/i);
    if (pair) {
      anoFabricacao ||= Number(pair[1]);
      anoModelo ||= Number(pair[2]);
    }
  }

  const marcaModeloRaw = valueAfterLabel(lines, [/^MARCA\s*\/\s*MODELO(?:\s*\/\s*VERSAO)?$/]) || firstGroup(flat, [
    /MARCA\s*\/\s*MODELO(?:\s*\/\s*VERSAO)?\s*[:\-]?\s*([A-Z0-9 ._-]+\/[A-Z0-9 ._\/-]+?)(?=\s+(?:CHASSI|ANO|COR|COMBUSTIVEL|CATEGORIA|ESPECIE|TIPO|PLACA|RENAVAM)\b|$)/i,
  ]);
  const marcaModelo = splitMarcaModelo(marcaModeloRaw);

  const cor = (valueAfterLabel(lines, [/^COR(?:\s+PREDOMINANTE)?$/]) || firstGroup(flat, [
    /\bCOR(?:\s+PREDOMINANTE)?\s*[:\-]?\s*([A-ZÀ-Ý ]+?)(?=\s+(?:COMBUST[IÍ]VEL|CATEGORIA|ESPECIE|TIPO|NOME|PROPRIETARIO|CHASSI)\b|$)/i,
  ])).trim();

  const combustivel = (valueAfterLabel(lines, [/^COMBUSTIVEL$/]) || firstGroup(flat, [
    /\bCOMBUST[IÍ]VEL\s*[:\-]?\s*([A-ZÀ-Ý0-9 /-]+?)(?=\s+(?:CATEGORIA|ESPECIE|TIPO|NOME|PROPRIETARIO|COR|CHASSI)\b|$)/i,
  ])).trim();

  const proprietario = (valueAfterLabel(lines, [/^(?:NOME|PROPRIETARIO)$/], 2) || firstGroup(flat, [
    /\b(?:NOME|PROPRIET[AÁ]RIO)\s*[:\-]?\s*([A-ZÀ-Ý0-9 .&'-]+?)(?=\s+(?:CPF|CNPJ|CATEGORIA|ESPECIE|TIPO|PLACA|RENAVAM)\b|$)/i,
  ])).trim();

  const exercicio = safeYear(valueAfterLabel(lines, [/^EXERCICIO$/])) || safeYear(firstGroup(flat, [
    /\bEXERC[IÍ]CIO\s*[:\-]?\s*((?:19|20|21)\d{2})/i,
  ]));

  const especieTipo = [
    valueAfterLabel(lines, [/^ESPECIE\s*\/\s*TIPO$/]),
    valueAfterLabel(lines, [/^CATEGORIA$/]),
    normalizedFlat,
  ].filter(Boolean).join(" ");
  const subcategoria = inferSubcategoria(especieTipo);

  const avisos: string[] = [];
  if (!placa) avisos.push("Placa não identificada automaticamente.");
  if (!renavam) avisos.push("RENAVAM não identificado automaticamente.");
  if (!chassi) avisos.push("Chassi não identificado automaticamente.");
  if (!marcaModelo.marca && !marcaModelo.modelo) avisos.push("Marca/modelo não identificados automaticamente.");
  if (!anoFabricacao || !anoModelo) avisos.push("Ano de fabricação/modelo não identificado por completo.");

  return {
    placa,
    renavam,
    chassi,
    marca: marcaModelo.marca,
    modelo: marcaModelo.modelo,
    anoFabricacao,
    anoModelo,
    cor,
    combustivel,
    proprietario,
    subcategoria,
    exercicio,
    avisos,
  };
}
