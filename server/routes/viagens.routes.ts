import { Router } from "express";
import { crudRoutes } from "./crud.routes.js";
import { viagensController } from "../controllers/viagens.controller.js";
import { viagemBody } from "../validators/schemas.js";
import { interpretarManifestoViagem } from "../services/viagens-manifesto.service.js";

export const viagensRoutes = Router();

viagensRoutes.post("/ler-manifesto", async (req, res, next) => {
  try {
    const texto = String(req.body?.texto ?? "");
    if (!texto.trim()) {
      res.status(400).json({ message: "Não foi possível extrair o texto do manifesto." });
      return;
    }
    const manifesto = await interpretarManifestoViagem(texto);
    res.json(manifesto);
  } catch (error) {
    next(error);
  }
});

viagensRoutes.use(crudRoutes(viagensController, viagemBody));
