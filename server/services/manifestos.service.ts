import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { created, dateOnly, number, tipoFromDb, tipoToDb } from "../utils/serialize.js";

const include = { produtos: { orderBy: { id: "asc" as const } } } as const;

function listDateRange(query?: Record<string, unknown>) {
  const from = typeof query?.from === "string" && query.from ? parseDateOnly(query.from) : undefined;
  const to = typeof query?.to === "string" && query.to ? parseDateOnly(query.to) : undefined;
  return from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;
}

type ManifestoDedupeInput = {
  clienteId?: unknown;
  dataManifesto?: unknown;
  placaVeiculo?: unknown;
  romaneios?: unknown;
  notasFiscais?: unknown;
  produtos?: Array<{
    produtoId?: unknown;
    clienteId?: unknown;
    romaneio?: unknown;
    notaFiscal?: unknown;
    serieNf?: unknown;
    quantidade?: unknown;
    valorTotal?: unknown;
  }>;
};

function normalizeKeyPart(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function formatPlate(value: unknown) {
  const normalized = normalizeKeyPart(value).slice(0, 7);
  if (!normalized) return "";
  if (normalized.length <= 3) return normalized;
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}

type VehicleMetadata = { id: string; placa: string; modelo: string | null };

function buildVehicleLookups(vehicles: VehicleMetadata[]) {
  return {
    byId: new Map(vehicles.map((vehicle) => [vehicle.id, vehicle])),
    byPlate: new Map(
      vehicles
        .map((vehicle) => [normalizeKeyPart(vehicle.placa), vehicle] as const)
        .filter(([plate]) => Boolean(plate)),
    ),
  };
}

function uniqueSorted(values: string[]) {
  return Array.from(new Set(values.filter(Boolean))).sort((left, right) =>
    left.localeCompare(right, "pt-BR", { numeric: true }),
  );
}

function dateKey(value: unknown) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value ?? "").slice(0, 10);
}

export function buildManifestoDedupeKey(input: ManifestoDedupeInput) {
  const produtos = Array.isArray(input.produtos) ? input.produtos : [];
  const romaneios = uniqueSorted(
    [input.romaneios, ...produtos.map((produto) => produto.romaneio)]
      .flatMap((value) => String(value ?? "").toUpperCase().match(/[A-Z0-9]+/g) ?? [])
      .map(normalizeKeyPart),
  );

  if (romaneios.length) {
    return `ROMANEIOS:${romaneios.join("|")}`;
  }

  const notasDosItens = produtos.map((produto) => {
    const nota = normalizeKeyPart(produto.notaFiscal);
    const serie = normalizeKeyPart(produto.serieNf);
    return nota ? `${nota}/${serie}` : "";
  });
  const notasDoCabecalho = String(input.notasFiscais ?? "")
    .split(/[,;\n]+/)
    .map(normalizeKeyPart);
  const notas = uniqueSorted([...notasDosItens, ...notasDoCabecalho]);
  const data = dateKey(input.dataManifesto);
  const placa = normalizeKeyPart(input.placaVeiculo);

  if (notas.length) {
    return `NOTAS:${data}|${placa}|${notas.join("|")}`;
  }

  const itens = produtos.map((produto) => [
    normalizeKeyPart(produto.produtoId),
    normalizeKeyPart(produto.clienteId),
    String(Number(produto.quantidade ?? 0)),
    String(Number(produto.valorTotal ?? 0)),
  ].join(":"));

  return [
    "CONTEUDO",
    data,
    placa,
    normalizeKeyPart(input.clienteId),
    uniqueSorted(itens).join("|"),
  ].join(":");
}

