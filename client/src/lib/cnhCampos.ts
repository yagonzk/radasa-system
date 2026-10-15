/** Interpreta texto OCR dos campos isolados: sem dependência do PDF, sem gravar dados. */
export type CnhCampo = "nome" | "cpf" | "rg" | "dataNascimento" | "cnhNumero" | "cnhRegistro" | "cnhCategoria" | "cnhEmissao" | "cnhValidade" | "primeiraHabilitacao";
export type DadosCnh = Partial<Record<CnhCampo, string>>;
export type ResultadoCnh = { dados: DadosCnh; avisos: string[]; modelo?: string };

function somenteNumeros(value: string): string { return value.replace(/\D/g, ""); }
function cpfValido(value: string): boolean {
  const digits = somenteNumeros(value);
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  for (let length = 9; length <= 10; length += 1) {
    let sum = 0;
    for (let index = 0; index < length; index += 1) sum += Number(digits[index]) * (length + 1 - index);
    if ((((sum * 10) % 11) % 10) !== Number(digits[length])) return false;
  }
  return true;
}
function dataBrasileira(value: string): string | undefined {
  const fixed = value.replace(/[oO]/g, "0").replace(/[lI|]/g, "1");
  const match = fixed.match(/(\d{2})\s*[\/\.\-]\s*(\d{2})\s*[\/\.\-]\s*(\d{4})/);
  if (!match) return undefined;
  const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
  if (year < 1900 || year > 2100) return undefined;
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return undefined;
  return `${match[3]}-${match[2]}-${match[1]}`;
}
/** Leitura tolerante apenas para a emissão: a impressão clara pode perder as barras no OCR. */
function dataEmissaoCnh(raw: string): string | undefined {
  const usual = dataBrasileira(raw);
  if (usual) return usual;
  const fixed = raw.toUpperCase().replace(/[OQ]/g, "0").replace(/[IL|]/g, "1");
  for (const line of fixed.split(/\r?\n/)) {
    // Aceita 16 12 2021 ou 16122021 somente no campo já recortado DATA EMISSÃO.
    const match = line.match(/(?:^|\D)(\d{2})\s+(\d{2})\s+(\d{4})(?!\d)/)
      || line.match(/(?:^|\D)(\d{2})(\d{2})(\d{4})(?!\d)/);
    if (!match) continue;
    const result = dataBrasileira(`${match[1]}/${match[2]}/${match[3]}`);
    if (result) return result;
  }
  return undefined;
}

function nomeCnh(raw: string): string | undefined {
  const line = raw.split(/\r?\n/).map(s => s.trim()).filter(Boolean).find(line => {
    const compact = line.replace(/[^\p{L} ]/gu, "").trim();
    return compact.length >= 8 && compact.split(/\s+/).length >= 2 && !/NOME|SOBRENOME|CARTEIRA|REPÚBLICA|PERMISO|LICEN[CS]E/i.test(compact);
  });
  if (!line) return undefined;
  const candidate = line.toLocaleUpperCase("pt-BR").replace(/[^\p{L} ]/gu, " ").replace(/\s+/g, " ").trim();
  return candidate.length >= 8 && candidate.length <= 100 ? candidate : undefined;
}
function numeroRegistro(raw: string): string | undefined {
  const fixed = raw.replace(/[oO]/g, "0").replace(/[lI|]/g, "1");
  return fixed.match(/(?:^|\D)(\d{11})(?!\d)/)?.[1];
}
function categoriaCnh(raw: string): string | undefined {
  // Limita a análise ao valor do campo 9, não ao "D" grande da área ACC.
  const clean = raw.toUpperCase().replace(/\b(?:CAT(?:EGORIA)?|HAB(?:ILITACAO)?|ACC)\b/g, " ")
    .replace(/[^A-Z\s]/g, " ").replace(/\s+/g, " ").trim();
  const allowed = new Set(["ACC", "A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"]);
  const tokens = clean.split(" ").filter(Boolean);
  // A impressão ou o OCR pode separar "A D" em duas palavras/linhas.
  for (let i = 0; i < tokens.length - 1; i++) {
    const joined = tokens[i] + tokens[i + 1];
    if (/^A[B-E]$/.test(joined)) return joined;
  }
  return tokens.reverse().find(token => allowed.has(token));
}

function cpfsDoOcr(raw: string): string[] {
  // Normaliza confusões de letras que aparecem em campos numéricos da CNH-e.
  const digitsText = raw.toUpperCase().replace(/[OQ]/g, "0").replace(/[IL|]/g, "1")
    .replace(/S/g, "5").replace(/B/g, "8");
  const found: string[] = [];
  // Aceita espaços e quebras de linha entre dígitos, sem capturar o rótulo "4d CPF".
  for (const match of digitsText.matchAll(/(?:^|[^\d])((?:\d[.\s\-]*){10}\d)(?!\d)/g)) {
    const value = somenteNumeros(match[1]);
    if (!found.includes(value)) found.push(value);
  }
  return found;
}

/** Campos OCR de áreas isoladas da frente da CNH-e da CDT/SENATRAN. */
export function interpretarCamposCnh(areas: Record<string, string>): ResultadoCnh {
  const dados: DadosCnh = {};
  const avisos: string[] = [];
  dados.nome = nomeCnh(areas.nome ?? "");
  const cpf = cpfsDoOcr(areas.cpf ?? "").find(cpfValido);
  if (cpf) dados.cpf = cpf;
  else avisos.push("CPF não reconhecido com segurança. Confira e preencha manualmente.");
  const identidade = (areas.rg ?? "").replace(/[oO]/g, "0").match(/\d[\d.\-]{4,13}\d/);
  if (identidade) dados.rg = somenteNumeros(identidade[0]);
  dados.dataNascimento = dataBrasileira(areas.dataNascimento ?? "");
  dados.primeiraHabilitacao = dataBrasileira(areas.primeiraHabilitacao ?? "");
  dados.cnhEmissao = dataEmissaoCnh(areas.cnhEmissao ?? "");
  dados.cnhValidade = dataBrasileira(areas.cnhValidade ?? "");
  const registro = numeroRegistro(areas.cnhRegistro ?? "");
  if (registro) {
    // "Número CNH" e "Registro CNH" referem-se ao número de registro (campo 5).
    dados.cnhNumero = registro;
    dados.cnhRegistro = registro;
  }
  dados.cnhCategoria = categoriaCnh(areas.cnhCategoria ?? "");
  if (!dados.cnhCategoria) avisos.push("Categoria não identificada. Confira o campo CAT. HAB. da CNH.");
  for (const campo of Object.keys(dados) as CnhCampo[]) if (!dados[campo]) delete dados[campo];
  if (!dados.cpf || !dados.nome || !dados.cnhRegistro) avisos.push("Alguns campos podem exigir preenchimento manual.");
  return { dados, avisos };
}

