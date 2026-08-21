import { prisma } from "../lib/prisma.js";
import { parseDateOnly } from "../utils/date.js";
import { number } from "../utils/serialize.js";

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
  diariasChapas: number;
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
    diariasChapas: 0,
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

    const diariasChapas = viagens.reduce((sum, item) => {
      const valor = number(item.valorDiaria) + number(item.valorChapa);
      addMonth(meses, item.dataManifesto, "diariasChapas", valor);
      return sum + valor;
    }, 0);

    const pneusManutencao = pneusRecapagens + pneusConsertos;
    const despesas = abastecimento + comissoes + almoxarifadoValor + pneusCompra + pneusManutencao + pedagios + diariasChapas;
    const resultado = faturamento - despesas;
    const margem = faturamento > 0 ? (resultado / faturamento) * 100 : 0;

    const mensal = Array.from(meses.values())
      .map((row) => {
        const despesasMes = row.abastecimento + row.comissoes + row.almoxarifado + row.pneusCompra + row.pneusManutencao + row.pedagios + row.diariasChapas;
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
        diariasChapas,
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
      },
      mensal,
    };
  },
};
