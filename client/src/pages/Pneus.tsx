import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { usePneus, type Pneu, type StatusPneu, type TipoPneu, type CondicaoPneu } from "@/lib/store";
import { CircleDollarSign, History, ImagePlus, Package, Pencil, Plus, RefreshCcw, Search, ShieldAlert, Trash2, Truck, Wrench, Recycle, Gauge, CircleOff, CircleDotDashed } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { PneuInstalacoes, PneuRodizios } from "@/components/pneus/PneuOperacoes";
import { PneuManutencao } from "@/components/pneus/PneuManutencao";
import { PneuGestao } from "@/components/pneus/PneuGestao";

const statusLabels: Record<StatusPneu, string> = { ESTOQUE: "Estoque", INSTALADO: "Instalado", MANUTENCAO: "Em manutenção", RECAPAGEM: "Em recapagem", DESCARTADO: "Descartado" };
const tipoLabels: Record<TipoPneu, string> = { DIRECIONAL: "Direcional", TRACAO: "Tração", LIVRE: "Livre" };
const condicaoLabels: Record<CondicaoPneu, string> = { NOVO: "Novo", USADO: "Usado", RECAPADO: "Recapado", AGUARDANDO_RECAPAGEM: "Aguardando recapagem" };
const emptyForm = { numeroFogo: "", marca: "", modelo: "", medida: "", aro: "", dot: "", numeroSerie: "", tipo: "LIVRE" as TipoPneu, valorCompra: "", fornecedor: "", dataCompra: "", maxRecapagens: "", recapagensRealizadas: "", status: "ESTOQUE" as StatusPneu, condicao: "NOVO" as CondicaoPneu, sulcoInicial: "", sulcoAtual: "", kmAtual: "", proximoRodizioKm: "", observacoes: "", fotos: [] as string[] };

function money(value: number) {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}

