import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarRange, Map, MapPinned, Pencil, Plus, Search, Wheat } from "lucide-react";
import { toast } from "sonner";
import AgroLayout from "@/components/agro/AgroLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import type { AgroCrop, AgroFarm, AgroPlot, AgroSeason } from "@/lib/agro";
import { formatAgroDate, formatAgroNumber } from "@/lib/agro";

type EntityType = "fazenda" | "talhao" | "safra" | "cultura";
const emptyFarm = { nome: "", cidade: "", uf: "", areaTotalHa: "0", observacoes: "", ativo: true };
const emptyPlot = { fazendaId: "", nome: "", areaHa: "0", observacoes: "", ativo: true };
const emptySeason = { nome: "", dataInicio: "", dataFim: "", ativo: true };
const emptyCrop = { nome: "", ativo: true };

export default function AgroCadastros() {
  const [tab, setTab] = useState("fazendas");
  const [farms, setFarms] = useState<AgroFarm[]>([]);
  const [plots, setPlots] = useState<AgroPlot[]>([]);
  const [seasons, setSeasons] = useState<AgroSeason[]>([]);
  const [crops, setCrops] = useState<AgroCrop[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [entityType, setEntityType] = useState<EntityType>("fazenda");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<any>(emptyFarm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [farmRes, plotRes, seasonRes, cropRes] = await Promise.all([
        api.get<AgroFarm[]>("/agro/fazendas"),
        api.get<AgroPlot[]>("/agro/talhoes"),
        api.get<AgroSeason[]>("/agro/safras"),
        api.get<AgroCrop[]>("/agro/culturas"),
      ]);
      setFarms(Array.isArray(farmRes.data) ? farmRes.data : []);
      setPlots(Array.isArray(plotRes.data) ? plotRes.data : []);
      setSeasons(Array.isArray(seasonRes.data) ? seasonRes.data : []);
      setCrops(Array.isArray(cropRes.data) ? cropRes.data : []);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível carregar os cadastros agrícolas.");
    } finally { if (!silent) setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "agro", "agro/cadastros", "agro/fazendas", "agro/talhoes", "agro/safras", "agro/culturas", "agro/lavouras")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => void load(true), 250);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => { if (timer) window.clearTimeout(timer); window.removeEventListener(REALTIME_CHANGE_EVENT, handler); };
  }, [load]);

  const query = search.trim().toLocaleLowerCase("pt-BR");
  const filteredFarms = useMemo(() => farms.filter((item) => !query || [item.nome, item.cidade, item.uf].some((v) => String(v || "").toLocaleLowerCase("pt-BR").includes(query))), [farms, query]);
  const filteredPlots = useMemo(() => plots.filter((item) => !query || [item.nome, item.fazenda?.nome].some((v) => String(v || "").toLocaleLowerCase("pt-BR").includes(query))), [plots, query]);
  const filteredSeasons = useMemo(() => seasons.filter((item) => !query || item.nome.toLocaleLowerCase("pt-BR").includes(query)), [seasons, query]);
  const filteredCrops = useMemo(() => crops.filter((item) => !query || item.nome.toLocaleLowerCase("pt-BR").includes(query)), [crops, query]);

  function openNew(type: EntityType) {
    setEntityType(type);
    setEditingId(null);
    setForm(type === "fazenda" ? emptyFarm : type === "talhao" ? { ...emptyPlot, fazendaId: farms.find((f) => f.ativo)?.id || "" } : type === "safra" ? emptySeason : emptyCrop);
    setDialogOpen(true);
  }

  function openEdit(type: EntityType, item: any) {
    setEntityType(type);
    setEditingId(item.id);
    if (type === "fazenda") setForm({ nome: item.nome, cidade: item.cidade, uf: item.uf, areaTotalHa: String(item.areaTotalHa), observacoes: item.observacoes, ativo: item.ativo });
    else if (type === "talhao") setForm({ fazendaId: item.fazendaId, nome: item.nome, areaHa: String(item.areaHa), observacoes: item.observacoes, ativo: item.ativo });
    else if (type === "safra") setForm({ nome: item.nome, dataInicio: item.dataInicio || "", dataFim: item.dataFim || "", ativo: item.ativo });
    else setForm({ nome: item.nome, ativo: item.ativo });
    setDialogOpen(true);
  }

  async function save() {
    if (!String(form.nome || "").trim()) return toast.error("Informe o nome.");
    if (entityType === "talhao" && !form.fazendaId) return toast.error("Selecione a fazenda.");
    const payload = { ...form };
    if (entityType === "fazenda") payload.areaTotalHa = Number(String(form.areaTotalHa || 0).replace(",", "."));
    if (entityType === "talhao") payload.areaHa = Number(String(form.areaHa || 0).replace(",", "."));
    if ((entityType === "fazenda" && (!Number.isFinite(payload.areaTotalHa) || payload.areaTotalHa < 0)) || (entityType === "talhao" && (!Number.isFinite(payload.areaHa) || payload.areaHa < 0))) return toast.error("Informe uma área válida.");
    const endpoint = entityType === "fazenda" ? "fazendas" : entityType === "talhao" ? "talhoes" : entityType === "safra" ? "safras" : "culturas";
    setSaving(true);
    try {
      if (editingId) await api.put(`/agro/${endpoint}/${editingId}`, payload);
      else await api.post(`/agro/${endpoint}`, payload);
      toast.success(editingId ? "Cadastro atualizado." : "Cadastro criado.");
      setDialogOpen(false);
      await load(true);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível salvar o cadastro."); }
    finally { setSaving(false); }
  }

  const addType: EntityType = tab === "fazendas" ? "fazenda" : tab === "talhoes" ? "talhao" : tab === "safras" ? "safra" : "cultura";
  const addLabel = addType === "fazenda" ? "Nova fazenda" : addType === "talhao" ? "Novo talhão" : addType === "safra" ? "Nova safra" : "Nova cultura";

  return (
    <AgroLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Agro / Cadastros</p><h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Estrutura agrícola</h1><p className="mt-2 text-sm text-muted-foreground">Fazendas, talhões, safras e culturas usados para organizar as lavouras.</p></div>
          <Button onClick={() => openNew(addType)}><Plus className="mr-2 h-4 w-4" />{addLabel}</Button>
        </div>

        <div className="rounded-xl border border-dashed bg-muted/20 px-4 py-3 text-sm text-muted-foreground">Responsáveis por retirada ou operação continuam sendo apenas identificação informativa, <strong className="font-semibold text-foreground">sem login</strong>, e são preenchidos diretamente nas movimentações e operações agrícolas.</div>

        <Tabs value={tab} onValueChange={setTab}>
          <div className="flex flex-col gap-3 rounded-xl border bg-card p-3 lg:flex-row lg:items-center lg:justify-between">
            <TabsList className="w-full overflow-x-auto lg:w-auto"><TabsTrigger value="fazendas"><MapPinned />Fazendas</TabsTrigger><TabsTrigger value="talhoes"><Map />Talhões</TabsTrigger><TabsTrigger value="safras"><CalendarRange />Safras</TabsTrigger><TabsTrigger value="culturas"><Wheat />Culturas</TabsTrigger></TabsList>
            <div className="relative min-w-0 flex-1 lg:max-w-sm"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" placeholder="Buscar neste cadastro..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>

          <TabsContent value="fazendas"><SimpleTable loading={loading} empty="Nenhuma fazenda cadastrada." headers={["Fazenda", "Localização", "Área", "Talhões", "Status", ""]} rows={filteredFarms.map((item) => [<div><div className="font-semibold">{item.nome}</div>{item.observacoes && <div className="max-w-md truncate text-xs text-muted-foreground">{item.observacoes}</div>}</div>, [item.cidade, item.uf].filter(Boolean).join(" / ") || "—", `${formatAgroNumber(item.areaTotalHa)} ha`, item._count?.talhoes ?? 0, <Status active={item.ativo} />, <EditButton onClick={() => openEdit("fazenda", item)} />])} /></TabsContent>
          <TabsContent value="talhoes"><SimpleTable loading={loading} empty="Nenhum talhão cadastrado." headers={["Talhão", "Fazenda", "Área", "Lavouras", "Status", ""]} rows={filteredPlots.map((item) => [<div><div className="font-semibold">{item.nome}</div>{item.observacoes && <div className="max-w-md truncate text-xs text-muted-foreground">{item.observacoes}</div>}</div>, item.fazenda?.nome || "—", `${formatAgroNumber(item.areaHa)} ha`, item._count?.lavouras ?? 0, <Status active={item.ativo} />, <EditButton onClick={() => openEdit("talhao", item)} />])} /></TabsContent>
          <TabsContent value="safras"><SimpleTable loading={loading} empty="Nenhuma safra cadastrada." headers={["Safra", "Início", "Fim", "Lavouras", "Status", ""]} rows={filteredSeasons.map((item) => [<span className="font-semibold">{item.nome}</span>, formatAgroDate(item.dataInicio), formatAgroDate(item.dataFim), item._count?.lavouras ?? 0, <Status active={item.ativo} />, <EditButton onClick={() => openEdit("safra", item)} />])} /></TabsContent>
          <TabsContent value="culturas"><SimpleTable loading={loading} empty="Nenhuma cultura cadastrada." headers={["Cultura", "Lavouras", "Status", ""]} rows={filteredCrops.map((item) => [<span className="font-semibold">{item.nome}</span>, item._count?.lavouras ?? 0, <Status active={item.ativo} />, <EditButton onClick={() => openEdit("cultura", item)} />])} /></TabsContent>
        </Tabs>
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[90vh] max-w-xl overflow-y-auto">
          <DialogHeader><DialogTitle>{editingId ? "Editar" : "Cadastrar"} {entityType === "fazenda" ? "fazenda" : entityType === "talhao" ? "talhão" : entityType === "safra" ? "safra" : "cultura"}</DialogTitle><DialogDescription>Este cadastro é exclusivo do módulo Agro.</DialogDescription></DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            {entityType === "talhao" && <Field label="Fazenda *"><select className="h-9 w-full rounded-md border bg-background px-3 text-sm" value={form.fazendaId || ""} onChange={(e) => setForm((f: any) => ({ ...f, fazendaId: e.target.value }))}><option value="">Selecione...</option>{farms.filter((f) => f.ativo || f.id === form.fazendaId).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}</select></Field>}
            <Field label="Nome *"><Input value={form.nome || ""} onChange={(e) => setForm((f: any) => ({ ...f, nome: e.target.value }))} placeholder={entityType === "safra" ? "Ex.: 2026/2027" : ""} /></Field>
            {entityType === "fazenda" && <><Field label="Cidade"><Input value={form.cidade || ""} onChange={(e) => setForm((f: any) => ({ ...f, cidade: e.target.value }))} /></Field><Field label="UF"><Input maxLength={2} value={form.uf || ""} onChange={(e) => setForm((f: any) => ({ ...f, uf: e.target.value.toUpperCase() }))} /></Field><Field label="Área total (ha)"><Input type="number" min="0" step="0.001" value={form.areaTotalHa || "0"} onChange={(e) => setForm((f: any) => ({ ...f, areaTotalHa: e.target.value }))} /></Field></>}
            {entityType === "talhao" && <Field label="Área (ha)"><Input type="number" min="0" step="0.001" value={form.areaHa || "0"} onChange={(e) => setForm((f: any) => ({ ...f, areaHa: e.target.value }))} /></Field>}
            {entityType === "safra" && <><Field label="Data inicial"><Input type="date" value={form.dataInicio || ""} onChange={(e) => setForm((f: any) => ({ ...f, dataInicio: e.target.value }))} /></Field><Field label="Data final"><Input type="date" value={form.dataFim || ""} onChange={(e) => setForm((f: any) => ({ ...f, dataFim: e.target.value }))} /></Field></>}
          </div>
          {(entityType === "fazenda" || entityType === "talhao") && <Field label="Observações"><Textarea rows={3} value={form.observacoes || ""} onChange={(e) => setForm((f: any) => ({ ...f, observacoes: e.target.value }))} /></Field>}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.ativo !== false} onChange={(e) => setForm((f: any) => ({ ...f, ativo: e.target.checked }))} />Cadastro ativo</label>
          <DialogFooter><Button variant="outline" onClick={() => setDialogOpen(false)}>Cancelar</Button><Button disabled={saving} onClick={() => void save()}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </AgroLayout>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-1.5"><Label>{label}</Label>{children}</div>; }
function Status({ active }: { active: boolean }) { return <span className={`rounded-full px-2 py-1 text-xs font-semibold ${active ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300" : "bg-muted text-muted-foreground"}`}>{active ? "Ativo" : "Inativo"}</span>; }
function EditButton({ onClick }: { onClick: () => void }) { return <Button variant="ghost" size="icon" onClick={onClick} title="Editar"><Pencil className="h-4 w-4" /></Button>; }
function SimpleTable({ headers, rows, loading, empty }: { headers: string[]; rows: React.ReactNode[][]; loading: boolean; empty: string }) {
  return <div className="mt-3 overflow-hidden rounded-xl border bg-card"><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground"><tr>{headers.map((h) => <th key={h} className="px-4 py-3">{h}</th>)}</tr></thead><tbody className="divide-y">{rows.map((cells, i) => <tr key={i}>{cells.map((cell, j) => <td key={j} className="px-4 py-3">{cell}</td>)}</tr>)}{loading && <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-muted-foreground">Carregando...</td></tr>}{!loading && rows.length === 0 && <tr><td colSpan={headers.length} className="px-4 py-12 text-center text-muted-foreground">{empty}</td></tr>}</tbody></table></div></div>;
}