function manifestoDedupeCandidateWhere(input: ManifestoDedupeInput, excludeId?: string) {
  const key = buildManifestoDedupeKey(input);
  const base = excludeId ? { id: { not: excludeId } } : {};

  if (key.startsWith("ROMANEIOS:")) {
    const romaneios = key.slice("ROMANEIOS:".length).split("|").filter(Boolean);
    if (romaneios.length) {
      const data = dateKey(input.dataManifesto);
      return {
        ...base,
        OR: [
          // A data mantém compatibilidade com números legados que possam ter
          // pontuação diferente; os contains capturam duplicatas mesmo se a
          // data tiver sido corrigida posteriormente.
          ...(data ? [{ dataManifesto: parseDateOnly(data) }] : []),
          ...romaneios.flatMap((romaneio) => [
            { romaneios: { contains: romaneio, mode: "insensitive" as const } },
            { produtos: { some: { romaneio: { contains: romaneio, mode: "insensitive" as const } } } },
          ]),
        ],
      };
    }
  }

  const data = dateKey(input.dataManifesto);
  if (data) {
    // Para chaves por NF/conteúdo, comparar somente registros da mesma data já
    // reduz a busca de todo o histórico para um conjunto pequeno sem arriscar
    // falso negativo por diferenças antigas de formatação da placa.
    return { ...base, dataManifesto: parseDateOnly(data) };
  }

  // Fallback raro para registros sem número e sem data. Mantém compatibilidade
  // com dados legados, ainda com a comparação lógica definitiva abaixo.
  return base;
}

const manifestoDedupeSelect = {
  id: true,
  clienteId: true,
  dataManifesto: true,
  placaVeiculo: true,
  romaneios: true,
  notasFiscais: true,
  produtos: {
    select: {
      produtoId: true,
      clienteId: true,
      romaneio: true,
      notaFiscal: true,
      serieNf: true,
      quantidade: true,
      valorTotal: true,
    },
  },
} as const;

async function assertManifestoIsUnique(
  tx: any,
  input: ManifestoDedupeInput,
  excludeId?: string,
) {
  const dedupeKey = buildManifestoDedupeKey(input);

  // A transação Serializable continua protegendo concorrência, mas a validação
  // deixa de varrer todos os romaneios/produtos históricos a cada gravação.
  // Primeiro o banco reduz os candidatos por número/data; depois a mesma chave
  // lógica faz a confirmação exata para preservar a regra de duplicidade.
  const existing = await tx.manifesto.findMany({
    where: manifestoDedupeCandidateWhere(input, excludeId),
    select: manifestoDedupeSelect,
  });

  const duplicate = existing.find(
    (item: ManifestoDedupeInput) => buildManifestoDedupeKey(item) === dedupeKey,
  ) as { id?: string } | undefined;

  if (duplicate?.id) {
    throw new AppError(409, "Este romaneio já foi cadastrado.", {
      duplicateId: duplicate.id,
    });
  }
}

async function serializableTransaction<T>(work: (tx: any) => Promise<T>) {
  const maxRetries = 3;

  for (let attempt = 1; attempt <= maxRetries; attempt += 1) {
    try {
      return await prisma.$transaction(work, {
        isolationLevel: "Serializable" as any,
        maxWait: 5_000,
        timeout: 15_000,
      });
    } catch (error) {
      const code = (error as { code?: unknown })?.code;

      if (code === "P2034" && attempt < maxRetries) {
        continue;
      }

      if (code === "P2034") {
        throw new AppError(
          409,
          "O romaneio está sendo cadastrado simultaneamente. Tente novamente.",
        );
      }

      throw error;
    }
  }

  throw new AppError(409, "Não foi possível concluir o cadastro do romaneio.");
}

