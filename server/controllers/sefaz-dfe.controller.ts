import type { Request, Response } from "express";
import { sefazDfeService } from "../services/sefaz-dfe.service.js";
import { AppError } from "../utils/app-error.js";

function mapSefazError(error: unknown): never {
  const anyError = error as { code?: unknown; message?: unknown } | null;
  const code = String(anyError?.code ?? "");
  const message = String(anyError?.message ?? error ?? "Falha na integração com a SEFAZ.");

  if (code === "P2021" || code === "P2022") {
    throw new AppError(
      503,
      "A atualização do banco da SEFAZ ainda não foi aplicada. Execute 'npx prisma migrate deploy' e publique novamente.",
      { code },
    );
  }

  if (/certificado A1|senha do certificado|CNPJ da empresa inválido|Empresa não encontrada/i.test(message)) {
    throw new AppError(422, message);
  }

  if (/aguardar 1 hora/i.test(message)) {
    throw new AppError(429, message);
  }

  if (/SEFAZ respondeu HTTP|SEFAZ DF-e|SEFAZ não retornou resposta HTTP|Resposta HTTP inválida da SEFAZ|retDistDFeInt|Falha HTTPS\/mTLS|Falha TLS direta|Binding SEFAZ_MTLS|SEFAZ_MTLS|encerrou a conexão|ECONN|ETIMEDOUT|timeout/i.test(message)) {
    throw new AppError(502, message);
  }

  throw error;
}

export const sefazDfeController = {
  status: async (req: Request, res: Response) => {
    try {
      res.json(await sefazDfeService.status(String(req.query.empresaId || "") || undefined));
    } catch (error) {
      mapSefazError(error);
    }
  },

  list: async (req: Request, res: Response) => {
    try {
      res.json(
        await sefazDfeService.list(String(req.query.empresaId || "") || undefined, {
          status: String(req.query.status || "") || undefined,
          classificacao: String(req.query.classificacao || "") || undefined,
          search: String(req.query.search || "") || undefined,
        }),
      );
    } catch (error) {
      mapSefazError(error);
    }
  },

  sync: async (req: Request, res: Response) => {
    try {
      res.json(await sefazDfeService.sync(String(req.body?.empresaId || "") || undefined));
    } catch (error) {
      mapSefazError(error);
    }
  },

  xml: async (req: Request, res: Response) => {
    try {
      res.json(await sefazDfeService.getXml(String(req.params.id)));
    } catch (error) {
      mapSefazError(error);
    }
  },
};
