import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarDays, ClipboardList, MapPinned, Package, Pencil, Plus, Search, Sprout, Tractor, Trash2, Wheat } from "lucide-react";
import { toast } from "sonner";
import AgroLayout from "@/components/agro/AgroLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import type { AgroCrop, AgroCropCycle, AgroCropCycleStatus, AgroFarm, AgroLot, AgroOperation, AgroOperationType, AgroPlot, AgroSeason, AgroStoragePosition, AgroStockLocation, AgroStockRow } from "@/lib/agro";
import { agroCropCycleStatusLabel, agroOperationLabel, formatAgroDate, formatAgroNumber } from "@/lib/agro";

const today = () => new Date().toISOString().slice(0, 10);
const emptyCropCycle = { talhaoId: "", safraId: "", culturaId: "", areaHa: "", status: "PLANEJADA" as AgroCropCycleStatus, dataPlantio: "", dataPrevisaoColheita: "", observacoes: "" };
const emptyOperation = { lavouraId: "", tipo: "APLICACAO" as AgroOperationType, data: today(), areaHa: "", localId: "", responsavel: "", documento: "", observacoes: "" };
type ProductUse = { key: number; produtoId: string; loteId: string; posicaoId: string; quantidade: string; valorUnitario: string };

export default function AgroLavouras() {
  const [tab, setTab] = useState("lavouras");
  const [farms, setFarms] = useState<AgroFarm[]>([]);
  const [plots, setPlots] = useState<AgroPlot[]>([]);
  const [seasons, setSeasons] = useState<AgroSeason[]>([]);
  const [crops, setCrops] = useState<AgroCrop[]>([]);
  const [cropCycles, setCropCycles] = useState<AgroCropCycle[]>([]);
  const [operations, setOperations] = useState<AgroOperation[]>([]);
  const [stock, setStock] = useState<AgroStockRow[]>([]);
  const [locations, setLocations] = useState<AgroStockLocation[]>([]);
  const [positions, setPositions] = useState<AgroStoragePosition[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [seasonFilter, setSeasonFilter] = useState("TODAS");

  const [cropCycleOpen, setCropCycleOpen] = useState(false);
  const [editingCropCycle, setEditingCropCycle] = useState<AgroCropCycle | null>(null);
  const [cropCycleForm, setCropCycleForm] = useState(emptyCropCycle);
  const [savingCropCycle, setSavingCropCycle] = useState(false);

  const [operationOpen, setOperationOpen] = useState(false);
  const [operationForm, setOperationForm] = useState(emptyOperation);
  const [productUses, setProductUses] = useState<ProductUse[]>([]);
  const [lotsByProduct, setLotsByProduct] = useState<Record<string, AgroLot[]>>({});
  const [savingOperation, setSavingOperation] = useState(false);
  const [rowSeed, setRowSeed] = useState(1);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [farmRes, plotRes, seasonRes, cropRes, cropCycleRes, operationRes, stockRes, localRes, positionRes] = await Promise.all([
        api.get<AgroFarm[]>("/agro/fazendas"),
        api.get<AgroPlot[]>("/agro/talhoes"),
        api.get<AgroSeason[]>("/agro/safras"),
        api.get<AgroCrop[]>("/agro/culturas"),
        api.get<AgroCropCycle[]>("/agro/lavouras"),
        api.get<AgroOperation[]>("/agro/operacoes", { params: { take: 300 } }),
        api.get<AgroStockRow[]>("/agro/estoque"),
        api.get<AgroStockLocation[]>("/agro/locais"),
        api.get<AgroStoragePosition[]>("/agro/posicoes"),
      ]);
      setFarms(Array.isArray(farmRes.data) ? farmRes.data : []);
      setPlots(Array.isArray(plotRes.data) ? plotRes.data : []);
      setSeasons(Array.isArray(seasonRes.data) ? seasonRes.data : []);
      setCrops(Array.isArray(cropRes.data) ? cropRes.data : []);
      setCropCycles(Array.isArray(cropCycleRes.data) ? cropCycleRes.data : []);
      setOperations(Array.isArray(operationRes.data) ? operationRes.data : []);
      setStock(Array.isArray(stockRes.data) ? stockRes.data : []);
      setLocations(Array.isArray(localRes.data) ? localRes.data : []);
      setPositions(Array.isArray(positionRes.data) ? positionRes.data : []);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível carregar as lavouras."); }
    finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "agro", "agro/lavouras", "agro/operacoes", "agro/fazendas", "agro/talhoes", "agro/safras", "agro/culturas", "agro/estoque", "agro/movimentacoes", "agro/posicoes")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(true), 250);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => { if (timer) window.clearTimeout(timer); window.removeEventListener(REALTIME_CHANGE_EVENT, handler); };
  }, [load]);

  const query = search.trim().toLocaleLowerCase("pt-BR");
  const filteredCropCycles = useMemo(() => cropCycles.filter((item) => {
    if (seasonFilter !== "TODAS" && item.safraId !== seasonFilter) return false;
    if (!query) return true;
    return [item.talhao?.fazenda?.nome, item.talhao?.nome, item.safra?.nome, item.cultura?.nome, agroCropCycleStatusLabel(item.status)].some((v) => String(v || "").toLocaleLowerCase("pt-BR").includes(query));
  }), [cropCycles, query, seasonFilter]);
  const filteredOperations = useMemo(() => operations.filter((item) => {
    if (seasonFilter !== "TODAS" && item.lavoura?.safraId !== seasonFilter) return false;
    if (!query) return true;
    return [agroOperationLabel(item.tipo), item.lavoura?.talhao?.fazenda?.nome, item.lavoura?.talhao?.nome, item.lavoura?.cultura?.nome, item.responsavel, item.documento].some((v) => String(v || "").toLocaleLowerCase("pt-BR").includes(query));
  }), [operations, query, seasonFilter]);

  const stats = useMemo(() => ({
    farms: farms.filter((f) => f.ativo).length,
    plots: plots.filter((p) => p.ativo).length,
    activeCrops: cropCycles.filter((c) => c.status === "EM_ANDAMENTO").length,
    operationsMonth: operations.filter((o) => o.data.startsWith(today().slice(0, 7))).length,
  }), [farms, plots, cropCycles, operations]);

  function newCropCycle() {
    setEditingCropCycle(null);
    const firstPlot = plots.find((p) => p.ativo && p.fazenda?.ativo !== false);
    const firstSeason = seasons.find((s) => s.ativo);
    const firstCrop = crops.find((c) => c.ativo);
    setCropCycleForm({ ...emptyCropCycle, talhaoId: firstPlot?.id || "", safraId: firstSeason?.id || "", culturaId: firstCrop?.id || "", areaHa: firstPlot ? String(firstPlot.areaHa) : "" });
    setCropCycleOpen(true);
  }

  function editCropCycle(item: AgroCropCycle) {
    setEditingCropCycle(item);
    setCropCycleForm({ talhaoId: item.talhaoId, safraId: item.safraId, culturaId: item.culturaId, areaHa: String(item.areaHa), status: item.status, dataPlantio: item.dataPlantio || "", dataPrevisaoColheita: item.dataPrevisaoColheita || "", observacoes: item.observacoes || "" });
    setCropCycleOpen(true);
  }

  async function saveCropCycle() {
    if (!cropCycleForm.talhaoId || !cropCycleForm.safraId || !cropCycleForm.culturaId) return toast.error("Selecione talhão, safra e cultura.");
    const areaHa = Number(String(cropCycleForm.areaHa || 0).replace(",", "."));
    if (!Number.isFinite(areaHa) || areaHa < 0) return toast.error("Informe uma área válida.");
    setSavingCropCycle(true);
    try {
      const payload = { ...cropCycleForm, areaHa };
      if (editingCropCycle) await api.put(`/agro/lavouras/${editingCropCycle.id}`, payload);
      else await api.post("/agro/lavouras", payload);
      toast.success(editingCropCycle ? "Lavoura atualizada." : "Lavoura criada.");
      setCropCycleOpen(false);
      await load(true);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível salvar a lavoura."); }
    finally { setSavingCropCycle(false); }
  }

  async function loadOperationStock(localId: string) {
    if (!localId) return;
    try { const response = await api.get<AgroStockRow[]>("/agro/estoque", { params: { localId } }); setStock(Array.isArray(response.data) ? response.data : []); }
    catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível carregar o estoque do barracão."); }
  }

  function newOperation(cropCycle?: AgroCropCycle) {
    const selected = cropCycle || cropCycles.find((c) => c.status !== "CONCLUIDA");
    const local = locations.find((l) => l.ativo && l.principal) || locations.find((l) => l.ativo);
    setOperationForm({ ...emptyOperation, data: today(), lavouraId: selected?.id || "", areaHa: selected ? String(selected.areaHa) : "", localId: local?.id || "" });
    setProductUses([]);
    setLotsByProduct({});
    if (local) void loadOperationStock(local.id);
    setOperationOpen(true);
  }

  function addProductUse() {
    const next = rowSeed;
    setRowSeed((value) => value + 1);
    setProductUses((rows) => [...rows, { key: next, produtoId: "", loteId: "", posicaoId: "", quantidade: "", valorUnitario: "0" }]);
  }

  const lotsKey = (produtoId: string, posicaoId: string) => `${produtoId}|${posicaoId || "SEM_POSICAO"}`;

  async function loadRowLots(produtoId: string, posicaoId: string) {
    const stockRow = stock.find((row) => row.produto.id === produtoId);
    if (!produtoId || !stockRow?.produto.controlaLote) return;
    const key = lotsKey(produtoId, posicaoId);
    try {
      const response = await api.get<AgroLot[]>("/agro/lotes", { params: { produtoId, ...(operationForm.localId ? { localId: operationForm.localId } : {}), ...(operationForm.localId ? { posicaoId: posicaoId || "__SEM_POSICAO__" } : {}) } });
      setLotsByProduct((current) => ({ ...current, [key]: Array.isArray(response.data) ? response.data : [] }));
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível carregar os lotes do produto."); }
  }

  async function selectProduct(rowKey: number, produtoId: string) {
    const current = productUses.find((row) => row.key === rowKey);
    const posicaoId = current?.posicaoId || "";
    setProductUses((rows) => rows.map((row) => row.key === rowKey ? { ...row, produtoId, loteId: "" } : row));
    await loadRowLots(produtoId, posicaoId);
  }

  async function selectPosition(rowKey: number, posicaoId: string) {
    const current = productUses.find((row) => row.key === rowKey);
    setProductUses((rows) => rows.map((row) => row.key === rowKey ? { ...row, posicaoId, loteId: "" } : row));
    if (current?.produtoId) await loadRowLots(current.produtoId, posicaoId);
  }

  async function saveOperation() {
    if (!operationForm.lavouraId) return toast.error("Selecione a lavoura.");
    if (!operationForm.localId && productUses.length) return toast.error("Selecione o barracão de origem dos produtos.");
    const areaHa = Number(String(operationForm.areaHa || 0).replace(",", "."));
    if (!Number.isFinite(areaHa) || areaHa < 0) return toast.error("Informe uma área válida.");
    const products = [] as Array<{ produtoId: string; loteId: string | null; posicaoId: string | null; quantidade: number; valorUnitario: number }>;
    for (const row of productUses) {
      if (!row.produtoId) return toast.error("Selecione o produto em todas as linhas de consumo.");
      const quantity = Number(String(row.quantidade).replace(",", "."));
      const unitValue = Number(String(row.valorUnitario || 0).replace(",", "."));
      const stockRow = stock.find((item) => item.produto.id === row.produtoId);
      if (!Number.isFinite(quantity) || quantity <= 0) return toast.error("Informe uma quantidade válida para cada produto.");
      if (!Number.isFinite(unitValue) || unitValue < 0) return toast.error("Informe um valor unitário válido.");
      if (stockRow?.produto.controlaLote && !row.loteId) return toast.error(`Selecione o lote de ${stockRow.produto.nome}.`);
      products.push({ produtoId: row.produtoId, loteId: row.loteId || null, posicaoId: row.posicaoId || null, quantidade: quantity, valorUnitario: unitValue });
    }
    setSavingOperation(true);
    try {
      await api.post("/agro/operacoes", { ...operationForm, areaHa, produtos: products });
      toast.success(products.length ? "Operação registrada e estoque baixado automaticamente." : "Operação agrícola registrada.");
      setOperationOpen(false);
      setTab("operacoes");
      await load(true);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível registrar a operação."); }
    finally { setSavingOperation(false); }
  }

  const selectedOperationCrop = cropCycles.find((item) => item.id === operationForm.lavouraId);
  const activeStock = stock.filter((row) => row.produto.ativo && row.estoque > 0);

  return (
    <AgroLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agro / Lavouras</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Gestão de lavouras</h1><p className="mt-2 text-sm text-muted-foreground">Safras por talhão, operações de campo e consumo integrado ao estoque.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={newCropCycle}><Plus className="mr-2 h-4 w-4" />Nova lavoura</Button><Button onClick={() => newOperation()}><Tractor className="mr-2 h-4 w-4" />Nova operação</Button></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[["Fazendas ativas", stats.farms, MapPinned], ["Talhões ativos", stats.plots, Sprout], ["Lavouras em andamento", stats.activeCrops, Wheat], ["Operações no mês", stats.operationsMonth, Tractor]].map(([label, value, Icon]: any) => <Card key={label}><CardContent className="flex items-center justify-between p-4"><div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>)}
        </div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList><TabsTrigger value="lavouras"><Sprout />Lavouras</TabsTrigger><TabsTrigger value="operacoes"><ClipboardList />Operações</TabsTrigger></TabsList>
            <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row lg:max-w-2xl"><div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar fazenda, talhão, cultura ou responsável..." value={search} onChange={(e) => setSearch(e.target.value)} /></div><select className="h-9 rounded-md border bg-background px-3 text-sm" value={seasonFilter} onChange={(e) => setSeasonFilter(e.target.value)}><option value="TODAS">Todas as safras</option>{seasons.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></div>
          </div>

          <TabsContent value="lavouras">
            <div className="mt-3 overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[950px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Fazenda / Talhão</th><th className="px-4 py-3">Safra</th><th className="px-4 py-3">Cultura</th><th className="px-4 py-3 text-right">Área</th><th className="px-4 py-3">Plantio</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-center">Operações</th><th className="px-4 py-3"></th></tr></thead><tbody className="divide-y">{filteredCropCycles.map((item) => <tr key={item.id}><td className="px-4 py-3"><div className="font-semibold">{item.talhao?.fazenda?.nome || "—"}</div><div className="text-xs text-muted-foreground">{item.talhao?.nome || "—"}</div></td><td className="px-4 py-3">{item.safra?.nome}</td><td className="px-4 py-3 font-medium">{item.cultura?.nome}</td><td className="px-4 py-3 text-right">{formatAgroNumber(item.areaHa)} ha</td><td className="px-4 py-3">{formatAgroDate(item.dataPlantio)}</td><td className="px-4 py-3"><CropStatus status={item.status} /></td><td className="px-4 py-3 text-center">{item._count?.operacoes ?? 0}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="sm" variant="ghost" onClick={() => newOperation(item)} title="Registrar operação"><Tractor className="h-4 w-4" /></Button><Button size="sm" variant="ghost" onClick={() => editCropCycle(item)} title="Editar lavoura"><Pencil className="h-4 w-4" /></Button></div></td></tr>)}{loading && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Carregando lavouras...</td></tr>}{!loading && filteredCropCycles.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Nenhuma lavoura encontrada. Cadastre fazenda, talhão, safra e cultura antes de criar a primeira lavoura.</td></tr>}</tbody></table></div></div>
          </TabsContent>

          <TabsContent value="operacoes">
            <div className="mt-3 overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[1080px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Operação</th><th className="px-4 py-3">Fazenda / Talhão</th><th className="px-4 py-3">Cultura / Safra</th><th className="px-4 py-3 text-right">Área</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Produtos consumidos</th></tr></thead><tbody className="divide-y">{filteredOperations.map((item) => <tr key={item.id}><td className="px-4 py-3">{formatAgroDate(item.data)}</td><td className="px-4 py-3"><span className="font-semibold">{agroOperationLabel(item.tipo)}</span>{item.documento && <div className="text-xs text-muted-foreground">{item.documento}</div>}</td><td className="px-4 py-3"><div className="font-medium">{item.lavoura?.talhao?.fazenda?.nome || "—"}</div><div className="text-xs text-muted-foreground">{item.lavoura?.talhao?.nome || "—"}</div></td><td className="px-4 py-3"><div>{item.lavoura?.cultura?.nome}</div><div className="text-xs text-muted-foreground">{item.lavoura?.safra?.nome}</div></td><td className="px-4 py-3 text-right">{formatAgroNumber(item.areaHa)} ha</td><td className="px-4 py-3">{item.responsavel || "—"}</td><td className="px-4 py-3">{item.movimentacoes?.length ? <div className="space-y-1">{item.movimentacoes.slice(0, 3).map((m) => <div key={m.id} className="text-xs"><span className="font-medium">{m.produto?.nome}</span> · {formatAgroNumber(m.quantidade)} {m.produto?.unidadeMedida}{m.lote?.codigo ? ` · lote ${m.lote.codigo}` : ""}{m.posicao?.codigo ? ` · posição ${m.posicao.codigo}` : " · sem posição"}</div>)}{item.movimentacoes.length > 3 && <div className="text-xs text-muted-foreground">+ {item.movimentacoes.length - 3} item(ns)</div>}</div> : <span className="text-muted-foreground">Sem consumo de estoque</span>}</td></tr>)}{loading && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Carregando operações...</td></tr>}{!loading && filteredOperations.length === 0 && <tr><td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">Nenhuma operação agrícola encontrada.</td></tr>}</tbody></table></div></div>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={cropCycleOpen} onOpenChange={setCropCycleOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingCropCycle ? "Editar lavoura" : "Nova lavoura"}</DialogTitle><DialogDescription>Vincule um talhão a uma safra e cultura. Uma mesma combinação não pode ser duplicada.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Talhão *"><select disabled={Boolean(editingCropCycle && (editingCropCycle._count?.operacoes || 0) > 0)} className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50" value={cropCycleForm.talhaoId} onChange={(e) => { const plot = plots.find((p) => p.id === e.target.value); setCropCycleForm((f) => ({ ...f, talhaoId: e.target.value, areaHa: plot ? String(plot.areaHa) : f.areaHa })); }}><option value="">Selecione...</option>{plots.filter((p) => p.ativo || p.id === cropCycleForm.talhaoId).map((p) => <option key={p.id} value={p.id}>{p.fazenda?.nome} · {p.nome}</option>)}</select></Field>
            <Field label="Safra *"><select disabled={Boolean(editingCropCycle && (editingCropCycle._count?.operacoes || 0) > 0)} className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50" value={cropCycleForm.safraId} onChange={(e) => setCropCycleForm((f) => ({ ...f, safraId: e.target.value }))}><option value="">Selecione...</option>{seasons.filter((s) => s.ativo || s.id === cropCycleForm.safraId).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</select></Field>
            <Field label="Cultura *"><select disabled={Boolean(editingCropCycle && (editingCropCycle._count?.operacoes || 0) > 0)} className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50" value={cropCycleForm.culturaId} onChange={(e) => setCropCycleForm((f) => ({ ...f, culturaId: e.target.value }))}><option value="">Selecione...</option>{crops.filter((c) => c.ativo || c.id === cropCycleForm.culturaId).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
            <Field label="Área da lavoura (ha)"><Input type="number" min="0" step="0.001" value={cropCycleForm.areaHa} onChange={(e) => setCropCycleForm((f) => ({ ...f, areaHa: e.target.value }))} /></Field>
            <Field label="Status"><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={cropCycleForm.status} onChange={(e) => setCropCycleForm((f) => ({ ...f, status: e.target.value as AgroCropCycleStatus }))}><option value="PLANEJADA">Planejada</option><option value="EM_ANDAMENTO">Em andamento</option><option value="CONCLUIDA">Concluída</option></select></Field>
            <Field label="Data de plantio"><Input type="date" value={cropCycleForm.dataPlantio} onChange={(e) => setCropCycleForm((f) => ({ ...f, dataPlantio: e.target.value }))} /></Field>
            <Field label="Previsão de colheita"><Input type="date" value={cropCycleForm.dataPrevisaoColheita} onChange={(e) => setCropCycleForm((f) => ({ ...f, dataPrevisaoColheita: e.target.value }))} /></Field>
          </div>
          <Field label="Observações"><Textarea rows={3} value={cropCycleForm.observacoes} onChange={(e) => setCropCycleForm((f) => ({ ...f, observacoes: e.target.value }))} /></Field>
          <DialogFooter><Button variant="outline" onClick={() => setCropCycleOpen(false)}>Cancelar</Button><Button disabled={savingCropCycle} onClick={() => void saveCropCycle()}>{savingCropCycle ? "Salvando..." : "Salvar lavoura"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={operationOpen} onOpenChange={setOperationOpen}>
        <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar operação agrícola</DialogTitle><DialogDescription>Produtos adicionados aqui geram saídas do estoque automaticamente. Se qualquer item estiver sem saldo, a operação inteira é cancelada.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Lavoura *"><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={operationForm.lavouraId} onChange={(e) => { const item = cropCycles.find((c) => c.id === e.target.value); setOperationForm((f) => ({ ...f, lavouraId: e.target.value, areaHa: item ? String(item.areaHa) : "" })); }}><option value="">Selecione...</option>{cropCycles.filter((c) => c.status !== "CONCLUIDA").map((c) => <option key={c.id} value={c.id}>{c.talhao?.fazenda?.nome} · {c.talhao?.nome} · {c.cultura?.nome} · {c.safra?.nome}</option>)}</select></Field>
            <Field label="Operação"><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={operationForm.tipo} onChange={(e) => setOperationForm((f) => ({ ...f, tipo: e.target.value as AgroOperationType }))}>{(["PLANTIO", "ADUBACAO", "PULVERIZACAO", "APLICACAO", "MONITORAMENTO", "COLHEITA", "OUTROS"] as AgroOperationType[]).map((type) => <option key={type} value={type}>{agroOperationLabel(type)}</option>)}</select></Field>
            <Field label="Data"><Input type="date" max={today()} value={operationForm.data} onChange={(e) => setOperationForm((f) => ({ ...f, data: e.target.value }))} /></Field>
            <Field label="Área trabalhada (ha)"><Input type="number" min="0" step="0.001" value={operationForm.areaHa} onChange={(e) => setOperationForm((f) => ({ ...f, areaHa: e.target.value }))} /></Field>
            <Field label="Barracão de origem"><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={operationForm.localId} onChange={(e) => { const localId = e.target.value; setOperationForm((f) => ({ ...f, localId })); setProductUses([]); setLotsByProduct({}); void loadOperationStock(localId); }}><option value="">Selecione...</option>{locations.filter((l) => l.ativo).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select></Field>
            <Field label="Responsável"><Input value={operationForm.responsavel} onChange={(e) => setOperationForm((f) => ({ ...f, responsavel: e.target.value }))} placeholder="Ex.: Elton" /></Field>
            <Field label="Documento / referência"><Input value={operationForm.documento} onChange={(e) => setOperationForm((f) => ({ ...f, documento: e.target.value }))} /></Field>
          </div>
          {selectedOperationCrop && <div className="rounded-lg border bg-muted/20 p-3 text-sm"><span className="font-semibold">{selectedOperationCrop.talhao?.fazenda?.nome} · {selectedOperationCrop.talhao?.nome}</span><span className="text-muted-foreground"> · {selectedOperationCrop.cultura?.nome} · safra {selectedOperationCrop.safra?.nome} · {formatAgroNumber(selectedOperationCrop.areaHa)} ha</span></div>}
          <Field label="Observações"><Textarea rows={3} value={operationForm.observacoes} onChange={(e) => setOperationForm((f) => ({ ...f, observacoes: e.target.value }))} /></Field>

          <div className="rounded-xl border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-muted/30 px-4 py-3"><div><div className="text-sm font-semibold">Produtos utilizados</div><div className="text-xs text-muted-foreground">Opcional. Cada item informado será baixado da posição selecionada no estoque.</div></div><Button type="button" size="sm" variant="outline" onClick={addProductUse} disabled={activeStock.length === 0}><Plus className="mr-2 h-4 w-4" />Adicionar produto</Button></div>
            <div className="space-y-3 p-4">
              {productUses.map((row) => {
                const stockRow = stock.find((item) => item.produto.id === row.produtoId);
                const lots = row.produtoId ? (lotsByProduct[lotsKey(row.produtoId, row.posicaoId)] || []) : [];
                const selectedLot = lots.find((lot) => lot.id === row.loteId);
                return <div key={row.key} className="grid gap-2 rounded-lg border bg-background p-3 sm:grid-cols-2 lg:grid-cols-[1.35fr_1fr_1fr_.7fr_.7fr_auto]">
                  <div><Label className="text-xs">Produto</Label><select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={row.produtoId} onChange={(e) => void selectProduct(row.key, e.target.value)}><option value="">Selecione...</option>{activeStock.map((item) => <option key={item.produto.id} value={item.produto.id}>{item.produto.codigo} · {item.produto.nome} · saldo {formatAgroNumber(item.estoque)}</option>)}</select>{stockRow && <div className="mt-1 text-[11px] text-muted-foreground">Disponível no barracão: {formatAgroNumber(stockRow.estoque)} {stockRow.produto.unidadeMedida}</div>}</div>
                  <div><Label className="text-xs">Posição</Label><select className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm" value={row.posicaoId} onChange={(e) => void selectPosition(row.key, e.target.value)}><option value="">Sem posição</option>{positions.filter((p) => p.ativo && p.localId === operationForm.localId).map((p) => <option key={p.id} value={p.id}>{p.codigo}{p.nome ? ` · ${p.nome}` : ""}</option>)}</select></div>
                  <div><Label className="text-xs">Lote{stockRow?.produto.controlaLote ? " *" : ""}</Label><select disabled={!stockRow?.produto.controlaLote} className="mt-1 h-9 w-full rounded-md border bg-background px-2 text-sm disabled:opacity-50" value={row.loteId} onChange={(e) => setProductUses((rows) => rows.map((item) => item.key === row.key ? { ...item, loteId: e.target.value } : item))}><option value="">Sem lote</option>{lots.filter((lot) => lot.ativo && (lot.saldo || 0) > 0).map((lot) => <option key={lot.id} value={lot.id}>{lot.codigo} · {formatAgroNumber(lot.saldo || 0)}</option>)}</select>{selectedLot && <div className="mt-1 text-[11px] text-muted-foreground">Saldo lote: {formatAgroNumber(selectedLot.saldo || 0)}</div>}</div>
                  <div><Label className="text-xs">Quantidade</Label><Input className="mt-1" type="number" min="0" step="0.001" value={row.quantidade} onChange={(e) => setProductUses((rows) => rows.map((item) => item.key === row.key ? { ...item, quantidade: e.target.value } : item))} /></div>
                  <div><Label className="text-xs">Custo médio</Label><div className="mt-1 flex h-9 items-center rounded-md border bg-muted/30 px-3 text-sm">Automático</div></div>
                  <div className="flex items-end"><Button type="button" variant="ghost" size="icon" onClick={() => setProductUses((rows) => rows.filter((item) => item.key !== row.key))} title="Remover produto"><Trash2 className="h-4 w-4" /></Button></div>
                </div>;
              })}
              {productUses.length === 0 && <div className="py-5 text-center text-sm text-muted-foreground"><Package className="mx-auto mb-2 h-5 w-5" />Nenhum produto informado. A operação pode ser registrada sem movimentar estoque.</div>}
            </div>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setOperationOpen(false)}>Cancelar</Button><Button disabled={savingOperation || cropCycles.filter((c) => c.status !== "CONCLUIDA").length === 0} onClick={() => void saveOperation()}>{savingOperation ? "Registrando..." : "Registrar operação"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AgroLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function CropStatus({ status }: { status: AgroCropCycleStatus }) {
  const cls = status === "EM_ANDAMENTO" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : status === "CONCLUIDA" ? "bg-muted text-muted-foreground" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>{agroCropCycleStatusLabel(status)}</span>;
}
