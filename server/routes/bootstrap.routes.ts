import { Router } from "express";
import { motoristasService } from "../services/motoristas.service.js";
import { chapasService } from "../services/chapas.service.js";
import { clientesService } from "../services/clientes.service.js";
import { fornecedoresService } from "../services/fornecedores.service.js";
import { empresaService } from "../services/empresa.service.js";
import { produtosService } from "../services/produtos.service.js";
import { locaisService } from "../services/locais.service.js";
import { veiculosService } from "../services/veiculos.service.js";
import { viagensService } from "../services/viagens.service.js";
import { fechamentosService } from "../services/fechamentos.service.js";
import { manifestosService } from "../services/manifestos.service.js";
import { abastecimentosService } from "../services/abastecimentos.service.js";
import { pneusService } from "../services/pneus.service.js";
import { mapWithConcurrency } from "../utils/concurrency.js";

const loaders = {
  motoristas: () => motoristasService.list(),
  chapas: () => chapasService.list(),
  clientes: () => clientesService.list(),
  fornecedores: () => fornecedoresService.list(),
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

  const resources = [...new Set(requested)].slice(0, 16);
  if (!resources.length) {
    res.status(400).json({ message: "Informe ao menos um recurso válido." });
    return;
  }

  // Evita que uma montagem de tela dispare 10+ consultas pesadas ao mesmo
  // tempo. O limite 3 mantém a UI rápida sem criar rajada de conexões no Neon.
  const settled = await mapWithConcurrency(resources, 3, async (resource) => {
    try {
      return { resource, ok: true as const, value: await loaders[resource]() };
    } catch (error) {
      return { resource, ok: false as const, error };
    }
  });

  const data: Record<string, unknown> = {};
  const errors: Record<string, string> = {};

  for (const result of settled) {
    if (result.ok) {
      data[result.resource] = result.value;
    } else {
      errors[result.resource] = result.error instanceof Error
        ? result.error.message
        : "Falha ao carregar recurso.";
    }
  }

  res.json({ data, errors });
});
