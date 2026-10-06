import { prisma } from "../lib/prisma.js";
import { created } from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

function serialize(item: any) {
  // O certificado pode ter vários MB. Listagens e GET cadastral devolvem apenas
  // o estado configurado; o conteúdo continua restrito ao backend (SEFAZ/CIOT).
  const {
    certificadoSenha: _certificadoSenha,
    certificadoArquivo: _certificadoArquivo,
    ...safe
  } = item;

  return {
    ...safe,
    certificadoConfigurado: item.certificadoConfigurado ?? Boolean(item.certificadoArquivo),
    certificadoValidade:
      item.certificadoValidade instanceof Date
        ? item.certificadoValidade.toISOString()
        : item.certificadoValidade,
    createdAt: created(item.createdAt),
  };
}

function normalizeData(data: any, preservePassword = false): any {
  const {
    createdAt,
    certificadoValidade,
    certificadoSenha,
    certificadoArquivo,
    ...rest
  } = data;

  const normalized: any = {
    ...rest,
  };

  if (certificadoValidade !== undefined) {
    normalized.certificadoValidade = certificadoValidade
      ? new Date(`${String(certificadoValidade).slice(0, 10)}T00:00:00.000Z`)
      : null;
  }

  if (certificadoSenha) {
    normalized.certificadoSenha = certificadoSenha;
  } else if (!preservePassword) {
    normalized.certificadoSenha = "";
  }

  if (certificadoArquivo) {
    normalized.certificadoArquivo = certificadoArquivo;
  } else if (!preservePassword && certificadoArquivo !== undefined) {
    normalized.certificadoArquivo = "";
  }

  if (createdAt) {
    normalized.createdAt = new Date(createdAt);
  }

  return normalized;
}

export const empresaService = {
  async list() {
    const [items, configured] = await Promise.all([
      prisma.empresa.findMany({
        omit: { certificadoArquivo: true, certificadoSenha: true },
        orderBy: [
          { empresaPadrao: "desc" },
          { createdAt: "desc" },
        ],
      }),
      prisma.empresa.findMany({
        where: { certificadoArquivo: { not: "" } },
        select: { id: true },
      }),
    ]);
    const configuredIds = new Set(configured.map((item) => item.id));
    return items.map((item) => serialize({ ...item, certificadoConfigurado: configuredIds.has(item.id) }));
  },

  async get(id: string) {
    const [item, configured] = await Promise.all([
      prisma.empresa.findUnique({
        where: { id },
        omit: { certificadoArquivo: true, certificadoSenha: true },
      }),
      prisma.empresa.findFirst({
        where: { id, certificadoArquivo: { not: "" } },
        select: { id: true },
      }),
    ]);

    if (!item) {
      throw new AppError(404, "Empresa não encontrada.");
    }

    return serialize({ ...item, certificadoConfigurado: Boolean(configured) });
  },

  async create(data: any) {
    const item = await prisma.$transaction(async (tx: any) => {
      if (data.empresaPadrao) {
        await tx.empresa.updateMany({
          where: { empresaPadrao: true },
          data: { empresaPadrao: false },
        });
      }

      return tx.empresa.create({
        data: normalizeData(data),
        omit: { certificadoArquivo: true, certificadoSenha: true },
      });
    });

    return serialize({ ...item, certificadoConfigurado: Boolean(data.certificadoArquivo) });
  },

  async update(id: string, data: any) {
    const [current, configured] = await Promise.all([
      prisma.empresa.findUnique({ where: { id }, select: { id: true } }),
      prisma.empresa.findFirst({
        where: { id, certificadoArquivo: { not: "" } },
        select: { id: true },
      }),
    ]);

    if (!current) {
      throw new AppError(404, "Empresa não encontrada.");
    }

    const item = await prisma.$transaction(async (tx: any) => {
      if (data.empresaPadrao) {
        await tx.empresa.updateMany({
          where: {
            empresaPadrao: true,
            id: { not: id },
          },
          data: { empresaPadrao: false },
        });
      }

      return tx.empresa.update({
        where: { id },
        data: normalizeData(data, true),
        omit: { certificadoArquivo: true, certificadoSenha: true },
      });
    });

    return serialize({
      ...item,
      certificadoConfigurado: Boolean(data.certificadoArquivo) || Boolean(configured),
    });
  },

  async remove(id: string) {
    const current = await prisma.empresa.findUnique({
      where: { id },
      select: { id: true, empresaPadrao: true },
    });

    if (!current) {
      throw new AppError(404, "Empresa não encontrada.");
    }

    if (current.empresaPadrao) {
      throw new AppError(409, "A empresa padrão não pode ser excluída.");
    }

    await prisma.empresa.delete({
      where: { id },
    });
  },
};
