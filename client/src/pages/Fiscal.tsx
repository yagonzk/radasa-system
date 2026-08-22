import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import * as XLSX from "xlsx";
import Layout from "@/components/Layout";
import FiscalRentabilidade from "@/components/fiscal/FiscalRentabilidade";
import { api } from "@/lib/api";
import { formatBRL } from "@/lib/exportUtils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { DatePicker } from "@/components/ui/date-picker";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ArrowDownRight,
  ArrowUpRight,
  CalendarDays,
  FileSpreadsheet,
  Fuel,
  HandCoins,
  LoaderCircle,
  PackageOpen,
  ReceiptText,
  RefreshCcw,
  TrendingDown,
  TrendingUp,
  Truck,
  WalletCards,
  CircleDotDashed,
} from "lucide-react";
import { toast } from "sonner";

type FiscalMonthlyRow = {
  mes: string;
  label: string;
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

type FiscalData = {
  periodo: { from: string | null; to: string | null };
  resumo: {
    faturamento: number;
    despesas: number;
    resultado: number;
    margem: number;
    recebidoCliente: number;
    aReceberCliente: number;
  };
  receitas: {
    receberCliente: number;
    acertarLebrinha: number;
    bonificacaoLebrinha: number;
    total: number;
  };
  despesas: {
    abastecimento: number;
    comissoes: number;
    almoxarifado: number;
    pneusCompra: number;
    pneusManutencao: number;
    pedagios: number;
    diarias: number;
  chapas: number;
    total: number;
  };
  contagens: {
    romaneios: number;
    abastecimentos: number;
    fechamentos: number;
    almoxarifado: number;
    pneusCompras: number;
    pneusManutencoes: number;
    viagens: number;
    diarias: number;
    chapas: number;
  };
  mensal: FiscalMonthlyRow[];
};

function toDateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function currentMonthPeriod() {
  const now = new Date();
  return {
    from: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)),
    to: toDateInput(now),
  };
}

function last30DaysPeriod() {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29);
  return { from: toDateInput(from), to: toDateInput(now) };
}

function percent(value: number) {
  return `${Number(value || 0).toLocaleString("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`;
}

