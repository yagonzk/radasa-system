import { Router } from "express";
import multer from "multer";
import { interpretarCteXml } from "../services/cte-documento.service";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024,
    files: 200,
  },
});

export const cteRoutes = Router();

cteRoutes.post(
  "/interpretar",
  upload.array("arquivos", 200),
  async (req, res, next) => {
    try {
      const files = (req.files ?? []) as Express.Multer.File[];

      if (!files.length) {
        res.status(400).json({ message: "Selecione pelo menos um XML de CT-e." });
        return;
      }

      const parsed = files.map((file) => {
        if (!file.originalname.toLowerCase().endsWith(".xml")) {
          throw new Error(`${file.originalname} não é um arquivo XML.`);
        }

        const xml = file.buffer.toString("utf8");
        const result = interpretarCteXml(xml);

        return {
          ...result,
          fileName: file.originalname,
          xmlUrl: `data:${file.mimetype || "application/xml"};base64,${file.buffer.toString("base64")}`,
        };
      });

      const duplicateKeys = new Set<string>();
      for (const item of parsed) {
        if (!item.chave) {
          throw new Error(`Não foi possível identificar a chave do CT-e ${item.fileName}.`);
        }
        if (duplicateKeys.has(item.chave)) {
          throw new Error(`O CT-e ${item.numero || item.chave} está duplicado no lote.`);
        }
        duplicateKeys.add(item.chave);
      }

      res.json({
        ctes: parsed,
        resumo: {
          quantidade: parsed.length,
          tipoOperacao: parsed.length > 1 ? "FRACIONADA" : "LOTACAO",
          pesoKg: parsed.reduce((sum, item) => sum + item.pesoKg, 0),
          valorMercadoria: parsed.reduce(
            (sum, item) => sum + item.valorMercadoria,
            0,
          ),
          valorFrete: parsed.reduce((sum, item) => sum + item.valorFrete, 0),
          valorPedagio: parsed.reduce((sum, item) => sum + item.valorPedagio, 0),
          cnpjs: Array.from(
            new Set(
              parsed
                .flatMap((item) => [
                  item.remetenteCnpj,
                  item.destinatarioCnpj,
                ])
                .filter(Boolean),
            ),
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);
