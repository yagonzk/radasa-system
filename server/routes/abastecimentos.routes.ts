import { crudRoutes } from "./crud.routes";
import { abastecimentosController } from "../controllers/abastecimentos.controller";
import { abastecimentoBody } from "../validators/schemas";
export const abastecimentosRoutes = crudRoutes(abastecimentosController, abastecimentoBody);
