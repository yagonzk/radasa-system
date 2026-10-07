import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Archive, Boxes, CalendarClock, Layers3, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AgroLayout from "@/components/agro/AgroLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import { AgroLot, AgroProduct, AgroStockRow, formatAgroDate, formatAgroNumber } from "@/lib/agro";

const emptyProduct = {
  nome: "", categoria: "", fabricante: "", unidadeMedida: "UN", estoqueMinimo: "0", localizacao: "", controlaLote: false, ativo: true,
};
const emptyLot = { codigo: "", validade: "", localizacao: "", observacoes: "", ativo: true };

export default function AgroEstoque() {
  const [rows, setRows] = useState<AgroStockRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("TODAS");
  const [onlyLow, setOnlyLow] = useState(false);

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
      const response = await api.get<AgroStockRow[]>("/agro/estoque");
      setRows(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível carregar o estoque Agro.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "agro", "agro/estoque", "agro/produtos", "agro/lotes", "agro/movimentacoes")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(true), 250);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => { if (timer) window.clearTimeout(timer); window.removeEventListener(REALTIME_CHANGE_EVENT, handler); };
  }, [load]);

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
    lotes: rows.reduce((sum, row) => sum + row.lotesAtivos, 0),
  }), [rows]);

  function newProduct() {
    setEditingProduct(null);
    setProductForm(emptyProduct);
    setProductOpen(true);
  }

  function editProduct(product: AgroProduct) {
    setEditingProduct(product);
    setProductForm({
      nome: product.nome,
      categoria: product.categoria,
      fabricante: product.fabricante,
      unidadeMedida: product.unidadeMedida,
      estoqueMinimo: String(product.estoqueMinimo),
      localizacao: product.localizacao,
      controlaLote: product.controlaLote,
      ativo: product.ativo,
    });
    setProductOpen(true);
  }

  async function saveProduct() {
    if (!productForm.nome.trim()) return toast.error("Informe o nome do produto.");
    const minimo = Number(String(productForm.estoqueMinimo).replace(",", "."));
    if (!Number.isFinite(minimo) || minimo < 0) return toast.error("Informe um estoque mínimo válido.");
    setSavingProduct(true);
    try {
      const payload = { ...productForm, estoqueMinimo: minimo };
      if (editingProduct) await api.put(`/agro/produtos/${editingProduct.id}`, payload);
      else await api.post("/agro/produtos", payload);
      toast.success(editingProduct ? "Produto Agro atualizado." : "Produto Agro cadastrado.");
      setProductOpen(false);
      await load(true);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível salvar o produto.");
    } finally { setSavingProduct(false); }
  }

  async function removeProduct(product: AgroProduct) {
    if (!window.confirm(`Remover o produto "${product.nome}"? Se houver histórico, ele será apenas inativado.`)) return;
    try {
      const response = await api.delete(`/agro/produtos/${product.id}`);
      toast.success(response.data?.deactivated ? "Produto inativado porque possui histórico." : "Produto removido.");
      await load(true);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível remover o produto."); }
  }

  const loadLots = useCallback(async (product: AgroProduct) => {
    setLotsLoading(true);
    try {
      const response = await api.get<AgroLot[]>("/agro/lotes", { params: { produtoId: product.id } });
      setLots(Array.isArray(response.data) ? response.data : []);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível carregar os lotes."); }
    finally { setLotsLoading(false); }
  }, []);

  async function openLots(product: AgroProduct) {
    setLotProduct(product);
    setEditingLot(null);
    setLotForm(emptyLot);
    setLotOpen(true);
    await loadLots(product);
  }

  function editLot(lot: AgroLot) {
    setEditingLot(lot);
    setLotForm({ codigo: lot.codigo, validade: lot.validade || "", localizacao: lot.localizacao || "", observacoes: lot.observacoes || "", ativo: lot.ativo });
  }

  async function saveLot() {
    if (!lotProduct) return;
    if (!lotForm.codigo.trim()) return toast.error("Informe o código do lote.");
    setSavingLot(true);
    try {
      if (editingLot) await api.put(`/agro/lotes/${editingLot.id}`, lotForm);
      else await api.post("/agro/lotes", { ...lotForm, produtoId: lotProduct.id });
      toast.success(editingLot ? "Lote atualizado." : "Lote cadastrado.");
      setEditingLot(null);
      setLotForm(emptyLot);
      await Promise.all([loadLots(lotProduct), load(true)]);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível salvar o lote."); }
    finally { setSavingLot(false); }
  }

  async function removeLot(lot: AgroLot) {
    if (!lotProduct || !window.confirm(`Remover o lote ${lot.codigo}? Se houver movimentação, ele será apenas inativado.`)) return;
    try {
      const response = await api.delete(`/agro/lotes/${lot.id}`);
      toast.success(response.data?.deactivated ? "Lote inativado porque possui histórico." : "Lote removido.");
      await Promise.all([loadLots(lotProduct), load(true)]);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível remover o lote."); }
  }

  return (
    <AgroLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agro / Estoque</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Estoque do barracão</h1>
            <p className="mt-2 text-sm text-muted-foreground">Saldo calculado exclusivamente pelas movimentações. Produtos e lotes ficam separados do TMS.</p>
          </div>
          <Button onClick={newProduct}><Plus className="mr-2 h-4 w-4" />Novo produto</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Produtos ativos", totals.ativos, Boxes],
            ["Com saldo", totals.comSaldo, Archive],
            ["Abaixo do mínimo", totals.baixos, AlertTriangle],
            ["Lotes ativos", totals.lotes, Layers3],
          ].map(([label, value, Icon]: any) => <Card key={label}><CardContent className="flex items-center justify-between p-4"><div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>)}
        </div>

        <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 md:flex-row md:items-center">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar produto, código, fabricante ou localização..." /></div>
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={category} onChange={(e) => setCategory(e.target.value)}><option value="TODAS">Todas as categorias</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select>
          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm"><input type="checkbox" checked={onlyLow} onChange={(e) => setOnlyLow(e.target.checked)} />Somente estoque baixo</label>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3 text-right">Saldo</th><th className="px-4 py-3 text-right">Mínimo</th><th className="px-4 py-3">Lotes</th><th className="px-4 py-3">Localização</th><th className="px-4 py-3">Situação</th><th className="px-4 py-3 text-right">Ações</th></tr></thead>
              <tbody className="divide-y">
                {filtered.map((row) => {
                  const p = row.produto;
                  return <tr key={p.id} className={!p.ativo ? "opacity-55" : ""}>
                    <td className="px-4 py-3"><div className="font-semibold">{p.nome}</div><div className="text-xs text-muted-foreground">{p.codigo}{p.fabricante ? ` · ${p.fabricante}` : ""}</div></td>
                    <td className="px-4 py-3">{p.categoria || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold">{formatAgroNumber(row.estoque)} <span className="text-xs font-normal text-muted-foreground">{p.unidadeMedida}</span></td>
                    <td className="px-4 py-3 text-right">{formatAgroNumber(p.estoqueMinimo)} {p.unidadeMedida}</td>
                    <td className="px-4 py-3"><button type="button" className="text-left text-primary hover:underline" onClick={() => void openLots(p)}>{row.lotesAtivos} lote(s){row.proximaValidade && <span className="block text-xs text-muted-foreground"><CalendarClock className="mr-1 inline h-3 w-3" />{formatAgroDate(row.proximaValidade)}</span>}</button></td>
                    <td className="px-4 py-3">{p.localizacao || "—"}</td>
                    <td className="px-4 py-3">{!p.ativo ? <span className="rounded-full bg-muted px-2 py-1 text-xs">Inativo</span> : row.abaixoMinimo ? <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-semibold text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">Estoque baixo</span> : row.semEstoque ? <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700 dark:bg-red-950/50 dark:text-red-300">Sem estoque</span> : <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">Normal</span>}</td>
                    <td className="px-4 py-3"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" title="Lotes" onClick={() => void openLots(p)}><Layers3 className="h-4 w-4" /></Button><Button size="icon" variant="ghost" title="Editar" onClick={() => editProduct(p)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" title="Remover ou inativar" onClick={() => void removeProduct(p)}><Trash2 className="h-4 w-4" /></Button></div></td>
                  </tr>;
                })}
                {!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Nenhum produto encontrado.</td></tr>}
                {loading && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Carregando estoque...</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Dialog open={productOpen} onOpenChange={setProductOpen}>
        <DialogContent className="max-h-[88vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingProduct ? "Editar produto" : "Novo produto Agro"}</DialogTitle><DialogDescription>O saldo não é informado aqui. Ele nasce das entradas, saídas e ajustes.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome *"><Input value={productForm.nome} onChange={(e) => setProductForm((f) => ({ ...f, nome: e.target.value }))} /></Field>
            <Field label="Categoria"><Input value={productForm.categoria} onChange={(e) => setProductForm((f) => ({ ...f, categoria: e.target.value }))} placeholder="Ex.: Defensivos" /></Field>
            <Field label="Fabricante"><Input value={productForm.fabricante} onChange={(e) => setProductForm((f) => ({ ...f, fabricante: e.target.value }))} /></Field>
            <Field label="Unidade de medida"><Input value={productForm.unidadeMedida} onChange={(e) => setProductForm((f) => ({ ...f, unidadeMedida: e.target.value.toUpperCase() }))} placeholder="L, KG, UN..." /></Field>
            <Field label="Estoque mínimo"><Input type="number" min="0" step="0.001" value={productForm.estoqueMinimo} onChange={(e) => setProductForm((f) => ({ ...f, estoqueMinimo: e.target.value }))} /></Field>
            <Field label="Localização"><Input value={productForm.localizacao} onChange={(e) => setProductForm((f) => ({ ...f, localizacao: e.target.value }))} placeholder="Barracão / setor / prateleira" /></Field>
          </div>
          <div className="grid gap-2 rounded-lg border p-3 sm:grid-cols-2">
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={productForm.controlaLote} onChange={(e) => setProductForm((f) => ({ ...f, controlaLote: e.target.checked }))} />Exigir lote nas movimentações</label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={productForm.ativo} onChange={(e) => setProductForm((f) => ({ ...f, ativo: e.target.checked }))} />Produto ativo</label>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => setProductOpen(false)}>Cancelar</Button><Button disabled={savingProduct} onClick={() => void saveProduct()}>{savingProduct ? "Salvando..." : "Salvar produto"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={lotOpen} onOpenChange={setLotOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader><DialogTitle>Lotes · {lotProduct?.nome}</DialogTitle><DialogDescription>Cadastre validade e localização. O saldo de cada lote também é calculado pelas movimentações.</DialogDescription></DialogHeader>
          <div className="grid gap-3 rounded-xl border bg-muted/15 p-4 sm:grid-cols-2">
            <Field label="Código do lote *"><Input value={lotForm.codigo} onChange={(e) => setLotForm((f) => ({ ...f, codigo: e.target.value.toUpperCase() }))} /></Field>
            <Field label="Validade"><Input type="date" value={lotForm.validade} onChange={(e) => setLotForm((f) => ({ ...f, validade: e.target.value }))} /></Field>
            <Field label="Localização"><Input value={lotForm.localizacao} onChange={(e) => setLotForm((f) => ({ ...f, localizacao: e.target.value }))} /></Field>
            <Field label="Observações"><Input value={lotForm.observacoes} onChange={(e) => setLotForm((f) => ({ ...f, observacoes: e.target.value }))} /></Field>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={lotForm.ativo} onChange={(e) => setLotForm((f) => ({ ...f, ativo: e.target.checked }))} />Lote ativo</label>
            <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => { setEditingLot(null); setLotForm(emptyLot); }}>{editingLot ? "Cancelar edição" : "Limpar"}</Button><Button disabled={savingLot} onClick={() => void saveLot()}>{editingLot ? "Salvar lote" : "Adicionar lote"}</Button></div>
          </div>
          <div className="overflow-hidden rounded-xl border">
            <table className="w-full text-sm"><thead className="bg-muted/40 text-left text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-2">Lote</th><th className="px-3 py-2">Validade</th><th className="px-3 py-2 text-right">Saldo</th><th className="px-3 py-2">Localização</th><th className="px-3 py-2 text-right">Ações</th></tr></thead><tbody className="divide-y">{lots.map((lot) => <tr key={lot.id} className={!lot.ativo ? "opacity-55" : ""}><td className="px-3 py-2 font-medium">{lot.codigo}{!lot.ativo && <span className="ml-2 text-xs text-muted-foreground">Inativo</span>}</td><td className="px-3 py-2">{formatAgroDate(lot.validade)}</td><td className="px-3 py-2 text-right font-semibold">{formatAgroNumber(lot.saldo || 0)} {lotProduct?.unidadeMedida}</td><td className="px-3 py-2">{lot.localizacao || "—"}</td><td className="px-3 py-2"><div className="flex justify-end gap-1"><Button size="icon" variant="ghost" onClick={() => editLot(lot)}><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" onClick={() => void removeLot(lot)}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}{!lotsLoading && lots.length === 0 && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Nenhum lote cadastrado.</td></tr>}{lotsLoading && <tr><td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">Carregando lotes...</td></tr>}</tbody></table>
          </div>
        </DialogContent>
      </Dialog>
    </AgroLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>;
}
