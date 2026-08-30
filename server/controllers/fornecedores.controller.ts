import { crudController } from "./crud.controller.js";
import { fornecedoresService } from "../services/fornecedores.service.js";
export const fornecedoresController = crudController(fornecedoresService);
