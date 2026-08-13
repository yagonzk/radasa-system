import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middlewares/validate.js";
import {
  bodySchema,
  estoqueMovimentacaoBody,
  estoqueProdutoBody,
  idParamsSchema,
} from "../validators/schemas.js";
import { estoqueController } from "../controllers/estoque.controller.js";

export const estoqueRoutes = Router();

// Cadastro próprio do estoque: não usa /produtos (aba Cadastros).
estoqueRoutes.get("/produtos", asyncHandler(estoqueController.listProdutos));
estoqueRoutes.post("/produtos", validate(bodySchema(estoqueProdutoBody)), asyncHandler(estoqueController.createProduto));
estoqueRoutes.put("/produtos/:id", validate(idParamsSchema), validate(bodySchema(estoqueProdutoBody.partial())), asyncHandler(estoqueController.updateProduto));
estoqueRoutes.delete("/produtos/:id", validate(idParamsSchema), asyncHandler(estoqueController.removeProduto));

estoqueRoutes.get("/", asyncHandler(estoqueController.list));
estoqueRoutes.get("/resumo", asyncHandler(estoqueController.resumo));
estoqueRoutes.post("/", validate(bodySchema(estoqueMovimentacaoBody)), asyncHandler(estoqueController.create));
estoqueRoutes.delete("/:id", validate(idParamsSchema), asyncHandler(estoqueController.remove));
