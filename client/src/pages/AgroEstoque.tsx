import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Boxes, CalendarClock, Layers3, List, MapPin, Pencil, Plus, Search, Settings, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AgroLayout from "@/components/agro/AgroLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import type { AgroLot, AgroProduct, AgroStorageMap, AgroStorageMapPosition, AgroStoragePosition, AgroStockLocation, AgroStockRow } from "@/lib/agro";
import { formatAgroCurrency, formatAgroDate, formatAgroNumber } from "@/lib/agro";

const emptyProduct = { nome: "", categoria: "", fabricante: "", unidadeMedida: "UN", estoqueMinimo: "0", localizacao: "", controlaLote: false, ativo: true };
const emptyLot = { codigo: "", validade: "", localizacao: "", observacoes: "", ativo: true };
const emptyPosition = { codigo: "", nome: "", setor: "", tipo: "PRATELEIRA", linha: "1", coluna: "1", observacoes: "", ativo: true };
type StockView = "lista" | "mapa";

export default function AgroEstoque() {
  const [rows, setRows] = useState<AgroStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("TODAS");
  const [onlyLow, setOnlyLow] = useState(false);
  const [locations, setLocations] = useState<AgroStockLocation[]>([]);
  const [localId, setLocalId] = useState("");
  const [view, setView] = useState<StockView>("lista");

  const [map, setMap] = useState<AgroStorageMap | null>(null);
  const [mapLoading, setMapLoading] = useState(false);
  const [selectedPosition, setSelectedPosition] = useState<AgroStorageMapPosition | null>(null);
  const [positionDetailOpen, setPositionDetailOpen] = useState(false);
  const [positionOpen, setPositionOpen] = useState(false);
  const [editingPosition, setEditingPosition] = useState<AgroStoragePosition | null>(null);
  const [positionForm, setPositionForm] = useState(emptyPosition);
  const [savingPosition, setSavingPosition] = useState(false);

  const [productOpen, setProductOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<AgroProduct | null>(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [savingProduct, setSavingProduct] = useState(false);

  const [lotOpen, setLotOpen] = useState(false);
  const [lotProduct, setLotProduct] = useState<AgroProduct | null>(null);
  const [lots, setLots] = useState<AgroLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [editingLot, setEditingLot] = useState<AgroLot | null>(null);
  const [lotForm, setLotForm] = useState(emptyLot);
  const [savingLot, setSavingLot] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [response, localRes] = await Promise.all([
        api.get<AgroStockRow[]>("/agro/estoque", { params: localId ? { localId } : {} }),
        api.get<AgroStockLocation[]>("/agro/locais"),
      ]);
      setRows(Array.isArray(response.data) ? response.data : []);
      const loadedLocations = Array.isArray(localRes.data) ? localRes.data : [];
      setLocations(loadedLocations);
      if (view === "mapa" && !localId) {
        const preferred = loadedLocations.find((item) => item.ativo && item.principal) || loadedLocations.find((item) => item.ativo);
        if (preferred) setLocalId(preferred.id);
      }
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível carregar o estoque Agro.");
    } finally { if (!silent) setLoading(false); }
  }, [localId, view]);

  const loadMap = useCallback(async (silent = false) => {
    if (view !== "mapa" || !localId) { setMap(null); return; }
    if (!silent) setMapLoading(true);
    try {
      const response = await api.get<AgroStorageMap>("/agro/mapa-barracao", { params: { localId } });
      setMap(response.data);
      setSelectedPosition((current) => current ? response.data.posicoes.find((p) => p.id === current.id) || null : null);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível carregar o mapa do barracão.");
      setMap(null);
    } finally { if (!silent) setMapLoading(false); }
  }, [localId, view]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadMap(); }, [loadMap]);
  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "agro", "agro/estoque", "agro/produtos", "agro/lotes", "agro/movimentacoes", "agro/posicoes", "agro/mapa-barracao", "agro/transferencias", "agro/inventarios")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void load(true); void loadMap(true); }, 250);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => { if (timer) window.clearTimeout(timer); window.removeEventListener(REALTIME_CHANGE_EVENT, handler); };
  }, [load, loadMap]);

  const categories = useMemo(() => Array.from(new Set(rows.map((row) => row.produto.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")), [rows]);
  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return rows.filter((row) => {
      const p = row.produto;
      if (category !== "TODAS" && p.categoria !== category) return false;
      if (onlyLow && !row.abaixoMinimo) return false;
      if (!q) return true;
      return [p.codigo, p.nome, p.categoria, p.fabricante, p.localizacao].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(q));
    });
  }, [rows, search, category, onlyLow]);

  const totals = useMemo(() => ({
    ativos: rows.filter((row) => row.produto.ativo).length,
    comSaldo: rows.filter((row) => row.produto.ativo && row.estoque > 0).length,
    baixos: rows.filter((row) => row.abaixoMinimo).length,
    valor: rows.reduce((sum, row) => sum + (row.valorEstoque || 0), 0),
  }), [rows]);

  const mapSearch = search.trim().toLocaleLowerCase("pt-BR");
  const mapPositionMatches = useCallback((position: AgroStorageMapPosition) => {
    if (!mapSearch) return true;
    return [position.codigo, position.nome, position.setor, position.tipo, ...position.itens.flatMap((item) => [item.produto.codigo, item.produto.nome, item.lote?.codigo])]
      .some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(mapSearch));
  }, [mapSearch]);

  function changeView(next: StockView) {
    setView(next);
    if (next === "mapa" && !localId) {
      const preferred = locations.find((item) => item.ativo && item.principal) || locations.find((item) => item.ativo);
      if (preferred) setLocalId(preferred.id);
    }
  }

  function newPosition() {
    if (!localId) return toast.error("Selecione um barracão antes de criar posições.");
    const nextColumn = Math.max(0, ...(map?.posicoes.map((item) => item.coluna) || [0])) + 1;
    setEditingPosition(null);
    setPositionForm({ ...emptyPosition, codigo: `P${String((map?.posicoes.length || 0) + 1).padStart(2, "0")}`, coluna: String(nextColumn) });
    setPositionOpen(true);
  }

  function editPosition(position: AgroStoragePosition) {
    setEditingPosition(position);
    setPositionForm({ codigo: position.codigo, nome: position.nome || "", setor: position.setor || "", tipo: position.tipo || "PRATELEIRA", linha: String(position.linha), coluna: String(position.coluna), observacoes: position.observacoes || "", ativo: position.ativo });
    setPositionOpen(true);
  }

  async function savePosition() {
    if (!localId || !positionForm.codigo.trim()) return toast.error("Informe o barracão e o código da posição.");
    const linha = Number(positionForm.linha), coluna = Number(positionForm.coluna);
    if (!Number.isInteger(linha) || linha < 1 || !Number.isInteger(coluna) || coluna < 1) return toast.error("Linha e coluna devem ser números inteiros maiores que zero.");
    setSavingPosition(true);
    try {
      const payload = { ...positionForm, localId, linha, coluna, codigo: positionForm.codigo.trim().toUpperCase() };
      if (editingPosition) await api.put(`/agro/posicoes/${editingPosition.id}`, payload);
      else await api.post("/agro/posicoes", payload);
      toast.success(editingPosition ? "Posição atualizada." : "Posição criada no mapa.");
      setPositionOpen(false);
      await loadMap(true);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível salvar a posição."); }
    finally { setSavingPosition(false); }
  }

  function openPosition(position: AgroStorageMapPosition) {
    setSelectedPosition(position);
    setPositionDetailOpen(true);
  }

  function newProduct() { setEditingProduct(null); setProductForm(emptyProduct); setProductOpen(true); }
  function editProduct(product: AgroProduct) {
    setEditingProduct(product);
    setProductForm({ nome: product.nome, categoria: product.categoria, fabricante: product.fabricante, unidadeMedida: product.unidadeMedida, estoqueMinimo: String(product.estoqueMinimo), localizacao: product.localizacao, controlaLote: product.controlaLote, ativo: product.ativo });
    setProductOpen(true);
  }
  async function saveProduct() {
    if (!productForm.nome.trim()) return toast.error("Informe o nome do produto.");
    const minimo = Number(String(productForm.estoqueMinimo).replace(",", "."));
    if (!Number.isFinite(minimo) || minimo < 0) return toast.error("Informe um estoque mínimo válido.");
    setSavingProduct(true);
    try {
      const payload = { ...productForm, estoqueMinimo: minimo };
      if (editingProduct) await api.put(`/agro/produtos/${editingProduct.id}`, payload); else await api.post("/agro/produtos", payload);
      toast.success(editingProduct ? "Produto Agro atualizado." : "Produto Agro cadastrado."); setProductOpen(false); await load(true); await loadMap(true);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível salvar o produto."); }
    finally { setSavingProduct(false); }
  }
  async function removeProduct(product: AgroProduct) {
    if (!window.confirm(`Remover o produto "${product.nome}"? Se houver histórico, ele será apenas inativado.`)) return;
    try { const response = await api.delete(`/agro/produtos/${product.id}`); toast.success(response.data?.deactivated ? "Produto inativado porque possui histórico." : "Produto removido."); await load(true); await loadMap(true); }
    catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível remover o produto."); }
  }

  const loadLots = useCallback(async (product: AgroProduct) => {
    setLotsLoading(true);
    try { const response = await api.get<AgroLot[]>("/agro/lotes", { params: { produtoId: product.id, ...(localId ? { localId } : {}) } }); setLots(Array.isArray(response.data) ? response.data : []); }
    catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível carregar os lotes."); }
    finally { setLotsLoading(false); }
  }, [localId]);
  async function openLots(product: AgroProduct) { setLotProduct(product); setEditingLot(null); setLotForm(emptyLot); setLotOpen(true); await loadLots(product); }
  function editLot(lot: AgroLot) { setEditingLot(lot); setLotForm({ codigo: lot.codigo, validade: lot.validade || "", localizacao: lot.localizacao || "", observacoes: lot.observacoes || "", ativo: lot.ativo }); }
  async function saveLot() {
    if (!lotProduct) return; if (!lotForm.codigo.trim()) return toast.error("Informe o código do lote."); setSavingLot(true);
    try { if (editingLot) await api.put(`/agro/lotes/${editingLot.id}`, lotForm); else await api.post("/agro/lotes", { ...lotForm, produtoId: lotProduct.id }); toast.success(editingLot ? "Lote atualizado." : "Lote cadastrado."); setEditingLot(null); setLotForm(emptyLot); await Promise.all([loadLots(lotProduct), load(true), loadMap(true)]); }
    catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível salvar o lote."); }
    finally { setSavingLot(false); }
  }
  async function removeLot(lot: AgroLot) {
    if (!lotProduct || !window.confirm(`Remover o lote ${lot.codigo}? Se houver movimentação, ele será apenas inativado.`)) return;
    try { const response = await api.delete(`/agro/lotes/${lot.id}`); toast.success(response.data?.deactivated ? "Lote inativado porque possui histórico." : "Lote removido."); await Promise.all([loadLots(lotProduct), load(true), loadMap(true)]); }
    catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível remover o lote."); }
  }

  return (
    <AgroLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agro / Estoque</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Estoque do barracão</h1><p className="mt-2 text-sm text-muted-foreground">Consulte o saldo em lista ou visualize fisicamente onde cada produto e lote está armazenado.</p></div>
          <div className="flex flex-wrap gap-2">
            <div className="flex rounded-md border bg-card p-1"><Button size="sm" variant={view === "lista" ? "default" : "ghost"} onClick={() => changeView("lista")}><List className="mr-2 h-4 w-4" />Lista</Button><Button size="sm" variant={view === "mapa" ? "default" : "ghost"} onClick={() => changeView("mapa")}><MapPin className="mr-2 h-4 w-4" />Mapa do barracão</Button></div>
            <select className="h-9 rounded-md border bg-background px-3 text-sm" value={localId} onChange={(e) => setLocalId(e.target.value)}><option value="">{view === "mapa" ? "Selecione um barracão" : "Todos os locais"}</option>{locations.filter((l) => l.ativo).map((l) => <option key={l.id} value={l.id}>{l.nome}</option>)}</select>
            {view === "mapa" && <Button variant="outline" onClick={newPosition} disabled={!localId}><Plus className="mr-2 h-4 w-4" />Nova posição</Button>}
            <Button onClick={newProduct}><Plus className="mr-2 h-4 w-4" />Novo produto</Button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Produtos ativos", totals.ativos, Boxes], ["Com saldo", totals.comSaldo, Archive], ["Abaixo do mínimo", totals.baixos, AlertTriangle], ["Valor em estoque", formatAgroCurrency(totals.valor), Layers3]].map(([label, value, Icon]: any) => <Card key={label}><CardContent className="flex items-center justify-between p-4"><div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>)}</div>

        <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder={view === "mapa" ? "Buscar posição, setor, produto ou lote..." : "Buscar produto, código, fabricante ou localização..."} /></div>
          {view === "lista" && <><select className="h-9 rounded-md border bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}><option value="TODAS">Todas as categorias</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select><label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />Somente estoque baixo</label></>}
        </div>

        {view === "lista" ? (
          <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[1160px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3 text-right">Custo médio</th><th className="px-4 py-3 text-right">Valor estoque</th><th className="px-4 py-3 text-right">Mínimo</th><th className="px-4 py-3">Lotes</th><th className="px-4 py-3">Referência</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y">
            {filtered.map((row) => { const p = row.produto; return <tr key={p.id} className={!p.ativo ? "opacity-55" : ""}><td className="px-4 py-3"><div className="font-semibold">{p.nome}</div><div className="text-xs text-muted-foreground">{p.codigo}{p.fabricante ? ` · ${p.fabricante}` : ""}</div></td><td className="px-4 py-3">{p.categoria || "—"}</td><td className="px-4 py-3 text-right font-semibold">{formatAgroNumber(row.estoque)} <span className="text-xs font-normal text-muted-foreground">{p.unidadeMedida}</span></td><td className="px-4 py-3 text-right">{formatAgroCurrency(row.custoMedio || 0)}</td><td className="px-4 py-3 text-right font-semibold">{formatAgroCurrency(row.valorEstoque || 0)}</td><td className="px-4 py-3 text-right">{formatAgroNumber(p.estoqueMinimo)} {p.unidadeMedida}</td><td className="px-4 py-3"><button type="button" className="text-left text-primary hover:underline" onClick={() => void openLots(p)}>{row.lotesAtivos} lote(s){row.proximaValidade && <span className="block text-xs text-muted-foreground"><CalendarClock className="mr-1 inline h-3 w-3" />{formatAgroDate(row.proximaValidade)}</span>}</button></td><td className="px-4 py-3">{p.localizacao || "—"}</td><td className="px-4 py-3">{!p.ativo ? <span className="rounded-full bg-muted px-2 py-1 text-xs">Inativo</span> : row.abaixoMinimo ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Estoque baixo</span> : row.semEstoque ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">Sem estoque</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Normal</span>}</td><td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Lotes" onClick={() => void openLots(p)}><Layers3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Editar" onClick={() => editProduct(p)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" title="Remover ou inativar" onClick={() => void removeProduct(p)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>; })}
            {!loading && filtered.length === 0 && <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>}{loading && <tr><td colSpan={10} className="px-4 py-12 text-center text-muted-foreground">Carregando estoque...</td></tr>}
          </tbody></table></div></div>
        ) : <StorageMap map={map} loading={mapLoading} search={mapSearch} matches={mapPositionMatches} onOpen={openPosition} onEdit={editPosition} onNew={newPosition} />}
      </div>

      <Dialog open={positionOpen} onOpenChange={setPositionOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editingPosition ? "Editar posição" : "Nova posição no barracão"}</DialogTitle><DialogDescription>Cada quadrado ocupa uma linha e coluna do mapa. Uma mesma posição pode armazenar vários produtos e vários lotes.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Código *"><Input value={positionForm.codigo} onChange={(e) => setPositionForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))} placeholder="A1" /></Field><Field label="Nome"><Input value={positionForm.nome} onChange={(e) => setPositionForm((f) => ({ ...f, nome: e.target.value }))} placeholder="Prateleira A1" /></Field><Field label="Setor"><Input value={positionForm.setor} onChange={(e) => setPositionForm((f) => ({ ...f, setor: e.target.value }))} placeholder="Defensivos" /></Field><Field label="Tipo"><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={positionForm.tipo} onChange={(e) => setPositionForm((f) => ({ ...f, tipo: e.target.value }))}><option value="PRATELEIRA">Prateleira</option><option value="PALLET">Pallet</option><option value="BOX">Box</option><option value="PISO">Área no chão</option><option value="TANQUE">Tanque</option><option value="OUTRO">Outro</option></select></Field><Field label="Linha do mapa *"><Input type="number" min="1" step="1" value={positionForm.linha} onChange={(e) => setPositionForm((f) => ({ ...f, linha: e.target.value }))} /></Field><Field label="Coluna do mapa *"><Input type="number" min="1" step="1" value={positionForm.coluna} onChange={(e) => setPositionForm((f) => ({ ...f, coluna: e.target.value }))} /></Field></div><Field label="Observações"><Textarea rows={3} value={positionForm.observacoes} onChange={(e) => setPositionForm((f) => ({ ...f, observacoes: e.target.value }))} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={positionForm.ativo} onChange={(e) => setPositionForm((f) => ({ ...f, ativo: e.target.checked }))} />Posição ativa</label><DialogFooter><Button variant="outline" onClick={() => setPositionOpen(false)}>Cancelar</Button><Button disabled={savingPosition} onClick={() => void savePosition()}>{savingPosition ? "Salvando..." : "Salvar posição"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={positionDetailOpen} onOpenChange={setPositionDetailOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Posição {selectedPosition?.codigo}</DialogTitle><DialogDescription>{selectedPosition?.nome || selectedPosition?.setor || "Detalhes da armazenagem"}{selectedPosition?.setor && selectedPosition?.nome ? ` · ${selectedPosition.setor}` : ""}</DialogDescription></DialogHeader>{selectedPosition && <><div className="grid gap-3 sm:grid-cols-3"><Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Itens distintos</div><div className="mt-1 text-xl font-bold">{selectedPosition.itens.length}</div></CardContent></Card><Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Produtos</div><div className="mt-1 text-xl font-bold">{new Set(selectedPosition.itens.map((i) => i.produto.id)).size}</div></CardContent></Card><Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Valor armazenado</div><div className="mt-1 text-xl font-bold">{formatAgroCurrency(selectedPosition.itens.reduce((sum, item) => sum + item.valorEstoque, 0))}</div></CardContent></Card></div><div className="overflow-hidden rounded-xl border"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Produto</th><th className="px-3 py-2">Lote</th><th className="px-3 py-2">Validade</th><th className="px-3 py-2 text-right">Quantidade</th><th className="px-3 py-2 text-right">Valor</th></tr></thead><tbody className="divide-y">{selectedPosition.itens.map((item) => <tr key={`${item.produto.id}-${item.lote?.id || "sem-lote"}`}><td className="px-3 py-2"><div className="font-medium">{item.produto.nome}</div><div className="text-xs text-muted-foreground">{item.produto.codigo}</div></td><td className="px-3 py-2">{item.lote?.codigo || "Sem lote"}</td><td className="px-3 py-2">{formatAgroDate(item.lote?.validade)}</td><td className="px-3 py-2 text-right font-semibold">{formatAgroNumber(item.quantidade)} {item.produto.unidadeMedida}</td><td className="px-3 py-2 text-right">{formatAgroCurrency(item.valorEstoque)}</td></tr>)}{selectedPosition.itens.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Esta posição está vazia.</td></tr>}</tbody></table></div></div></>}<DialogFooter><Button variant="outline" onClick={() => { setPositionDetailOpen(false); if (selectedPosition) editPosition(selectedPosition); }}><Settings className="mr-2 h-4 w-4" />Configurar posição</Button><Button onClick={() => setPositionDetailOpen(false)}>Fechar</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={productOpen} onOpenChange={setProductOpen}><DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto"><DialogHeader><DialogTitle>{editingProduct ? "Editar produto" : "Novo produto Agro"}</DialogTitle><DialogDescription>O saldo não é informado aqui. Ele nasce das entradas, saídas e ajustes.</DialogDescription></DialogHeader><div className="grid gap-4 sm:grid-cols-2"><Field label="Nome *"><Input value={productForm.nome} onChange={(e) => setProductForm((f) => ({ ...f, nome: e.target.value }))} /></Field><Field label="Categoria"><Input value={productForm.categoria} onChange={(e) => setProductForm((f) => ({ ...f, categoria: e.target.value }))} placeholder="Ex.: Defensivos" /></Field><Field label="Fabricante"><Input value={productForm.fabricante} onChange={(e) => setProductForm((f) => ({ ...f, fabricante: e.target.value }))} /></Field><Field label="Unidade de medida"><Input value={productForm.unidadeMedida} onChange={(e) => setProductForm((f) => ({ ...f, unidadeMedida: e.target.value.toUpperCase() }))} placeholder="L, KG, UN..." /></Field><Field label="Estoque mínimo"><Input type="number" min="0" step="0.001" value={productForm.estoqueMinimo} onChange={(e) => setProductForm((f) => ({ ...f, estoqueMinimo: e.target.value }))} /></Field><Field label="Referência de localização"><Input value={productForm.localizacao} onChange={(e) => setProductForm((f) => ({ ...f, localizacao: e.target.value }))} placeholder="Opcional; a posição física fica no mapa" /></Field></div><div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2"><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={productForm.controlaLote} onChange={(e) => setProductForm((f) => ({ ...f, controlaLote: e.target.checked }))} />Exigir lote nas movimentações</label><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={productForm.ativo} onChange={(e) => setProductForm((f) => ({ ...f, ativo: e.target.checked }))} />Produto ativo</label></div><DialogFooter><Button variant="outline" onClick={() => setProductOpen(false)}>Cancelar</Button><Button disabled={savingProduct} onClick={() => void saveProduct()}>{savingProduct ? "Salvando..." : "Salvar produto"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={lotOpen} onOpenChange={setLotOpen}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>Lotes · {lotProduct?.nome}</DialogTitle><DialogDescription>Cadastre validade e referências. A posição física é definida nas movimentações do estoque.</DialogDescription></DialogHeader><div className="grid gap-3 rounded-xl border bg-muted/15 p-4 sm:grid-cols-2"><Field label="Código do lote *"><Input value={lotForm.codigo} onChange={(e) => setLotForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))} /></Field><Field label="Validade"><Input type="date" value={lotForm.validade} onChange={(e) => setLotForm((f) => ({ ...f, validade: e.target.value }))} /></Field><Field label="Referência"><Input value={lotForm.localizacao} onChange={(e) => setLotForm((f) => ({ ...f, localizacao: e.target.value }))} /></Field><Field label="Observações"><Input value={lotForm.observacoes} onChange={(e) => setLotForm((f) => ({ ...f, observacoes: e.target.value }))} /></Field><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lotForm.ativo} onChange={(e) => setLotForm((f) => ({ ...f, ativo: e.target.checked }))} />Lote ativo</label><div className="flex items-end"><Button className="w-full" disabled={savingLot} onClick={() => void saveLot()}>{editingLot ? "Salvar alterações" : "Adicionar lote"}</Button></div></div><div className="overflow-hidden rounded-xl border"><div className="overflow-x-auto"><table className="w-full min-w-[650px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Lote</th><th className="px-3 py-2">Validade</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2">Situação</th><th className="px-3 py-2"></th></tr></thead><tbody className="divide-y">{lots.map((lot) => <tr key={lot.id}><td className="px-3 py-2 font-medium">{lot.codigo}</td><td className="px-3 py-2">{formatAgroDate(lot.validade)}</td><td className="px-3 py-2 text-right">{formatAgroNumber(lot.saldo || 0)} {lotProduct?.unidadeMedida}</td><td className="px-3 py-2">{lot.ativo ? "Ativo" : "Inativo"}</td><td className="px-3 py-2"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => editLot(lot)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => void removeLot(lot)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{!lotsLoading && lots.length === 0 && <tr><td colSpan={5} className="px-3 py-10 text-center text-muted-foreground">Nenhum lote cadastrado.</td></tr>}</tbody></table></div></div><DialogFooter><Button variant="outline" onClick={() => setLotOpen(false)}>Fechar</Button></DialogFooter></DialogContent></Dialog>
    </AgroLayout>
  );
}

function StorageMap({ map, loading, search, matches, onOpen, onEdit, onNew }: { map: AgroStorageMap | null; loading: boolean; search: string; matches: (position: AgroStorageMapPosition) => boolean; onOpen: (position: AgroStorageMapPosition) => void; onEdit: (position: AgroStoragePosition) => void; onNew: () => void }) {
  if (loading) return <div className="rounded-xl border bg-card px-4 py-16 text-center text-sm text-muted-foreground">Carregando mapa do barracão...</div>;
  if (!map) return <div className="rounded-xl border bg-card px-4 py-16 text-center text-sm text-muted-foreground">Selecione um barracão para visualizar o mapa.</div>;
  const today = new Date(); today.setHours(0, 0, 0, 0); const soon = new Date(today.getTime() + 60 * 86_400_000);
  const styleFor = (position: AgroStorageMapPosition) => {
    const expiries = position.itens.map((item) => item.lote?.validade).filter((value): value is string => Boolean(value)).map((value) => new Date(`${value}T12:00:00`));
    if (expiries.some((date) => date < today)) return "border-red-300 bg-red-50 dark:border-red-900 dark:bg-red-950/25";
    if (expiries.some((date) => date <= soon)) return "border-amber-300 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/25";
    if (position.itens.length > 1) return "border-primary/35 bg-primary/5";
    if (position.itens.length === 1) return "border-emerald-300 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/20";
    return "border-dashed bg-muted/20";
  };
  return <div className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-card p-3"><div><div className="font-semibold">Mapa · {map.local.nome}</div><div className="text-xs text-muted-foreground">{map.posicoes.length} posições cadastradas · clique em qualquer quadrado para ver todos os produtos e lotes.</div></div><div className="flex flex-wrap gap-3 text-xs text-muted-foreground"><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-emerald-400" />Ocupada</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-amber-400" />Validade próxima</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-red-400" />Vencido</span><span><i className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />Vazia</span></div></div>
    {map.posicoes.length === 0 ? <div className="rounded-xl border border-dashed bg-card px-4 py-16 text-center"><MapPin className="mx-auto mb-3 h-8 w-8 text-muted-foreground" /><div className="font-semibold">Este barracão ainda não possui posições no mapa.</div><div className="mt-1 text-sm text-muted-foreground">Crie A1, A2, B1 ou os códigos que representem o espaço físico real.</div><Button className="mt-4" onClick={onNew}><Plus className="mr-2 h-4 w-4" />Criar primeira posição</Button></div> : <div className="overflow-x-auto rounded-xl border bg-card p-4"><div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${map.colunas}, minmax(170px, 1fr))`, minWidth: `${Math.max(1, map.colunas) * 182}px` }}>{map.posicoes.map((position) => { const matched = matches(position); const preview = position.itens.slice(0, 2); return <button key={position.id} type="button" onClick={() => onOpen(position)} className={`min-h-[145px] rounded-xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm ${styleFor(position)} ${search && !matched ? "opacity-25" : ""} ${!position.ativo ? "grayscale opacity-50" : ""}`} style={{ gridColumnStart: position.coluna, gridRowStart: position.linha }}><div className="flex items-start justify-between gap-2"><div><div className="text-lg font-bold">{position.codigo}</div><div className="text-xs text-muted-foreground">{position.nome || position.tipo}{position.setor ? ` · ${position.setor}` : ""}</div></div><Settings className="h-4 w-4 text-muted-foreground" onClick={(event) => { event.stopPropagation(); onEdit(position); }} /></div><div className="mt-3 space-y-2">{preview.map((item) => <div key={`${item.produto.id}-${item.lote?.id || "sem"}`} className="rounded-md bg-background/70 px-2 py-1.5"><div className="truncate text-xs font-semibold">{item.produto.nome}</div><div className="truncate text-[11px] text-muted-foreground">{item.lote ? `Lote ${item.lote.codigo} · ` : ""}{formatAgroNumber(item.quantidade)} {item.produto.unidadeMedida}</div></div>)}{position.itens.length === 0 && <div className="pt-4 text-center text-xs text-muted-foreground">Posição vazia</div>}{position.itens.length > 2 && <div className="text-xs font-medium text-primary">+ {position.itens.length - 2} item(ns)</div>}</div></button>; })}</div></div>}
    {map.semPosicao.length > 0 && <div className="rounded-xl border border-amber-300 bg-amber-50/60 p-4 dark:border-amber-900 dark:bg-amber-950/20"><div className="flex items-start gap-3"><AlertTriangle className="mt-0.5 h-5 w-5 text-amber-700" /><div className="min-w-0 flex-1"><div className="font-semibold">Estoque sem posição definida</div><div className="text-sm text-muted-foreground">Estoque criado antes do mapa ou lançado sem posição. O sistema não inventa uma localização física; mova esses itens usando uma transferência interna para uma posição.</div><div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{map.semPosicao.map((item) => <div key={`${item.produto.id}-${item.lote?.id || "sem"}`} className="rounded-lg border bg-background p-2 text-sm"><div className="font-medium">{item.produto.nome}</div><div className="text-xs text-muted-foreground">{item.lote ? `Lote ${item.lote.codigo} · ` : ""}{formatAgroNumber(item.quantidade)} {item.produto.unidadeMedida}</div></div>)}</div></div></div></div>}
  </div>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
