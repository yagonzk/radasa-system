import { crudController } from "./crud.controller.js";
import { demandasService } from "../services/demandas.service.js";
export const demandasController = crudController(demandasService);