const serialize = (item: any) => ({
  id: item.id,
  clienteId: item.clienteId,
  dataManifesto: dateOnly(item.dataManifesto),
  tipoManifesto: tipoFromDb(item.tipoManifesto),
  pdfUrl: item.pdfUrl ?? undefined,
  pdfStored: item.pdfStored ?? Boolean(item.pdfUrl),
  transportadoraCodigo: item.transportadoraCodigo ?? "",
  transportadoraNome: item.transportadoraNome ?? "",
  veiculoCodigo: item.veiculoCodigo ?? "",
  placaVeiculo: item.placaVeiculo ?? "",
  modeloVeiculo: item.modeloVeiculo ?? "",
  romaneios: item.romaneios ?? "",
  notasFiscais: item.notasFiscais ?? "",
  preFechamentoComissao: number(item.preFechamentoComissao),
  preFechamentoPedagio: number(item.preFechamentoPedagio),
  preFechamentoAbastecimento: number(item.preFechamentoAbastecimento),
  preFechamentoComissaoPaga: item.preFechamentoComissaoPaga === true,
  preFechamentoPedagioPago: item.preFechamentoPedagioPago === true,
  preFechamentoAbastecimentoPago: item.preFechamentoAbastecimentoPago === true,
  produtos: item.produtos.map((produto: any) => ({
    id: produto.id,
    produtoId: produto.produtoId,
    clienteId: produto.clienteId ?? item.clienteId,
    romaneio: produto.romaneio ?? "",
    notaFiscal: produto.notaFiscal ?? "",
    serieNf: produto.serieNf ?? "",
    instrucaoCobranca: produto.instrucaoCobranca ?? "",
    quantidade: number(produto.quantidade),
    valorUnitario: number(produto.valorUnitario),
    valorTotal: number(produto.valorTotal),
    tipoManifesto: produto.tipoManifesto
      ? tipoFromDb(produto.tipoManifesto)
      : tipoFromDb(item.tipoManifesto),
    pagoCliente: produto.pagoCliente ?? null,
  })),
  createdAt: created(item.createdAt),
});

const nested = (items: any[], fallbackClientId: string) => {
  const batch = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return items.map((produto, index) => ({
    // O prefixo ordinal no ID preserva a ordem do PDF sem exigir coluna/migration nova.
    id: produto.id || `rmi_${String(index + 1).padStart(6, "0")}_${batch}_${Math.random().toString(36).slice(2, 10)}`,
    produtoId: produto.produtoId,
    clienteId: produto.clienteId || fallbackClientId,
    romaneio: produto.romaneio || "",
    notaFiscal: produto.notaFiscal || "",
    serieNf: produto.serieNf || "",
    instrucaoCobranca: produto.instrucaoCobranca || "",
    quantidade: Number(produto.quantidade),
    valorUnitario: Number(produto.valorUnitario),
    valorTotal: Number(produto.valorTotal),
    tipoManifesto: produto.tipoManifesto
      ? tipoToDb(produto.tipoManifesto)
      : undefined,
    pagoCliente: produto.pagoCliente ?? null,
  }));
};

const manifestoListSelect = {
  id: true,
  clienteId: true,
  dataManifesto: true,
  tipoManifesto: true,
  transportadoraCodigo: true,
  transportadoraNome: true,
  veiculoCodigo: true,
  placaVeiculo: true,
  modeloVeiculo: true,
  romaneios: true,
  notasFiscais: true,
  preFechamentoComissao: true,
  preFechamentoPedagio: true,
  preFechamentoAbastecimento: true,
  preFechamentoComissaoPaga: true,
  preFechamentoPedagioPago: true,
  preFechamentoAbastecimentoPago: true,
  createdAt: true,
  produtos: {
    orderBy: { id: "asc" as const },
    select: {
      id: true,
      produtoId: true,
      clienteId: true,
      romaneio: true,
      notaFiscal: true,
      serieNf: true,
      instrucaoCobranca: true,
      quantidade: true,
      valorUnitario: true,
      valorTotal: true,
      tipoManifesto: true,
      pagoCliente: true,
    },
  },
} as const;

