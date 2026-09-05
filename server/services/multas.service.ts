import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { created, dateOnly, number } from "../utils/serialize.js";
import { motoristaDaViagemParaPlaca } from "./multas-match.js";
const asDate = (value: string) => new Date(`${value}T12:00:00.000Z`);

const serialize = (item: any) => ({
  ...item,
  dataInfracao: dateOnly(item.dataInfracao),
  vencimento: item.vencimento ? dateOnly(item.vencimento) : null,
  valorOriginal: number(item.valorOriginal),
  valorAtual: number(item.valorAtual),
  documentoStored: Boolean(item.documentoUrl || item.documentoNome),
  createdAt: created(item.createdAt),
});

async function resolveMotorista(veiculo: { placa: string }, dataInfracao: string, motoristaId?: string | null) {
  if (motoristaId) {
    const motorista = await prisma.motorista.findUnique({ where: { id: motoristaId }, select: { id: true } });
    if (!motorista) throw new AppError(404, "Motorista não encontrado.");
    return motorista.id;
  }

  const viagens = await prisma.viagem.findMany({
    where: { dataManifesto: asDate(dataInfracao) },
    select: { placa: true, motoristaId: true },
    orderBy: { createdAt: "desc" },
  });
  return motoristaDaViagemParaPlaca(viagens, veiculo.placa);
}

async function vehicleOrThrow(veiculoId: string) {
  const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoId } });
  if (!veiculo) throw new AppError(404, "Veículo não encontrado.");
  return veiculo;
}

const veiculoSelect = { id: true, placa: true, renavam: true, modelo: true, marca: true } as const;
const include = {
  veiculo: { select: veiculoSelect },
  motorista: { select: { id: true, nome: true, cpf: true } },
} as const;

const listSelect = {
  id: true, veiculoId: true, motoristaId: true, autoInfracao: true, codigoInfracao: true, orgaoAutuador: true,
  dataInfracao: true, hora: true, local: true, descricao: true, pontos: true, valorOriginal: true, valorAtual: true,
  vencimento: true, status: true, observacoes: true, documentoNome: true, createdAt: true, updatedAt: true,
  veiculo: { select: veiculoSelect }, motorista: { select: { id: true, nome: true, cpf: true } },
} as const;

export const multasService = {
  async list() {
    return (await prisma.multa.findMany({ select: listSelect, orderBy: [{ dataInfracao: "desc" }, { createdAt: "desc" }] })).map(serialize);
  },

  async create(data: any) {
    const veiculo = await vehicleOrThrow(data.veiculoId);
    const motoristaId = await resolveMotorista(veiculo, data.dataInfracao, data.motoristaId || null);
    const item = await prisma.multa.create({
      data: {
        veiculoId: data.veiculoId,
        motoristaId,
        autoInfracao: data.autoInfracao || "",
        codigoInfracao: data.codigoInfracao || "",
        orgaoAutuador: data.orgaoAutuador || "",
        dataInfracao: asDate(data.dataInfracao),
        hora: data.hora || "",
        local: data.local || "",
        descricao: data.descricao || "",
        pontos: Number(data.pontos || 0),
        valorOriginal: Number(data.valorOriginal || 0),
        valorAtual: Number(data.valorAtual || data.valorOriginal || 0),
        vencimento: data.vencimento ? asDate(data.vencimento) : null,
        status: data.status || "PENDENTE",
        observacoes: data.observacoes || "",
        documentoUrl: data.documentoUrl || null,
        documentoNome: data.documentoNome || null,
      },
      include,
    });
    return serialize(item);
  },

  async update(id: string, data: any) {
    const current = await prisma.multa.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Multa não encontrada.");
    const veiculo = await vehicleOrThrow(data.veiculoId);
    const motoristaId = await resolveMotorista(veiculo, data.dataInfracao, data.motoristaId || null);
    const item = await prisma.multa.update({
      where: { id },
      data: {
        veiculoId: data.veiculoId,
        motoristaId,
        autoInfracao: data.autoInfracao || "",
        codigoInfracao: data.codigoInfracao || "",
        orgaoAutuador: data.orgaoAutuador || "",
        dataInfracao: asDate(data.dataInfracao),
        hora: data.hora || "",
        local: data.local || "",
        descricao: data.descricao || "",
        pontos: Number(data.pontos || 0),
        valorOriginal: Number(data.valorOriginal || 0),
        valorAtual: Number(data.valorAtual || data.valorOriginal || 0),
        vencimento: data.vencimento ? asDate(data.vencimento) : null,
        status: data.status || "PENDENTE",
        observacoes: data.observacoes || "",
        documentoUrl: data.documentoUrl || (data.documentoNome ? current.documentoUrl : null),
        documentoNome: data.documentoNome || null,
      },
      include,
    });
    return serialize(item);
  },

  async remove(id: string) {
    const current = await prisma.multa.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new AppError(404, "Multa não encontrada.");
    await prisma.multa.delete({ where: { id } });
  },

  async getDocumento(id: string) {
    const item = await prisma.multa.findUnique({ where: { id }, select: { documentoUrl: true, documentoNome: true } });
    if (!item) throw new AppError(404, "Multa não encontrada.");
    if (!item.documentoUrl) throw new AppError(404, "Documento não encontrado nesta multa.");
    return { dataUrl: item.documentoUrl, name: item.documentoNome || "multa.pdf" };
  },

  async consultarVeiculo(veiculoId: string) {
    const veiculo = await vehicleOrThrow(veiculoId);
    const multas = (await prisma.multa.findMany({ where: { veiculoId }, select: listSelect, orderBy: [{ dataInfracao: "desc" }, { createdAt: "desc" }] })).map(serialize);
    return {
      veiculo: { id: veiculo.id, placa: veiculo.placa, renavam: veiculo.renavam, modelo: veiculo.modelo, marca: veiculo.marca },
      integracaoAutomatica: false,
      fonte: "CONTROLE_INTERNO",
      mensagem: "Consulta automática SENATRAN/RENAINF ainda não configurada. A tela exibe as multas registradas no Radasa System para esta placa.",
      multas,
    };
  },
};
