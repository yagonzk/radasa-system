import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middlewares/validate.js";
import {
  bodySchema,
  estoqueMovimentacaoBody,
  estoqueNfeImportBody,
  estoqueProdutoBody,
  estoqueSubcategoriaBody,
  estoqueTipoProdutoBody,
  idParamsSchema,
} from "../validators/schemas.js";
import { estoqueController } from "../controllers/estoque.controller.js";

export const estoqueRoutes = Router();

// Tipos próprios do Almoxarifado. Não usa categorias/produtos da aba Cadastros.
estoqueRoutes.get("/tipos", asyncHandler(estoqueController.listTiposProduto));
estoqueRoutes.post("/tipos", validate(bodySchema(estoqueTipoProdutoBody)), asyncHandler(estoqueController.createTipoProduto));
estoqueRoutes.delete("/tipos/:id", validate(idParamsSchema), asyncHandler(estoqueController.removeTipoProduto));

estoqueRoutes.get("/subcategorias", asyncHandler(estoqueController.listSubcategorias));
estoqueRoutes.post("/subcategorias", validate(bodySchema(estoqueSubcategoriaBody)), asyncHandler(estoqueController.createSubcategoria));
estoqueRoutes.delete("/subcategorias/:id", validate(idParamsSchema), asyncHandler(estoqueController.removeSubcategoria));

// Cadastro próprio do estoque: não usa /produtos (aba Cadastros).
estoqueRoutes.get("/produtos", asyncHandler(estoqueController.listProdutos));
estoqueRoutes.post("/produtos", validate(bodySchema(estoqueProdutoBody)), asyncHandler(estoqueController.createProduto));
estoqueRoutes.put("/produtos/:id", validate(idParamsSchema), validate(bodySchema(estoqueProdutoBody.partial())), asyncHandler(estoqueController.updateProduto));
estoqueRoutes.delete("/produtos/:id", validate(idParamsSchema), asyncHandler(estoqueController.removeProduto));

estoqueRoutes.post("/importar-nfe", validate(bodySchema(estoqueNfeImportBody)), asyncHandler(estoqueController.importarNfe));
estoqueRoutes.get("/notas/:id/xml", validate(idParamsSchema), asyncHandler(estoqueController.getNotaXml));
estoqueRoutes.get("/notas/:id/pdf", validate(idParamsSchema), asyncHandler(estoqueController.getNotaPdf));

estoqueRoutes.get("/", asyncHandler(estoqueController.list));
estoqueRoutes.get("/resumo", asyncHandler(estoqueController.resumo));
estoqueRoutes.post("/", validate(bodySchema(estoqueMovimentacaoBody)), asyncHandler(estoqueController.create));
estoqueRoutes.delete("/:id", validate(idParamsSchema), asyncHandler(estoqueController.remove));
