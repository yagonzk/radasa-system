import { Router } from "express";

export const agroRoutes = Router();

// Etapa 2: endpoint mínimo para validar que o ambiente Agro está protegido
// pela licença própria. As APIs de estoque/lavoura serão adicionadas nas próximas etapas.
agroRoutes.get("/status", (_req, res) => {
  res.json({ module: "AGRO", available: true });
});
