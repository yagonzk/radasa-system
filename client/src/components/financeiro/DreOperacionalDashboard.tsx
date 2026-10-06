import { useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronDown, ChevronUp, Download, FileText, Filter, Heart, RefreshCw, TrendingDown, TrendingUp, WalletCards } from "lucide-react";
import { toast } from "sonner";

type Filters = Record<string, string>;
type Rank = { id: string; nome: string; receita: number; custos: number; resultado: number; margem: number; km?: number; viagens?: number };
type DreData = {
  periodo: { from: string; to: string; dias: number };
  cobertura: { fonteReceita: string; cte: string; indisponiveis: string[] };
  filtros: {
    clientes: any[]; filiais: any[]; centrosCusto: any[]; veiculos: any[]; motoristas: any[];
    tiposOperacao: string[]; tiposVeiculo: string[]; cidadesOrigem: string[]; cidadesDestino: string[];
    ufsOrigem: string[]; ufsDestino: string[]; viagens: any[]; ctes: any[]; cargas: string[];
  };
  kpis: Record<string, number>;
  dre: { id: string; label: string; tipo: string; valor: number; filhos: { label: string; valor: number }[] }[];
  seriesMensais: { mes: string; receita: number; custos: number; ebitda: number; resultado: number }[];
  rankings: { clientesMais: Rank[]; clientesMenos: Rank[]; filiais: Rank[]; motoristas: Rank[]; veiculos: Rank[] };
  custosPorCategoria: { label: string; valor: number }[];
  receitaCustoResultado: { mes: string; receita: number; custo: number; resultado: number }[];
};

type Props = { from: string; to: string };
type MiniTab = "RESUMO" | "DRE" | "RENTABILIDADE" | "ANALISES";
type RankTab = "CLIENTES" | "VEICULOS" | "MOTORISTAS" | "FILIAIS";

