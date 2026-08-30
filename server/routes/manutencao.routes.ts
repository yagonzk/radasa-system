import { Router } from "express";
import multer from "multer";
import { asyncHandler } from "../utils/async-handler.js";
import { manutencaoController as c } from "../controllers/manutencao.controller.js";
import { AppError } from "../utils/app-error.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = file.originalname.toLowerCase();
    const ok = file.mimetype === "application/pdf" || file.mimetype.startsWith("image/") || file.mimetype.includes("xml") || name.endsWith(".pdf") || name.endsWith(".xml") || /\.(png|jpe?g|webp)$/i.test(name);
    if (!ok) return cb(new AppError(400, "Envie PDF, XML ou imagem (JPG/PNG/WEBP)."));
    cb(null, true);
  },
});

export const manutencaoRoutes = Router();
manutencaoRoutes.get("/dashboard", asyncHandler(c.dashboard));
manutencaoRoutes.get("/planos", asyncHandler(c.planos));
manutencaoRoutes.post("/planos", asyncHandler(c.criarPlano));
manutencaoRoutes.delete("/planos/:id", asyncHandler(c.removerPlano));
manutencaoRoutes.get("/ordens", asyncHandler(c.ordens));
manutencaoRoutes.get("/ordens/:id", asyncHandler(c.obterOs));
manutencaoRoutes.post("/ordens", asyncHandler(c.criarOs));
manutencaoRoutes.put("/ordens/:id", asyncHandler(c.atualizarOs));
manutencaoRoutes.put("/ordens/:id/concluir", asyncHandler(c.concluirOs));
manutencaoRoutes.post("/ordens/:id/notas", upload.single("arquivo"), asyncHandler(c.adicionarNotaFiscal));
manutencaoRoutes.get("/ordens/:id/notas/:notaId/arquivo", asyncHandler(c.arquivoNotaFiscal));
manutencaoRoutes.delete("/ordens/:id/notas/:notaId", asyncHandler(c.removerNotaFiscal));
manutencaoRoutes.post("/ordens/:id/anexos", upload.single("arquivo"), asyncHandler(c.adicionarAnexo));
manutencaoRoutes.get("/ordens/:id/anexos/:anexoId/arquivo", asyncHandler(c.arquivoAnexo));
manutencaoRoutes.delete("/ordens/:id/anexos/:anexoId", asyncHandler(c.removerAnexo));
manutencaoRoutes.get("/documentos", asyncHandler(c.documentos));
manutencaoRoutes.post("/documentos", asyncHandler(c.criarDocumento));
manutencaoRoutes.delete("/documentos/:id", asyncHandler(c.removerDocumento));
