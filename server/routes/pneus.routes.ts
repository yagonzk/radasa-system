import { Router } from "express";
import { pneusGestaoController } from "../controllers/pneus-gestao.controller.js";
import { pneusController } from "../controllers/pneus.controller.js";
import { pneusOperacoesController } from "../controllers/pneus-operacoes.controller.js";
import { pneusManutencaoController } from "../controllers/pneus-manutencao.controller.js";
import { asyncHandler } from "../utils/async-handler.js";
import { validate } from "../middlewares/validate.js";
import { bodySchema, partialBodySchema, pneuBody, pneuInstalacaoBody, pneuRetiradaBody, pneuRodizioBody, pneuSulcoBody, pneuCalibragemBody, pneuRecapagemBody, pneuConsertoBody, pneuInspecaoBody } from "../validators/schemas.js";

export const pneusRoutes = Router();

pneusRoutes.get("/gestao/alertas", asyncHandler(pneusGestaoController.alerts));
pneusRoutes.get("/gestao/relatorios", asyncHandler(pneusGestaoController.reports));

pneusRoutes.get("/:id/manutencao", asyncHandler(pneusManutencaoController.get));
pneusRoutes.post("/:id/sulcos", validate(bodySchema(pneuSulcoBody)), asyncHandler(pneusManutencaoController.addSulco));
pneusRoutes.post("/:id/calibragens", validate(bodySchema(pneuCalibragemBody)), asyncHandler(pneusManutencaoController.addCalibragem));
pneusRoutes.post("/:id/recapagens", validate(bodySchema(pneuRecapagemBody)), asyncHandler(pneusManutencaoController.addRecapagem));
pneusRoutes.post("/:id/consertos", validate(bodySchema(pneuConsertoBody)), asyncHandler(pneusManutencaoController.addConserto));
pneusRoutes.post("/:id/inspecoes", validate(bodySchema(pneuInspecaoBody)), asyncHandler(pneusManutencaoController.addInspecao));
pneusRoutes.get("/instalacoes", asyncHandler(pneusOperacoesController.listInstallations));
pneusRoutes.get("/rodizios", asyncHandler(pneusOperacoesController.listRotations));
pneusRoutes.post("/rodizios", validate(bodySchema(pneuRodizioBody)), asyncHandler(pneusOperacoesController.rotate));
pneusRoutes.post("/:id/instalar", validate(bodySchema(pneuInstalacaoBody)), asyncHandler(pneusOperacoesController.install));
pneusRoutes.post("/:id/retirar", validate(bodySchema(pneuRetiradaBody)), asyncHandler(pneusOperacoesController.retire));

pneusRoutes.get("/", asyncHandler(pneusController.list));
pneusRoutes.get("/:id", asyncHandler(pneusController.get));
pneusRoutes.post("/", validate(bodySchema(pneuBody)), asyncHandler(pneusController.create));
pneusRoutes.put("/:id", validate(partialBodySchema(pneuBody)), asyncHandler(pneusController.update));
pneusRoutes.delete("/:id", asyncHandler(pneusController.remove));
