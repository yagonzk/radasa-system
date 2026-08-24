import { crudRoutes } from "./crud.routes.js";
import { demandasController } from "../controllers/demandas.controller.js";
import { demandaBody } from "../validators/schemas.js";
export const demandasRoutes = crudRoutes(demandasController, demandaBody);
