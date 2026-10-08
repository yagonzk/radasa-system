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
  const normalized = raw.toUpperCase().replace(/[^A-Z]/g, " ").trim();
  const allowed = new Set(["ACC", "A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"]);
  return normalized.split(/\s+/).reverse().find(token => allowed.has(token));
}

/** Campos OCR de áreas isoladas da frente da CNH-e da CDT/SENATRAN. */
export function interpretarCamposCnh(areas: Record<string, string>): ResultadoCnh {
  const dados: DadosCnh = {};
  const avisos: string[] = [];
  dados.nome = nomeCnh(areas.nome ?? "");
  const cpfCandidates = [...(areas.cpf ?? "").matchAll(/(\d{3})[.\s]?(\d{3})[.\s]?(\d{3})[-\s]?(\d{2})(?!\d)/g)]
    .map(match => match.slice(1, 5).join(""));
  const cpf = cpfCandidates.find(cpfValido);
  if (cpf) dados.cpf = cpf;
  else if (areas.cpf?.trim()) avisos.push("CPF não foi reconhecido com segurança; confira no documento.");
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
  cpf: [0.241, 0.195, 0.309, 0.210],
  cnhRegistro: [0.314, 0.195, 0.390, 0.210],
  cnhCategoria: [0.402, 0.195, 0.451, 0.210],
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
    await ocrWorker.setParameters({ tessedit_pageseg_mode: String(PSM.SINGLE_LINE), preserve_interword_spaces: "1" });
    const areas: Record<string, string> = {};
    const entries = Object.entries(REGIOES_CNH);
    for (let index = 0; index < entries.length; index++) {
      const [field, coords] = entries[index];
      progresso?.(`Lendo os dados da CNH (${index + 1}/${entries.length})...`);
      const modo = ["cpf", "cnhRegistro", "cnhCategoria"].includes(field) ? PSM.SINGLE_BLOCK : PSM.SINGLE_LINE;
      await ocrWorker.setParameters({ tessedit_pageseg_mode: String(modo) });
      const crop = recortar(pageCanvas, coords);
      try { areas[field] = (await ocrWorker.recognize(crop)).data.text.trim(); }
      finally { crop.width = 1; crop.height = 1; }
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
