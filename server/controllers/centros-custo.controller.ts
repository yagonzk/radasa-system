import {crudController} from "./crud.controller.js";import {centrosCustoService} from "../services/centros-custo.service.js";export const centrosCustoController=crudController(centrosCustoService);
