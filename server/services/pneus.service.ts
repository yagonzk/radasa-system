import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { created, dateOnly, number } from "../utils/serialize.js";
import { randomUUID } from "node:crypto";

const include = { fotos: true, eventos: { orderBy: { data: "desc" as const } }, recapagens: { orderBy: { numeroRecapagem: "desc" as const } }, consertos: { orderBy: { data: "desc" as const } }, medicoesSulco: { orderBy: { data: "desc" as const }, take: 12 }, calibragens: { orderBy: { data: "desc" as const }, take: 1 }, inspecoes: { orderBy: { data: "desc" as const }, take: 1 } } as const;
const serialize = (p: any) => {
  const { codigoBarras: _codigoBarras, qrCode: _qrCode, notaFiscalUrl: _notaFiscalUrl, ...rest } = p;
  return {
  ...rest,
  notaFiscalStored: Boolean(p.notaFiscalUrl),
  valorCompra: number(p.valorCompra), sulcoInicial: p.sulcoInicial == null ? null : number(p.sulcoInicial),
  sulcoAtual: p.sulcoAtual == null ? null : number(p.sulcoAtual), kmAtual: number(p.kmAtual),
  proximoRodizioKm: p.proximoRodizioKm == null ? null : number(p.proximoRodizioKm),
  dataCompra: dateOnly(p.dataCompra), createdAt: created(p.createdAt),
  eventos: (p.eventos ?? []).map((e: any) => ({ ...e, quilometragem: e.quilometragem == null ? null : number(e.quilometragem), data: created(e.data), createdAt: created(e.createdAt) })),
  fotos: (p.fotos ?? []).map((f: any) => ({ ...f, createdAt: created(f.createdAt) })),
  recapagens: (p.recapagens ?? []).map((x:any)=>({...x, valor:number(x.valor), dataEnvio:dateOnly(x.dataEnvio), dataRetorno:x.dataRetorno?dateOnly(x.dataRetorno):null, createdAt:created(x.createdAt)})),
  consertos: (p.consertos ?? []).map((x:any)=>({...x, valor:number(x.valor), data:dateOnly(x.data), createdAt:created(x.createdAt)})),
  medicoesSulco: (p.medicoesSulco ?? []).map((x:any)=>({...x, data:dateOnly(x.data), mediaSulco:number(x.mediaSulco), percentualDesgaste:number(x.percentualDesgaste), vidaUtilRestante:number(x.vidaUtilRestante), createdAt:created(x.createdAt)})),
  calibragens: (p.calibragens ?? []).map((x:any)=>({...x, data:dateOnly(x.data), pressaoRecomendada:number(x.pressaoRecomendada), pressaoEncontrada:number(x.pressaoEncontrada), pressaoAjustada:number(x.pressaoAjustada), createdAt:created(x.createdAt)})),
  inspecoes: (p.inspecoes ?? []).map((x:any)=>({...x, data:dateOnly(x.data), createdAt:created(x.createdAt)})),
  };
};

function generatedNumeroFogo() {
  return `PNEU-${randomUUID().slice(0, 8).toUpperCase()}`;
}

function data(input: any, fallbackNumeroFogo?: string) {
  const numeroFogo = String(input.numeroFogo ?? "").trim() || fallbackNumeroFogo || generatedNumeroFogo();
  const dataCompra = String(input.dataCompra ?? "").trim() || new Date().toISOString().slice(0, 10);
  return {
    numeroFogo,
    marca: String(input.marca ?? "").trim(),
    modelo: String(input.modelo ?? "").trim(),
    medida: String(input.medida ?? "").trim(),
    aro: String(input.aro ?? "").trim() || null,
    dot: String(input.dot ?? "").trim(),
    numeroSerie: String(input.numeroSerie ?? "").trim() || null,
    tipo: input.tipo ?? "LIVRE",
    valorCompra: Number(input.valorCompra ?? 0),
    fornecedor: String(input.fornecedor ?? "").trim(),
    dataCompra: parseDateOnly(dataCompra),
    maxRecapagens: Number(input.maxRecapagens ?? 0),
    recapagensRealizadas: Number(input.recapagensRealizadas ?? 0), status: input.status ?? "ESTOQUE",
    condicao: input.condicao ?? "NOVO", sulcoInicial: input.sulcoInicial == null || input.sulcoInicial === "" ? null : Number(input.sulcoInicial),
    sulcoAtual: input.sulcoAtual == null || input.sulcoAtual === "" ? null : Number(input.sulcoAtual),
    kmAtual: Number(input.kmAtual ?? 0), proximoRodizioKm: input.proximoRodizioKm == null || input.proximoRodizioKm === "" ? null : Number(input.proximoRodizioKm),
    observacoes: input.observacoes || null,
  };
}

