import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, ArrowUpFromLine, ClipboardList, History, Search, SlidersHorizontal } from "lucide-react";
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
import type { AgroLot, AgroMovement, AgroMovementType, AgroStockRow } from "@/lib/agro";
import { formatAgroDate, formatAgroNumber, movementIsExit, movementLabel } from "@/lib/agro";

function today() { return new Date().toISOString().slice(0, 10); }
const emptyForm = { tipo: "ENTRADA" as AgroMovementType, produtoId: "", loteId: "", quantidade: "", valorUnitario: "0", data: today(), responsavel: "", destino: "", documento: "", observacoes: "" };

export default function AgroMovimentacoes() {
  const [stock, setStock] = useState<AgroStockRow[]>([]);
  const [movements, setMovements] = useState<AgroMovement[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("TODOS");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [lots, setLots] = useState<AgroLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [stockRes, movRes] = await Promise.all([
        api.get<AgroStockRow[]>("/agro/estoque"),
        api.get<AgroMovement[]>("/agro/movimentacoes", { params: { take: 300 } }),
      ]);
      setStock(Array.isArray(stockRes.data) ? stockRes.data : []);
      setMovements(Array.isArray(movRes.data) ? movRes.data : []);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível carregar as movimentações Agro."); }
    finally { if (!silent) setLoading(false); }
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

  const activeStock = useMemo(() => stock.filter((row) => row.produto.ativo), [stock]);
  const selectedStock = useMemo(() => activeStock.find((row) => row.produto.id === form.produtoId), [activeStock, form.produtoId]);
  const selectedLot = useMemo(() => lots.find((lot) => lot.id === form.loteId), [lots, form.loteId]);

  useEffect(() => {
    let active = true;
    if (!form.produtoId || !selectedStock?.produto.controlaLote) { setLots([]); setForm((f) => f.loteId ? { ...f, loteId: "" } : f); return; }
    setLotsLoading(true);
    api.get<AgroLot[]>("/agro/lotes", { params: { produtoId: form.produtoId } })
      .then((response) => { if (active) setLots((Array.isArray(response.data) ? response.data : []).filter((lot) => lot.ativo)); })
      .catch((error) => { if (active) toast.error(error?.response?.data?.message || "Não foi possível carregar os lotes."); })
      .finally(() => { if (active) setLotsLoading(false); });
    return () => { active = false; };
  }, [form.produtoId, selectedStock?.produto.controlaLote]);

  const filtered = useMemo(() => {
    const q = search.trim().toLocaleLowerCase("pt-BR");
    return movements.filter((item) => {
      if (typeFilter !== "TODOS") {
        if (typeFilter === "AJUSTE" && !item.tipo.startsWith("AJUSTE")) return false;
        if (typeFilter !== "AJUSTE" && item.tipo !== typeFilter) return false;
      }
      if (!q) return true;
      return [item.produto?.nome, item.produto?.codigo, item.lote?.codigo, item.responsavel, item.destino, item.documento].some((value) => String(value || "").toLocaleLowerCase("pt-BR").includes(q));
    });
  }, [movements, search, typeFilter]);

  const monthPrefix = new Date().toISOString().slice(0, 7);
  const stats = useMemo(() => ({
    entradas: movements.filter((m) => m.data.startsWith(monthPrefix) && m.tipo === "ENTRADA").length,
    saidas: movements.filter((m) => m.data.startsWith(monthPrefix) && m.tipo === "SAIDA").length,
    ajustes: movements.filter((m) => m.data.startsWith(monthPrefix) && m.tipo.startsWith("AJUSTE")).length,
    total: movements.length,
  }), [movements, monthPrefix]);

  function openMovement(tipo: "ENTRADA" | "SAIDA" | "AJUSTE_ENTRADA") {
    setForm({ ...emptyForm, tipo, data: today() });
    setLots([]);
    setDialogOpen(true);
  }

  async function saveMovement() {
    const quantity = Number(String(form.quantidade).replace(",", "."));
    const unitValue = Number(String(form.valorUnitario || 0).replace(",", "."));
    if (!form.produtoId) return toast.error("Selecione o produto.");
    if (!Number.isFinite(quantity) || quantity <= 0) return toast.error("Informe uma quantidade válida.");
    if (!Number.isFinite(unitValue) || unitValue < 0) return toast.error("Informe um valor unitário válido.");
    if (selectedStock?.produto.controlaLote && !form.loteId) return toast.error("Selecione o lote deste produto.");
    setSaving(true);
    try {
      await api.post("/agro/movimentacoes", { ...form, quantidade: quantity, valorUnitario: unitValue, loteId: form.loteId || null });
      toast.success(`${movementLabel(form.tipo)} registrada. Saldo recalculado automaticamente.`);
      setDialogOpen(false);
      await load(true);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível registrar a movimentação."); }
    finally { setSaving(false); }
  }

  const outgoing = movementIsExit(form.tipo);

  return (
    <AgroLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agro / Movimentações</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Movimentações de estoque</h1><p className="mt-2 text-sm text-muted-foreground">Toda alteração de saldo fica registrada. Não existe edição manual da quantidade em estoque.</p></div>
          <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => openMovement("ENTRADA")}><ArrowDownToLine className="mr-2 h-4 w-4" />Entrada</Button><Button variant="outline" onClick={() => openMovement("SAIDA")}><ArrowUpFromLine className="mr-2 h-4 w-4" />Saída</Button><Button onClick={() => openMovement("AJUSTE_ENTRADA")}><SlidersHorizontal className="mr-2 h-4 w-4" />Ajuste</Button></div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[["Entradas no mês", stats.entradas, ArrowDownToLine], ["Saídas no mês", stats.saidas, ArrowUpFromLine], ["Ajustes no mês", stats.ajustes, SlidersHorizontal], ["Histórico carregado", stats.total, History]].map(([label, value, Icon]: any) => <Card key={label}><CardContent className="flex items-center justify-between p-4"><div><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 text-2xl font-bold">{value}</div></div><Icon className="h-5 w-5 text-primary" /></CardContent></Card>)}
        </div>

        <div className="flex flex-col gap-2 rounded-xl border bg-card p-3 md:flex-row">
          <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar produto, lote, responsável, destino ou documento..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          <select className="h-9 rounded-md border bg-background px-3 text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}><option value="TODOS">Todos os tipos</option><option value="ENTRADA">Entradas</option><option value="SAIDA">Saídas</option><option value="AJUSTE">Ajustes</option></select>
        </div>

        <div className="overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[1000px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Tipo</th><th className="px-4 py-3">Produto</th><th className="px-4 py-3">Lote</th><th className="px-4 py-3 text-right">Quantidade</th><th className="px-4 py-3">Responsável</th><th className="px-4 py-3">Destino</th><th className="px-4 py-3">Documento</th></tr></thead><tbody className="divide-y">{filtered.map((item) => <tr key={item.id}><td className="px-4 py-3">{formatAgroDate(item.data)}</td><td className="px-4 py-3"><MovementBadge type={item.tipo} /></td><td className="px-4 py-3"><div className="font-semibold">{item.produto?.nome}</div><div className="text-xs text-muted-foreground">{item.produto?.codigo}</div></td><td className="px-4 py-3">{item.lote?.codigo || "—"}</td><td className="px-4 py-3 text-right font-semibold">{movementIsExit(item.tipo) ? "−" : "+"}{formatAgroNumber(item.quantidade)} {item.produto?.unidadeMedida}</td><td className="px-4 py-3">{item.responsavel || "—"}</td><td className="px-4 py-3">{item.destino || "—"}</td><td className="px-4 py-3"><div>{item.documento || "—"}</div>{item.agroOperacaoId && <div className="mt-1 text-[11px] font-semibold text-primary">Operação agrícola</div>}</td></tr>)}{!loading && filtered.length === 0 && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Nenhuma movimentação encontrada.</td></tr>}{loading && <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Carregando movimentações...</td></tr>}</tbody></table></div></div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle>Registrar movimentação</DialogTitle><DialogDescription>O saldo será recalculado automaticamente e saídas nunca podem deixar estoque negativo.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Tipo"><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.tipo} onChange={(e) => setForm((f) => ({ ...f, tipo: e.target.value as AgroMovementType }))}><option value="ENTRADA">Entrada</option><option value="SAIDA">Saída</option><option value="AJUSTE_ENTRADA">Ajuste positivo</option><option value="AJUSTE_SAIDA">Ajuste negativo</option></select></Field>
            <Field label="Data"><Input type="date" value={form.data} onChange={(e) => setForm((f) => ({ ...f, data: e.target.value }))} /></Field>
            <Field label="Produto *"><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.produtoId} onChange={(e) => setForm((f) => ({ ...f, produtoId: e.target.value, loteId: "" }))}><option value="">Selecione...</option>{activeStock.map((row) => <option key={row.produto.id} value={row.produto.id}>{row.produto.codigo} · {row.produto.nome}</option>)}</select>{selectedStock && <p className="mt-1 text-xs text-muted-foreground">Disponível: {formatAgroNumber(selectedStock.estoque)} {selectedStock.produto.unidadeMedida}</p>}</Field>
            <Field label={`Lote${selectedStock?.produto.controlaLote ? " *" : ""}`}><select disabled={!selectedStock?.produto.controlaLote || lotsLoading} className="h-9 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-50" value={form.loteId} onChange={(e) => setForm((f) => ({ ...f, loteId: e.target.value }))}><option value="">{lotsLoading ? "Carregando..." : "Sem lote"}</option>{lots.map((lot) => <option key={lot.id} value={lot.id}>{lot.codigo} · saldo {formatAgroNumber(lot.saldo || 0)}</option>)}</select>{selectedLot && <p className="mt-1 text-xs text-muted-foreground">Saldo do lote: {formatAgroNumber(selectedLot.saldo || 0)} {selectedStock?.produto.unidadeMedida}</p>}</Field>
            <Field label="Quantidade *"><Input type="number" min="0" step="0.001" value={form.quantidade} onChange={(e) => setForm((f) => ({ ...f, quantidade: e.target.value }))} /></Field>
            <Field label="Valor unitário (opcional)"><Input type="number" min="0" step="0.0001" value={form.valorUnitario} onChange={(e) => setForm((f) => ({ ...f, valorUnitario: e.target.value }))} /></Field>
            <Field label="Responsável pela retirada/entrega"><Input value={form.responsavel} onChange={(e) => setForm((f) => ({ ...f, responsavel: e.target.value }))} placeholder="Ex.: Tâmioso" /></Field>
            <Field label="Destino / finalidade"><Input value={form.destino} onChange={(e) => setForm((f) => ({ ...f, destino: e.target.value }))} placeholder="Ex.: Fazenda / talhão / manutenção" /></Field>
            <Field label="Documento"><Input value={form.documento} onChange={(e) => setForm((f) => ({ ...f, documento: e.target.value }))} placeholder="NF, recibo, referência..." /></Field>
          </div>
          <Field label="Observações"><Textarea value={form.observacoes} onChange={(e) => setForm((f) => ({ ...f, observacoes: e.target.value }))} rows={3} /></Field>
          {outgoing && selectedStock && <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200"><ClipboardList className="mr-2 inline h-4 w-4" />A saída será validada contra o saldo atual no servidor antes de ser gravada.</div>}
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button disabled={saving || activeStock.length === 0} onClick={() => void saveMovement()}>{saving ? "Registrando..." : "Registrar movimentação"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AgroLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function MovementBadge({ type }: { type: AgroMovementType }) {
  const cls = type === "ENTRADA" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : type === "SAIDA" ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300" : "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300";
  return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${cls}`}>{movementLabel(type)}</span>;
}
