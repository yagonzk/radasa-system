import { crudRoutes } from "./crud.routes";
import { manifestosController } from "../controllers/manifestos.controller";
import { manifestoBody } from "../validators/schemas";
export const manifestosRoutes = crudRoutes(manifestosController, manifestoBody);
