import { Router } from "express";
import { agroController } from "../controllers/agro.controller.js";
import { asyncHandler } from "../utils/async-handler.js";

export const agroRoutes = Router();

agroRoutes.get("/status", asyncHandler(agroController.status));
agroRoutes.get("/dashboard", asyncHandler(agroController.dashboard));
agroRoutes.get("/relatorios", asyncHandler(agroController.relatorios));
agroRoutes.get("/estoque", asyncHandler(agroController.estoque));

agroRoutes.get("/locais", asyncHandler(agroController.locais));
agroRoutes.post("/locais", asyncHandler(agroController.criarLocal));
agroRoutes.put("/locais/:id", asyncHandler(agroController.atualizarLocal));

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

agroRoutes.get("/transferencias", asyncHandler(agroController.transferencias));
agroRoutes.post("/transferencias", asyncHandler(agroController.criarTransferencia));

agroRoutes.get("/inventarios", asyncHandler(agroController.inventarios));
agroRoutes.get("/inventarios/:id", asyncHandler(agroController.inventario));
agroRoutes.post("/inventarios", asyncHandler(agroController.criarInventario));
agroRoutes.put("/inventarios/:id/itens/:itemId", asyncHandler(agroController.atualizarItemInventario));
agroRoutes.post("/inventarios/:id/finalizar", asyncHandler(agroController.finalizarInventario));
agroRoutes.post("/inventarios/:id/cancelar", asyncHandler(agroController.cancelarInventario));


agroRoutes.get("/fazendas", asyncHandler(agroController.fazendas));
agroRoutes.post("/fazendas", asyncHandler(agroController.criarFazenda));
agroRoutes.put("/fazendas/:id", asyncHandler(agroController.atualizarFazenda));

agroRoutes.get("/talhoes", asyncHandler(agroController.talhoes));
agroRoutes.post("/talhoes", asyncHandler(agroController.criarTalhao));
agroRoutes.put("/talhoes/:id", asyncHandler(agroController.atualizarTalhao));

agroRoutes.get("/safras", asyncHandler(agroController.safras));
agroRoutes.post("/safras", asyncHandler(agroController.criarSafra));
agroRoutes.put("/safras/:id", asyncHandler(agroController.atualizarSafra));

agroRoutes.get("/culturas", asyncHandler(agroController.culturas));
agroRoutes.post("/culturas", asyncHandler(agroController.criarCultura));
agroRoutes.put("/culturas/:id", asyncHandler(agroController.atualizarCultura));

agroRoutes.get("/lavouras", asyncHandler(agroController.lavouras));
agroRoutes.post("/lavouras", asyncHandler(agroController.criarLavoura));
agroRoutes.put("/lavouras/:id", asyncHandler(agroController.atualizarLavoura));

agroRoutes.get("/operacoes", asyncHandler(agroController.operacoes));
agroRoutes.post("/operacoes", asyncHandler(agroController.criarOperacao));
