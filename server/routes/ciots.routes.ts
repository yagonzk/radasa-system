import { Router } from "express";
import { prisma } from "../lib/prisma";
import { ciotBody } from "../validators/schemas";

function decimal(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function serializeCiot(ciot: any) {
  return {
    ...ciot,
    pesoKg: decimal(ciot.pesoKg),
    valorFrete: decimal(ciot.valorFrete),
    valorPedagio: decimal(ciot.valorPedagio),
    outrosValores: decimal(ciot.outrosValores),
    descontos: decimal(ciot.descontos),
    valorLiquido: decimal(ciot.valorLiquido),
    ctes: Array.isArray(ciot.ctes)
      ? ciot.ctes.map((cte: any) => ({
          ...cte,
          pesoKg: decimal(cte.pesoKg),
          valorMercadoria: decimal(cte.valorMercadoria),
          valorFrete: decimal(cte.valorFrete),
          valorPedagio: decimal(cte.valorPedagio),
          dataEmissao: cte.dataEmissao instanceof Date
            ? cte.dataEmissao.toISOString().slice(0, 10)
            : cte.dataEmissao,
        }))
      : ciot.ctes,
    dataInicio:
      ciot.dataInicio instanceof Date
        ? ciot.dataInicio.toISOString().slice(0, 10)
        : ciot.dataInicio,
    dataFim:
      ciot.dataFim instanceof Date
        ? ciot.dataFim.toISOString().slice(0, 10)
        : ciot.dataFim,
  };
}

function toCreateData(input: ReturnType<typeof ciotBody.parse>) {
  return {
    clienteId: input.clienteId || null,
    empresaId: input.empresaId || null,
    contratanteRazaoSocial: input.contratanteRazaoSocial,
    contratanteNomeFantasia: input.contratanteNomeFantasia,
    contratanteCnpj: input.contratanteCnpj,
    contratadoRazaoSocial: input.contratadoRazaoSocial,
    contratadoNomeFantasia: input.contratadoNomeFantasia,
    contratadoCnpj: input.contratadoCnpj,
    contratadoInscricaoEstadual: input.contratadoInscricaoEstadual,
    contratadoEndereco: input.contratadoEndereco,
    contratadoCidade: input.contratadoCidade,
    contratadoUf: input.contratadoUf,
    motoristaId: input.motoristaId,
    veiculoId: input.veiculoId,
    tipoOperacao: input.tipoOperacao,
    status: input.status,
    rntrc: input.rntrc,
    origemCidade: input.origemCidade,
    origemUf: input.origemUf,
    destinoCidade: input.destinoCidade,
    destinoUf: input.destinoUf,
    dataInicio: new Date(`${input.dataInicio}T00:00:00.000Z`),
    dataFim: input.dataFim
      ? new Date(`${input.dataFim}T00:00:00.000Z`)
      : null,
    naturezaCarga: input.naturezaCarga,
    pesoKg: input.pesoKg,
    valorFrete: input.valorFrete,
    valorPedagio: input.valorPedagio,
    outrosValores: input.outrosValores,
    descontos: input.descontos,
    valorLiquido: input.valorLiquido,
    formaPagamento: input.formaPagamento,
    favorecidoPix: input.favorecidoPix,
    payloadAntt: input.payloadAntt ?? undefined,
    preparadoEm: input.preparadoEm ? new Date(input.preparadoEm) : null,
    observacoes: input.observacoes || null,
    numeroCiot: input.numeroCiot || null,
    codigoVerificador: input.codigoVerificador || null,
    protocolo: input.protocolo || null,
    mensagemRetorno: input.mensagemRetorno || null,
    valorMercadoria: input.valorMercadoria,
    cnpjsCargaFracionada: input.cnpjsCargaFracionada,
    ctes: input.ctes?.length
      ? {
          create: input.ctes.map((cte) => ({
            chave: cte.chave,
            numero: cte.numero,
            serie: cte.serie,
            emitenteCnpj: cte.emitenteCnpj,
            emitenteNome: cte.emitenteNome,
            emitenteNomeFantasia: cte.emitenteNomeFantasia,
            emitenteInscricaoEstadual: cte.emitenteInscricaoEstadual,
            emitenteEndereco: cte.emitenteEndereco,
            emitenteCidade: cte.emitenteCidade,
            emitenteUf: cte.emitenteUf,
            remetenteCnpj: cte.remetenteCnpj,
            remetenteNome: cte.remetenteNome,
            destinatarioCnpj: cte.destinatarioCnpj,
            destinatarioNome: cte.destinatarioNome,
            tomadorCnpj: cte.tomadorCnpj,
            tomadorNome: cte.tomadorNome,
            origemCidade: cte.origemCidade,
            origemUf: cte.origemUf,
            destinoCidade: cte.destinoCidade,
            destinoUf: cte.destinoUf,
            produto: cte.produto,
            ncm: cte.ncm,
            pesoKg: cte.pesoKg,
            valorMercadoria: cte.valorMercadoria,
            valorFrete: cte.valorFrete,
            valorPedagio: cte.valorPedagio,
            xmlUrl: cte.xmlUrl || null,
            arquivoNome: cte.arquivoNome || "",
            dataEmissao: cte.dataEmissao ? new Date(`${cte.dataEmissao}T00:00:00.000Z`) : null,
          })),
        }
      : undefined,
  };
}

export const ciotsRoutes = Router();

ciotsRoutes.get("/", async (_req, res, next) => {
  try {
    const items = await prisma.ciot.findMany({
      include: { ctes: true },
      orderBy: [{ createdAt: "desc" }],
    });
    res.json(items.map(serializeCiot));
  } catch (error) {
    next(error);
  }
});

ciotsRoutes.get("/:id", async (req, res, next) => {
  try {
    const item = await prisma.ciot.findUnique({
      where: { id: req.params.id },
      include: { ctes: true },
    });

    if (!item) {
      res.status(404).json({ message: "CIOT não encontrado." });
      return;
    }

    res.json(serializeCiot(item));
  } catch (error) {
    next(error);
  }
});

ciotsRoutes.post("/", async (req, res, next) => {
  try {
    const parsed = ciotBody.parse(req.body);
    const item = await prisma.ciot.create({
      data: {
        ...toCreateData(parsed),
        id: parsed.id,
        createdAt: parsed.createdAt ? new Date(parsed.createdAt) : undefined,
      },
      include: { ctes: true },
    });
    res.status(201).json(serializeCiot(item));
  } catch (error) {
    next(error);
  }
});

ciotsRoutes.put("/:id", async (req, res, next) => {
  try {
    const current = await prisma.ciot.findUnique({
      where: { id: req.params.id },
    });

    if (!current) {
      res.status(404).json({ message: "CIOT não encontrado." });
      return;
    }

    if (
      ["AUTORIZADO", "CANCELADO", "ENCERRADO"].includes(current.status)
    ) {
      res.status(409).json({
        message:
          "CIOT autorizado, cancelado ou encerrado não pode ser alterado nesta etapa.",
      });
      return;
    }

    const parsed = ciotBody.partial().parse(req.body);
    const data: Record<string, unknown> = { ...parsed };

    if (parsed.ctes !== undefined) {
      data.ctes = {
        deleteMany: {},
        create: parsed.ctes.map((cte) => ({
          chave: cte.chave,
          numero: cte.numero,
          serie: cte.serie,
          emitenteCnpj: cte.emitenteCnpj,
          emitenteNome: cte.emitenteNome,
          emitenteNomeFantasia: cte.emitenteNomeFantasia,
          emitenteInscricaoEstadual: cte.emitenteInscricaoEstadual,
          emitenteEndereco: cte.emitenteEndereco,
          emitenteCidade: cte.emitenteCidade,
          emitenteUf: cte.emitenteUf,
          remetenteCnpj: cte.remetenteCnpj,
          remetenteNome: cte.remetenteNome,
          destinatarioCnpj: cte.destinatarioCnpj,
          destinatarioNome: cte.destinatarioNome,
          tomadorCnpj: cte.tomadorCnpj,
          tomadorNome: cte.tomadorNome,
          origemCidade: cte.origemCidade,
          origemUf: cte.origemUf,
          destinoCidade: cte.destinoCidade,
          destinoUf: cte.destinoUf,
          produto: cte.produto,
          ncm: cte.ncm,
          pesoKg: cte.pesoKg,
          valorMercadoria: cte.valorMercadoria,
          valorFrete: cte.valorFrete,
          valorPedagio: cte.valorPedagio,
          xmlUrl: cte.xmlUrl || null,
          arquivoNome: cte.arquivoNome || "",
          dataEmissao: cte.dataEmissao ? new Date(`${cte.dataEmissao}T00:00:00.000Z`) : null,
        })),
      };
    }

    if (parsed.dataInicio) {
      data.dataInicio = new Date(`${parsed.dataInicio}T00:00:00.000Z`);
    }
    if (parsed.dataFim !== undefined) {
      data.dataFim = parsed.dataFim
        ? new Date(`${parsed.dataFim}T00:00:00.000Z`)
        : null;
    }
    if (parsed.preparadoEm !== undefined) {
      data.preparadoEm = parsed.preparadoEm
        ? new Date(parsed.preparadoEm)
        : null;
    }

    delete data.id;
    delete data.createdAt;
    delete data.updatedAt;

    for (const key of [
      "observacoes",
      "numeroCiot",
      "codigoVerificador",
      "protocolo",
      "mensagemRetorno",
    ]) {
      if (data[key] === "") data[key] = null;
    }

    const item = await prisma.ciot.update({
      where: { id: req.params.id },
      data,
      include: { ctes: true },
    });

    res.json(serializeCiot(item));
  } catch (error) {
    next(error);
  }
});

ciotsRoutes.delete("/:id", async (req, res, next) => {
  try {
    const current = await prisma.ciot.findUnique({
      where: { id: req.params.id },
    });

    if (!current) {
      res.status(404).json({ message: "CIOT não encontrado." });
      return;
    }

    if (current.status !== "RASCUNHO") {
      res.status(409).json({
        message: "Somente CIOTs em rascunho podem ser excluídos.",
      });
      return;
    }

    await prisma.ciot.delete({ where: { id: req.params.id } });
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
