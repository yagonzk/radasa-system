import { crudRoutes } from "./crud.routes";
import { pneusController } from "../controllers/pneus.controller";
import { pneuBody } from "../validators/schemas";
export const pneusRoutes = crudRoutes(pneusController, pneuBody);
