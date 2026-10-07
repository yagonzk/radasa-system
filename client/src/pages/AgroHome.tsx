import { useCallback, useEffect, useState } from "react";
import { Link } from "wouter";
import { ArrowRight, BarChart3, Boxes, ClipboardList, Leaf, PackageCheck, Sprout, TriangleAlert, Warehouse } from "lucide-react";
import AgroLayout from "@/components/agro/AgroLayout";
import { Card, CardContent } from "@/components/ui/card";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import { AgroMovement, formatAgroDate, formatAgroNumber, movementIsExit, movementLabel } from "@/lib/agro";

const quickLinks = [
  { title: "Estoque", description: "Produtos, lotes, saldos e alertas do barracão.", href: "/agro/estoque", icon: Warehouse },
  { title: "Movimentações", description: "Entradas, saídas, ajustes e histórico de estoque.", href: "/agro/movimentacoes", icon: ClipboardList },
  { title: "Lavouras", description: "Fazendas, talhões, safras e operações agrícolas.", href: "/agro/lavouras", icon: Sprout },
  { title: "Relatórios", description: "Consumo, estoque, lavouras e indicadores gerenciais.", href: "/agro/relatorios", icon: BarChart3 },
];

type DashboardData = {
  produtosAtivos: number;
  produtosComSaldo: number;
  estoqueBaixo: number;
  saidasMes: number;
  lotesVencendo: number;
  recent: AgroMovement[];
};

export default function AgroHome() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const response = await api.get<DashboardData>("/agro/dashboard");
      setData(response.data);
    } catch (error) { console.error("Falha ao carregar Dashboard Agro", error); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "agro", "agro/dashboard", "agro/estoque", "agro/movimentacoes", "agro/produtos", "agro/lotes")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(true), 250);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => { if (timer) window.clearTimeout(timer); window.removeEventListener(REALTIME_CHANGE_EVENT, handler); };
  }, [load]);

  const stats = [
    { label: "Produtos ativos", value: data?.produtosAtivos ?? 0, detail: `${data?.produtosComSaldo ?? 0} com saldo`, icon: Boxes },
    { label: "Estoque baixo", value: data?.estoqueBaixo ?? 0, detail: "abaixo do mínimo definido", icon: TriangleAlert },
    { label: "Saídas do mês", value: data?.saidasMes ?? 0, detail: "movimentações de saída", icon: PackageCheck },
    { label: "Lotes a vencer", value: data?.lotesVencendo ?? 0, detail: "próximos 60 dias", icon: Warehouse },
  ];

  return (
    <AgroLayout>
      <div className="space-y-6">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><Leaf className="h-4 w-4" />Radasa Agro</div>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Dashboard Agro</h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Visão rápida do estoque agrícola. Lavouras serão conectadas na próxima etapa.</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {stats.map(({ label, value, detail, icon: Icon }) => (
            <Card key={label} className="border-border/70"><CardContent className="flex items-center justify-between gap-4 p-5"><div><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-2xl font-bold">{loading && !data ? "—" : value}</div><div className="mt-1 text-xs text-muted-foreground">{detail}</div></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>
          ))}
        </div>

        <div className="grid gap-5 xl:grid-cols-[1.2fr_1fr]">
          <div>
            <h2 className="text-base font-semibold">Acesso rápido</h2>
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              {quickLinks.map(({ title, description, href, icon: Icon }) => (
                <Link key={href} href={href} className="group rounded-xl border bg-card p-5 transition hover:border-primary/30 hover:bg-accent/20">
                  <div className="flex items-start justify-between gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div><ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" /></div>
                  <div className="mt-4 font-semibold">{title}</div><p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
                </Link>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3"><h2 className="text-base font-semibold">Últimas movimentações</h2><Link href="/agro/movimentacoes" className="text-xs font-semibold text-primary hover:underline">Ver histórico</Link></div>
            <div className="mt-3 overflow-hidden rounded-xl border bg-card">
              {(data?.recent || []).map((item) => <div key={item.id} className="flex items-center gap-3 border-b p-3 last:border-b-0"><div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${movementIsExit(item.tipo) ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"}`}><ClipboardList className="h-4 w-4" /></div><div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{item.produto?.nome}</div><div className="text-xs text-muted-foreground">{movementLabel(item.tipo)} · {formatAgroDate(item.data)}</div></div><div className="text-right text-sm font-semibold">{movementIsExit(item.tipo) ? "−" : "+"}{formatAgroNumber(item.quantidade)}<div className="text-[10px] font-normal text-muted-foreground">{item.produto?.unidadeMedida}</div></div></div>)}
              {!loading && (data?.recent?.length ?? 0) === 0 && <div className="p-8 text-center text-sm text-muted-foreground">Nenhuma movimentação registrada ainda.</div>}
              {loading && !data && <div className="p-8 text-center text-sm text-muted-foreground">Carregando...</div>}
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-dashed bg-muted/20 p-4"><div className="flex items-start gap-3"><Boxes className="mt-0.5 h-5 w-5 text-primary" /><div><div className="text-sm font-semibold">Etapa 4: estoque funcional</div><p className="mt-1 text-sm leading-6 text-muted-foreground">Produtos, lotes e movimentações já usam tabelas exclusivas do Agro. O saldo é derivado do histórico e não pode ser alterado diretamente.</p></div></div></div>
      </div>
    </AgroLayout>
  );
}
