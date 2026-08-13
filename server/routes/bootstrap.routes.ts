import { Router } from "express";
import { motoristasService } from "../services/motoristas.service.js";
import { chapasService } from "../services/chapas.service.js";
import { clientesService } from "../services/clientes.service.js";
import { empresaService } from "../services/empresa.service.js";
import { produtosService } from "../services/produtos.service.js";
import { locaisService } from "../services/locais.service.js";
import { veiculosService } from "../services/veiculos.service.js";
import { viagensService } from "../services/viagens.service.js";
import { fechamentosService } from "../services/fechamentos.service.js";
import { manifestosService } from "../services/manifestos.service.js";
import { abastecimentosService } from "../services/abastecimentos.service.js";
import { pneusService } from "../services/pneus.service.js";

const loaders = {
  motoristas: () => motoristasService.list(),
  chapas: () => chapasService.list(),
  clientes: () => clientesService.list(),
  empresa: () => empresaService.list(),
  produtos: () => produtosService.list(),
  locais: () => locaisService.list(),
  veiculos: () => veiculosService.list(),
  viagens: () => viagensService.list(),
  fechamentos: () => fechamentosService.list(),
  manifestos: () => manifestosService.list(),
  abastecimentos: () => abastecimentosService.list(),
  pneus: () => pneusService.list(),
} satisfies Record<string, () => Promise<unknown>>;

type ResourceName = keyof typeof loaders;

export const bootstrapRoutes = Router();

bootstrapRoutes.get("/", async (req, res) => {
  const requested = String(req.query.resources ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value): value is ResourceName => value in loaders);

  const resources = [...new Set(requested)].slice(0, 12);
  if (!resources.length) {
    res.status(400).json({ message: "Informe ao menos um recurso válido." });
    return;
  }

  const settled = await Promise.allSettled(
    resources.map(async (resource) => [resource, await loaders[resource]()] as const),
  );

  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (let index = 0; index < settled.length; index += 1) {
    const result = settled[index];
    const resource = resources[index];
    if (result.status === "fulfilled") {
      data[result.value[0]] = result.value[1];
    } else {
      errors[resource] = result.reason instanceof Error
        ? result.reason.message
        : "Falha ao carregar recurso.";
    }
  }

  res.json({ data, errors });
});
