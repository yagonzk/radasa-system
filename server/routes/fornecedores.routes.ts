import { crudRoutes } from "./crud.routes.js";
import { fornecedoresController } from "../controllers/fornecedores.controller.js";
import { fornecedorBody } from "../validators/schemas.js";
export const fornecedoresRoutes = crudRoutes(fornecedoresController, fornecedorBody);
