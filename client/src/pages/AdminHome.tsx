import { type ReactNode, useCallback, useEffect, useState } from "react";
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  Leaf,
  RefreshCw,
  ScrollText,
  ShieldCheck,
  Truck,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";

type AdminSummary = {
  usuarios: { total: number; ativos: number; pendentes: number; administradores: number };
  licencas: { transportesAtivas: number; agroAtivas: number };
  auditoria: {
    ultimas24h: number;
    ultimos7dias: number;
    recentes: Array<{
      id: string;
      action: string;
      method: string;
      path: string;
      createdAt: string;
      user: { name: string; username: string } | null;
    }>;
  };
  cadastros: {
    transportes: { motoristas: number; clientes: number; fornecedores: number; produtos: number; veiculos: number; empresas: number };
    agro: { produtos: number; fazendas: number; talhoes: number; lavouras: number; barracoes: number };
  };
  operacao: { romaneios: number; viagens: number; lancamentosFinanceiros: number; inventariosAgroAbertos: number };
  generatedAt: string;
};

function MetricCard({ label, value, hint, icon }: { label: string; value: number; hint: string; icon: ReactNode }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{value.toLocaleString("pt-BR")}</p>
            <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
          </div>
          <div className="rounded-xl bg-primary/10 p-2.5 text-primary">{icon}</div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminHome() {
  const [summary, setSummary] = useState<AdminSummary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AdminSummary>("/admin/resumo");
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "admin", "usuarios", "agro", "manifestos", "viagens", "financeiro")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void load(); }, 300);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(REALTIME_CHANGE_EVENT, handler);
    };
  }, [load]);

  const s = summary;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" /> Administração</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">Visão administrativa</h1>
            <p className="mt-1 text-sm text-muted-foreground">Usuários, licenças, cadastros, atividade e volumes da plataforma em um só lugar.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="Usuários" value={s?.usuarios.total ?? 0} hint={`${s?.usuarios.ativos ?? 0} ativos • ${s?.usuarios.pendentes ?? 0} pendentes`} icon={<Users className="h-5 w-5" />} />
          <MetricCard label="Transportes liberado" value={s?.licencas.transportesAtivas ?? 0} hint="contas com acesso vigente" icon={<Truck className="h-5 w-5" />} />
          <MetricCard label="Agro liberado" value={s?.licencas.agroAtivas ?? 0} hint="contas com acesso vigente" icon={<Leaf className="h-5 w-5" />} />
          <MetricCard label="Eventos nas últimas 24h" value={s?.auditoria.ultimas24h ?? 0} hint={`${s?.auditoria.ultimos7dias ?? 0} nos últimos 7 dias`} icon={<ScrollText className="h-5 w-5" />} />
        </div>

        <div className="grid gap-4 xl:grid-cols-2">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Transportes</CardTitle>
                <Badge variant="outline">Dados operacionais</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["Veículos", s?.cadastros.transportes.veiculos ?? 0],
                  ["Motoristas", s?.cadastros.transportes.motoristas ?? 0],
                  ["Clientes", s?.cadastros.transportes.clientes ?? 0],
                  ["Romaneios", s?.operacao.romaneios ?? 0],
                  ["Viagens", s?.operacao.viagens ?? 0],
                  ["Financeiro", s?.operacao.lancamentosFinanceiros ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 text-lg font-bold tabular-nums">{Number(value).toLocaleString("pt-BR")}</div>
                  </div>
                ))}
              </div>
              <Link href="/admin/cadastros" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">Ver cadastros e dados <ArrowRight className="h-4 w-4" /></Link>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="text-base">Agro</CardTitle>
                <Badge variant="outline">Dados operacionais</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  ["Produtos", s?.cadastros.agro.produtos ?? 0],
                  ["Fazendas", s?.cadastros.agro.fazendas ?? 0],
                  ["Talhões", s?.cadastros.agro.talhoes ?? 0],
                  ["Lavouras", s?.cadastros.agro.lavouras ?? 0],
                  ["Barracões", s?.cadastros.agro.barracoes ?? 0],
                  ["Inventários abertos", s?.operacao.inventariosAgroAbertos ?? 0],
                ].map(([label, value]) => (
                  <div key={String(label)} className="rounded-lg border bg-muted/20 p-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="mt-1 text-lg font-bold tabular-nums">{Number(value).toLocaleString("pt-BR")}</div>
                  </div>
                ))}
              </div>
              <Link href="/admin/cadastros" className="inline-flex items-center gap-2 text-sm font-medium text-primary hover:underline">Ver cadastros e dados <ArrowRight className="h-4 w-4" /></Link>
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.4fr_0.6fr]">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <CardTitle className="flex items-center gap-2 text-base"><ScrollText className="h-4 w-4" /> Atividade recente</CardTitle>
                <Link href="/admin/logs" className="text-xs font-medium text-primary hover:underline">Abrir logs</Link>
              </div>
            </CardHeader>
            <CardContent>
              <div className="divide-y rounded-lg border">
                {(s?.auditoria.recentes ?? []).length === 0 ? (
                  <div className="p-6 text-center text-sm text-muted-foreground">Nenhum evento de auditoria encontrado.</div>
                ) : (s?.auditoria.recentes ?? []).map((log) => (
                  <div key={log.id} className="flex flex-col gap-1 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium">{log.action}</div>
                      <div className="truncate text-xs text-muted-foreground">{log.user?.name || log.user?.username || "Sistema"} • {log.method} {log.path}</div>
                    </div>
                    <div className="shrink-0 text-xs text-muted-foreground">{new Date(log.createdAt).toLocaleString("pt-BR")}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Ações administrativas</CardTitle></CardHeader>
            <CardContent className="space-y-2">
              <Link href="/admin/usuarios" className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-medium hover:bg-accent"><span className="flex items-center gap-2"><Users className="h-4 w-4" /> Usuários e licenças</span><ArrowRight className="h-4 w-4" /></Link>
              <Link href="/admin/aprovacoes" className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-medium hover:bg-accent"><span className="flex items-center gap-2"><ShieldCheck className="h-4 w-4" /> Aprovar contas</span><ArrowRight className="h-4 w-4" /></Link>
              <Link href="/admin/cadastros" className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-medium hover:bg-accent"><span className="flex items-center gap-2"><Boxes className="h-4 w-4" /> Cadastros e dados</span><ArrowRight className="h-4 w-4" /></Link>
              <Link href="/admin/logs" className="flex items-center justify-between rounded-lg border px-3 py-3 text-sm font-medium hover:bg-accent"><span className="flex items-center gap-2"><ClipboardList className="h-4 w-4" /> Logs e auditoria</span><ArrowRight className="h-4 w-4" /></Link>
            </CardContent>
          </Card>
        </div>

        <div className="rounded-xl border bg-muted/20 px-4 py-3 text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">Leitura administrativa:</span> os números desta tela são contagens leves do banco, sem carregar registros completos. Última leitura: {s?.generatedAt ? new Date(s.generatedAt).toLocaleString("pt-BR") : "—"}.
        </div>
      </div>
    </AdminLayout>
  );
}
