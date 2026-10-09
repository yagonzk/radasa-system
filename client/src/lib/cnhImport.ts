/** Leitura local e assistida de CNH digital. Nunca grava um cadastro nem o PDF. */
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export type CnhCampo = "nome" | "cpf" | "rg" | "dataNascimento" | "cnhNumero" | "cnhRegistro" | "cnhCategoria" | "cnhEmissao" | "cnhValidade" | "primeiraHabilitacao";
export type DadosCnh = Partial<Record<CnhCampo, string>>;
export type ResultadoCnh = { dados: DadosCnh; avisos: string[] };

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
  else avisos.push("CPF não reconhecido com segurança. Confira e preencha manualmente o campo 4d.");
  const identidade = (areas.rg ?? "").replace(/[oO]/g, "0").match(/\d[\d.\-]{4,13}\d/);
  if (identidade) dados.rg = somenteNumeros(identidade[0]);
  dados.dataNascimento = dataBrasileira(areas.dataNascimento ?? "");
  dados.primeiraHabilitacao = dataBrasileira(areas.primeiraHabilitacao ?? "");
  dados.cnhEmissao = dataBrasileira(areas.cnhEmissao ?? "");
  dados.cnhValidade = dataBrasileira(areas.cnhValidade ?? "");
  const registro = numeroRegistro(areas.cnhRegistro ?? "");
  if (registro) {
    // "Número CNH" e "Registro CNH" referem-se ao número de registro (campo 5).
    dados.cnhNumero = registro;
    dados.cnhRegistro = registro;
  }
  dados.cnhCategoria = categoriaCnh(areas.cnhCategoria ?? "");
  if (!dados.cnhCategoria) avisos.push("Categoria não identificada. Confira o campo 9 CAT. HAB. (não o D de ACC).");
  for (const campo of Object.keys(dados) as CnhCampo[]) if (!dados[campo]) delete dados[campo];
  if (!dados.cpf || !dados.nome || !dados.cnhRegistro) avisos.push("Alguns campos podem exigir preenchimento manual.");
  return { dados, avisos };
}

// Posições relativas do anverso de CNH-e emitida pela CDT em página A4.
// Deliberadamente exclui o QR Code, a fotografia e os dados de filiação.
const REGIOES_CNH: Record<string, readonly [number, number, number, number]> = {
  nome: [0.122, 0.129, 0.375, 0.142],
  primeiraHabilitacao: [0.381, 0.131, 0.448, 0.142],
  dataNascimento: [0.239, 0.149, 0.441, 0.159],
  cnhEmissao: [0.237, 0.167, 0.297, 0.175],
  cnhValidade: [0.308, 0.167, 0.369, 0.175],
  rg: [0.238, 0.184, 0.440, 0.192],
  cpf: [0.238, 0.196, 0.314, 0.211],
  cnhRegistro: [0.314, 0.195, 0.390, 0.210],
  cnhCategoria: [0.399, 0.196, 0.454, 0.211],
};

function recortar(canvas: HTMLCanvasElement, bounds: readonly [number, number, number, number]) {
  const [x1, y1, x2, y2] = bounds;
  const crop = document.createElement("canvas");
  const sourceX = Math.round(canvas.width * x1), sourceY = Math.round(canvas.height * y1);
  const sourceW = Math.round(canvas.width * (x2 - x1)), sourceH = Math.round(canvas.height * (y2 - y1));
  // Aumentar áreas pequenas ajuda o OCR nos dígitos vermelhos da CNH-e.
  crop.width = Math.max(1, sourceW * 3);
  crop.height = Math.max(1, sourceH * 3);
  const ctx = crop.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a imagem da CNH.");
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, crop.width, crop.height);
  ctx.drawImage(canvas, sourceX, sourceY, sourceW, sourceH, 0, 0, crop.width, crop.height);
  return crop;
}

/** Converte apenas letras vermelhas do campo 9 em texto preto: ignora o D preto de ACC. */
function realcarVermelho(crop: HTMLCanvasElement): HTMLCanvasElement | null {
  const context = crop.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  const original = context.getImageData(0, 0, crop.width, crop.height);
  const pixels = original.data;
  let redPixels = 0;
  for (let i = 0; i < pixels.length; i += 4) {
    const [r, g, b] = [pixels[i], pixels[i + 1], pixels[i + 2]];
    if (r >= 110 && r > g + 28 && r > b + 28) {
      pixels[i] = pixels[i + 1] = pixels[i + 2] = 0;
      redPixels += 1;
    } else pixels[i] = pixels[i + 1] = pixels[i + 2] = 255;
  }
  if (redPixels < 25) return null; // CNH de outra edição: usa OCR convencional.
  const prepared = document.createElement("canvas");
  prepared.width = crop.width;
  prepared.height = crop.height;
  prepared.getContext("2d")?.putImageData(original, 0, 0);
  return prepared;
}