export const manifestosService = {
  async list(query?: Record<string, unknown>) {
    // Listagem principal: evita reler toda a tabela de veículos aqui. O frontend
    // já carrega Cadastros > Veículos em paralelo e faz o enriquecimento atual
    // de placa/modelo em memória. Isso elimina uma consulta redundante ao Neon.
    const range = listDateRange(query);
    const where = range ? { dataManifesto: range } : undefined;
    const [items, withPdf] = await Promise.all([
      prisma.manifesto.findMany({
        where,
        select: manifestoListSelect,
        orderBy: [{ dataManifesto: "desc" }, { createdAt: "desc" }],
      }),
      prisma.manifesto.findMany({
        where: { ...(where ?? {}), pdfUrl: { not: null } },
        select: { id: true },
      }),
    ]);
    const pdfIds = new Set(withPdf.map((item) => item.id));
    return items.map((item) =>
      serialize({
        ...item,
        pdfStored: pdfIds.has(item.id),
      }),
    );
  },

  async get(id: string) {
    // O romaneio já persiste placa/modelo no momento da gravação. Buscar toda a
    // frota aqui fazia um simples download de PDF depender de uma consulta extra.
    const item = await prisma.manifesto.findUnique({ where: { id }, include });
    if (!item) throw new AppError(404, "Romaneio não encontrado.");
    return serialize(item);
  },

  async create(input: any) {
    const clienteId = input.clienteId || input.produtos?.[0]?.clienteId;
    if (!clienteId) throw new AppError(400, "Informe o cliente de pelo menos um item.");
    const item = await serializableTransaction(async (tx) => {
      await assertManifestoIsUnique(tx, { ...input, clienteId });
      return tx.manifesto.create({
        select: manifestoListSelect,
        data: {
          id: input.id,
          clienteId,
          dataManifesto: parseDateOnly(input.dataManifesto),
          tipoManifesto: tipoToDb(input.tipoManifesto),
          pdfUrl: input.pdfUrl || null,
          transportadoraCodigo: input.transportadoraCodigo || "",
          transportadoraNome: input.transportadoraNome || "",
          veiculoCodigo: input.veiculoCodigo || "",
          placaVeiculo: formatPlate(input.placaVeiculo),
          modeloVeiculo: input.modeloVeiculo || "",
          romaneios: input.romaneios || "",
          notasFiscais: input.notasFiscais || "",
          createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
          produtos: { create: nested(input.produtos, clienteId) },
        },
      });
    });
    return serialize({ ...item, pdfStored: Boolean(input.pdfUrl) });
  },

  async createSpreadsheetItem(input: any) {
    const rows = Array.isArray(input?.produtos) ? input.produtos : [];
    if (!rows.length) throw new AppError(400, "O romaneio não possui itens para importar.");

    const cleanCode = (value: unknown) => String(value ?? "").trim().split("/")[0];
    const codeKey = (value: unknown) => {
      const normalized = normalizeKeyPart(cleanCode(value));
      return /^\d+$/.test(normalized) ? normalized.replace(/^0+(?=\d)/, "") : normalized;
    };
    const codeVariants = (values: string[]) => Array.from(new Set(values.flatMap((value) => {
      const raw = cleanCode(value);
      const key = codeKey(value);
      if (!key) return [];
      if (!/^\d+$/.test(key)) return [raw, key];
      return Array.from({ length: 12 }, (_, index) => key.padStart(index + 1, "0")).concat(raw);
    })));
    const plateKey = normalizeKeyPart(input?.placaVeiculo);
    if (!plateKey) throw new AppError(400, "Informe a placa do veículo.");

    const vehicle = await prisma.veiculo.findFirst({
      where: { placa: { equals: formatPlate(input.placaVeiculo), mode: "insensitive" } },
      select: { id: true, placa: true, modelo: true },
    });
    if (!vehicle) throw new AppError(400, `Placa ${String(input.placaVeiculo ?? "")} não cadastrada.`);

    const clientCodes: string[] = Array.from(new Set<string>(rows.map((row: any) => cleanCode(row.clienteCodigo)).filter((code: string) => Boolean(code))));
    const productCodes: string[] = Array.from(new Set<string>(rows.map((row: any) => cleanCode(row.produtoCodigo)).filter((code: string) => Boolean(code))));

    const [existingClients, existingProducts] = await Promise.all([
      prisma.cliente.findMany({ where: { codigoInterno: { in: codeVariants(clientCodes), mode: "insensitive" } } }),
      prisma.produto.findMany({ where: { codigoInterno: { in: codeVariants(productCodes), mode: "insensitive" } } }),
    ]);
    const clients = new Map(existingClients.map((item) => [codeKey(item.codigoInterno), item]));
    const products = new Map(existingProducts.map((item) => [codeKey(item.codigoInterno), item]));

    // Cria somente os cadastros realmente ausentes deste romaneio. Como esta rota
    // recebe um romaneio por request, cada chamada permanece pequena no Worker.
    for (const row of rows) {
      const rawCode = cleanCode(row.clienteCodigo);
      const code = codeKey(rawCode);
      if (!code || clients.has(code)) continue;
      const name = String(row.clienteNome || rawCode || code).trim() || rawCode || code;
      const createdClient = await prisma.cliente.create({
        data: { nomeFantasia: name, razaoSocial: name, codigoInterno: rawCode || code, cnpj: "", email: "-", telefone: "-", enderecoFiscal: "-" },
      });
      clients.set(code, createdClient);
    }
    for (const row of rows) {
      const rawCode = cleanCode(row.produtoCodigo);
      const code = codeKey(rawCode);
      if (!code || products.has(code)) continue;
      const name = String(row.produtoDescricao || rawCode || code).trim() || rawCode || code;
      const createdProduct = await prisma.produto.create({
        data: { nome: name, codigoInterno: rawCode || code, categoriaEstoque: "Produtos de piscina" },
      });
      products.set(code, createdProduct);
    }

    const produtos = rows.map((row: any) => {
      const cliente = clients.get(codeKey(row.clienteCodigo));
      const produto = products.get(codeKey(row.produtoCodigo));
      if (!cliente || !produto) throw new AppError(400, "Não foi possível resolver cliente/produto do romaneio.");
      return {
        produtoId: produto.id,
        clienteId: cliente.id,
        romaneio: String(row.romaneio || ""),
        notaFiscal: String(row.notaFiscal || ""),
        serieNf: String(row.serieNf || ""),
        instrucaoCobranca: String(row.instrucaoCobranca || ""),
        quantidade: Number(row.quantidade || 0),
        valorUnitario: Number(row.valorUnitario || 0),
        valorTotal: Number(row.valorTotal || 0),
        tipoManifesto: String(row.tipoManifesto || "Acertar c/ Lebrinha"),
      };
    });

    const first = produtos[0];
    const payload = {
      clienteId: first.clienteId,
      dataManifesto: input.dataManifesto,
      produtos,
      tipoManifesto: first.tipoManifesto,
      transportadoraCodigo: String(input.transportadoraCodigo || ""),
      transportadoraNome: String(input.transportadoraNome || ""),
      veiculoCodigo: vehicle.id,
      placaVeiculo: vehicle.placa,
      modeloVeiculo: vehicle.modelo || "",
      romaneios: String(input.romaneios || ""),
      notasFiscais: String(input.notasFiscais || ""),
    };

    const createdItem = await this.create(payload);
    return { id: createdItem.id };
  },

  async createMany(inputs: any[]) {
    if (!Array.isArray(inputs) || !inputs.length) return { imported: [], failed: [] };

    // Busca apenas candidatos que podem conflitar com os itens deste lote. Antes
    // esta etapa carregava todos os romaneios do banco (e, no fallback, todos os
    // produtos históricos), fazendo o custo crescer junto com o histórico.
    const candidateWheres = inputs.map((input) => manifestoDedupeCandidateWhere(input));
    const existing = await prisma.manifesto.findMany({
      where: candidateWheres.length === 1 ? candidateWheres[0] : { OR: candidateWheres },
      select: manifestoDedupeSelect,
    });
    const knownKeys = new Set(existing.map((item) => buildManifestoDedupeKey(item)));
    const accepted: Array<{ index: number; input: any; clienteId: string; key: string }> = [];
    const failed: Array<{ index: number; message: string }> = [];

    inputs.forEach((input, index) => {
      const clienteId = input?.clienteId || input?.produtos?.[0]?.clienteId;
      if (!clienteId) {
        failed.push({ index, message: "Informe o cliente de pelo menos um item." });
        return;
      }
      const key = buildManifestoDedupeKey({ ...input, clienteId });
      if (knownKeys.has(key)) {
        failed.push({ index, message: "Este romaneio já foi cadastrado." });
        return;
      }
      knownKeys.add(key);
      accepted.push({ index, input, clienteId, key });
    });

    // A validação definitiva do veículo acontece no servidor, diretamente no
    // banco. Assim a importação não depende de cache/lista de veículos do
    // navegador. `veiculoCodigo` só é aceito se for um ID interno real; caso
    // contrário a placa do PDF é usada para localizar o cadastro.
    const vehicles = await prisma.veiculo.findMany({
      select: { id: true, placa: true, modelo: true },
    });
    const vehicleLookups = buildVehicleLookups(vehicles);
    const resolvedAccepted: Array<(typeof accepted)[number] & { vehicle: VehicleMetadata }> = [];

    for (const entry of accepted) {
      const vehicle =
        (entry.input?.veiculoCodigo ? vehicleLookups.byId.get(String(entry.input.veiculoCodigo)) : undefined) ??
        vehicleLookups.byPlate.get(normalizeKeyPart(entry.input?.placaVeiculo));
      if (!vehicle) {
        failed.push({
          index: entry.index,
          message: `Placa ${formatPlate(entry.input?.placaVeiculo) || "não identificada"} não cadastrada em Veículos.`,
        });
        continue;
      }
      resolvedAccepted.push({ ...entry, vehicle });
    }

    // A importação em massa não precisa devolver o PDF em base64 nem todos os
    // produtos recém-criados. Retornar só o ID evita baixar de volta dezenas de
    // megabytes que o navegador acabou de enviar.
    const imported: Array<{ index: number; id: string }> = [];
    let nextIndex = 0;
    const workerCount = Math.min(2, resolvedAccepted.length);
    const workers = Array.from({ length: workerCount }, async () => {
      while (true) {
        const cursor = nextIndex++;
        if (cursor >= resolvedAccepted.length) return;
        const entry = resolvedAccepted[cursor];
        try {
          const item = await prisma.manifesto.create({
            select: { id: true },
            data: {
              id: entry.input.id,
              clienteId: entry.clienteId,
              dataManifesto: parseDateOnly(entry.input.dataManifesto),
              tipoManifesto: tipoToDb(entry.input.tipoManifesto),
              pdfUrl: entry.input.pdfUrl || null,
              transportadoraCodigo: entry.input.transportadoraCodigo || "",
              transportadoraNome: entry.input.transportadoraNome || "",
              veiculoCodigo: entry.vehicle.id,
              placaVeiculo: formatPlate(entry.vehicle.placa),
              modeloVeiculo: entry.vehicle.modelo ?? entry.input.modeloVeiculo ?? "",
              romaneios: entry.input.romaneios || "",
              notasFiscais: entry.input.notasFiscais || "",
              createdAt: entry.input.createdAt ? new Date(entry.input.createdAt) : undefined,
              produtos: { create: nested(entry.input.produtos, entry.clienteId) },
            },
          });
          imported.push({ index: entry.index, id: item.id });
        } catch (error: any) {
          failed.push({
            index: entry.index,
            message: error?.message || "Não foi possível cadastrar este romaneio.",
          });
        }
      }
    });

    await Promise.all(workers);
    imported.sort((a, b) => a.index - b.index);
    failed.sort((a, b) => a.index - b.index);
    return { imported, failed };
  },

  async update(id: string, input: any) {
    const [current, currentWithPdf] = await Promise.all([
      prisma.manifesto.findUnique({ where: { id }, select: { id: true, clienteId: true } }),
      prisma.manifesto.findFirst({ where: { id, pdfUrl: { not: null } }, select: { id: true } }),
    ]);
    if (!current) throw new AppError(404, "Romaneio não encontrado.");
    const clienteId = input.clienteId || input.produtos?.[0]?.clienteId || current.clienteId;
    const item = await serializableTransaction(async (tx) => {
      await assertManifestoIsUnique(tx, { ...input, clienteId }, id);
      await tx.manifestoProduto.deleteMany({ where: { manifestoId: id } });
      return tx.manifesto.update({
        where: { id },
        select: manifestoListSelect,
        data: {
          clienteId,
          dataManifesto: parseDateOnly(input.dataManifesto),
          tipoManifesto: tipoToDb(input.tipoManifesto),
          ...(input.pdfUrl !== undefined ? { pdfUrl: input.pdfUrl || null } : {}),
          transportadoraCodigo: input.transportadoraCodigo || "",
          transportadoraNome: input.transportadoraNome || "",
          veiculoCodigo: input.veiculoCodigo || "",
          placaVeiculo: formatPlate(input.placaVeiculo),
          modeloVeiculo: input.modeloVeiculo || "",
          romaneios: input.romaneios || "",
          notasFiscais: input.notasFiscais || "",
          produtos: { create: nested(input.produtos, clienteId) },
        },
      });
    });
    const pdfStored = input.pdfUrl !== undefined ? Boolean(input.pdfUrl) : Boolean(currentWithPdf);
    return serialize({ ...item, pdfStored });
  },

  async removeMany(ids: string[]) {
    const uniqueIds = Array.from(new Set(ids)).slice(0, 500);
    const result = await prisma.$transaction(async (tx) => {
      await tx.manifestoProduto.deleteMany({ where: { manifestoId: { in: uniqueIds } } });
      return tx.manifesto.deleteMany({ where: { id: { in: uniqueIds } } });
    });
    return { requested: uniqueIds.length, deleted: result.count };
  },

  async remove(id: string) {
    await prisma.manifesto.delete({ where: { id } });
  },

  async updatePreFechamento(
    manifestoId: string,
    values: {
      comissao: number;
      pedagio: number;
      abastecimento: number;
      comissaoPaga: boolean;
      pedagioPago: boolean;
      abastecimentoPago: boolean;
    },
  ) {
    const exists = await prisma.manifesto.findUnique({
      where: { id: manifestoId },
      select: { id: true },
    });
    if (!exists) throw new AppError(404, "Romaneio não encontrado.");

    await prisma.manifesto.update({
      where: { id: manifestoId },
      data: {
        preFechamentoComissao: values.comissao,
        preFechamentoPedagio: values.pedagio,
        preFechamentoAbastecimento: values.abastecimento,
        preFechamentoComissaoPaga: values.comissaoPaga,
        preFechamentoPedagioPago: values.pedagioPago,
        preFechamentoAbastecimentoPago: values.abastecimentoPago,
      },
    });
    return this.get(manifestoId);
  },

  async updatePagamentoCliente(manifestoId: string, produtoId: string, pago: boolean) {
    const produto = await prisma.manifestoProduto.findFirst({
      where: { id: produtoId, manifestoId },
      include: { manifesto: true },
    });
    if (!produto) throw new AppError(404, "Item do romaneio não encontrado.");

    const tipo = produto.tipoManifesto
      ? tipoFromDb(produto.tipoManifesto)
      : tipoFromDb(produto.manifesto.tipoManifesto);
    if (tipo !== "Receber c/ Cliente") {
      throw new AppError(400, "Somente itens 'Receber c/ Cliente' possuem controle de pagamento.");
    }

    await prisma.manifestoProduto.update({
      where: { id: produtoId },
      data: { pagoCliente: pago },
    });
    return this.get(manifestoId);
  },
};