export const pneusService = {
  async list() { return (await prisma.pneu.findMany({ where: { deletedAt: null }, include, orderBy: [{ status: "asc" }, { numeroFogo: "asc" }] })).map(serialize); },
  async get(id: string) { const p = await prisma.pneu.findFirst({ where: { id, deletedAt: null }, include }); if (!p) throw new AppError(404, "Pneu não encontrado."); return serialize(p); },
  async create(input: any) {
    const prepared = data(input);
    const exists = await prisma.pneu.findUnique({ where: { numeroFogo: prepared.numeroFogo } });
    if (exists) throw new AppError(409, "Já existe um pneu com este número de fogo.");
    return serialize(await prisma.pneu.create({ data: { ...prepared, fotos: { create: (input.fotos ?? []).map((url: string) => ({ url })) }, eventos: { create: { tipo: "COMPRA", observacoes: "Pneu cadastrado no sistema.", dados: { fornecedor: prepared.fornecedor, valorCompra: prepared.valorCompra } } } }, include }));
  },
  async update(id: string, input: any) {
    const current = await prisma.pneu.findFirst({ where: { id, deletedAt: null }, include });
    if (!current) throw new AppError(404, "Pneu não encontrado.");
    if (input.numeroFogo && input.numeroFogo !== current.numeroFogo) {
      const exists = await prisma.pneu.findUnique({ where: { numeroFogo: input.numeroFogo } }); if (exists) throw new AppError(409, "Já existe um pneu com este número de fogo.");
    }
    const merged = { ...serialize(current), ...input };
    const statusChanged = input.status && input.status !== current.status;
    return serialize(await prisma.$transaction(async (tx: any) => {
      if (input.fotos) { await tx.pneuFoto.deleteMany({ where: { pneuId: id } }); }
      return tx.pneu.update({ where: { id }, data: { ...data(merged, current.numeroFogo), ...(input.fotos ? { fotos: { create: input.fotos.map((url: string) => ({ url })) } } : {}), eventos: { create: { tipo: statusChanged ? "STATUS" : "ALTERACAO", observacoes: statusChanged ? `Status alterado de ${current.status} para ${input.status}.` : "Dados cadastrais atualizados.", dados: statusChanged ? { anterior: current.status, atual: input.status } : undefined } } }, include });
    }));
  },
  async getNotaFiscal(id: string) {
    const pneu = await prisma.pneu.findFirst({
      where: { id, deletedAt: null },
      select: { id: true, notaFiscalUrl: true, notaFiscalNome: true },
    });
    if (!pneu) throw new AppError(404, "Pneu não encontrado.");
    if (!pneu.notaFiscalUrl) throw new AppError(404, "Este pneu não possui nota fiscal anexada.");
    return { url: pneu.notaFiscalUrl, nome: pneu.notaFiscalNome || `nota-fiscal-pneu-${id}.pdf` };
  },
  async saveNotaFiscal(id: string, input: { notaFiscalUrl: string; notaFiscalNome: string }) {
    const pneu = await prisma.pneu.findFirst({ where: { id, deletedAt: null }, select: { id: true } });
    if (!pneu) throw new AppError(404, "Pneu não encontrado.");
    await prisma.pneu.update({
      where: { id },
      data: {
        notaFiscalUrl: input.notaFiscalUrl,
        notaFiscalNome: input.notaFiscalNome,
        eventos: {
          create: {
            tipo: "ALTERACAO",
            observacoes: `Nota fiscal anexada: ${input.notaFiscalNome}.`,
          },
        },
      },
    });
    return { stored: true, nome: input.notaFiscalNome };
  },
  async removeNotaFiscal(id: string) {
    const pneu = await prisma.pneu.findFirst({ where: { id, deletedAt: null }, select: { id: true, notaFiscalUrl: true } });
    if (!pneu) throw new AppError(404, "Pneu não encontrado.");
    await prisma.pneu.update({
      where: { id },
      data: {
        notaFiscalUrl: null,
        notaFiscalNome: null,
        eventos: pneu.notaFiscalUrl
          ? { create: { tipo: "ALTERACAO", observacoes: "Nota fiscal removida do pneu." } }
          : undefined,
      },
    });
  },
  async remove(id: string) { const p = await prisma.pneu.findFirst({ where: { id, deletedAt: null } }); if (!p) throw new AppError(404, "Pneu não encontrado."); await prisma.pneu.update({ where: { id }, data: { deletedAt: new Date(), eventos: { create: { tipo: "STATUS", observacoes: "Pneu arquivado (soft delete)." } } } }); },
};
