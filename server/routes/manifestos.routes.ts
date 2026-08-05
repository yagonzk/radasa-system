import { Router } from "express";
import multer from "multer";
import { crudRoutes } from "./crud.routes";
import { manifestosController } from "../controllers/manifestos.controller";
import { manifestoBody } from "../validators/schemas";
import {
  interpretarManifestoPdf,
  sugerirVinculosManifestoPdf,
} from "../services/manifesto-pdf.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: 1, fileSize: 15 * 1024 * 1024 },
});

export const manifestosRoutes = Router();

manifestosRoutes.post(
  "/interpretar-pdf",
  upload.single("arquivo"),
  async (req, res, next) => {
    try {
      const file = req.file;
      if (!file) {
        res.status(400).json({ message: "Selecione um arquivo PDF." });
        return;
      }
      if (
        file.mimetype !== "application/pdf" &&
        !file.originalname.toLowerCase().endsWith(".pdf")
      ) {
        res.status(400).json({ message: "O arquivo deve estar no formato PDF." });
        return;
      }

      const documento = await interpretarManifestoPdf(file.buffer);
      const sugestoes = await sugerirVinculosManifestoPdf(documento);
      const pendencias: string[] = [];

      if (!documento.dataEmissao) pendencias.push("data do manifesto");
      if (!sugestoes.cliente) pendencias.push("cliente");
      if (!documento.produtos.length) pendencias.push("produtos");
      if (sugestoes.produtos.some((item) => !item.cadastro)) {
        pendencias.push("associação de produtos");
      }

      res.json({ documento, sugestoes, pendencias });
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.use(crudRoutes(manifestosController, manifestoBody));