/** Alternativa de contraste, usada somente se o CPF não passar na validação. */
function altoContraste(crop: HTMLCanvasElement): HTMLCanvasElement {
  const result = document.createElement("canvas");
  result.width = crop.width;
  result.height = crop.height;
  const context = result.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Não foi possível preparar a leitura dos números da CNH.");
  context.drawImage(crop, 0, 0);
  const image = context.getImageData(0, 0, result.width, result.height);
  for (let i = 0; i < image.data.length; i += 4) {
    const gray = image.data[i] * 0.299 + image.data[i + 1] * 0.587 + image.data[i + 2] * 0.114;
    const value = gray < 195 ? 0 : 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
  }
  context.putImageData(image, 0, 0);
  return result;
}

export async function lerCnhPdf(file: File, progresso?: (mensagem: string) => void): Promise<ResultadoCnh> {
  if (file.size > 10 * 1024 * 1024) throw new Error("O PDF deve ter no máximo 10 MB.");
  const loading = getDocument({ data: new Uint8Array(await file.arrayBuffer()) });
  let ocrWorker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>> | undefined;
  let pageCanvas: HTMLCanvasElement | undefined;
  try {
    const doc = await loading.promise;
    if (doc.numPages < 1 || doc.numPages > 3) throw new Error("Envie uma CNH em PDF com até 3 páginas.");
    progresso?.("Preparando a leitura da CNH...");
    const page = await doc.getPage(1);
    const viewport = page.getViewport({ scale: 3 });
    if (viewport.width * viewport.height > 9_000_000) throw new Error("A página da CNH possui dimensões acima do limite.");
    pageCanvas = document.createElement("canvas");
    pageCanvas.width = Math.ceil(viewport.width);
    pageCanvas.height = Math.ceil(viewport.height);
    const ctx = pageCanvas.getContext("2d");
    if (!ctx) throw new Error("Não foi possível renderizar o PDF.");
    await page.render({ canvas: pageCanvas, canvasContext: ctx, viewport }).promise;
    const { createWorker, PSM } = await import("tesseract.js");
    progresso?.("Carregando reconhecimento de texto...");
    ocrWorker = await createWorker("por", 1);
    await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, preserve_interword_spaces: "1" });
    const areas: Record<string, string> = {};
    const entries = Object.entries(REGIOES_CNH);
    for (let index = 0; index < entries.length; index++) {
      const [field, coords] = entries[index];
      progresso?.(`Lendo os dados da CNH (${index + 1}/${entries.length})...`);
      const crop = recortar(pageCanvas, coords);
      try {
        if (field === "cnhCategoria") {
          const redOnly = realcarVermelho(crop);
          try {
            // Na CNH-e de exemplo a categoria "AD" é vermelha; o "D" de ACC é preto.
            if (redOnly) {
              await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, tessedit_char_whitelist: "ABCDE" });
              const redText = (await ocrWorker.recognize(redOnly)).data.text.trim();
              if (categoriaCnh(redText)) areas[field] = redText;
              if (categoriaCnh(redText) === "D") {
                // Uma leitura de "AD" pode perder o A. Releia antes de aceitar D.
                await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "ABCDE" });
                const another = (await ocrWorker.recognize(redOnly)).data.text.trim();
                if (categoriaCnh(another)?.length === 2) areas[field] = another;
              }
            }
            if (!areas[field]) {
              await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, tessedit_char_whitelist: "ABCDE" });
              areas[field] = (await ocrWorker.recognize(crop)).data.text.trim();
            }
          } finally { if (redOnly) redOnly.width = redOnly.height = 1; }
        } else if (field === "cpf") {
          await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "0123456789.- " });
          areas[field] = (await ocrWorker.recognize(crop)).data.text.trim();
          if (!cpfsDoOcr(areas[field]).some(cpfValido)) {
            // Não inventa números: tenta uma segunda imagem, e aceita só CPF válido.
            const enhanced = altoContraste(crop);
            try {
              await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, tessedit_char_whitelist: "0123456789.- " });
              const alternative = (await ocrWorker.recognize(enhanced)).data.text.trim();
              areas[field] += "\n" + alternative;
            } finally { enhanced.width = enhanced.height = 1; }
          }
        } else {
          const mode = field === "cnhRegistro" ? PSM.SINGLE_BLOCK : PSM.SINGLE_LINE;
          await ocrWorker.setParameters({ tessedit_pageseg_mode: mode, tessedit_char_whitelist: "" });
          areas[field] = (await ocrWorker.recognize(crop)).data.text.trim();
        }
      } finally { crop.width = crop.height = 1; }
    }
    const result = interpretarCamposCnh(areas);
    const essential = ["nome", "cpf", "cnhRegistro"].filter(field => result.dados[field as CnhCampo]);
    if (!essential.length) throw new Error("Não foi possível identificar os dados da CNH. Confira se o PDF é uma CNH-e digital legível.");
    return result;
  } finally {
    pageCanvas && (pageCanvas.width = pageCanvas.height = 1);
    await ocrWorker?.terminate();
    await loading.destroy();
  }
}
