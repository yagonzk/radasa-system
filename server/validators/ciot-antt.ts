import { z } from "zod";
const number = z.number().finite();
const str = z.string().trim().max(255);
export const ciotAnttOverrides = z.object({
  distanciaPercorrida: number.int().nonnegative().optional(),
  codigoMunicipioOrigem: number.int().optional(),
  codigoMunicipioDestino: number.int().optional(),
  cepOrigem: str.optional(),
  cepDestino: str.optional(),
  latitudeOrigem: number.optional(),
  longitudeOrigem: number.optional(),
  latitudeDestino: number.optional(),
  longitudeDestino: number.optional(),
  codigoNaturezaCarga: number.int().optional(),
  codigoTipoCarga: number.int().optional(),
  numeroEixos: number.int().optional(),
  tipoPagamento: number.int().optional(),
  codigoInstituicaoFinanceira: number.int().optional(),
  numeroAgencia: str.optional(),
  numeroConta: str.optional(),
  chavePix: str.optional(),
  cpfCnpjCreditado: str.optional(),
  codigoPagamento: number.int().optional(),
  identificadorPix: str.optional(),
  indPagamento: z.union([z.literal(0), z.literal(1)]).optional(),
  parcelas: z
    .array(
      z.object({
        numeroParcela: number.int().positive(),
        dataVencimento: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        valorParcela: number.positive(),
      }),
    )
    .max(100)
    .optional(),
  indAltoDesempenho: z.boolean().optional(),
  indRetornoVazio: z.boolean().optional(),
  composicaoVeicular: z.boolean().optional(),
  indContingencia: z.boolean().optional(),
  justificativaContingencia: str.optional(),
  rntrcContratante: str.optional(),
  cpfCnpjDestinatario: str.optional(),
  quantidadeViagens: number.int().positive().optional(),
  veiculosAdicionais: z
    .array(z.object({ placa: str, rntrc: str, numeroEixos: number.int() }))
    .max(5)
    .optional(),
});
