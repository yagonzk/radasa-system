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
  motoristas: (_query?: Record<string, unknown>) => motoristasService.list(),
  chapas: (_query?: Record<string, unknown>) => chapasService.list(),
  clientes: (_query?: Record<string, unknown>) => clientesService.list(),
  fornecedores: (_query?: Record<string, unknown>) => fornecedoresService.list(),
  empresa: (_query?: Record<string, unknown>) => empresaService.list(),
  produtos: (_query?: Record<string, unknown>) => produtosService.list(),
  locais: (_query?: Record<string, unknown>) => locaisService.list(),
  veiculos: (_query?: Record<string, unknown>) => veiculosService.list(),
  viagens: (query?: Record<string, unknown>) => viagensService.list(query),
  fechamentos: (query?: Record<string, unknown>) => fechamentosService.list(query),
  manifestos: (query?: Record<string, unknown>) => manifestosService.list(query),
  abastecimentos: (query?: Record<string, unknown>) => abastecimentosService.list(query),
  pneus: (_query?: Record<string, unknown>) => pneusService.list(),
} satisfies Record<string, (query?: Record<string, unknown>) => Promise<unknown>>;

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
  // tempo. O limite 2 acompanha o pool local do Prisma e evita fila interna no Worker.
  const listQuery = { from: req.query.from, to: req.query.to } as Record<string, unknown>;
  const settled = await mapWithConcurrency(resources, 2, async (resource) => {
    try {
      return { resource, ok: true as const, value: await loaders[resource](listQuery) };
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