const money = (v: number) => Number(v || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (v: number) => `${Number(v || 0).toFixed(1)}%`;
const fmtMonth = (v: string) => { const [y, m] = v.split("-"); return `${m}/${y}`; };
const favoriteKey = "radasa:dre:filtros-favoritos:v1";

const SelectField = ({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) => (
  <label className="min-w-0 text-xs font-medium text-muted-foreground">
    {label}
    <select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm text-foreground" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Todos</option>
      {children}
    </select>
  </label>
);

export default function DreOperacionalDashboard({ from, to }: Props) {
  const [data, setData] = useState<DreData | null>(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<Filters>({});
  const [applied, setApplied] = useState<Filters>({});
  const [details, setDetails] = useState<any[] | null>(null);
  const [detailsTitle, setDetailsTitle] = useState("");
  const [compare, setCompare] = useState<DreData | null>(null);
  const [compareOn, setCompareOn] = useState(false);
  const [favorites, setFavorites] = useState<{ name: string; filters: Filters }[]>([]);
  const [miniTab, setMiniTab] = useState<MiniTab>("RESUMO");
  const [rankTab, setRankTab] = useState<RankTab>("CLIENTES");
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const req = useRef(0);

  useEffect(() => {
    try { setFavorites(JSON.parse(localStorage.getItem(favoriteKey) || "[]")); }
    catch { setFavorites([]); }
  }, []);

  const params = useMemo(() => ({ from, to, ...applied }), [from, to, applied]);
  const activeFilterCount = useMemo(() => Object.values(applied).filter(Boolean).length, [applied]);

  const load = async () => {
    const id = ++req.current;
    setLoading(true);
    try {
      const r = await api.get("/financeiro/dre-operacional", { params });
      if (id === req.current) setData(r.data);
    } catch (e: any) {
      if (id === req.current) toast.error(e.response?.data?.message || "Erro ao carregar DRE Operacional");
    } finally {
      if (id === req.current) setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [params.from, params.to, JSON.stringify(applied)]);

  useEffect(() => {
    let timer: number | undefined;
    const handler = (e: Event) => {
      if (!realtimeChangeTouches(e, "financeiro", "romaneios", "viagens", "abastecimentos", "frota", "pneus")) return;
      if (timer) clearTimeout(timer);
      timer = window.setTimeout(() => void load(), 350);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => {
      if (timer) clearTimeout(timer);
      window.removeEventListener(REALTIME_CHANGE_EVENT, handler);
    };
  }, [params.from, params.to, JSON.stringify(applied)]);

  useEffect(() => {
    if (!compareOn) { setCompare(null); return; }
    const start = new Date(`${from}T00:00:00Z`);
    const end = new Date(`${to}T00:00:00Z`);
    const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
    const prevEnd = new Date(start); prevEnd.setUTCDate(prevEnd.getUTCDate() - 1);
    const prevStart = new Date(prevEnd); prevStart.setUTCDate(prevStart.getUTCDate() - days + 1);
    const d = (x: Date) => x.toISOString().slice(0, 10);
    void api.get("/financeiro/dre-operacional", { params: { ...applied, from: d(prevStart), to: d(prevEnd) } })
      .then((r) => setCompare(r.data)).catch(() => setCompare(null));
  }, [compareOn, from, to, JSON.stringify(applied)]);

  const apply = () => setApplied({ ...filters });
  const clear = () => { setFilters({}); setApplied({}); };

  const saveFavorite = () => {
    const name = window.prompt("Nome do filtro favorito:");
    if (!name?.trim()) return;
    const next = [...favorites.filter((x) => x.name !== name.trim()), { name: name.trim(), filters: { ...filters } }];
    setFavorites(next);
    localStorage.setItem(favoriteKey, JSON.stringify(next));
    toast.success("Filtro favorito salvo neste navegador.");
  };

  const drill = async (tipo: string, categoria?: string, title?: string) => {
    try {
      const r = await api.get("/financeiro/dre-operacional/detalhes", { params: { from, to, ...applied, tipo, categoria } });
      setDetails(r.data);
      setDetailsTitle(title || "Detalhamento");
    } catch (e: any) {
      toast.error(e.response?.data?.message || "Erro ao abrir detalhamento");
    }
  };

  const exportExcel = () => {
    if (!data) return;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.dre.flatMap((x) => [
      { Grupo: x.label, Item: "Subtotal", Valor: x.valor },
      ...x.filhos.map((f) => ({ Grupo: x.label, Item: f.label, Valor: f.valor })),
    ])), "DRE");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.seriesMensais), "Evolucao");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.rankings.clientesMais), "Clientes");
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data.rankings.veiculos), "Veiculos");
    XLSX.writeFile(wb, `DRE-Operacional_${from}_${to}.xlsx`);
  };

  const exportPdf = () => {
    if (!data) return;
    const rows = data.dre.map((x) => `<tr><td><b>${x.label}</b></td><td style="text-align:right"><b>${money(x.valor)}</b></td></tr>${x.filhos.map((f) => `<tr><td style="padding-left:24px">${f.label}</td><td style="text-align:right">${money(f.valor)}</td></tr>`).join("")}`).join("");
    const w = window.open("", "_blank", "width=1000,height=800");
    if (!w) return toast.error("Permita pop-ups para exportar o PDF.");
    w.document.write(`<html><head><title>DRE Operacional</title><style>body{font-family:Arial;padding:24px;color:#111}table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ddd;padding:8px}h1{margin:0}small{color:#666}</style></head><body><h1>DRE Operacional</h1><small>${from} a ${to}</small><table>${rows}</table><script>window.onload=()=>window.print()<\/script></body></html>`);
    w.document.close();
  };

  if (!data && loading) return <Card><CardContent className="p-8 text-center text-sm text-muted-foreground">Calculando DRE Operacional...</CardContent></Card>;
  if (!data) return <Card><CardContent className="p-8 text-center"><Button onClick={() => void load()}>Tentar novamente</Button></CardContent></Card>;

  const k = data.kpis;
  const compareValue = (key: string) => compare ? Number(compare.kpis[key] || 0) : null;
  const delta = (key: string) => {
    const prev = compareValue(key), cur = Number(k[key] || 0);
    if (prev === null || prev === 0) return null;
    return (cur - prev) / Math.abs(prev) * 100;
  };

  const summaryCards = [
    ["Receita Líquida", "receitaLiquida", money(k.receitaLiquida), TrendingUp],
    ["Custos Diretos", "custosDiretos", money(k.custosDiretos), TrendingDown],
    ["EBITDA", "ebitda", money(k.ebitda), WalletCards],
    ["Resultado Operacional", "resultadoOperacional", money(k.resultadoOperacional), WalletCards],
    ["Margem Operacional", "margemOperacional", pct(k.margemOperacional), TrendingUp],
    ["Lucro por Km", "lucroKm", money(k.lucroKm), TrendingUp],
  ] as const;

  const operationalCards = [
    ["Receita por Km", money(k.receitaKm)],
    ["Custo por Km", money(k.custoKm)],
    ["Ticket Médio", money(k.ticketMedio)],
    ["Faturamento por Veículo", money(k.faturamentoVeiculo)],
  ] as const;

  return <div className="space-y-4">
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
              <SelectField label="Cliente" value={filters.clienteId || ""} onChange={(v) => setFilters((f) => ({ ...f, clienteId: v }))}>
                {data.filtros.clientes.map((x) => <option key={x.id} value={x.id}>{x.codigoInterno ? `${x.codigoInterno} · ` : ""}{x.nomeFantasia}</option>)}
              </SelectField>
              <SelectField label="Veículo" value={filters.veiculoId || ""} onChange={(v) => setFilters((f) => ({ ...f, veiculoId: v }))}>
                {data.filtros.veiculos.map((x) => <option key={x.id} value={x.id}>{x.placa}{x.modelo ? ` · ${x.modelo}` : ""}</option>)}
              </SelectField>
              <SelectField label="Motorista" value={filters.motoristaId || ""} onChange={(v) => setFilters((f) => ({ ...f, motoristaId: v }))}>
                {data.filtros.motoristas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </SelectField>
              <SelectField label="Filial" value={filters.filialId || ""} onChange={(v) => setFilters((f) => ({ ...f, filialId: v }))}>
                {data.filtros.filiais.map((x) => <option key={x.id} value={x.id}>{x.nomeFantasia || x.razaoSocial}</option>)}
              </SelectField>
              <SelectField label="Centro de custo" value={filters.centroCustoId || ""} onChange={(v) => setFilters((f) => ({ ...f, centroCustoId: v }))}>
                {data.filtros.centrosCusto.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </SelectField>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={() => setAdvancedOpen((v) => !v)}>
              {advancedOpen ? <ChevronUp className="mr-1 h-4 w-4" /> : <ChevronDown className="mr-1 h-4 w-4" />}
              Mais filtros{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""}
            </Button>
            <Button size="sm" variant="outline" onClick={clear}>Limpar</Button>
            <Button size="sm" onClick={apply}><Filter className="mr-1 h-4 w-4" />Aplicar</Button>
          </div>
        </div>

        {advancedOpen ? <div className="mt-4 border-t pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <SelectField label="Tipo de operação" value={filters.tipoOperacao || ""} onChange={(v) => setFilters((f) => ({ ...f, tipoOperacao: v }))}>{data.filtros.tiposOperacao.map((x) => <option key={x}>{x}</option>)}</SelectField>
            <SelectField label="Tipo de veículo" value={filters.tipoVeiculo || ""} onChange={(v) => setFilters((f) => ({ ...f, tipoVeiculo: v }))}>{data.filtros.tiposVeiculo.map((x) => <option key={x}>{x}</option>)}</SelectField>
            <SelectField label="Cidade origem" value={filters.cidadeOrigem || ""} onChange={(v) => setFilters((f) => ({ ...f, cidadeOrigem: v }))}>{data.filtros.cidadesOrigem.map((x) => <option key={x}>{x}</option>)}</SelectField>
            <SelectField label="Cidade destino" value={filters.cidadeDestino || ""} onChange={(v) => setFilters((f) => ({ ...f, cidadeDestino: v }))}>{data.filtros.cidadesDestino.map((x) => <option key={x}>{x}</option>)}</SelectField>
            <SelectField label="UF origem" value={filters.ufOrigem || ""} onChange={(v) => setFilters((f) => ({ ...f, ufOrigem: v }))}>{data.filtros.ufsOrigem.map((x) => <option key={x}>{x}</option>)}</SelectField>
            <SelectField label="UF destino" value={filters.ufDestino || ""} onChange={(v) => setFilters((f) => ({ ...f, ufDestino: v }))}>{data.filtros.ufsDestino.map((x) => <option key={x}>{x}</option>)}</SelectField>
            <SelectField label="Viagem" value={filters.viagemId || ""} onChange={(v) => setFilters((f) => ({ ...f, viagemId: v }))}>{data.filtros.viagens.slice(0, 300).map((x) => <option key={x.id} value={x.id}>{x.label}</option>)}</SelectField>
            <label className="text-xs font-medium text-muted-foreground">CT-e / Conhecimento<Input className="mt-1 h-9" placeholder="Número ou chave" value={filters.cte || ""} onChange={(e) => setFilters((f) => ({ ...f, cte: e.target.value }))} /></label>
            <label className="text-xs font-medium text-muted-foreground">Número da carga<Input className="mt-1 h-9" value={filters.numeroCarga || ""} onChange={(e) => setFilters((f) => ({ ...f, numeroCarga: e.target.value }))} /></label>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            {favorites.length > 0 ? <div className="flex flex-wrap items-center gap-2 text-xs"><span className="text-muted-foreground">Favoritos:</span>{favorites.map((x) => <Button key={x.name} size="sm" variant="outline" onClick={() => { setFilters(x.filters); setApplied(x.filters); }}>{x.name}</Button>)}</div> : <span />}
            <Button size="sm" variant="ghost" onClick={saveFavorite}><Heart className="mr-1 h-4 w-4" />Salvar filtro atual</Button>
          </div>
        </div> : null}
      </CardContent>
    </Card>

    <div className="rounded-xl border bg-card p-1">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1">
          {([
            ["RESUMO", "Resumo"],
            ["DRE", "DRE"],
            ["RENTABILIDADE", "Rentabilidade"],
            ["ANALISES", "Análises"],
          ] as const).map(([key, label]) => (
            <Button key={key} size="sm" variant={miniTab === key ? "default" : "ghost"} onClick={() => setMiniTab(key)}>{label}</Button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 p-1">
          <Button size="sm" variant="ghost" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-1 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
          {miniTab === "DRE" ? <><Button size="sm" variant="ghost" onClick={exportExcel}><Download className="mr-1 h-4 w-4" />Excel</Button><Button size="sm" variant="ghost" onClick={exportPdf}><FileText className="mr-1 h-4 w-4" />PDF</Button></> : null}
        </div>
      </div>
    </div>

    {miniTab === "RESUMO" ? <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm text-muted-foreground">Período: {from} a {to}{activeFilterCount ? ` · ${activeFilterCount} filtro(s) aplicado(s)` : ""}</div>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={compareOn} onChange={(e) => setCompareOn(e.target.checked)} />Comparar com período anterior</label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {summaryCards.map(([label, key, value, Icon]) => {
          const d = delta(key);
          return <Card key={key} className="cursor-pointer" onClick={() => { if (key === "receitaLiquida") void drill("receita", undefined, label); if (key === "custosDiretos") void drill("custo", undefined, label); }}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between gap-2 text-[11px] uppercase tracking-wide text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4" /></div>
              <div className={`mt-2 text-xl font-bold ${String(key).includes("resultado") || String(key).includes("lucro") || String(key).includes("ebitda") ? Number(k[key]) >= 0 ? "text-emerald-600" : "text-red-600" : ""}`}>{value}</div>
              {d !== null ? <div className={`mt-1 text-[11px] ${d >= 0 ? "text-emerald-600" : "text-red-600"}`}>{d >= 0 ? "+" : ""}{d.toFixed(1)}% vs. anterior</div> : null}
            </CardContent>
          </Card>;
        })}
      </div>
      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">Receita x Custo x Resultado</CardTitle></CardHeader>
        <CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.receitaCustoResultado}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" tickFormatter={fmtMonth} /><YAxis width={70} /><Tooltip formatter={(v: any) => money(Number(v))} /><Legend /><Bar dataKey="receita" name="Receita" /><Bar dataKey="custo" name="Custo" /><Bar dataKey="resultado" name="Resultado" /></BarChart></ResponsiveContainer></CardContent>
      </Card>
    </div> : null}

    {miniTab === "DRE" ? <Card>
      <CardHeader className="pb-2"><div className="flex flex-wrap items-center justify-between gap-2"><div><CardTitle className="text-base">Demonstrativo operacional</CardTitle><p className="mt-1 text-xs text-muted-foreground">Clique em uma linha para abrir os lançamentos que formam o valor.</p></div></div></CardHeader>
      <CardContent className="space-y-1">
        {data.dre.map((row) => <div key={row.id}>
          <button className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left ${row.tipo === "resultado" ? "bg-muted/50 font-bold" : "font-semibold"}`} onClick={() => void drill(row.id.includes("receita") ? "receita" : "custo", undefined, row.label)}>
            <span>{row.label}</span><span className={row.tipo === "resultado" && row.valor < 0 ? "text-red-600" : row.tipo === "resultado" ? "text-emerald-600" : ""}>{money(row.valor)}</span>
          </button>
          {row.filhos.map((child) => <button key={child.label} className="flex w-full items-center justify-between gap-3 border-b px-6 py-2 text-left text-sm hover:bg-muted/40" onClick={() => void drill(row.id.includes("receita") ? "receita" : "custo", child.label, child.label)}><span>{child.label}</span><span>{money(child.valor)}</span></button>)}
        </div>)}
      </CardContent>
    </Card> : null}

    {miniTab === "RENTABILIDADE" ? <div className="space-y-4">
      <div className="rounded-xl border bg-card p-1"><div className="flex flex-wrap gap-1">{([
        ["CLIENTES", "Clientes"], ["VEICULOS", "Veículos"], ["MOTORISTAS", "Motoristas"], ["FILIAIS", "Filiais"],
      ] as const).map(([key, label]) => <Button key={key} size="sm" variant={rankTab === key ? "secondary" : "ghost"} onClick={() => setRankTab(key)}>{label}</Button>)}</div></div>
      {rankTab === "CLIENTES" ? <div className="grid gap-4 xl:grid-cols-2"><Ranking title="Clientes mais rentáveis" rows={data.rankings.clientesMais} /><Ranking title="Clientes com menor rentabilidade" rows={data.rankings.clientesMenos} /></div> : null}
      {rankTab === "VEICULOS" ? <Ranking title="Rentabilidade por veículo" rows={data.rankings.veiculos} /> : null}
      {rankTab === "MOTORISTAS" ? <Ranking title="Rentabilidade por motorista" rows={data.rankings.motoristas} /> : null}
      {rankTab === "FILIAIS" ? <Ranking title="Rentabilidade por filial" rows={data.rankings.filiais} /> : null}
    </div> : null}

    {miniTab === "ANALISES" ? <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {operationalCards.map(([label, value]) => <Card key={label}><CardContent className="p-4"><div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div><div className="mt-2 text-xl font-bold">{value}</div></CardContent></Card>)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Evolução mensal</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><LineChart data={data.seriesMensais}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="mes" tickFormatter={fmtMonth} /><YAxis width={70} /><Tooltip formatter={(v: any) => money(Number(v))} /><Legend /><Line type="monotone" dataKey="receita" name="Receita" /><Line type="monotone" dataKey="custos" name="Custos" /><Line type="monotone" dataKey="ebitda" name="EBITDA" /></LineChart></ResponsiveContainer></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-base">Custos por categoria</CardTitle></CardHeader><CardContent className="h-[300px]"><ResponsiveContainer width="100%" height="100%"><BarChart data={data.custosPorCategoria.slice(0, 10)} layout="vertical"><CartesianGrid strokeDasharray="3 3" /><XAxis type="number" /><YAxis type="category" dataKey="label" width={130} /><Tooltip formatter={(v: any) => money(Number(v))} /><Bar dataKey="valor" name="Custo" /></BarChart></ResponsiveContainer></CardContent></Card>
      </div>
      <div className="rounded-md border bg-muted/20 p-3 text-xs text-muted-foreground"><strong className="text-foreground">Origem dos dados:</strong> {data.cobertura.fonteReceita}. {data.cobertura.cte}</div>
    </div> : null}

    <Dialog open={details !== null} onOpenChange={(open) => { if (!open) setDetails(null); }}>
      <DialogContent className="max-w-5xl">
        <DialogHeader><DialogTitle>{detailsTitle}</DialogTitle></DialogHeader>
        <div className="max-h-[65vh] overflow-auto rounded-md border">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="sticky top-0 bg-background"><tr className="border-b text-left text-xs text-muted-foreground"><th className="p-2">Data</th><th>Categoria</th><th>Cliente</th><th>Documento</th><th>Viagem/Carga</th><th>Placa</th><th className="pr-2 text-right">Valor</th></tr></thead>
            <tbody>{(details || []).map((x) => <tr key={x.id} className="border-b"><td className="p-2">{x.data}</td><td>{x.categoria}</td><td>{x.cliente || "—"}</td><td>{x.documento || "—"}</td><td>{x.viagem || "—"}</td><td>{x.placa || "—"}</td><td className="pr-2 text-right font-medium">{money(x.valor)}</td></tr>)}</tbody>
          </table>
          {details?.length === 0 ? <div className="p-8 text-center text-sm text-muted-foreground">Nenhum lançamento encontrado neste nível.</div> : null}
        </div>
      </DialogContent>
    </Dialog>
  </div>;
}

function Ranking({ title, rows }: { title: string; rows: Rank[] }) {
  return <Card>
    <CardHeader className="pb-2"><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent>{rows.length === 0 ? <div className="py-8 text-center text-sm text-muted-foreground">Sem dados no período.</div> : <div className="space-y-2">{rows.map((x, i) => <div key={x.id} className="grid grid-cols-[28px_1fr_auto_auto] items-center gap-2 rounded-md border px-3 py-2 text-sm"><span className="text-muted-foreground">{i + 1}</span><span className="truncate font-medium" title={x.nome}>{x.nome}</span><span className={x.resultado >= 0 ? "text-emerald-600" : "text-red-600"}>{money(x.resultado)}</span><span className="w-16 text-right text-xs text-muted-foreground">{pct(x.margem)}</span></div>)}</div>}</CardContent>
  </Card>;
}
