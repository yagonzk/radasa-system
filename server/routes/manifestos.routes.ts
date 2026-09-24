import { Router } from "express";
import { crudRoutes } from "./crud.routes.js";
import { manifestosController } from "../controllers/manifestos.controller.js";
import { manifestosService } from "../services/manifestos.service.js";
import { manifestoBody } from "../validators/schemas.js";
import { biNfeService } from "../services/bi-nfe.service.js";
import {
  interpretarTextoManifestoPdf,
  sugerirVinculosManifestoPdf,
  sugerirVinculosManifestosPdf,
} from "../services/manifesto-pdf.service.js";

export const manifestosRoutes = Router();

manifestosRoutes.post("/excluir-lote", async (req, res, next) => {
  try {
    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id: unknown) => String(id ?? "").trim()).filter(Boolean)
      : [];
    if (!ids.length) {
      res.status(400).json({ message: "Selecione ao menos um romaneio para excluir." });
      return;
    }
    if (ids.length > 500) {
      res.status(400).json({ message: "Exclua no máximo 500 romaneios por operação." });
      return;
    }
    res.json(await manifestosService.removeMany(ids));
  } catch (error) {
    next(error);
  }
});


function montarPendencias(documento: ReturnType<typeof interpretarTextoManifestoPdf>) {
  const pendencias: string[] = [];
  if (!documento.dataEmissao) pendencias.push("data do romaneio");
  if (!documento.produtos.length) pendencias.push("itens do romaneio");
  if (documento.produtos.some((item) => !item.clienteCodigo || !item.clienteNome)) {
    pendencias.push("cliente de um ou mais itens");
  }
  return pendencias;
}






manifestosRoutes.post(
  "/interpretar-textos-pdf",
  async (req, res, next) => {
    try {
      const textos = Array.isArray(req.body?.textos)
        ? req.body.textos.map((item: unknown) => String(item ?? ""))
        : [];
      if (!textos.length || textos.some((texto: string) => !texto.trim())) {
        res.status(400).json({ message: "Envie ao menos um texto de PDF válido." });
        return;
      }
      if (textos.length > 50) {
        res.status(400).json({ message: "Envie no máximo 50 romaneios por lote." });
        return;
      }

      const documentos = textos.map((texto: string) => interpretarTextoManifestoPdf(texto));
      const sugestoes = await sugerirVinculosManifestosPdf(documentos);
      const resultados = documentos.map((documento, index) => {
        const pendencias: string[] = [];
        if (!documento.dataEmissao) pendencias.push("data do romaneio");
        if (!documento.produtos.length) pendencias.push("itens do romaneio");
        if (documento.produtos.some((item) => !item.clienteCodigo || !item.clienteNome)) {
          pendencias.push("cliente de um ou mais itens");
        }
        return { documento, sugestoes: sugestoes[index], pendencias };
      });

      res.json({ resultados });
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.post("/:id/notas-fiscais/importar", async (req, res, next) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    res.json(await biNfeService.importarVinculadas(req.params.id, items));
  } catch (error) { next(error); }
});

manifestosRoutes.get("/:id/notas-fiscais/vinculadas", async (req, res, next) => {
  try { res.json(await biNfeService.vinculadas(req.params.id)); } catch (error) { next(error); }
});

manifestosRoutes.get("/:id/notas-fiscais/vinculadas/:nfeId/arquivo", async (req, res, next) => {
  try { const file=await biNfeService.arquivoVinculado(req.params.id,req.params.nfeId);res.setHeader("Content-Type","application/xml; charset=utf-8");res.setHeader("Content-Disposition",`attachment; filename="${file.nome}"`);res.send(file.conteudo); } catch (error) { next(error); }
});

manifestosRoutes.delete("/:id/notas-fiscais/vinculadas/:nfeId", async (req, res, next) => {
  try { res.json(await biNfeService.desvincular(req.params.id, req.params.nfeId)); } catch (error) { next(error); }
});

manifestosRoutes.post(
  "/importar-planilha-item",
  async (req, res, next) => {
    try {
      res.status(201).json(await manifestosService.createSpreadsheetItem(req.body));
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.post(
  "/importar-lote",
  async (req, res, next) => {
    try {
      const parsed = manifestoBody.array().max(20).safeParse(req.body?.items);
      if (!parsed.success) {
        res.status(400).json({
          message: "Há dados inválidos no lote de romaneios.",
          errors: parsed.error.flatten(),
        });
        return;
      }
      res.status(201).json(await manifestosService.createMany(parsed.data));
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.post(
  "/interpretar-texto-pdf",
  async (req, res, next) => {
    try {
      const texto = String(req.body?.texto ?? "");
      if (!texto.trim()) {
        res.status(400).json({ message: "Não foi possível extrair o texto do PDF." });
        return;
      }

      const documento = interpretarTextoManifestoPdf(texto);
      const sugestoes = await sugerirVinculosManifestoPdf(documento);
      const pendencias: string[] = [];

      if (!documento.dataEmissao) pendencias.push("data do romaneio");
      if (!documento.produtos.length) pendencias.push("itens do romaneio");
      if (documento.produtos.some((item) => !item.clienteCodigo || !item.clienteNome)) {
        pendencias.push("cliente de um ou mais itens");
      }

      res.json({ documento, sugestoes, pendencias });
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.patch(
  "/:id/pre-fechamento",
  async (req, res, next) => {
    try {
      const comissao = Number(req.body?.comissao ?? 0);
      const pedagio = Number(req.body?.pedagio ?? 0);
      const abastecimento = Number(req.body?.abastecimento ?? 0);
      const comissaoPaga = req.body?.comissaoPaga === true;
      const pedagioPago = req.body?.pedagioPago === true;
      const abastecimentoPago = req.body?.abastecimentoPago === true;
      const values = [comissao, pedagio, abastecimento];

      if (values.some((value) => !Number.isFinite(value) || value < 0 || value > 999_999_999.99)) {
        res.status(400).json({ message: "Informe valores válidos para comissão, pedágio e abastecimento." });
        return;
      }

      res.json(
        await manifestosService.updatePreFechamento(req.params.id, {
          comissao,
          pedagio,
          abastecimento,
          comissaoPaga,
          pedagioPago,
          abastecimentoPago,
        }),
      );
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.patch(
  "/:id/produtos/:produtoId/pagamento",
  async (req, res, next) => {
    try {
      if (typeof req.body?.pago !== "boolean") {
        res.status(400).json({ message: "Informe se o item foi pago." });
        return;
      }
      res.json(
        await manifestosService.updatePagamentoCliente(
          req.params.id,
          req.params.produtoId,
          req.body.pago,
        ),
      );
    } catch (error) {
      next(error);
    }
  },
);

manifestosRoutes.use(crudRoutes(manifestosController, manifestoBody));
