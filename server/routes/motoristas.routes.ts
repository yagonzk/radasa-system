import { Router } from "express";
import multer from "multer";
import { crudRoutes } from "./crud.routes.js";
import { motoristasController } from "../controllers/motoristas.controller.js";
import { motoristaBody } from "../validators/schemas.js";
import { motoristasService } from "../services/motoristas.service.js";
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

export const motoristasRoutes = Router();
motoristasRoutes.use(crudRoutes(motoristasController, motoristaBody));

motoristasRoutes.post("/:id/documento/:tipo", upload.single("arquivo"), asyncHandler(async (req, res) => {
  if (!req.file) throw new AppError(400, "Selecione um arquivo PDF.");
  res.json(await motoristasService.uploadPdf(String(req.params.id), String(req.params.tipo), req.file));
}));
motoristasRoutes.get("/:id/documento/:tipo", asyncHandler(async (req, res) => {
  const doc = await motoristasService.getPdf(String(req.params.id), String(req.params.tipo));
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `inline; filename*=UTF-8''${encodeURIComponent(doc.nome)}`);
  res.send(doc.buffer);
}));
motoristasRoutes.delete("/:id/documento/:tipo", asyncHandler(async (req, res) => {
  res.json(await motoristasService.removePdf(String(req.params.id), String(req.params.tipo)));
}));
