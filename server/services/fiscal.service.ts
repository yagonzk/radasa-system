import { prisma } from "../lib/prisma.js";
import { formatDateOnly, parseDateOnly } from "../utils/date.js";
import { number } from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

type FiscalPeriod = {
  from?: string;
  to?: string;
};

type MonthRow = {
  mes: string;
  faturamento: number;
  receberCliente: number;
  acertarLebrinha: number;
  bonificacaoLebrinha: number;
  abastecimento: number;
  comissoes: number;
  almoxarifado: number;
  pneusCompra: number;
  pneusManutencao: number;
  pedagios: number;
  diarias: number;
  chapas: number;
  despesas: number;
  resultado: number;
};

function dateRange(from?: string, to?: string) {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: parseDateOnly(from) } : {}),
    ...(to ? { lte: parseDateOnly(to) } : {}),
  };
}

function dateKey(value: Date) {
  return value.toISOString().slice(0, 10);
}

function monthKey(value: Date) {
  return dateKey(value).slice(0, 7);
}

function emptyMonth(mes: string): MonthRow {
  return {
    mes,
    faturamento: 0,
    receberCliente: 0,
    acertarLebrinha: 0,
    bonificacaoLebrinha: 0,
    abastecimento: 0,
    comissoes: 0,
    almoxarifado: 0,
    pneusCompra: 0,
    pneusManutencao: 0,
    pedagios: 0,
    diarias: 0,
    chapas: 0,
    despesas: 0,
    resultado: 0,
  };
}

function addMonth(map: Map<string, MonthRow>, date: Date, field: keyof MonthRow, value: number) {
  const key = monthKey(date);
  const row = map.get(key) ?? emptyMonth(key);
  if (field !== "mes") (row as any)[field] = Number(row[field]) + value;
  map.set(key, row);
}