function parseBRLCurrency(value: string | number) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;

  const raw = String(value ?? "")
    .replace(/R\$/gi, "")
    .replace(/\s/g, "")
    .trim();

  if (!raw) return 0;

  // Formato brasileiro: 1.234,56 -> 1234.56
  if (raw.includes(",")) {
    const normalized = raw.replace(/\./g, "").replace(",", ".");
    const parsed = Number(normalized.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }

  // Também aceita 1234.56 para facilitar colar valores de outras fontes.
  const parsed = Number(raw.replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBRLCurrencyInput(value: string | number) {
  if (value === "" || value == null) return "";
  return money(parseBRLCurrency(value));
}

function date(value: string) { return value ? new Date(`${value}T12:00:00`).toLocaleDateString("pt-BR") : "—"; }

function compareNumeroFogoDesc(a: Pneu, b: Pneu) {
  const numeroA = String(a.numeroFogo ?? "").trim();
  const numeroB = String(b.numeroFogo ?? "").trim();

  if (!numeroA && !numeroB) return 0;
  if (!numeroA) return 1;
  if (!numeroB) return -1;

  return numeroB.localeCompare(numeroA, "pt-BR", {
    numeric: true,
    sensitivity: "base",
  });
}

export default function Pneus() {
  const { items, create, update, remove } = usePneus();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Pneu | null>(null);
  const [details, setDetails] = useState<Pneu | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<StatusPneu | "TODOS">("TODOS");
  const [saving, setSaving] = useState(false);

  const filtered = useMemo(() => items.filter((p) => {
    const q = search.trim().toLowerCase();
    const matchesSearch = !q || [p.numeroFogo, p.marca, p.modelo, p.medida, p.aro, p.fornecedor].some(v => String(v ?? "").toLowerCase().includes(q));
    return matchesSearch && (status === "TODOS" || p.status === status);
  }), [items, search, status]);

  const cadastroItems = useMemo(
    () => [...filtered].sort(compareNumeroFogoDesc),
    [filtered],
  );

  const estoqueItems = useMemo(
    () => items.filter((p) => p.status === "ESTOQUE").sort(compareNumeroFogoDesc),
    [items],
  );

  const stats = useMemo(() => {
    const ativos = items.filter(p => p.status !== "DESCARTADO");
    const proximosRodizio = items.filter(p => p.proximoRodizioKm != null && p.proximoRodizioKm - p.kmAtual <= 1000 && p.status === "INSTALADO").length;
    const criticos = items.filter(p => p.sulcoAtual != null && p.sulcoAtual <= 2).length;
    const custo = items.reduce((sum, p) => sum + p.valorCompra + (p.recapagens ?? []).reduce((a, r) => a + r.valor, 0) + (p.consertos ?? []).reduce((a, c) => a + c.valor, 0), 0);
    const economia = items.reduce((sum, p) => sum + (p.recapagens ?? []).reduce((a, r) => a + Math.max(0, p.valorCompra - r.valor), 0), 0);
    return { ativos: ativos.length, estoque: items.filter(p => p.status === "ESTOQUE").length, instalados: items.filter(p => p.status === "INSTALADO").length, recapagem: items.filter(p => p.status === "RECAPAGEM").length, descartados: items.filter(p => p.status === "DESCARTADO").length, proximosRodizio, criticos, custo, economia };
  }, [items]);

  const statusDistribution = useMemo(() => (Object.keys(statusLabels) as StatusPneu[]).map(key => ({ key, label: statusLabels[key], value: items.filter(p => p.status === key).length })), [items]);
  const maxStatus = Math.max(1, ...statusDistribution.map(s => s.value));
  const monthlyCosts = useMemo(() => {
    const months: { key: string; label: string; value: number }[] = [];
    const now = new Date();
    for (let offset = 5; offset >= 0; offset--) {
      const current = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const key = `${current.getFullYear()}-${String(current.getMonth() + 1).padStart(2, "0")}`;
      months.push({ key, label: current.toLocaleDateString("pt-BR", { month: "short" }), value: items.filter(p => (p.dataCompra ?? "").startsWith(key)).reduce((sum, p) => sum + p.valorCompra, 0) });
    }
    return months;
  }, [items]);
  const maxMonthlyCost = Math.max(1, ...monthlyCosts.map(m => m.value));
  const totalRecapagens = items.reduce((sum, p) => sum + p.recapagensRealizadas, 0);

  const desgasteMedio = useMemo(() => {
    const values = items.filter(p => p.sulcoInicial && p.sulcoAtual != null).map(p => Math.max(0, Math.min(100, ((p.sulcoInicial! - p.sulcoAtual!) / p.sulcoInicial!) * 100)));
    return values.length ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }, [items]);

  const historico = useMemo(() => {
    const eventos: Array<Pneu["eventos"][number] & { pneu: Pneu }> = [];
    for (const pneu of items) {
      const lista = Array.isArray(pneu?.eventos) ? pneu.eventos : [];
      for (const evento of lista) eventos.push({ ...evento, pneu });
    }
    return eventos
      .sort((a, b) => +new Date(b.data) - +new Date(a.data))
      .slice(0, 100);
  }, [items]);

  const openCreate = () => { setEditing(null); setForm({ ...emptyForm, fotos: [] }); setOpen(true); };
  const openEdit = (p: Pneu) => {
    setEditing(p);
    setForm({ numeroFogo: p.numeroFogo, marca: p.marca, modelo: p.modelo, medida: p.medida, aro: p.aro ?? "", dot: p.dot, numeroSerie: p.numeroSerie ?? "", tipo: p.tipo, valorCompra: p.valorCompra ? money(p.valorCompra) : "", fornecedor: p.fornecedor, dataCompra: p.dataCompra, maxRecapagens: p.maxRecapagens ? String(p.maxRecapagens) : "", recapagensRealizadas: p.recapagensRealizadas ? String(p.recapagensRealizadas) : "", status: p.status, condicao: p.condicao, sulcoInicial: p.sulcoInicial == null ? "" : String(p.sulcoInicial), sulcoAtual: p.sulcoAtual == null ? "" : String(p.sulcoAtual), kmAtual: p.kmAtual ? String(p.kmAtual) : "", proximoRodizioKm: p.proximoRodizioKm == null ? "" : String(p.proximoRodizioKm), observacoes: p.observacoes ?? "", fotos: (p.fotos ?? []).map(f => f.url) });
    setOpen(true);
  };

  const handlePhotos = async (files: FileList | null) => {
    if (!files) return;
    const currentFotos = Array.isArray(form.fotos) ? form.fotos : [];
    const remaining = Math.max(0, 10 - currentFotos.length);
    const selected = Array.from(files).slice(0, remaining);
    const encoded = await Promise.all(selected.map(file => new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = reject; reader.readAsDataURL(file); })));
    setForm(current => ({ ...current, fotos: [...(Array.isArray(current.fotos) ? current.fotos : []), ...encoded] }));
  };

  const save = async () => {
    setSaving(true);
    const payload = { ...form, valorCompra: parseBRLCurrency(form.valorCompra), maxRecapagens: Number(form.maxRecapagens || 0), recapagensRealizadas: Number(form.recapagensRealizadas || 0), sulcoInicial: form.sulcoInicial === "" ? null : Number(form.sulcoInicial), sulcoAtual: form.sulcoAtual === "" ? null : Number(form.sulcoAtual), kmAtual: Number(form.kmAtual || 0), proximoRodizioKm: form.proximoRodizioKm === "" ? null : Number(form.proximoRodizioKm) };
    try { if (editing) await update(editing.id, payload as any); else await create(payload as any); toast.success(editing ? "Pneu atualizado." : "Pneu cadastrado."); setOpen(false); } catch (error: any) { toast.error(error?.response?.data?.message ?? "Não foi possível salvar o pneu."); } finally { setSaving(false); }
  };

  const archive = async (p: Pneu) => { if (!confirm(`Arquivar o pneu ${p.numeroFogo}? O histórico será preservado.`)) return; try { await remove(p.id); toast.success("Pneu arquivado."); } catch { toast.error("Não foi possível arquivar o pneu."); } };

  const cards = [
    ["Total de pneus ativos", stats.ativos, CircleDotDashed], ["Pneus em estoque", stats.estoque, Package], ["Pneus instalados", stats.instalados, Truck],
    ["Pneus em recapagem", stats.recapagem, Recycle], ["Pneus descartados", stats.descartados, CircleOff], ["Próximos do rodízio", stats.proximosRodizio, RefreshCcw],
    ["Desgaste crítico", stats.criticos, ShieldAlert], ["Custo total", money(stats.custo), CircleDollarSign], ["Economia com recapagens", money(stats.economia), Gauge],
  ] as const;

  return <Layout>
    <div className="w-full min-w-0 space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Pneus</h1><p className="text-sm text-muted-foreground">Gestão do ciclo de vida, estoque, custos e histórico dos pneus.</p></div>
        <Button onClick={openCreate}><Plus className="mr-2 h-4 w-4"/>Novo pneu</Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map(([label, value, Icon]) => <Card key={label} className="min-w-0 overflow-hidden"><CardContent className="flex min-w-0 items-center justify-between gap-3 p-4"><div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{label}</p><p className="mt-1 truncate text-xl font-bold" title={String(value)}>{value}</p></div><Icon className="h-5 w-5 shrink-0 text-primary"/></CardContent></Card>)}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card><CardHeader><CardTitle className="text-sm">Distribuição por status</CardTitle></CardHeader><CardContent className="space-y-3">{statusDistribution.map(item => <div key={item.key}><div className="mb-1 flex justify-between text-xs"><span>{item.label}</span><strong>{item.value}</strong></div><div className="h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(item.value / maxStatus) * 100}%` }}/></div></div>)}</CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Desgaste médio dos pneus</CardTitle></CardHeader><CardContent><div className="flex items-end justify-between"><div><p className="text-3xl font-bold">{desgasteMedio.toFixed(1)}%</p><p className="text-xs text-muted-foreground">Com base nos sulcos inicial e atual cadastrados.</p></div><Gauge className="h-10 w-10 text-primary"/></div><div className="mt-5 h-3 rounded-full bg-muted"><div className="h-3 rounded-full bg-primary" style={{ width: `${desgasteMedio}%` }}/></div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Custos de compra por mês</CardTitle></CardHeader><CardContent><div className="flex h-32 items-end gap-3">{monthlyCosts.map(month => <div key={month.key} className="flex flex-1 flex-col items-center gap-1"><span className="text-[10px] text-muted-foreground">{month.value ? money(month.value) : "—"}</span><div className="w-full rounded-t bg-primary" style={{ height: `${Math.max(4, (month.value / maxMonthlyCost) * 90)}px` }}/><span className="text-[10px] capitalize text-muted-foreground">{month.label}</span></div>)}</div></CardContent></Card>
        <Card><CardHeader><CardTitle className="text-sm">Quantidade de recapagens</CardTitle></CardHeader><CardContent><div className="flex items-end justify-between"><div><p className="text-3xl font-bold">{totalRecapagens}</p><p className="text-xs text-muted-foreground">Recapagens informadas nos pneus cadastrados.</p></div><Recycle className="h-10 w-10 text-primary"/></div><div className="mt-5 grid grid-cols-4 gap-2 text-center text-xs">{[0,1,2,3].map(n => <div key={n} className="rounded-md bg-muted p-2"><strong>{items.filter(p => p.recapagensRealizadas === n).length}</strong><span className="block text-muted-foreground">{n} rec.</span></div>)}</div></CardContent></Card>
      </div>

      <Tabs defaultValue="cadastro">
        <TabsList className="flex h-auto flex-wrap"><TabsTrigger value="cadastro">Cadastro</TabsTrigger><TabsTrigger value="estoque">Estoque</TabsTrigger><TabsTrigger value="instalacoes">Instalações</TabsTrigger><TabsTrigger value="rodizios">Rodízios</TabsTrigger><TabsTrigger value="manutencao">Manutenção</TabsTrigger><TabsTrigger value="historico">Histórico</TabsTrigger><TabsTrigger value="gestao">Gestão e relatórios</TabsTrigger></TabsList>
        <TabsContent value="cadastro" className="mt-4 space-y-4">
          <Card><CardContent className="p-4"><div className="flex flex-col gap-3 md:flex-row"><div className="relative flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" placeholder="Pesquisar número de fogo, marca, modelo, medida, ARO ou fornecedor" value={search} onChange={e => setSearch(e.target.value)}/></div><Select value={status} onValueChange={v => setStatus(v as any)}><SelectTrigger className="md:w-56"><SelectValue/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem>{Object.entries(statusLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div></CardContent></Card>
          <Card><CardContent className="p-0"><div className="overflow-x-auto"><Table><TableHeader><TableRow><TableHead>Nº de fogo</TableHead><TableHead>Marca / Modelo</TableHead><TableHead>Medida</TableHead><TableHead>ARO</TableHead><TableHead>Tipo</TableHead><TableHead>Status</TableHead><TableHead>Sulco atual</TableHead><TableHead>Compra</TableHead><TableHead className="text-right">Ações</TableHead></TableRow></TableHeader><TableBody>{cadastroItems.map(p => <TableRow key={p.id}><TableCell className="font-semibold"><button className="text-primary hover:underline" onClick={() => setDetails(p)}>{p.numeroFogo || "—"}</button></TableCell><TableCell>{[p.marca, p.modelo].filter(Boolean).join(" - ") || "—"}</TableCell><TableCell>{p.medida || "—"}</TableCell><TableCell>{p.aro || "—"}</TableCell><TableCell>{tipoLabels[p.tipo]}</TableCell><TableCell><Badge variant={p.status === "DESCARTADO" ? "destructive" : p.status === "INSTALADO" ? "default" : "secondary"}>{statusLabels[p.status]}</Badge></TableCell><TableCell>{p.sulcoAtual == null ? "—" : `${p.sulcoAtual.toFixed(1)} mm`}</TableCell><TableCell>{date(p.dataCompra)}</TableCell><TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" onClick={() => setDetails(p)}><History className="h-4 w-4"/></Button><Button variant="ghost" size="icon" title="Editar informações do pneu" aria-label="Editar informações do pneu" onClick={() => openEdit(p)}><Pencil className="h-4 w-4"/></Button><Button variant="ghost" size="icon" className="text-destructive" onClick={() => archive(p)}><Trash2 className="h-4 w-4"/></Button></div></TableCell></TableRow>)}{cadastroItems.length === 0 && <TableRow><TableCell colSpan={9} className="h-28 text-center text-muted-foreground">Nenhum pneu encontrado.</TableCell></TableRow>}</TableBody></Table></div></CardContent></Card>
        </TabsContent>
        <TabsContent value="estoque" className="mt-4 space-y-4">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.entries(condicaoLabels).map(([key, label]) => <Card key={key}><CardHeader><CardTitle className="text-sm">{label}</CardTitle></CardHeader><CardContent><p className="text-3xl font-bold">{estoqueItems.filter(p => p.condicao === key).length}</p><p className="text-xs text-muted-foreground">pneus em estoque</p></CardContent></Card>)}
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between gap-3 text-base">
                <span>Pneus em estoque</span>
                <Badge variant="secondary">{estoqueItems.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº de fogo</TableHead>
                      <TableHead>Marca / Modelo</TableHead>
                      <TableHead>Medida</TableHead>
                      <TableHead>ARO</TableHead>
                      <TableHead>Condição</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Sulco atual</TableHead>
                      <TableHead>Compra</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {estoqueItems.map((p) => <TableRow key={p.id}>
                      <TableCell className="font-semibold"><button className="text-primary hover:underline" onClick={() => setDetails(p)}>{p.numeroFogo || "—"}</button></TableCell>
                      <TableCell>{[p.marca, p.modelo].filter(Boolean).join(" - ") || "—"}</TableCell>
                      <TableCell>{p.medida || "—"}</TableCell>
                      <TableCell>{p.aro || "—"}</TableCell>
                      <TableCell><Badge variant="secondary">{condicaoLabels[p.condicao]}</Badge></TableCell>
                      <TableCell>{tipoLabels[p.tipo]}</TableCell>
                      <TableCell>{p.sulcoAtual == null ? "—" : `${p.sulcoAtual.toFixed(1)} mm`}</TableCell>
                      <TableCell>{date(p.dataCompra)}</TableCell>
                      <TableCell className="text-right"><div className="flex justify-end gap-1"><Button variant="ghost" size="icon" title="Ver detalhes" onClick={() => setDetails(p)}><History className="h-4 w-4"/></Button><Button variant="ghost" size="icon" title="Editar informações do pneu" onClick={() => openEdit(p)}><Pencil className="h-4 w-4"/></Button></div></TableCell>
                    </TableRow>)}
                    {estoqueItems.length === 0 && <TableRow><TableCell colSpan={9} className="h-28 text-center text-muted-foreground">Nenhum pneu está em estoque.</TableCell></TableRow>}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="instalacoes" className="mt-4"><PneuInstalacoes/></TabsContent>
        <TabsContent value="rodizios" className="mt-4"><PneuRodizios/></TabsContent>
        <TabsContent value="manutencao" className="mt-4"><PneuManutencao/></TabsContent><TabsContent value="gestao" className="mt-4"><PneuGestao/></TabsContent>
        <TabsContent value="historico" className="mt-4"><Card><CardContent className="p-4"><div className="space-y-4">{historico.map(e => <div key={e.id} className="flex gap-3 border-b pb-4 last:border-0"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary"/><div><p className="text-sm font-medium">Pneu {e.pneu.numeroFogo || "sem número"} — {e.observacoes || e.tipo}</p><p className="text-xs text-muted-foreground">{new Date(e.data).toLocaleString("pt-BR")}{e.responsavel ? ` • ${e.responsavel}` : ""}</p></div></div>)}</div></CardContent></Card></TabsContent>
      </Tabs>
    </div>

    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Editar pneu" : "Cadastrar pneu"}</DialogTitle><DialogDescription>Todos os campos são opcionais. Preencha apenas as informações disponíveis.</DialogDescription></DialogHeader><div className="grid gap-4 py-2 md:grid-cols-2">
      {[["Número de fogo","numeroFogo"],["Marca","marca"],["Modelo","modelo"],["Medida","medida"],["ARO","aro"],["DOT","dot"],["Número de série","numeroSerie"],["Fornecedor","fornecedor"]].map(([label, key]) => <div key={key} className="space-y-1.5"><Label>{label}</Label><Input value={(form as any)[key]} onChange={e => setForm({ ...form, [key]: e.target.value })}/></div>)}
      <div className="space-y-1.5"><Label>Tipo</Label><Select value={form.tipo} onValueChange={v => setForm({ ...form, tipo: v as TipoPneu })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(tipoLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5">
        <Label>Valor de compra</Label>
        <Input
          type="text"
          inputMode="decimal"
          placeholder="R$ 0,00"
          value={form.valorCompra}
          onChange={e => setForm({ ...form, valorCompra: e.target.value })}
          onBlur={() => setForm(current => ({
            ...current,
            valorCompra: formatBRLCurrencyInput(current.valorCompra),
          }))}
        />
        <p className="text-xs text-muted-foreground">Valor em reais. Ex.: R$ 1.234,56</p>
      </div>
      <div className="space-y-1.5"><Label>Data de compra</Label><Input type="date" value={form.dataCompra} onChange={e => setForm({ ...form, dataCompra: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Máximo de recapagens</Label><Input type="number" min="0" value={form.maxRecapagens} onChange={e => setForm({ ...form, maxRecapagens: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Recapagens realizadas</Label><Input type="number" min="0" value={form.recapagensRealizadas} onChange={e => setForm({ ...form, recapagensRealizadas: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Status</Label><Select value={form.status} onValueChange={v => setForm({ ...form, status: v as StatusPneu })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(statusLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Condição</Label><Select value={form.condicao} onValueChange={v => setForm({ ...form, condicao: v as CondicaoPneu })}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{Object.entries(condicaoLabels).map(([k,v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent></Select></div>
      <div className="space-y-1.5"><Label>Sulco inicial (mm)</Label><Input type="number" min="0" step="0.1" value={form.sulcoInicial} onChange={e => setForm({ ...form, sulcoInicial: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Sulco atual (mm)</Label><Input type="number" min="0" step="0.1" value={form.sulcoAtual} onChange={e => setForm({ ...form, sulcoAtual: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Quilometragem acumulada</Label><Input type="number" min="0" step="0.1" value={form.kmAtual} onChange={e => setForm({ ...form, kmAtual: e.target.value })}/></div>
      <div className="space-y-1.5"><Label>Próximo rodízio (km)</Label><Input type="number" min="0" step="0.1" value={form.proximoRodizioKm} onChange={e => setForm({ ...form, proximoRodizioKm: e.target.value })}/></div>
      <div className="space-y-1.5 md:col-span-2"><Label>Fotos</Label><label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed p-4 text-sm text-muted-foreground hover:bg-muted"><ImagePlus className="h-4 w-4"/>Adicionar fotos<input type="file" accept="image/*" multiple className="hidden" onChange={e => void handlePhotos(e.target.files)}/></label>{(Array.isArray(form.fotos) ? form.fotos.length : 0) > 0 && <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-5">{(Array.isArray(form.fotos) ? form.fotos : []).map((url, i) => <div key={i} className="relative aspect-square overflow-hidden rounded-md border"><img src={url} alt={`Foto ${i+1}`} className="h-full w-full object-cover"/><button type="button" onClick={() => setForm({ ...form, fotos: (Array.isArray(form.fotos) ? form.fotos : []).filter((_, j) => j !== i) })} className="absolute right-1 top-1 rounded bg-background/90 px-1 text-xs">×</button></div>)}</div>}</div>
      <div className="space-y-1.5 md:col-span-2"><Label>Observações</Label><Textarea value={form.observacoes} onChange={e => setForm({ ...form, observacoes: e.target.value })}/></div>
    </div><DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancelar</Button><Button onClick={save} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter></DialogContent></Dialog>

    <Dialog open={!!details} onOpenChange={o => !o && setDetails(null)}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">{details && <><DialogHeader><DialogTitle>Pneu {details.numeroFogo}</DialogTitle><DialogDescription>{[details.marca, details.modelo, details.medida, details.aro ? `ARO ${details.aro}` : ""].filter(Boolean).join(" • ") || "Informações cadastrais do pneu"}</DialogDescription></DialogHeader><div className="grid gap-3 sm:grid-cols-3">{[["Status", statusLabels[details.status]],["Condição",condicaoLabels[details.condicao]],["Tipo",tipoLabels[details.tipo]],["ARO",details.aro || "—"],["DOT",details.dot || "—"],["Valor",money(details.valorCompra)],["Fornecedor",details.fornecedor || "—"],["Sulco atual",details.sulcoAtual == null ? "—" : `${details.sulcoAtual} mm`],["Km acumulado",details.kmAtual.toLocaleString("pt-BR")],["Recapagens",`${details.recapagensRealizadas}/${details.maxRecapagens}`]].map(([a,b]) => <div key={a} className="rounded-lg border p-3"><p className="text-xs text-muted-foreground">{a}</p><p className="text-sm font-semibold">{b}</p></div>)}</div>{(details.fotos ?? []).length > 0 && <div><h3 className="mb-2 text-sm font-semibold">Fotos</h3><div className="grid grid-cols-3 gap-2 sm:grid-cols-5">{(details.fotos ?? []).map(f => <img key={f.id} src={f.url} alt="Pneu" className="aspect-square rounded-md border object-cover"/>)}</div></div>}<div><h3 className="mb-3 text-sm font-semibold">Linha do tempo</h3><div className="space-y-4">{(details.eventos ?? []).map(e => <div key={e.id} className="flex gap-3"><div className="mt-1 h-2.5 w-2.5 rounded-full bg-primary"/><div><p className="text-sm font-medium">{e.observacoes || e.tipo}</p><p className="text-xs text-muted-foreground">{new Date(e.data).toLocaleString("pt-BR")}</p></div></div>)}</div></div><DialogFooter><Button variant="outline" onClick={() => { const pneu = details; setDetails(null); openEdit(pneu); }}><Pencil className="mr-2 h-4 w-4"/>Editar informações</Button></DialogFooter></>}</DialogContent></Dialog>
  </Layout>;
}
