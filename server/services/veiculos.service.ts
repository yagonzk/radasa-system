import { prisma } from "../lib/prisma.js";
import { created, dateOnly, number } from "../utils/serialize.js";
import { parseDateOnly } from "../utils/date.js";
import { AppError } from "../utils/app-error.js";

const serialize = (item: any) => ({
  ...item,
  crlvValidade: item.crlvValidade ? dateOnly(item.crlvValidade) : null,
  ipvaVencimento: item.ipvaVencimento ? dateOnly(item.ipvaVencimento) : null,
  licenciamentoVencimento: item.licenciamentoVencimento ? dateOnly(item.licenciamentoVencimento) : null,
  seguroValidade: item.seguroValidade ? dateOnly(item.seguroValidade) : null,
  ipvaValor: number(item.ipvaValor), licenciamentoValor: number(item.licenciamentoValor), seguroValor: number(item.seguroValor),
  createdAt: created(item.createdAt),
});
const normalizeVehicleDates = (data: any) => {
  const out = { ...data };
  for (const key of ["crlvValidade","ipvaVencimento","licenciamentoVencimento","seguroValidade"]) {
    if (key in out) out[key] = out[key] ? parseDateOnly(out[key]) : null;
  }
  return out;
};

function normalizePlate(value: unknown) {
  return String(value ?? "")
    .toUpperCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 7);
}

function formatPlate(value: unknown) {
  const normalized = normalizePlate(value);
  if (!normalized) return "";
  if (normalized.length <= 3) return normalized;
  return `${normalized.slice(0, 3)}-${normalized.slice(3)}`;
}


async function validateMotoristaId(value: unknown) {
  const motoristaId = String(value ?? "").trim();
  if (!motoristaId) return null;

  const motorista = await prisma.motorista.findUnique({
    where: { id: motoristaId },
    select: { id: true },
  });
  if (!motorista) throw new AppError(400, "Motorista vinculado não encontrado.");
  return motoristaId;
}

async function syncVehicleIntoManifestos(vehicle: { id: string; placa: string; modelo?: string | null }, previousPlate?: string) {
  const currentPlate = formatPlate(vehicle.placa);
  const oldPlate = formatPlate(previousPlate);

  const plateCandidates = Array.from(new Set([currentPlate, oldPlate].filter(Boolean)));
  const plateKeys = new Set(plateCandidates.map(normalizePlate));

  // Primeiro atualiza os romaneios que já guardam o ID do veículo.
  await prisma.manifesto.updateMany({
    where: { veiculoCodigo: vehicle.id },
    data: {
      placaVeiculo: currentPlate,
      modeloVeiculo: vehicle.modelo ?? "",
    },
  });

  // Romaneios mais antigos podem ter somente a placa, sem veiculoCodigo. Como
  // diferentes versões salvaram a placa com/sem hífen, localizamos esses casos
  // pela placa normalizada e fazemos o vínculo definitivo pelo ID.
  const legacy = await prisma.manifesto.findMany({
    where: {
      OR: plateCandidates.map((plate) => ({ placaVeiculo: plate })),
    },
    select: { id: true, placaVeiculo: true },
  });

  const legacyIds = legacy
    .filter((manifesto) => plateKeys.has(normalizePlate(manifesto.placaVeiculo)))
    .map((manifesto) => manifesto.id);

  if (legacyIds.length) {
    await prisma.manifesto.updateMany({
      where: { id: { in: legacyIds } },
      data: {
        veiculoCodigo: vehicle.id,
        placaVeiculo: currentPlate,
        modeloVeiculo: vehicle.modelo ?? "",
      },
    });
  }
}

export const veiculosService = {
  async list() {
    return (await prisma.veiculo.findMany({ orderBy: { createdAt: "desc" } })).map(serialize);
  },

  async get(id: string) {
    const item = await prisma.veiculo.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Veiculo não encontrado.");
    return serialize(item);
  },

  async create(data: any) {
    const { createdAt, ...raw } = data;
    const rest = normalizeVehicleDates(raw);
    const motoristaId = await validateMotoristaId(rest.motoristaId);
    const item = await prisma.veiculo.create({
      data: {
        ...rest,
        motoristaId,
        placa: formatPlate(rest.placa),
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    });
    // A sincronização dos romaneios não deve impedir o cadastro do veículo.
    // A tela de Romaneios também enriquece modelo/placa em memória, então mesmo
    // que a persistência histórica falhe momentaneamente a listagem continua funcionando.
    await syncVehicleIntoManifestos(item).catch(() => undefined);
    return serialize(item);
  },

  async update(id: string, data: any) {
    const current = await prisma.veiculo.findUnique({
      where: { id },
      select: { placa: true },
    });
    if (!current) throw new AppError(404, "Veiculo não encontrado.");

    const { createdAt, ...raw } = data;
    const rest = normalizeVehicleDates(raw);
    const motoristaId = rest.motoristaId !== undefined
      ? await validateMotoristaId(rest.motoristaId)
      : undefined;
    const item = await prisma.veiculo.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.motoristaId !== undefined ? { motoristaId } : {}),
        ...(rest.placa !== undefined ? { placa: formatPlate(rest.placa) } : {}),
      },
    });

    // Mudanças de modelo/placa passam a refletir imediatamente em todos os
    // romaneios já cadastrados desse veículo.
    await syncVehicleIntoManifestos(item, current.placa).catch(() => undefined);
    return serialize(item);
  },

  async remove(id: string) {
    await prisma.veiculo.delete({ where: { id } });
  },
};