function fiscalMonthLabel(key: string) {
  const [year, month] = key.split("-");
  return new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${year}-${month}-01T00:00:00.000Z`))
    .replace(" de ", "/");
}


type FiscalPrecoRule = {
  id: string;
  produtoId: string;
  clienteId: string | null;
  vigenciaInicio: Date;
  custoUnitarioLebrinha: unknown;
  vendaUnitarioCliente: unknown;
};

function cleanId(value: unknown) {
  return String(value ?? "").trim();
}

function cleanMoney(value: unknown, label: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new AppError(400, `${label} inválido.`);
  }
  return parsed;
}

function fiscalTipoLabel(value: string) {
  if (value === "ACERTAR_LEBRINHA") return "Acertar c/ Lebrinha";
  if (value === "BONIFICACAO_LEBRINHA") return "Bonificação Lebrinha";
  if (value === "VASILHAME") return "Vasilhame";
  return "Receber c/ Cliente";
}

function serializePrecoFiscal(item: any) {
  return {
    id: item.id,
    produtoId: item.produtoId,
    clienteId: item.clienteId ?? null,
    vigenciaInicio: formatDateOnly(item.vigenciaInicio),
    custoUnitarioLebrinha: number(item.custoUnitarioLebrinha),
    vendaUnitarioCliente: number(item.vendaUnitarioCliente),
    produto: item.produto
      ? {
          id: item.produto.id,
          nome: item.produto.nome,
          codigoInterno: item.produto.codigoInterno,
        }
      : null,
    cliente: item.cliente
      ? {
          id: item.cliente.id,
          nomeFantasia: item.cliente.nomeFantasia,
          codigoInterno: item.cliente.codigoInterno,
        }
      : null,
    createdAt: item.createdAt?.toISOString?.() ?? null,
  };
}

function applicablePrice(
  rules: FiscalPrecoRule[],
  produtoId: string,
  clienteId: string,
  date: Date,
) {
  const eligible = rules.filter(
    (rule) =>
      rule.produtoId === produtoId &&
      rule.vigenciaInicio.getTime() <= date.getTime() &&
      (rule.clienteId === clienteId || rule.clienteId === null),
  );

  eligible.sort((a, b) => {
    const clientPriority = Number(b.clienteId === clienteId) - Number(a.clienteId === clienteId);
    if (clientPriority !== 0) return clientPriority;
    return b.vigenciaInicio.getTime() - a.vigenciaInicio.getTime();
  });

  return eligible[0] ?? null;
}

function roundMoney(value: number) {
  return Math.round((value + Number.EPSILON) * 10000) / 10000;
}

export const fiscalService = {
  async resumo(period: FiscalPeriod = {}) {
    const range = dateRange(period.from, period.to);

    const [manifestos, abastecimentos, fechamentos, almoxarifado, pneusCompras, recapagens, consertos, viagens] = await Promise.all([
      prisma.manifesto.findMany({
        where: range ? { dataManifesto: range } : undefined,
        select: {
          id: true,
          dataManifesto: true,
          tipoManifesto: true,
          produtos: {
            select: {
              valorTotal: true,
              tipoManifesto: true,
              pagoCliente: true,
            },
          },
        },
      }),
      prisma.abastecimento.findMany({
        where: range ? { dataEmissao: range } : undefined,
        select: { id: true, dataEmissao: true, valorTotal: true },
      }),
      prisma.fechamento.findMany({
        where: range ? { dataFim: range } : undefined,
        select: { id: true, dataFim: true, valorTotal: true },
      }),
      prisma.estoqueMovimentacao.findMany({
        where: {
          tipo: "ENTRADA",
          ...(range ? { data: range } : {}),
        },
        select: { id: true, data: true, valorTotal: true },
      }),
      prisma.pneu.findMany({
        where: range ? { dataCompra: range } : undefined,
        select: { id: true, dataCompra: true, valorCompra: true },
      }),
      prisma.pneuRecapagem.findMany({
        where: range ? { dataEnvio: range } : undefined,
        select: { id: true, dataEnvio: true, valor: true },
      }),
      prisma.pneuConserto.findMany({
        where: range ? { data: range } : undefined,
        select: { id: true, data: true, valor: true },
      }),
      prisma.viagem.findMany({
        where: range ? { dataManifesto: range } : undefined,
        select: {
          id: true,
          dataManifesto: true,
          valorPedagio: true,
          valorDiaria: true,
          valorChapa: true,
        },
      }),
    ]);

    const meses = new Map<string, MonthRow>();

    let receberCliente = 0;
    let acertarLebrinha = 0;
    let bonificacaoLebrinha = 0;
    let recebidoCliente = 0;
    let aReceberCliente = 0;

    for (const manifesto of manifestos) {
      for (const item of manifesto.produtos) {
        const tipo = item.tipoManifesto ?? manifesto.tipoManifesto;
        const valor = number(item.valorTotal);

        if (tipo === "RECEBER_CLIENTE") {
          receberCliente += valor;
          if (item.pagoCliente === true) recebidoCliente += valor;
          else aReceberCliente += valor;
          addMonth(meses, manifesto.dataManifesto, "receberCliente", valor);
          addMonth(meses, manifesto.dataManifesto, "faturamento", valor);
        } else if (tipo === "ACERTAR_LEBRINHA") {
          acertarLebrinha += valor;
          addMonth(meses, manifesto.dataManifesto, "acertarLebrinha", valor);
          addMonth(meses, manifesto.dataManifesto, "faturamento", valor);
        } else if (tipo === "BONIFICACAO_LEBRINHA") {
          bonificacaoLebrinha += valor;
          addMonth(meses, manifesto.dataManifesto, "bonificacaoLebrinha", valor);
          addMonth(meses, manifesto.dataManifesto, "faturamento", valor);
        }
      }
    }

    const faturamento = receberCliente + acertarLebrinha + bonificacaoLebrinha;

    const abastecimento = abastecimentos.reduce((sum, item) => {
      const valor = number(item.valorTotal);
      addMonth(meses, item.dataEmissao, "abastecimento", valor);
      return sum + valor;
    }, 0);

    const comissoes = fechamentos.reduce((sum, item) => {
      const valor = number(item.valorTotal);
      addMonth(meses, item.dataFim, "comissoes", valor);
      return sum + valor;
    }, 0);

    const almoxarifadoValor = almoxarifado.reduce((sum, item) => {
      const valor = number(item.valorTotal);
      addMonth(meses, item.data, "almoxarifado", valor);
      return sum + valor;
    }, 0);

    const pneusCompra = pneusCompras.reduce((sum, item) => {
      const valor = number(item.valorCompra);
      addMonth(meses, item.dataCompra, "pneusCompra", valor);
      return sum + valor;
    }, 0);

    const pneusRecapagens = recapagens.reduce((sum, item) => {
      const valor = number(item.valor);
      addMonth(meses, item.dataEnvio, "pneusManutencao", valor);
      return sum + valor;
    }, 0);

    const pneusConsertos = consertos.reduce((sum, item) => {
      const valor = number(item.valor);
      addMonth(meses, item.data, "pneusManutencao", valor);
      return sum + valor;
    }, 0);

    const pedagios = viagens.reduce((sum, item) => {
      const valor = number(item.valorPedagio);
      addMonth(meses, item.dataManifesto, "pedagios", valor);
      return sum + valor;
    }, 0);

    const diarias = viagens.reduce((sum, item) => {
      const valor = number(item.valorDiaria);
      addMonth(meses, item.dataManifesto, "diarias", valor);
      return sum + valor;
    }, 0);

    const chapas = viagens.reduce((sum, item) => {
      const valor = number(item.valorChapa);
      addMonth(meses, item.dataManifesto, "chapas", valor);
      return sum + valor;
    }, 0);

    const pneusManutencao = pneusRecapagens + pneusConsertos;
    const despesas = abastecimento + comissoes + almoxarifadoValor + pneusCompra + pneusManutencao + pedagios + diarias + chapas;
    const resultado = faturamento - despesas;
    const margem = faturamento > 0 ? (resultado / faturamento) * 100 : 0;

    const mensal = Array.from(meses.values())
      .map((row) => {
        const despesasMes = row.abastecimento + row.comissoes + row.almoxarifado + row.pneusCompra + row.pneusManutencao + row.pedagios + row.diarias + row.chapas;
        return {
          ...row,
          label: fiscalMonthLabel(row.mes),
          despesas: despesasMes,
          resultado: row.faturamento - despesasMes,
        };
      })
      .sort((a, b) => a.mes.localeCompare(b.mes));

    return {
      periodo: {
        from: period.from ?? null,
        to: period.to ?? null,
      },
      resumo: {
        faturamento,
        despesas,
        resultado,
        margem,
        recebidoCliente,
        aReceberCliente,
      },
      receitas: {
        receberCliente,
        acertarLebrinha,
        bonificacaoLebrinha,
        total: faturamento,
      },
      despesas: {
        abastecimento,
        comissoes,
        almoxarifado: almoxarifadoValor,
        pneusCompra,
        pneusManutencao,
        pedagios,
        diarias,
        chapas,
        total: despesas,
      },
      contagens: {
        romaneios: manifestos.length,
        abastecimentos: abastecimentos.length,
        fechamentos: fechamentos.length,
        almoxarifado: almoxarifado.length,
        pneusCompras: pneusCompras.length,
        pneusManutencoes: recapagens.length + consertos.length,
        viagens: viagens.length,
        diarias: viagens.filter((item) => number(item.valorDiaria) > 0).length,
        chapas: viagens.filter((item) => number(item.valorChapa) > 0).length,
      },
      mensal,
    };
  },

  async listPrecosProdutos() {
    const items = await prisma.fiscalPrecoProduto.findMany({
      include: {
        produto: { select: { id: true, nome: true, codigoInterno: true } },
        cliente: { select: { id: true, nomeFantasia: true, codigoInterno: true } },
      },
      orderBy: [
        { vigenciaInicio: "desc" },
        { createdAt: "desc" },
      ],
    });
    return items.map(serializePrecoFiscal);
  },

  async createPrecoProduto(input: any) {
    const produtoId = cleanId(input?.produtoId);
    const clienteId = cleanId(input?.clienteId) || null;
    const vigenciaInicio = parseDateOnly(cleanId(input?.vigenciaInicio));
    const custoUnitarioLebrinha = cleanMoney(input?.custoUnitarioLebrinha, "Custo unitário da Lebrinha");
    const vendaUnitarioCliente = cleanMoney(input?.vendaUnitarioCliente, "Valor unitário pago pelo cliente");

    if (!produtoId) throw new AppError(400, "Selecione o produto.");

    const [produto, cliente] = await Promise.all([
      prisma.produto.findUnique({ where: { id: produtoId }, select: { id: true } }),
      clienteId
        ? prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })
        : Promise.resolve(null),
    ]);

    if (!produto) throw new AppError(400, "Produto não encontrado.");
    if (clienteId && !cliente) throw new AppError(400, "Cliente não encontrado.");

    const duplicate = await prisma.fiscalPrecoProduto.findFirst({
      where: { produtoId, clienteId, vigenciaInicio },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError(
        409,
        "Já existe uma tabela para este produto/cliente com a mesma data de vigência.",
      );
    }

    const item = await prisma.fiscalPrecoProduto.create({
      data: {
        produtoId,
        clienteId,
        vigenciaInicio,
        custoUnitarioLebrinha,
        vendaUnitarioCliente,
      },
      include: {
        produto: { select: { id: true, nome: true, codigoInterno: true } },
        cliente: { select: { id: true, nomeFantasia: true, codigoInterno: true } },
      },
    });
    return serializePrecoFiscal(item);
  },

  async updatePrecoProduto(id: string, input: any) {
    const existing = await prisma.fiscalPrecoProduto.findUnique({ where: { id } });
    if (!existing) throw new AppError(404, "Tabela de preço não encontrada.");

    const produtoId = input?.produtoId !== undefined ? cleanId(input.produtoId) : existing.produtoId;
    const clienteId = input?.clienteId !== undefined
      ? (cleanId(input.clienteId) || null)
      : existing.clienteId;
    const vigenciaInicio = input?.vigenciaInicio !== undefined
      ? parseDateOnly(cleanId(input.vigenciaInicio))
      : existing.vigenciaInicio;
    const custoUnitarioLebrinha = input?.custoUnitarioLebrinha !== undefined
      ? cleanMoney(input.custoUnitarioLebrinha, "Custo unitário da Lebrinha")
      : number(existing.custoUnitarioLebrinha);
    const vendaUnitarioCliente = input?.vendaUnitarioCliente !== undefined
      ? cleanMoney(input.vendaUnitarioCliente, "Valor unitário pago pelo cliente")
      : number(existing.vendaUnitarioCliente);

    const [produto, cliente] = await Promise.all([
      prisma.produto.findUnique({ where: { id: produtoId }, select: { id: true } }),
      clienteId
        ? prisma.cliente.findUnique({ where: { id: clienteId }, select: { id: true } })
        : Promise.resolve(null),
    ]);
    if (!produto) throw new AppError(400, "Produto não encontrado.");
    if (clienteId && !cliente) throw new AppError(400, "Cliente não encontrado.");

    const duplicate = await prisma.fiscalPrecoProduto.findFirst({
      where: {
        id: { not: id },
        produtoId,
        clienteId,
        vigenciaInicio,
      },
      select: { id: true },
    });
    if (duplicate) {
      throw new AppError(
        409,
        "Já existe uma tabela para este produto/cliente com a mesma data de vigência.",
      );
    }

    const item = await prisma.fiscalPrecoProduto.update({
      where: { id },
      data: {
        produtoId,
        clienteId,
        vigenciaInicio,
        custoUnitarioLebrinha,
        vendaUnitarioCliente,
      },
      include: {
        produto: { select: { id: true, nome: true, codigoInterno: true } },
        cliente: { select: { id: true, nomeFantasia: true, codigoInterno: true } },
      },
    });
    return serializePrecoFiscal(item);
  },

  async removePrecoProduto(id: string) {
    const existing = await prisma.fiscalPrecoProduto.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!existing) throw new AppError(404, "Tabela de preço não encontrada.");
    await prisma.fiscalPrecoProduto.delete({ where: { id } });
    return { ok: true };
  },

  async rentabilidade(period: FiscalPeriod = {}) {
    const range = dateRange(period.from, period.to);

    const manifestos = await prisma.manifesto.findMany({
      where: range ? { dataManifesto: range } : undefined,
      select: {
        id: true,
        dataManifesto: true,
        tipoManifesto: true,
        romaneios: true,
        placaVeiculo: true,
        clienteId: true,
        cliente: {
          select: {
            id: true,
            nomeFantasia: true,
            codigoInterno: true,
          },
        },
        produtos: {
          select: {
            id: true,
            produtoId: true,
            clienteId: true,
            romaneio: true,
            notaFiscal: true,
            serieNf: true,
            quantidade: true,
            valorUnitario: true,
            valorTotal: true,
            tipoManifesto: true,
            pagoCliente: true,
            produto: {
              select: {
                id: true,
                nome: true,
                codigoInterno: true,
              },
            },
            cliente: {
              select: {
                id: true,
                nomeFantasia: true,
                codigoInterno: true,
              },
            },
          },
        },
      },
      orderBy: [{ dataManifesto: "desc" }, { createdAt: "desc" }],
    });

    const linhas: any[] = [];

    for (const manifesto of manifestos) {
      for (const item of manifesto.produtos) {
        const tipo = item.tipoManifesto ?? manifesto.tipoManifesto;
        if (tipo === "VASILHAME") continue;

        const cliente = item.cliente ?? manifesto.cliente;
        const quantidade = number(item.quantidade);
        const valorUnitario = number(item.valorUnitario);
        const valorTotal = number(item.valorTotal);

        linhas.push({
          id: item.id,
          manifestoId: manifesto.id,
          dataManifesto: formatDateOnly(manifesto.dataManifesto),
          romaneio: item.romaneio || manifesto.romaneios || "",
          notaFiscal: item.notaFiscal || "",
          serieNf: item.serieNf || "",
          placa: manifesto.placaVeiculo || "",
          clienteId: item.clienteId ?? manifesto.clienteId,
          clienteNome: cliente?.nomeFantasia || "Cliente não identificado",
          clienteCodigo: cliente?.codigoInterno || "",
          produtoId: item.produtoId,
          produtoNome: item.produto.nome,
          produtoCodigo: item.produto.codigoInterno,
          quantidade: roundMoney(quantidade),
          valorUnitario: roundMoney(valorUnitario),
          valorTotal: roundMoney(valorTotal),
          tipo: fiscalTipoLabel(tipo),
          tipoDb: tipo,
          pagoCliente: item.pagoCliente ?? null,
        });
      }
    }

    const groups = new Map<string, any>();

    for (const row of linhas) {
      const key = `${row.clienteId}:${row.produtoId}`;
      const group = groups.get(key) ?? {
        key,
        clienteId: row.clienteId,
        clienteNome: row.clienteNome,
        clienteCodigo: row.clienteCodigo,
        produtoId: row.produtoId,
        produtoNome: row.produtoNome,
        produtoCodigo: row.produtoCodigo,

        quantidadeCliente: 0,
        receberCliente: 0,
        recebidoCliente: 0,
        aReceberCliente: 0,

        quantidadeAcertarLebrinha: 0,
        acertarLebrinha: 0,

        quantidadeBonificacaoLebrinha: 0,
        bonificacaoLebrinha: 0,

        romaneios: new Set<string>(),
        notasFiscais: new Set<string>(),
        placas: new Set<string>(),
        linhas: 0,
      };

      if (row.tipoDb === "RECEBER_CLIENTE") {
        group.quantidadeCliente += row.quantidade;
        group.receberCliente += row.valorTotal;

        if (row.pagoCliente === true) {
          group.recebidoCliente += row.valorTotal;
        } else {
          group.aReceberCliente += row.valorTotal;
        }
      } else if (row.tipoDb === "ACERTAR_LEBRINHA") {
        group.quantidadeAcertarLebrinha += row.quantidade;
        group.acertarLebrinha += row.valorTotal;
      } else if (row.tipoDb === "BONIFICACAO_LEBRINHA") {
        group.quantidadeBonificacaoLebrinha += row.quantidade;
        group.bonificacaoLebrinha += row.valorTotal;
      }

      if (row.romaneio) group.romaneios.add(row.romaneio);
      if (row.notaFiscal) group.notasFiscais.add(row.notaFiscal);
      if (row.placa) group.placas.add(row.placa);
      group.linhas += 1;

      groups.set(key, group);
    }

    const agrupado = Array.from(groups.values())
      .map((group) => {
        const quantidadeLebrinha =
          group.quantidadeAcertarLebrinha + group.quantidadeBonificacaoLebrinha;
        const totalLebrinha = group.acertarLebrinha + group.bonificacaoLebrinha;

        const valorUnitarioCliente =
          group.quantidadeCliente > 0
            ? group.receberCliente / group.quantidadeCliente
            : 0;

        const valorUnitarioAcertarLebrinha =
          group.quantidadeAcertarLebrinha > 0
            ? group.acertarLebrinha / group.quantidadeAcertarLebrinha
            : 0;

        const valorUnitarioBonificacao =
          group.quantidadeBonificacaoLebrinha > 0
            ? group.bonificacaoLebrinha / group.quantidadeBonificacaoLebrinha
            : 0;

        const valorUnitarioLebrinha =
          quantidadeLebrinha > 0
            ? totalLebrinha / quantidadeLebrinha
            : 0;

        const diferencaClienteLebrinha =
          group.receberCliente - totalLebrinha;

        const diferencaUnitario =
          valorUnitarioCliente - valorUnitarioLebrinha;

        const percentualDiferenca =
          group.receberCliente > 0
            ? (diferencaClienteLebrinha / group.receberCliente) * 100
            : 0;

        return {
          key: group.key,
          clienteId: group.clienteId,
          clienteNome: group.clienteNome,
          clienteCodigo: group.clienteCodigo,
          produtoId: group.produtoId,
          produtoNome: group.produtoNome,
          produtoCodigo: group.produtoCodigo,

          quantidadeCliente: roundMoney(group.quantidadeCliente),
          valorUnitarioCliente: roundMoney(valorUnitarioCliente),
          receberCliente: roundMoney(group.receberCliente),
          recebidoCliente: roundMoney(group.recebidoCliente),
          aReceberCliente: roundMoney(group.aReceberCliente),

          quantidadeAcertarLebrinha: roundMoney(group.quantidadeAcertarLebrinha),
          valorUnitarioAcertarLebrinha: roundMoney(valorUnitarioAcertarLebrinha),
          acertarLebrinha: roundMoney(group.acertarLebrinha),

          quantidadeBonificacaoLebrinha: roundMoney(group.quantidadeBonificacaoLebrinha),
          valorUnitarioBonificacao: roundMoney(valorUnitarioBonificacao),
          bonificacaoLebrinha: roundMoney(group.bonificacaoLebrinha),

          quantidadeLebrinha: roundMoney(quantidadeLebrinha),
          valorUnitarioLebrinha: roundMoney(valorUnitarioLebrinha),
          totalLebrinha: roundMoney(totalLebrinha),

          diferencaUnitario: roundMoney(diferencaUnitario),
          diferencaClienteLebrinha: roundMoney(diferencaClienteLebrinha),
          percentualDiferenca,

          romaneios: Array.from(group.romaneios),
          notasFiscais: Array.from(group.notasFiscais),
          placas: Array.from(group.placas),
          linhas: group.linhas,
        };
      })
      .sort((a, b) =>
        b.receberCliente - a.receberCliente ||
        a.clienteNome.localeCompare(b.clienteNome, "pt-BR") ||
        a.produtoNome.localeCompare(b.produtoNome, "pt-BR")
      );

    const receberCliente = linhas
      .filter((row) => row.tipoDb === "RECEBER_CLIENTE")
      .reduce((sum, row) => sum + row.valorTotal, 0);

    const recebidoCliente = linhas
      .filter((row) => row.tipoDb === "RECEBER_CLIENTE" && row.pagoCliente === true)
      .reduce((sum, row) => sum + row.valorTotal, 0);

    const aReceberCliente = linhas
      .filter((row) => row.tipoDb === "RECEBER_CLIENTE" && row.pagoCliente !== true)
      .reduce((sum, row) => sum + row.valorTotal, 0);

    const acertarLebrinha = linhas
      .filter((row) => row.tipoDb === "ACERTAR_LEBRINHA")
      .reduce((sum, row) => sum + row.valorTotal, 0);

    const bonificacaoLebrinha = linhas
      .filter((row) => row.tipoDb === "BONIFICACAO_LEBRINHA")
      .reduce((sum, row) => sum + row.valorTotal, 0);

    const totalLebrinha = acertarLebrinha + bonificacaoLebrinha;
    const diferencaClienteLebrinha = receberCliente - totalLebrinha;

    const romaneiosUnicos = new Set(
      linhas.flatMap((row) =>
        String(row.romaneio || "")
          .split(",")
          .map((value) => value.trim())
          .filter(Boolean)
      )
    );

    const clientesUnicos = new Set(linhas.map((row) => row.clienteId).filter(Boolean));
    const produtosUnicos = new Set(linhas.map((row) => row.produtoId).filter(Boolean));

    return {
      periodo: {
        from: period.from ?? null,
        to: period.to ?? null,
      },
      resumo: {
        receberCliente: roundMoney(receberCliente),
        recebidoCliente: roundMoney(recebidoCliente),
        aReceberCliente: roundMoney(aReceberCliente),
        acertarLebrinha: roundMoney(acertarLebrinha),
        bonificacaoLebrinha: roundMoney(bonificacaoLebrinha),
        totalLebrinha: roundMoney(totalLebrinha),
        diferencaClienteLebrinha: roundMoney(diferencaClienteLebrinha),
        romaneios: romaneiosUnicos.size,
        clientes: clientesUnicos.size,
        produtos: produtosUnicos.size,
        linhas: linhas.length,
      },
      agrupado,
      linhas,
    };
  },
};
