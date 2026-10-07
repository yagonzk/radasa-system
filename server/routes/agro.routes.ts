import { Router } from "express";
import { agroController } from "../controllers/agro.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

export const agroRoutes = Router();

agroRoutes.get("/status", asyncHandler(agroController.status));
agroRoutes.get("/dashboard", asyncHandler(agroController.dashboard));
agroRoutes.get("/estoque", asyncHandler(agroController.estoque));

agroRoutes.get("/produtos", asyncHandler(agroController.produtos));
agroRoutes.post("/produtos", asyncHandler(agroController.criarProduto));
agroRoutes.put("/produtos/:id", asyncHandler(agroController.atualizarProduto));
agroRoutes.delete("/produtos/:id", asyncHandler(agroController.removerProduto));

agroRoutes.get("/lotes", asyncHandler(agroController.lotes));
agroRoutes.post("/lotes", asyncHandler(agroController.criarLote));
agroRoutes.put("/lotes/:id", asyncHandler(agroController.atualizarLote));
agroRoutes.delete("/lotes/:id", asyncHandler(agroController.removerLote));

agroRoutes.get("/movimentacoes", asyncHandler(agroController.movimentacoes));
agroRoutes.post("/movimentacoes", asyncHandler(agroController.criarMovimentacao));
