import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import multer from "multer";
import {
  criarContextoSugestoesAbastecimento,
  interpretarAbastecimentoXml,
  sugerirVinculosAbastecimento,
} from "../services/abastecimento-xml.service.js";
import {
  abastecimentosService,
  type PoliticaDuplicidadeAbastecimento,
} from "../services/abastecimentos.service.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
    files: 1000,
  },
});

export const abastecimentosXmlRoutes = Router();

abastecimentosXmlRoutes.post(
  "/interpretar",
  upload.array("arquivos", 1000),
  async (req, res, next) => {
    try {
      const files = (req.files ?? []) as Express.Multer.File[];
      const modoDuplicidade =
        String(req.body?.modoDuplicidade ?? "OCULTAR").toUpperCase() ===
        "SINCRONIZAR"
          ? "SINCRONIZAR"
          : "OCULTAR";

      if (!files.length) {
        res.status(400).json({
          message: "Selecione pelo menos um XML de nota de abastecimento.",
        });
        return;
      }

      const results: Array<any | undefined> = new Array(files.length);
      const parsed: Array<{
        index: number;
        file: Express.Multer.File;
        document: ReturnType<typeof interpretarAbastecimentoXml>;
      }> = [];
      const keys = new Set<string>();

      // Parsing e validação inicial acontecem antes das consultas ao banco. Isso
      // permite fazer a busca de duplicidades já cadastradas em uma única query.
      files.forEach((file, index) => {
        try {
          if (!file.originalname.toLowerCase().endsWith(".xml")) {
            throw new Error("O arquivo não possui extensão .xml.");
          }

          const document = interpretarAbastecimentoXml(
            file.buffer.toString("utf8"),
          );

          if (!document.chaveNfe) {
            throw new Error("Não foi possível identificar a chave da NF-e.");
          }

          if (keys.has(document.chaveNfe)) {
            throw new Error("Esta NF-e está repetida no lote selecionado.");
          }

          keys.add(document.chaveNfe);
          parsed.push({ index, file, document });
        } catch (error) {
          results[index] = {
            indiceArquivo: index,
            fileName: file.originalname,
            status: "INVALIDO",
            erros: [
              error instanceof Error
                ? error.message
                : "Não foi possível interpretar o XML.",
            ],
            pendencias: [],
            documento: null,
            sugestoes: null,
            xmlUrl: null,
          };
        }
      });

      type ExistingAbastecimento = {
        id: string;
        chaveNfe: string | null;
        clienteId: string;
        veiculoId: string;
        hodometro: unknown;
      };

      const existentes = (keys.size
        ? await prisma.abastecimento.findMany({
            where: { chaveNfe: { in: Array.from(keys) } },
            select: {
              id: true,
              chaveNfe: true,
              clienteId: true,
              veiculoId: true,
              hodometro: true,
            },
          })
        : []) as ExistingAbastecimento[];

      const existentePorChave = new Map<string, ExistingAbastecimento>(
        existentes
          .filter((item) => item.chaveNfe)
          .map((item) => [item.chaveNfe!, item] as const),
      );
      const jaCadastrados = existentes.length;

      const pendentesDeSugestao = parsed.filter(({ document }) => {
        const existente = existentePorChave.get(document.chaveNfe);
        return !existente || modoDuplicidade === "SINCRONIZAR";
      });

      // Carrega clientes, veículos e combustíveis uma única vez por requisição.
      // Antes cada XML repetia essas consultas, o que fazia lotes grandes ficarem
      // muito mais lentos do que o parsing do XML em si.
      const suggestionContext = pendentesDeSugestao.length
        ? await criarContextoSugestoesAbastecimento()
        : null;

      const CONCURRENCY = 4;
      let nextIndex = 0;

      const workers = Array.from(
        { length: Math.min(CONCURRENCY, pendentesDeSugestao.length) },
        async () => {
          while (true) {
            const position = nextIndex;
            nextIndex += 1;
            if (position >= pendentesDeSugestao.length) return;

            const { index, file, document } = pendentesDeSugestao[position];
            const existente = existentePorChave.get(document.chaveNfe);

            try {
              const sugestoes = await sugerirVinculosAbastecimento(
                document,
                suggestionContext ?? undefined,
              );

              const missing: string[] = [];
              if (!sugestoes.cliente) missing.push("cliente/posto");
              if (!sugestoes.veiculo) missing.push("veículo");
              if (
                sugestoes.produtos.some(
                  (item) =>
                    !item.cadastro &&
                    !String(
                      item.produto.nome ||
                        item.produto.combustivel?.descricaoAnp ||
                        "",
                    ).trim(),
                )
              ) {
                missing.push("produto");
              }

              results[index] = {
                indiceArquivo: index,
                fileName: file.originalname,
                status: missing.length ? "PENDENTE" : "COMPLETO",
                erros: [],
                pendencias: Array.from(new Set(missing)),
                documento: document,
                sugestoes,
                jaCadastrado: Boolean(existente),
                existente: existente
                  ? {
                      id: existente.id,
                      clienteId: existente.clienteId,
                      veiculoId: existente.veiculoId,
                      hodometro: Number(existente.hodometro),
                    }
                  : null,
                xmlUrl: `data:${
                  file.mimetype || "application/xml"
                };base64,${file.buffer.toString("base64")}`,
              };
            } catch (error) {
              results[index] = {
                indiceArquivo: index,
                fileName: file.originalname,
                status: "INVALIDO",
                erros: [
                  error instanceof Error
                    ? error.message
                    : "Não foi possível sugerir os vínculos do XML.",
                ],
                pendencias: [],
                documento: null,
                sugestoes: null,
                xmlUrl: null,
              };
            }
          }
        },
      );

      await Promise.all(workers);

      const visibleResults = results.filter(Boolean);

      res.json({
        arquivos: visibleResults,
        resumo: {
          quantidade: visibleResults.length,
          completos: visibleResults.filter((item) => item.status === "COMPLETO")
            .length,
          pendentes: visibleResults.filter((item) => item.status === "PENDENTE")
            .length,
          invalidos: visibleResults.filter((item) => item.status === "INVALIDO")
            .length,
          jaCadastrados,
          litros: visibleResults.reduce(
            (sum: number, item: any) =>
              sum +
              (item.documento?.produtos ?? []).reduce(
                (
                  productSum: number,
                  product: { quantidade?: number | string | null },
                ) => productSum + Number(product.quantidade ?? 0),
                0,
              ),
            0,
          ),
          valor: visibleResults.reduce(
            (sum, item) => sum + Number(item.documento?.totais.nota || 0),
            0,
          ),
        },
      });
    } catch (error) {
      next(error);
    }
  },
);

