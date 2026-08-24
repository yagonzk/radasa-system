import { prisma } from "../lib/prisma.js";
import { created, number, dateOnly } from "../utils/serialize.js";
import { parseDateOnly } from "../utils/date.js";
import { AppError } from "../utils/app-error.js";

const serialize = (item: any) => ({
  ...item,
  salarioBase: number(item.salarioBase),
  dataNascimento: item.dataNascimento ? dateOnly(item.dataNascimento) : null,
  dataAdmissao: item.dataAdmissao ? dateOnly(item.dataAdmissao) : null,
  cnhValidade: item.cnhValidade ? dateOnly(item.cnhValidade) : null,
  primeiraHabilitacao: item.primeiraHabilitacao ? dateOnly(item.primeiraHabilitacao) : null,
  moppValidade: item.moppValidade ? dateOnly(item.moppValidade) : null,
  toxicologicoValidade: item.toxicologicoValidade ? dateOnly(item.toxicologicoValidade) : null,
  createdAt: created(item.createdAt),
});
const normalizeDates = (data: any) => {
  const out = { ...data };
  for (const key of ["dataNascimento","dataAdmissao","cnhValidade","primeiraHabilitacao","moppValidade","toxicologicoValidade"]) {
    if (key in out) out[key] = out[key] ? parseDateOnly(out[key]) : null;
  }
  return out;
};

export const motoristasService = {
  async list() {
    return (await prisma.motorista.findMany({ orderBy: { createdAt: "desc" } })).map(serialize);
  },

  async get(id: string) {
    const item = await prisma.motorista.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Motorista não encontrado.");
    return serialize(item);
  },

  async create(data: any) {
    const { createdAt, status = "ATIVO", ...raw } = data;
    const rest = normalizeDates(raw);
    const item = await prisma.motorista.create({
      data: {
        ...rest,
        status,
        ...(createdAt ? { createdAt: new Date(createdAt) } : {}),
      },
    });
    return serialize(item);
  },

  async update(id: string, data: any) {
    const { createdAt, ...raw } = data;
    const rest = normalizeDates(raw);
    const item = await prisma.motorista.update({ where: { id }, data: rest });
    return serialize(item);
  },

  async remove(_id: string) {
    throw new AppError(
      405,
      "Motoristas não podem ser excluídos. Altere o status para DEMITIDO."
    );
  },
};
