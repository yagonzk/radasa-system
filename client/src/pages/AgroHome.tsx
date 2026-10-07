import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BarChart3, Boxes, ClipboardList, Leaf, PackageCheck, Sprout, Tractor, TriangleAlert, Warehouse } from "lucide-react";
import AgroLayout from "@/components/agro/AgroLayout";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import type { AgroMovement, AgroReport } from "@/lib/agro";
import { formatAgroCurrency, formatAgroDate, formatAgroNumber, movementIsExit, movementLabel } from "@/lib/agro";

const quickLinks = [
  { title: "Estoque", description: "Produtos, lotes, custo médio e saldos.", href: "/agro/estoque", icon: Warehouse },
  { title: "Movimentações", description: "Entradas, saídas e ajustes de estoque.", href: "/agro/movimentacoes", icon: ClipboardList },
  { title: "Barracões e inventário", description: "Locais, transferências e contagem física.", href: "/agro/inventario", icon: Boxes },
  { title: "Lavouras", description: "Fazendas, talhões, safras e operações agrícolas.", href: "/agro/lavouras", icon: Sprout },
  { title: "Relatórios", description: "Consumo, custos e indicadores por hectare.", href: "/agro/relatorios", icon: BarChart3 },
];

type DashboardData = { produtosAtivos: number; produtosComSaldo: number; estoqueBaixo: number; valorEstoque: number; entradasMes: number; saidasMes: number; consumoMes: number; lotesVencendo: number; lavourasEmAndamento: number; operacoesMes: number; locaisAtivos: number; inventariosAbertos: number; recent: AgroMovement[]; };
function firstDay() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`; }
function today() { return new Date().toISOString().slice(0, 10); }

export default function AgroHome() {
  const [data, setData] = useState<DashboardData | null>(null); const [report, setReport] = useState<AgroReport | null>(null); const [loading, setLoading] = useState(true);
  const load = useCallback(async (silent = false) => { if (!silent) setLoading(true); try { const response = await api.get<DashboardData>("/agro/dashboard"); setData(response.data); api.get<AgroReport>("/agro/relatorios", { params: { from: firstDay(), to: today() } }).then((r) => setReport(r.data)).catch(() => undefined); } catch (error) { console.error("Falha ao carregar Dashboard Agro", error); } finally { if (!silent) setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { let timer: number | undefined; const handler = (event: Event) => { if (!realtimeChangeTouches(event, "agro", "agro/dashboard", "agro/estoque", "agro/movimentacoes", "agro/operacoes", "agro/inventarios", "agro/transferencias")) return; if (timer) clearTimeout(timer); timer = window.setTimeout(() => void load(true), 300); }; window.addEventListener(REALTIME_CHANGE_EVENT, handler); return () => { if (timer) clearTimeout(timer); window.removeEventListener(REALTIME_CHANGE_EVENT, handler); }; }, [load]);

  const stats = [
    { label: "Valor em estoque", value: formatAgroCurrency(data?.valorEstoque || 0), detail: `${data?.produtosComSaldo ?? 0} produtos com saldo`, icon: Boxes },
    { label: "Estoque baixo", value: data?.estoqueBaixo ?? 0, detail: "abaixo do mínimo", icon: TriangleAlert },
    { label: "Consumo no mês", value: formatAgroCurrency(data?.consumoMes || 0), detail: `${data?.saidasMes ?? 0} saídas`, icon: PackageCheck },
    { label: "Lotes a vencer", value: data?.lotesVencendo ?? 0, detail: "próximos 60 dias", icon: Warehouse },
    { label: "Lavouras ativas", value: data?.lavourasEmAndamento ?? 0, detail: `${data?.operacoesMes ?? 0} operações no mês`, icon: Sprout },
    { label: "Barracões", value: data?.locaisAtivos ?? 0, detail: `${data?.inventariosAbertos ?? 0} inventário(s) aberto(s)`, icon: Tractor },
  ];

  return <AgroLayout><div className="space-y-6">
    <div><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><Leaf className="h-4 w-4" />Radasa Agro</div><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Dashboard Agro</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Estoque, custos e lavouras em uma visão rápida, com atualização automática entre computadores.</p></div>
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{stats.map(({ label, value, detail, icon: Icon }) => <Card key={label}><CardContent className="flex items-center justify-between gap-4 p-5"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-xl font-bold">{loading && !data ? "—" : value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>)}</div>
    <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]"><div><h2 className="text-base font-semibold">Acesso rápido</h2><div className="mt-3 grid gap-3 sm:grid-cols-2">{quickLinks.map(({ title, description, href, icon: Icon }) => <Link key={href} href={href} className="group rounded-xl border bg-card p-4 transition hover:border-primary/30 hover:bg-accent/20"><div className="flex items-start justify-between"><div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div><ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary" /></div><div className="mt-3 font-semibold">{title}</div><p className="mt-1 text-sm text-muted-foreground">{description}</p></Link>)}</div></div>
      <div><div className="flex items-center justify-between"><h2 className="text-base font-semibold">Últimas movimentações</h2><Link href="/agro/movimentacoes" className="text-xs font-semibold text-primary hover:underline">Ver histórico</Link></div><div className="mt-3 overflow-hidden rounded-xl border bg-card">{(data?.recent || []).map((item) => <div key={item.id} className="flex items-center gap-3 border-b p-3 last:border-b-0"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${movementIsExit(item.tipo) ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"}`}><ClipboardList className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.produto?.nome}</div><div className="text-xs text-muted-foreground">{movementLabel(item.tipo)} · {item.local?.nome || "Estoque"} · {formatAgroDate(item.data)}</div></div><div className="text-right text-sm font-semibold">{movementIsExit(item.tipo) ? "−" : "+"}{formatAgroNumber(item.quantidade)}<div className="text-[10px] font-normal text-muted-foreground">{item.produto?.unidadeMedida}</div></div></div>)}{!loading && (data?.recent?.length ?? 0) === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</div>}</div></div></div>
    <div className="grid gap-4 lg:grid-cols-3"><MiniRanking title="Produtos mais consumidos" rows={report?.consumoPorProduto || []} /><MiniRanking title="Custo por fazenda" rows={report?.consumoPorFazenda || []} /><MiniRanking title="Custo por cultura" rows={report?.consumoPorCultura || []} /></div>
  </div></AgroLayout>;
}
function MiniRanking({ title, rows }: { title: string; rows: Array<{ id: string; label: string; custo: number }> }) { return <Card><CardContent className="p-4"><div className="font-semibold">{title}</div><div className="mt-3 divide-y">{rows.slice(0, 5).map((r) => <div key={r.id} className="flex justify-between gap-3 py-2 text-sm"><span className="truncate">{r.label}</span><span className="shrink-0 font-semibold">{formatAgroCurrency(r.custo)}</span></div>)}{rows.length === 0 && <div className="py-6 text-center text-sm text-muted-foreground">Sem consumo no mês.</div>}</div></CardContent></Card>; }
