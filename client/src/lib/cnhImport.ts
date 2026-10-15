/** Leitura local e assistida de CNH digital. Nunca grava um cadastro nem o PDF. */
import { getDocument, GlobalWorkerOptions } from "pdfjs-dist";
import pdfWorkerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";
import { identificarPerfilCnh, type CnhRegiao, type CnhPerfil } from "./cnhLayouts";

GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export { interpretarCamposCnh } from "./cnhCampos";
export type { CnhCampo, DadosCnh, ResultadoCnh } from "./cnhCampos";
import { interpretarCamposCnh, type CnhCampo, type ResultadoCnh } from "./cnhCampos";

/** Trata somente valores de categoria encontrados no recorte isolado. */
function categoriaDoOcr(raw: string): string | undefined {
  const value = raw.toUpperCase().replace(/[^A-Z]/g, "");
  if (["ACC", "A", "B", "C", "D", "E", "AB", "AC", "AD", "AE"].includes(value)) return value;
  return undefined;
}

function recortar(canvas: HTMLCanvasElement, bounds: CnhRegiao) {
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
    const detected = identificarPerfilCnh(pageCanvas);
    progresso?.(`Modelo identificado: ${detected.nome}.`);
    const result = await extrairPerfilCnh(pageCanvas, ocrWorker, PSM, detected, progresso);
    const essential = ["nome", "cpf", "cnhRegistro"].filter(field => result.dados[field as CnhCampo]);
    if (!essential.length) throw new Error("Não foi possível identificar os dados da CNH. Confira se o PDF é uma CNH-e digital legível.");
    return result;
  } finally {
    pageCanvas && (pageCanvas.width = pageCanvas.height = 1);
    await ocrWorker?.terminate();
    await loading.destroy();
  }
}

async function extrairPerfilCnh(
  pageCanvas: HTMLCanvasElement,
  ocrWorker: Awaited<ReturnType<typeof import("tesseract.js")["createWorker"]>>,
  PSM: typeof import("tesseract.js")["PSM"],
  perfil: CnhPerfil,
  progresso?: (mensagem: string) => void,
): Promise<ResultadoCnh> {
    const areas: Record<string, string> = {};
    const entries = Object.entries(perfil.regioes);
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
              if (categoriaDoOcr(redText)) areas[field] = redText;
              if (categoriaDoOcr(redText) === "D") {
                // Uma leitura de "AD" pode perder o A. Releia antes de aceitar D.
                await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "ABCDE" });
                const another = (await ocrWorker.recognize(redOnly)).data.text.trim();
                if (categoriaDoOcr(another)?.length === 2) areas[field] = another;
              }
            }
            if (!areas[field]) {
              await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_WORD, tessedit_char_whitelist: "ABCDE" });
              areas[field] = (await ocrWorker.recognize(crop)).data.text.trim();
            }
          } finally { if (redOnly) redOnly.width = redOnly.height = 1; }
        } else if (perfil.id === "cnh-e-verde" && field === "cnhValidade") {
          // No modelo antigo, a validade também é impressa em tinta clara.
          const redOnly = realcarVermelho(crop);
          try {
            await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "0123456789/.-" });
            areas[field] = (await ocrWorker.recognize(redOnly || crop)).data.text.trim();
            if (!interpretarCamposCnh({ cnhValidade: areas[field] }).dados.cnhValidade) {
              areas[field] += "\n" + (await ocrWorker.recognize(crop)).data.text.trim();
            }
          } finally { if (redOnly) redOnly.width = redOnly.height = 1; }
        } else if (perfil.id === "cnh-e-verde" && field === "cnhRegistro") {
          // O registro do modelo verde aparece em tinta alaranjada, pouco
          // contrastante; separar essa tinta reduz erros com os contornos.
          const redOnly = realcarVermelho(crop);
          try {
            await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "0123456789" });
            areas[field] = (await ocrWorker.recognize(redOnly || crop)).data.text.trim();
            if (!/\d{11}/.test(areas[field])) {
              await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "0123456789" });
              areas[field] += "\n" + (await ocrWorker.recognize(crop)).data.text.trim();
            }
          } finally { if (redOnly) redOnly.width = redOnly.height = 1; }
        } else if (field === "cpf") {
          await ocrWorker.setParameters({ tessedit_pageseg_mode: PSM.SINGLE_LINE, tessedit_char_whitelist: "0123456789.- " });
          areas[field] = (await ocrWorker.recognize(crop)).data.text.trim();
          if (!interpretarCamposCnh({ cpf: areas[field] }).dados.cpf) {
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
    return { ...result, modelo: perfil.nome };
}
