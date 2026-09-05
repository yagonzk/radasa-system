import { AppError } from "../utils/app-error.js";
import { interpretarTextoCrlv } from "./crlv-text-parser.js";

export function interpretarCrlvTexto(rawText: unknown) {
  const text = String(rawText ?? "").trim();
  if (text.length < 30) {
    throw new AppError(
      422,
      "Não foi possível ler texto suficiente deste CRLV. Confira se o PDF está legível.",
    );
  }

  const result = interpretarTextoCrlv(text);
  const identified = [
    result.placa,
    result.renavam,
    result.chassi,
    result.marca,
    result.modelo,
  ].filter(Boolean).length;

  if (identified === 0) {
    throw new AppError(
      422,
      "O PDF foi lido, mas não foi possível reconhecer os dados principais de um CRLV.",
    );
  }

  return result;
}
