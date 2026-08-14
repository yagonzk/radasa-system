import { prisma } from "../lib/prisma.js";
import { created } from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

const serialize = (item: any) => ({ ...item, createdAt: created(item.createdAt) });

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
    const { createdAt, ...rest } = data;
    const item = await prisma.veiculo.create({
      data: {
        ...rest,
        placa: formatPlate(rest.placa),
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    });
    await syncVehicleIntoManifestos(item);
    return serialize(item);
  },

  async update(id: string, data: any) {
    const current = await prisma.veiculo.findUnique({
      where: { id },
      select: { placa: true },
    });
    if (!current) throw new AppError(404, "Veiculo não encontrado.");

    const { createdAt, ...rest } = data;
    const item = await prisma.veiculo.update({
      where: { id },
      data: {
        ...rest,
        ...(rest.placa !== undefined ? { placa: formatPlate(rest.placa) } : {}),
      },
    });

    // Mudanças de modelo/placa passam a refletir imediatamente em todos os
    // romaneios já cadastrados desse veículo.
    await syncVehicleIntoManifestos(item, current.placa);
    return serialize(item);
  },

  async remove(id: string) {
    await prisma.veiculo.delete({ where: { id } });
  },
};
