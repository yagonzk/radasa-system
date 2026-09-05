import { Router } from "express";
import multer from "multer";
import { crudRoutes } from "./crud.routes.js";
import { veiculosController } from "../controllers/veiculos.controller.js";
import { veiculoBody } from "../validators/schemas.js";
import { veiculosService } from "../services/veiculos.service.js";
import { interpretarCrlvPdf } from "../services/crlv-pdf.service.js";
import { asyncHandler } from "../utils/async-handler.js";
import { AppError } from "../utils/app-error.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok = file.mimetype === "application/pdf" || file.originalname.toLowerCase().endsWith(".pdf");
    if (!ok) return cb(new AppError(400, "Envie somente arquivos PDF."));
    cb(null, true);
  },
});

export const veiculosRoutes = Router();
veiculosRoutes.post("/crlv-pdf/interpretar", upload.single("arquivo"), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, "Selecione o PDF do CRLV.");
  res.json(await interpretarCrlvPdf(req.file.buffer));
}));
veiculosRoutes.use(crudRoutes(veiculosController, veiculoBody));
veiculosRoutes.post("/:id/crlv-pdf", upload.single("arquivo"), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, "Selecione o PDF do CRLV.");
  res.json(await veiculosService.uploadCrlvPdf(String(req.params.id), req.file));
}));
veiculosRoutes.get("/:id/crlv-pdf", asyncHandler(async (req, res) => {
  const doc = await veiculosService.getCrlvPdf(String(req.params.id));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(doc.nome)}`);
  res.send(doc.buffer);
}));
veiculosRoutes.delete("/:id/crlv-pdf", asyncHandler(async (req, res) => {
  res.json(await veiculosService.removeCrlvPdf(String(req.params.id)));
}));
