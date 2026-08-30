import { Router } from "express";
import multer from "multer";
import { crudRoutes } from "./crud.routes.js";
import { abastecimentosController } from "../controllers/abastecimentos.controller.js";
import { abastecimentosService } from "../services/abastecimentos.service.js";
import { abastecimentoBody } from "../validators/schemas.js";
import {
  interpretarDocumentoAbastecimento,
  interpretarTextoPdfAbastecimento,
} from "../services/abastecimento-documento.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    files: 1,
    fileSize: 10 * 1024 * 1024,
  },
});

export const abastecimentosRoutes = Router();

abastecimentosRoutes.post("/excluir-lote", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id: unknown) => String(id ?? "").trim()).filter(Boolean)
      : [];
    if (!ids.length) {
      res.status(400).json({ message: "Selecione ao menos um abastecimento para excluir." });
      return;
    }
    if (ids.length > 500) {
      res.status(400).json({ message: "Exclua no máximo 500 abastecimentos por operação." });
      return;
    }
    res.json(await abastecimentosService.removeMany(ids));
  } catch (error) {
    next(error);
  }
});

abastecimentosRoutes.post("/interpretar-texto-pdf", async (req, res, next) => {
  try {
    const texto = String(req.body?.texto ?? "");
    res.json(await interpretarTextoPdfAbastecimento(texto));
  } catch (error) {
    next(error);
  }
});

abastecimentosRoutes.post(
  "/interpretar-documento",
  upload.single("arquivo"),
  async (req, res, next) => {
    try {
      if (!req.file) {
        res.status(400).json({
          message: "Selecione um XML ou PDF de nota fiscal.",
        });
        return;
      }

      const result = await interpretarDocumentoAbastecimento(req.file);
      res.json(result);
    } catch (error) {
      next(error);
    }
  },
);

abastecimentosRoutes.get("/:id/documento/:tipo", async (req, res, next) => {
  try {
    const tipo = String(req.params.tipo ?? "").toLowerCase();
    if (tipo !== "pdf" && tipo !== "xml") {
      res.status(400).json({ message: "Tipo de documento inválido." });
      return;
    }
    res.json(await abastecimentosService.getDocumento(req.params.id, tipo));
  } catch (error) {
    next(error);
  }
});

abastecimentosRoutes.use(
  crudRoutes(abastecimentosController, abastecimentoBody),
);
