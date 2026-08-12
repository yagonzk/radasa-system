import type { RequestHandler } from "express";
import type { ZodType } from "zod";

/**
 * Valida entrada sem reatribuir req.query/req.params.
 *
 * No Express 5 req.query é exposto por getter e, no bridge Node da Cloudflare,
 * IncomingMessage também pode expor essas propriedades como somente leitura.
 * Os schemas atuais transformam/coagem o body; params/query são apenas validados.
 */
export function validate(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const parsed = schema.safeParse({
      body: req.body,
      params: req.params,
      query: req.query,
    });

    if (!parsed.success) return next(parsed.error);

    const data = parsed.data as {
      body?: unknown;
      params?: unknown;
      query?: unknown;
    };

    // Preserva trims, coerções, defaults e transforms do Zod no corpo.
    if (data.body !== undefined) {
      req.body = data.body;
    }

    // Não faça `req.query = ...` nem `req.params = ...` aqui.
    // Essas propriedades podem ser somente leitura no Express 5/Cloudflare.
    next();
  };
}
