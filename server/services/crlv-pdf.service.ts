import pdf from "pdf-parse";
import { AppError } from "../utils/app-error.js";
import { interpretarTextoCrlv } from "./crlv-text-parser.js";

export async function interpretarCrlvPdf(buffer: Buffer) {
  const parsed = await pdf(buffer);
  const text = String(parsed.text ?? "").trim();
  if (text.length < 30) {
    throw new AppError(422, "Não foi possível ler texto suficiente deste CRLV. Se o PDF for apenas uma imagem digitalizada, preencha os campos manualmente.");
  }

  const result = interpretarTextoCrlv(text);
  const identified = [result.placa, result.renavam, result.chassi, result.marca, result.modelo].filter(Boolean).length;
  if (identified === 0) {
    throw new AppError(422, "O PDF foi lido, mas não foi possível reconhecer os dados principais de um CRLV.");
  }
  return result;
}
