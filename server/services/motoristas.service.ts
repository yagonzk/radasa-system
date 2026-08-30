import { prisma } from "../lib/prisma.js";
import { created, number, dateOnly } from "../utils/serialize.js";
import { parseDateOnly } from "../utils/date.js";
import { AppError } from "../utils/app-error.js";

const serialize = (item: any) => {
  const { cnhPdfUrl, toxicologicoPdfUrl, ...safe } = item;
  return ({
  ...safe,
  cnhPdfStored: Boolean(cnhPdfUrl),
  toxicologicoPdfStored: Boolean(toxicologicoPdfUrl),
  salarioBase: number(item.salarioBase),
  dataNascimento: item.dataNascimento ? dateOnly(item.dataNascimento) : null,
  dataAdmissao: item.dataAdmissao ? dateOnly(item.dataAdmissao) : null,
  cnhValidade: item.cnhValidade ? dateOnly(item.cnhValidade) : null,
  cnhEmissao: item.cnhEmissao ? dateOnly(item.cnhEmissao) : null,
  primeiraHabilitacao: item.primeiraHabilitacao ? dateOnly(item.primeiraHabilitacao) : null,
  moppValidade: item.moppValidade ? dateOnly(item.moppValidade) : null,
  toxicologicoValidade: item.toxicologicoValidade ? dateOnly(item.toxicologicoValidade) : null,
  createdAt: created(item.createdAt),
});
};
const normalizeDates = (data: any) => {
  const out = { ...data };
  for (const key of ["dataNascimento","dataAdmissao","cnhValidade","cnhEmissao","primeiraHabilitacao","moppValidade","toxicologicoValidade"]) {
    if (key in out) out[key] = out[key] ? parseDateOnly(out[key]) : null;
  }
  return out;
};


function pdfDataUrl(file: Express.Multer.File) {
  return `data:application/pdf;base64,${file.buffer.toString("base64")}`;
}

function motoristaPdfFields(tipo: string) {
  if (tipo === "cnh") return { nome: "cnhPdfNome", url: "cnhPdfUrl" } as const;
  if (tipo === "toxicologico") return { nome: "toxicologicoPdfNome", url: "toxicologicoPdfUrl" } as const;
  throw new AppError(400, "Tipo de documento inválido.");
}

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

  async uploadPdf(id: string, tipo: string, file: Express.Multer.File) {
    const fields = motoristaPdfFields(tipo);
    const exists = await prisma.motorista.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError(404, "Motorista não encontrado.");
    const item = await prisma.motorista.update({
      where: { id },
      data: { [fields.nome]: file.originalname, [fields.url]: pdfDataUrl(file) },
    });
    return serialize(item);
  },

  async getPdf(id: string, tipo: string) {
    const fields = motoristaPdfFields(tipo);
    const item = await prisma.motorista.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Motorista não encontrado.");
    const dataUrl = String((item as any)[fields.url] ?? "");
    if (!dataUrl) throw new AppError(404, "Documento não cadastrado.");
    const encoded = dataUrl.includes(",") ? dataUrl.slice(dataUrl.indexOf(",") + 1) : dataUrl;
    return { nome: String((item as any)[fields.nome] || `${tipo}.pdf`), buffer: Buffer.from(encoded, "base64") };
  },

  async removePdf(id: string, tipo: string) {
    const fields = motoristaPdfFields(tipo);
    const exists = await prisma.motorista.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new AppError(404, "Motorista não encontrado.");
    const item = await prisma.motorista.update({ where: { id }, data: { [fields.nome]: "", [fields.url]: "" } });
    return serialize(item);
  },

  async remove(_id: string) {
    throw new AppError(
      405,
      "Motoristas não podem ser excluídos. Altere o status para DEMITIDO."
    );
  },
};
