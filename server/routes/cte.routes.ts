import { Router } from "express";
import multer from "multer";
import { interpretarCteXml } from "../services/cte-documento.service.js";
import { completarDadosAnttCte } from "../services/cte-antt-auto.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024, files: 20 },
});
export const cteRoutes = Router();
cteRoutes.post(
  "/interpretar",
  upload.array("arquivos", 20),
  async (req, res, next) => {
    try {
      const files = (req.files ?? []) as Express.Multer.File[];
      if (!files.length) {
        res.status(400).json({ message: "Selecione um ou mais XMLs de CT-e." });
        return;
      }
      if (files.reduce((sum, file) => sum + file.size, 0) > 10 * 1024 * 1024) {
        res.status(413).json({ message: "O lote deve ter no máximo 10 MB." });
        return;
      }
      const ctes: Array<
        ReturnType<typeof interpretarCteXml> & {
          fileName: string;
          xmlUrl: string;
        }
      > = [];
      const erros: Array<{ fileName: string; message: string }> = [];
      const keys = new Set<string>();
      for (const file of files) {
        try {
          if (!file.originalname.toLowerCase().endsWith(".xml"))
            throw new Error("Somente XML de CT-e é aceito.");
          const result = interpretarCteXml(file.buffer.toString("utf8"));
          if (!/^\d{44}$/.test(result.chave ?? ""))
            throw new Error("Chave do CT-e inválida ou ausente.");
          if (keys.has(result.chave)) {
            erros.push({
              fileName: file.originalname,
              message: "CT-e duplicado no lote; não foi somado novamente.",
            });
            continue;
          }
          keys.add(result.chave);
          ctes.push({
            ...result,
            fileName: file.originalname,
            xmlUrl: `data:application/xml;base64,${file.buffer.toString("base64")}`,
          });
        } catch (error) {
          erros.push({
            fileName: file.originalname,
            message: error instanceof Error ? error.message : "XML inválido.",
          });
        }
      }
      if (!ctes.length) {
        res
          .status(422)
          .json({
            message: erros
              .map((item) => `${item.fileName}: ${item.message}`)
              .join(" | "),
            erros,
          });
        return;
      }
      res.json({
        ctes,
        erros,
        resumo: {
          quantidade: ctes.length,
          pesoKg: ctes.reduce((n, c) => n + c.pesoKg, 0),
          valorMercadoria: ctes.reduce((n, c) => n + c.valorMercadoria, 0),
          valorFrete: ctes.reduce((n, c) => n + c.valorFrete, 0),
          valorPedagio: ctes.reduce((n, c) => n + c.valorPedagio, 0),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
cteRoutes.post("/complementar-antt", async (req, res, next) => {
  try {
    res.json(await completarDadosAnttCte(req.body ?? {}));
  } catch (error) {
    next(error);
  }
});
