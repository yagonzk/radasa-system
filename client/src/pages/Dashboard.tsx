import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AnimatedNumber } from "@/components/ui/animated-number";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import {
  Truck, WalletCards, TrendingUp, Fuel, Route, AlertTriangle,
  Wrench, ArrowRight, Building2, CalendarDays, Activity,
  type LucideIcon,
} from "lucide-react";

const money = (value: number) => Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (value: number) => Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits: 1 });
const dateBR = (value?: string) => {
  if (!value) return "—";
  const iso = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return iso ? `${iso[3]}/${iso[2]}/${iso[1]}` : value;
};

type DashboardData = {
  periodo?: { from?: string; to?: string };
  operacao?: { emAndamento?: number; km?: number; combustivel?: number };
  frota?: { osAbertas?: number };
  viagensRecentes?: Array<{ id: string; codigo?: string; data?: string; placa?: string; destino?: string; frete?: number }>;
  parcial?: boolean;
  indisponiveis?: string[];
};
type Financeiro = { receitas?: number; resultado?: number; aReceber?: number; aPagar?: number; projecao7?: number; projecao30?: number };
type Alerta = { id: string; href?: string; nivel?: string; titulo?: string; detalhe?: string };
type RankingRow = { id: string; nome: string; margem?: number; viagens?: number; resultado?: number };
type Rankings = { rankingVeiculos?: RankingRow[]; rankingClientes?: RankingRow[] };

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [financeiro, setFinanceiro] = useState<Financeiro | null>(null);
  const [alertas, setAlertas] = useState<Alerta[] | null>(null);
  const [rankings, setRankings] = useState<Rankings | null>(null);
  const [loading, setLoading] = useState(true);
  const [financeLoading, setFinanceLoading] = useState(true);
  const [alertsLoading, setAlertsLoading] = useState(true);
  const [rankingsLoading, setRankingsLoading] = useState(false);
  const [error, setError] = useState("");
  const [financeError, setFinanceError] = useState("");
  const [alertsError, setAlertsError] = useState("");
  const [rankingsError, setRankingsError] = useState("");

  const loadDashboard = useCallback(async (silent = false) => {
    if (!silent) { setLoading(true); setFinanceLoading(true); setAlertsLoading(true); }
    try {
      const core = await api.get<DashboardData>("/dashboard/gerencial");
      setData(core.data);
      setError("");
    } catch (e: any) {
      setError(e?.response?.data?.message || "Não foi possível carregar a Visão Geral.");
    } finally { setLoading(false); }

    try {
      const fin = await api.get<{ financeiro?: Financeiro }>("/dashboard/financeiro");
      setFinanceiro(fin.data?.financeiro || {});
      setFinanceError("");
    } catch (e: any) {
      setFinanceError(e?.response?.data?.message || "Financeiro indisponível nesta atualização.");
    } finally { setFinanceLoading(false); }

    try {
      const alerts = await api.get<Alerta[]>("/dashboard/alertas", { params: { limit: 12 } });
      setAlertas(Array.isArray(alerts.data) ? alerts.data : []);
      setAlertsError("");
    } catch (e: any) {
      setAlertsError(e?.response?.data?.message || "Alertas indisponíveis nesta atualização.");
    } finally { setAlertsLoading(false); }
  }, []);

  useEffect(() => { void loadDashboard(false); }, [loadDashboard]);
  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "dashboard")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void loadDashboard(true); }, 250);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => { if (timer) window.clearTimeout(timer); window.removeEventListener(REALTIME_CHANGE_EVENT, handler); };
  }, [loadDashboard]);

  const loadRankings = async () => {
    if (rankingsLoading) return;
    setRankingsLoading(true);
    setRankingsError("");
    try {
      const response = await api.get<Rankings>("/dashboard/rankings");
      setRankings(response.data);
    } catch (e: any) {
      setRankingsError(e?.response?.data?.message || "Não foi possível carregar os rankings.");
    } finally { setRankingsLoading(false); }
  };

  const cards: Array<{ label: string; value: number; format: (value: number) => string; loading?: boolean; icon: LucideIcon; tone: string; tint: string }> = [
    { label: "Faturamento do mês", value: financeiro?.receitas || 0, format: money, loading: financeLoading, icon: TrendingUp, tone: "text-primary", tint: "bg-primary/10" },
    { label: "Resultado", value: financeiro?.resultado || 0, format: money, loading: financeLoading, icon: WalletCards, tone: "text-amber-600 dark:text-amber-300", tint: "bg-amber-100 dark:bg-amber-400/15" },
    { label: "Acertos de viagem", value: data?.operacao?.emAndamento || 0, format: (n) => String(Math.round(n)), icon: Route, tone: "text-sky-600 dark:text-sky-300", tint: "bg-sky-100 dark:bg-sky-400/15" },
    { label: "KM rodado", value: data?.operacao?.km || 0, format: (n) => `${num(n)} km`, icon: Truck, tone: "text-primary", tint: "bg-primary/10" },
    { label: "Combustível", value: data?.operacao?.combustivel || 0, format: money, icon: Fuel, tone: "text-amber-600 dark:text-amber-300", tint: "bg-amber-100 dark:bg-amber-400/15" },
    { label: "OS abertas", value: data?.frota?.osAbertas || 0, format: (n) => String(Math.round(n)), icon: Wrench, tone: "text-emerald-600 dark:text-emerald-300", tint: "bg-emerald-100 dark:bg-emerald-400/15" },
  ];

  return (
    <Layout>
      <div className="mx-auto w-full max-w-7xl space-y-5 sm:space-y-6">
        <section className="relative isolate overflow-hidden rounded-[2rem] bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-500 px-5 py-7 text-white shadow-[0_20px_50px_rgba(99,102,241,0.2)] sm:px-8 sm:py-8">
          <div aria-hidden="true" className="pointer-events-none absolute -right-12 -top-24 h-64 w-64 rounded-full border-[40px] border-white/10" />
          <div aria-hidden="true" className="pointer-events-none absolute -bottom-28 left-1/3 h-56 w-56 rounded-full bg-white/10 blur-3xl" />
          <div className="relative flex flex-wrap items-end justify-between gap-6">
            <div className="space-y-3">
              <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/15 px-3 py-1 text-[11px] font-semibold tracking-wide backdrop-blur">
                <Activity className="h-3.5 w-3.5" /> PAINEL GERENCIAL
              </span>
              <div>
                <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Visão Geral</h1>
                <p className="mt-2 max-w-md text-sm text-indigo-50/95">Resumo do que exige atenção agora na operação.</p>
              </div>
            </div>
            <div className="inline-flex items-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-4 py-3 text-xs font-medium text-white backdrop-blur sm:text-sm">
              <CalendarDays className="h-4 w-4 shrink-0" />
              <span>Período: {dateBR(data?.periodo?.from)} a {dateBR(data?.periodo?.to)}</span>
            </div>
          </div>
        </section>

        {loading && <div role="status" className="rounded-2xl border border-border bg-card p-4 text-sm text-muted-foreground">Carregando resumo operacional...</div>}
        {error && <div role="alert" className="rounded-2xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">{error}</div>}
        {data?.parcial && <div role="status" className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700 dark:text-amber-300">Alguns indicadores operacionais não responderam nesta atualização ({(data.indisponiveis || []).join(", ")}). Os demais dados continuam disponíveis.</div>}

        <section aria-label="Indicadores principais" className="radasa-kpi-grid radasa-stagger">
          {cards.map(({ label, value, format, loading: cardLoading, icon: Icon, tone, tint }) => (
            <Card key={label} className="card-hover radasa-interactive-card min-w-0 gap-0 rounded-[1.6rem] py-0">
              <CardContent className="flex h-full min-w-0 flex-col gap-5 p-4 sm:p-5">
                <div className={`flex h-11 w-11 items-center justify-center rounded-2xl ${tint} ${tone}`}><Icon className="h-5 w-5" /></div>
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold tracking-wide text-muted-foreground">{label}</p>
                  <p className="mt-1.5 break-words text-[clamp(1rem,1.35vw,1.4rem)] font-bold tracking-tight tabular-nums text-foreground">{cardLoading ? "…" : <AnimatedNumber value={value} format={format} />}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </section>

        <div className="grid items-stretch gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between gap-3">
              <CardTitle className="flex items-center gap-2 text-base"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-amber-100 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300"><AlertTriangle className="h-4 w-4" /></span> Alertas prioritários</CardTitle>
              <Link href="/alertas" className="shrink-0 text-xs font-semibold text-primary hover:underline">Ver todos</Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {alertsLoading ? <p className="text-sm text-muted-foreground">Carregando alertas...</p>
                : alertsError ? <p className="text-sm text-amber-700 dark:text-amber-300">{alertsError}</p>
                : (alertas || []).length === 0 ? <p className="rounded-2xl bg-muted/60 p-4 text-sm text-muted-foreground">Nenhum alerta prioritário no momento.</p>
                : (alertas || []).slice(0, 6).map(a => (
                  <Link href={a.href || "/alertas"} key={a.id} className="flex items-start gap-3 rounded-2xl border border-border/80 bg-background/30 p-3 transition hover:border-primary/25 hover:bg-accent/40">
                    <AlertTriangle className={`mt-0.5 h-4 w-4 shrink-0 ${a.nivel === "VENCIDO" ? "text-red-600" : "text-amber-500"}`} />
                    <div className="min-w-0"><div className="text-sm font-medium">{a.titulo}</div><div className="mt-0.5 text-xs text-muted-foreground">{a.detalhe}</div></div>
                  </Link>
                ))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 text-base"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-100 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300"><WalletCards className="h-4 w-4" /></span> Fluxo de caixa</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 gap-3">
              {financeLoading ? <div className="col-span-2 py-4 text-sm text-muted-foreground">Carregando financeiro sem bloquear a página...</div>
                : financeError ? <div className="col-span-2 py-4 text-sm text-amber-700 dark:text-amber-300">{financeError}</div>
                : <>
                    <Mini label="A receber" value={money(financeiro?.aReceber || 0)} />
                    <Mini label="A pagar" value={money(financeiro?.aPagar || 0)} />
                    <Mini label="Projeção 7 dias" value={money(financeiro?.projecao7 || 0)} />
                    <Mini label="Projeção 30 dias" value={money(financeiro?.projecao30 || 0)} />
                  </>}
              <Link href="/financeiro" className="col-span-2 inline-flex items-center justify-end gap-1 text-sm font-semibold text-primary hover:underline">Abrir DRE Operacional <ArrowRight className="h-4 w-4" /></Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          {rankings
            ? <><Ranking title="Rentabilidade por caminhão" icon={Truck} rows={rankings.rankingVeiculos || []} /><Ranking title="Rentabilidade por cliente" icon={Building2} rows={rankings.rankingClientes || []} /></>
            : <Card className="xl:col-span-2">
                <CardHeader><CardTitle className="text-base">Análises de rentabilidade</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap items-center justify-between gap-4">
                  <div><p className="text-sm text-muted-foreground">Os rankings detalhados ficam sob demanda para evitar uma análise pesada toda vez que a Visão Geral é aberta.</p>{rankingsError && <p className="mt-2 text-sm text-amber-700 dark:text-amber-300">{rankingsError}</p>}</div>
                  <Button onClick={() => void loadRankings()} disabled={rankingsLoading}>{rankingsLoading ? "Calculando rankings..." : "Carregar rankings"}</Button>
                </CardContent>
              </Card>}
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-3"><CardTitle className="text-base">Acertos de viagem recentes</CardTitle><Link href="/viagens" className="shrink-0 text-xs font-semibold text-primary hover:underline">Abrir acertos</Link></CardHeader>
          <CardContent className="min-w-0 overflow-x-auto">
            <table className="w-full min-w-[700px] text-sm">
              <thead><tr className="border-b text-left text-xs font-semibold text-muted-foreground"><th className="px-3 pb-3">Código</th><th>Data</th><th>Placa</th><th>Destino</th><th className="pr-3 text-right">Frete</th></tr></thead>
              <tbody>{(data?.viagensRecentes || []).map(v => (
                <tr key={v.id} className="border-b border-border/70 last:border-0 hover:bg-muted/40"><td className="px-3 py-3 font-medium">{v.codigo || "—"}</td><td>{dateBR(v.data)}</td><td>{v.placa || "—"}</td><td>{v.destino || "—"}</td><td className="pr-3 text-right font-semibold tabular-nums">{money(v.frete || 0)}</td></tr>
              ))}</tbody>
            </table>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return <div className="min-w-0 rounded-2xl border border-border/70 bg-muted/45 p-3 sm:p-4"><div className="text-xs font-medium text-muted-foreground">{label}</div><div className="mt-2 break-words text-base font-bold tracking-tight tabular-nums sm:text-lg">{value}</div></div>;
}

function Ranking({ title, icon: Icon, rows }: { title: string; icon: LucideIcon; rows: RankingRow[] }) {
  return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4 text-primary" />{title}</CardTitle></CardHeader><CardContent className="space-y-2">{rows.length === 0 ? <p className="text-sm text-muted-foreground">Sem dados no período.</p> : rows.map((r, i) => <div key={r.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border/70 bg-muted/30 p-3"><div><div className="text-sm font-medium">{i + 1}. {r.nome}</div><div className="text-xs text-muted-foreground">Margem {Number(r.margem || 0).toFixed(1)}% · {r.viagens} viagem(ns)</div></div><strong className="tabular-nums">{money(r.resultado || 0)}</strong></div>)}</CardContent></Card>;
}
