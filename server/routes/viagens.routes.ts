import { Router } from "express";
import { crudRoutes } from "./crud.routes.js";
import { viagensController } from "../controllers/viagens.controller.js";
import { viagemBody } from "../validators/schemas.js";
import { interpretarTextoManifestoPdf } from "../services/manifesto-pdf.service.js";

export const viagensRoutes = Router();

function cleanInlineValue(value: string) {
  return value
    .replace(/\s{2,}/g, " ")
    .replace(/\b(?:PLACA|VE[IÍ]CULO|KM|DIST[ÂA]NCIA|CLIENTE|ROMANEIO|NOTA\s+FISCAL)\b.*$/i, "")
    .replace(/[|;]+.*$/, "")
    .trim();
}
function extractMotorista(text: string) {
  const patterns = [
    /(?:MOTORISTA|CONDUTOR)\s*[:\-]?\s*([^\n\r|;]{2,80})/i,
    /(?:MOTORISTA|CONDUTOR)\s+([A-ZÀ-Ü][A-ZÀ-Ü .'-]{2,60})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = cleanInlineValue(match?.[1] ?? "");
    if (value) return value;
  }
  return "";
}
function extractCidadeDestino(text: string) {
  const pattern = /(?:CIDADE\s+(?:DE\s+)?DESTINO|DESTINO|CIDADE\s+DE\s+ENTREGA|ENTREGA\s+EM)\s*[:\-]?\s*([^\n\r|;]{2,100})/i;
  const match = text.match(pattern);
  return cleanInlineValue(match?.[1] ?? "");
}
function parseBrNumber(value: string) {
  const raw = String(value ?? "").replace(/\s/g, "");
  if (!raw) return 0;
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}
function extractDistanciaKm(text: string) {
  const patterns = [
    /(?:DIST[ÂA]NCIA(?:\s+(?:TOTAL|DA\s+VIAGEM|DA\s+ROTA))?|QUILOMETRAGEM(?:\s+TOTAL)?|KM\s+(?:TOTAL|DA\s+VIAGEM|DA\s+ROTA|ROTA|VIAGEM))\s*[:\-]?\s*([0-9][0-9.,]{0,12})\s*(?:KM)?\b/i,
    /(?:TOTAL\s+KM|KM\s+PERCORRIDO)\s*[:\-]?\s*([0-9][0-9.,]{0,12})/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    const value = parseBrNumber(match?.[1] ?? "");
    if (value > 0 && value < 100000) return value;
  }
  return 0;
}
viagensRoutes.post("/ler-romaneio", async (req, res, next) => {
  try {
    const texto = String(req.body?.texto ?? "");
    if (!texto.trim()) {
      res.status(400).json({ message: "Não foi possível extrair o texto do romaneio." });
      return;
    }
    const documento = interpretarTextoManifestoPdf(texto);
    res.json({
      parserVersion: documento.parserVersion,
      dataManifesto: documento.dataEmissao,
      placa: documento.placaVeiculo,
      valorFrete: Number(documento.valorTotal || 0),
      romaneios: documento.romaneios,
      motoristaNome: extractMotorista(texto),
      cidadeDestino: extractCidadeDestino(texto),
      distanciaKm: extractDistanciaKm(texto),
      avisos: documento.avisos,
    });
  } catch (error) {
    next(error);
  }
});
viagensRoutes.use(crudRoutes(viagensController, viagemBody));