function SummaryCard({
  title,
  value,
  detail,
  icon,
}: {
  title: string;
  value: string;
  detail: string;
  icon: ReactNode;
}) {
  return (
    <Card className="min-w-0 overflow-hidden">
      <CardContent className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
            <p className="mt-2 truncate text-2xl font-bold tabular-nums text-foreground" title={value}>{value}</p>
            <p className="mt-1 text-xs text-muted-foreground">{detail}</p>
          </div>
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownRow({ label, value, total, icon }: { label: string; value: number; total: number; icon: ReactNode }) {
  const width = total > 0 ? Math.min(100, (value / total) * 100) : 0;
  return (
    <div className="space-y-2 rounded-lg border p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-2 text-sm font-medium">
          <span className="shrink-0 text-muted-foreground">{icon}</span>
          <span className="truncate">{label}</span>
        </div>
        <span className="shrink-0 text-sm font-semibold tabular-nums">{formatBRL(value)}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

export default function Fiscal() {
  const initial = useMemo(currentMonthPeriod, []);
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [data, setData] = useState<FiscalData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await api.get<FiscalData>("/fiscal/resumo", {
        params: { from: from || undefined, to: to || undefined },
      });
      setData(response.data);
    } catch (error: any) {
      console.error("Falha ao carregar o Fiscal.", error);
      toast.error(error?.response?.data?.message || "Não foi possível carregar os dados fiscais.");
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    void load();
  }, [load]);

  const applyCurrentMonth = () => {
    const period = currentMonthPeriod();
    setFrom(period.from);
    setTo(period.to);
  };

  const applyLast30Days = () => {
    const period = last30DaysPeriod();
    setFrom(period.from);
    setTo(period.to);
  };

  const clearPeriod = () => {
    setFrom("");
    setTo("");
  };

  const exportXlsx = () => {
    if (!data) return;

    const workbook = XLSX.utils.book_new();
    const resumo = [
      ["Indicador", "Valor"],
      ["Faturamento Romaneios", data.resumo.faturamento],
      ["Despesas operacionais", data.resumo.despesas],
      ["Resultado estimado", data.resumo.resultado],
      ["Margem (%)", data.resumo.margem],
      ["Recebido de clientes", data.resumo.recebidoCliente],
      ["A receber de clientes", data.resumo.aReceberCliente],
    ];
    const wsResumo = XLSX.utils.aoa_to_sheet(resumo);
    wsResumo["!cols"] = [{ wch: 32 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, wsResumo, "Resumo");

    const receitas = [
      ["Receita", "Valor"],
      ["Receber c/ Cliente", data.receitas.receberCliente],
      ["Acertar c/ Lebrinha", data.receitas.acertarLebrinha],
      ["Bonificação Lebrinha", data.receitas.bonificacaoLebrinha],
      ["Total", data.receitas.total],
    ];
    const wsReceitas = XLSX.utils.aoa_to_sheet(receitas);
    wsReceitas["!cols"] = [{ wch: 28 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, wsReceitas, "Receitas");

    const despesas = [
      ["Despesa", "Valor"],
      ["Abastecimento", data.despesas.abastecimento],
      ["Comissões", data.despesas.comissoes],
      ["Almoxarifado - entradas", data.despesas.almoxarifado],
      ["Pneus - compras", data.despesas.pneusCompra],
      ["Pneus - manutenção", data.despesas.pneusManutencao],
      ["Pedágios - viagens", data.despesas.pedagios],
      ["Diárias - viagens", data.despesas.diarias],
      ["Chapas - viagens", data.despesas.chapas],
      ["Total", data.despesas.total],
    ];
    const wsDespesas = XLSX.utils.aoa_to_sheet(despesas);
    wsDespesas["!cols"] = [{ wch: 30 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(workbook, wsDespesas, "Despesas");

    const mensal = [
      ["Mês", "Faturamento", "Abastecimento", "Comissões", "Almoxarifado", "Pneus compra", "Pneus manutenção", "Pedágios", "Diárias", "Chapas", "Despesas", "Resultado"],
      ...data.mensal.map((row) => [
        row.label,
        row.faturamento,
        row.abastecimento,
        row.comissoes,
        row.almoxarifado,
        row.pneusCompra,
        row.pneusManutencao,
        row.pedagios,
        row.diarias,
        row.chapas,
        row.despesas,
        row.resultado,
      ]),
    ];
    const wsMensal = XLSX.utils.aoa_to_sheet(mensal);
    wsMensal["!cols"] = [{ wch: 14 }, ...Array.from({ length: 11 }, () => ({ wch: 18 }))];
    XLSX.utils.book_append_sheet(workbook, wsMensal, "Comparativo mensal");

    XLSX.writeFile(workbook, `fiscal-${from || "inicio"}-${to || "atual"}.xlsx`, { compression: true });
    toast.success("Relatório fiscal XLSX exportado.");
  };

  const despesasRows = data ? [
    ["Abastecimento", data.despesas.abastecimento, <Fuel className="h-4 w-4" />],
    ["Comissões", data.despesas.comissoes, <HandCoins className="h-4 w-4" />],
    ["Almoxarifado (entradas)", data.despesas.almoxarifado, <PackageOpen className="h-4 w-4" />],
    ["Pneus (compras)", data.despesas.pneusCompra, <CircleDotDashed className="h-4 w-4" />],
    ["Pneus (manutenção)", data.despesas.pneusManutencao, <CircleDotDashed className="h-4 w-4" />],
    ["Pedágios (viagens)", data.despesas.pedagios, <Truck className="h-4 w-4" />],
    [`Diárias (viagens) · ${data.contagens.diarias} lançamento(s)`, data.despesas.diarias, <WalletCards className="h-4 w-4" />],
    [`Chapas (viagens) · ${data.contagens.chapas} lançamento(s)`, data.despesas.chapas, <WalletCards className="h-4 w-4" />],
  ] as const : [];

  return (
    <Layout>
      <div className="w-full min-w-0 space-y-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-display text-2xl font-bold text-foreground">Comercial</h1>
              <Badge variant="outline">Faturamento x despesas</Badge>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Compare faturamento e despesas e acompanhe a rentabilidade por cliente, produto e frete.
            </p>
          </div>
          <Button variant="outline" disabled={!data || loading} onClick={exportXlsx}>
            <FileSpreadsheet className="mr-2 h-4 w-4" />Exportar XLSX
          </Button>
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">De</Label>
                  <DatePicker value={from} onChange={setFrom} className="w-full sm:w-44" placeholder="Data inicial" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Até</Label>
                  <DatePicker value={to} onChange={setTo} className="w-full sm:w-44" placeholder="Data final" />
                </div>
                <Button variant="outline" onClick={applyCurrentMonth}><CalendarDays className="mr-2 h-4 w-4" />Mês atual</Button>
                <Button variant="outline" onClick={applyLast30Days}>Últimos 30 dias</Button>
                <Button variant="ghost" onClick={clearPeriod}>Todo período</Button>
              </div>
              <Button variant="ghost" size="icon" onClick={() => void load()} disabled={loading} title="Atualizar dados">
                <RefreshCcw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="visao-geral" className="space-y-4">
          <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 sm:w-fit">
            <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
            <TabsTrigger value="analise-romaneios">Análise Romaneios</TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-0 space-y-4">
            {loading && !data ? (
              <div className="flex min-h-[320px] items-center justify-center rounded-xl border bg-card">
            <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : data ? (
          <>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <SummaryCard
                title="Faturamento Romaneios"
                value={formatBRL(data.resumo.faturamento)}
                detail={`${data.contagens.romaneios} romaneio(s) no período`}
                icon={<TrendingUp className="h-5 w-5" />}
              />
              <SummaryCard
                title="Despesas operacionais"
                value={formatBRL(data.resumo.despesas)}
                detail="Combustível + custos cadastrados"
                icon={<TrendingDown className="h-5 w-5" />}
              />
              <SummaryCard
                title="Resultado estimado"
                value={formatBRL(data.resumo.resultado)}
                detail={data.resumo.resultado >= 0 ? "Faturamento acima das despesas" : "Despesas acima do faturamento"}
                icon={data.resumo.resultado >= 0 ? <ArrowUpRight className="h-5 w-5" /> : <ArrowDownRight className="h-5 w-5" />}
              />
              <SummaryCard
                title="Margem estimada"
                value={percent(data.resumo.margem)}
                detail={`${formatBRL(data.resumo.aReceberCliente)} a receber de clientes`}
                icon={<ReceiptText className="h-5 w-5" />}
              />
            </div>

            <div className="grid gap-4 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Composição do faturamento</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <BreakdownRow label="Receber c/ Cliente" value={data.receitas.receberCliente} total={data.receitas.total} icon={<ReceiptText className="h-4 w-4" />} />
                  <BreakdownRow label="Acertar c/ Lebrinha" value={data.receitas.acertarLebrinha} total={data.receitas.total} icon={<WalletCards className="h-4 w-4" />} />
                  <BreakdownRow label="Bonificação Lebrinha" value={data.receitas.bonificacaoLebrinha} total={data.receitas.total} icon={<WalletCards className="h-4 w-4" />} />
                  <div className="grid gap-3 pt-2 sm:grid-cols-2">
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">Recebido de clientes</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatBRL(data.resumo.recebidoCliente)}</p>
                    </div>
                    <div className="rounded-lg border p-3">
                      <p className="text-xs text-muted-foreground">A receber de clientes</p>
                      <p className="mt-1 font-semibold tabular-nums">{formatBRL(data.resumo.aReceberCliente)}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Composição das despesas</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {despesasRows.map(([label, value, icon]) => (
                    <BreakdownRow key={label} label={label} value={value} total={data.despesas.total} icon={icon} />
                  ))}
                </CardContent>
              </Card>
            </div>


            <Card>
              <CardHeader>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <CardTitle className="text-base">Comparativo mensal</CardTitle>
                  <span className="text-xs text-muted-foreground">Faturamento, despesas e resultado por mês</span>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[1280px] text-sm">
                    <thead className="border-y bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                      <tr>
                        <th className="px-4 py-3 text-left">Mês</th>
                        <th className="px-3 py-3 text-right">Faturamento</th>
                        <th className="px-3 py-3 text-right">Abastecimento</th>
                        <th className="px-3 py-3 text-right">Comissões</th>
                        <th className="px-3 py-3 text-right">Almoxarifado</th>
                        <th className="px-3 py-3 text-right">Pneus</th>
                        <th className="px-3 py-3 text-right">Pedágios</th>
                        <th className="px-3 py-3 text-right">Diárias</th>
                        <th className="px-3 py-3 text-right">Chapas</th>
                        <th className="px-3 py-3 text-right">Despesas</th>
                        <th className="px-4 py-3 text-right">Resultado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.mensal.map((row) => (
                        <tr key={row.mes} className="border-b last:border-b-0">
                          <td className="px-4 py-3 font-semibold capitalize">{row.label}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatBRL(row.faturamento)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBRL(row.abastecimento)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBRL(row.comissoes)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBRL(row.almoxarifado)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBRL(row.pneusCompra + row.pneusManutencao)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBRL(row.pedagios)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBRL(row.diarias)}</td>
                          <td className="px-3 py-3 text-right tabular-nums">{formatBRL(row.chapas)}</td>
                          <td className="px-3 py-3 text-right font-semibold tabular-nums">{formatBRL(row.despesas)}</td>
                          <td className={`px-4 py-3 text-right font-bold tabular-nums ${row.resultado < 0 ? "text-destructive" : "text-primary"}`}>{formatBRL(row.resultado)}</td>
                        </tr>
                      ))}
                      {data.mensal.length === 0 && (
                        <tr><td colSpan={11} className="px-4 py-12 text-center text-muted-foreground">Nenhum movimento encontrado no período.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>

            <Card className="border-dashed">
              <CardContent className="p-4 text-xs leading-relaxed text-muted-foreground">
                <strong className="text-foreground">Critérios do Comercial:</strong> faturamento vem dos produtos dos Romaneios classificados como Receber c/ Cliente, Acertar c/ Lebrinha ou Bonificação Lebrinha. Vasilhames ficam fora do faturamento. Abastecimento usa o valor total das NFs. Almoxarifado considera entradas, pneus consideram compras/recapagens/consertos e pedágios usam a base de Viagens. <strong className="text-foreground">Diárias e Chapas são apuradas separadamente, cada uma pelo seu próprio campo em cada viagem.</strong> O valor de abastecimento da base de Viagens não é somado novamente para evitar duplicidade.
              </CardContent>
            </Card>
              </>
            ) : null}
          </TabsContent>

          <TabsContent value="analise-romaneios" className="mt-0">
            <FiscalRentabilidade from={from} to={to} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