abastecimentosXmlRoutes.post("/importar-lote", async (req, res, next) => {
  try {
    const politica = String(
      req.body?.politicaDuplicidade ?? "IGNORAR",
    ).toUpperCase() as PoliticaDuplicidadeAbastecimento;

    if (!["IGNORAR", "ATUALIZAR"].includes(politica)) {
      res.status(400).json({
        message: "politicaDuplicidade deve ser IGNORAR ou ATUALIZAR.",
      });
      return;
    }

    const itens = Array.isArray(req.body?.itens) ? req.body.itens : [];

    if (!itens.length) {
      res.status(400).json({
        message: "Nenhum abastecimento foi enviado para importação.",
      });
      return;
    }

    const invalidos = itens
      .map((item: any, index: number) => ({
        index,
        clienteId: String(item?.clienteId ?? "").trim(),
        veiculoId: String(item?.veiculoId ?? "").trim(),
        chaveNfe: String(item?.chaveNfe ?? "").replace(/\D/g, ""),
        hodometro: Number(item?.hodometro ?? 0),
        produtos: Array.isArray(item?.produtos) ? item.produtos : [],
      }))
      .filter(
        (item: any) =>
          !item.clienteId ||
          !item.veiculoId ||
          item.chaveNfe.length !== 44 ||
          !Number.isFinite(item.hodometro) ||
          item.hodometro < 0 ||
          !item.produtos.length ||
          item.produtos.some((produto: any) => {
            const produtoId = String(produto?.produtoId ?? "").trim();
            const produtoXml = produto?.produtoXml ?? null;
            const nomeXml = String(
              produtoXml?.nome ?? produtoXml?.combustivel?.descricaoAnp ?? "",
            ).trim();

            return (
              (!produtoId && !nomeXml) ||
              !Number.isFinite(Number(produto?.quantidadeLitros)) ||
              Number(produto?.quantidadeLitros) <= 0 ||
              !Number.isFinite(Number(produto?.valorUnitario)) ||
              Number(produto?.valorUnitario) < 0
            );
          }),
      );

    if (invalidos.length) {
      res.status(400).json({
        message: `${invalidos.length} item(ns) possuem dados obrigatórios inválidos.`,
        indices: invalidos.map((item: any) => item.index),
      });
      return;
    }

    const resultado = await abastecimentosService.importBatch(
      itens,
      politica,
    );

    res.status(201).json(resultado);
  } catch (error) {
    next(error);
  }
});

