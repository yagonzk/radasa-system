import { useMemo, useRef, useState, type FormEvent } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useMotoristas, useMultas, useVeiculos, type Multa, type StatusMulta } from "@/lib/store";
import { formatBRL, formatDate } from "@/lib/exportUtils";
import { AlertTriangle, Eye, FileText, Pencil, Plus, Search, ShieldCheck, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";

const today = () => new Date().toISOString().slice(0, 10);
const emptyForm = () => ({
  veiculoId: "", motoristaId: "", autoInfracao: "", codigoInfracao: "", orgaoAutuador: "", dataInfracao: today(), hora: "", local: "", descricao: "", pontos: "0", valorOriginal: "", valorAtual: "", vencimento: "", status: "PENDENTE" as StatusMulta, observacoes: "", documentoUrl: null as string | null, documentoNome: null as string | null,
});

const statusLabel: Record<StatusMulta, string> = { PENDENTE: "Pendente", PAGO: "Pago", EM_RECURSO: "Em recurso", CANCELADO: "Cancelado" };
const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Não foi possível ler o arquivo."));
    reader.readAsDataURL(file);
  });
}

export default function Multas() {
  const { items: multas, create, update, remove, consultarVeiculo } = useMultas();
  const { items: veiculos } = useVeiculos();
  const { items: motoristas } = useMotoristas();
  const [search, setSearch] = useState("");
  const [veiculoFilter, setVeiculoFilter] = useState("TODOS");
  const [statusFilter, setStatusFilter] = useState("TODOS");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Multa | null>(null);
  const [viewing, setViewing] = useState<Multa | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = useMemo(() => multas.filter((multa) => {
    if (veiculoFilter !== "TODOS" && multa.veiculoId !== veiculoFilter) return false;
    if (statusFilter !== "TODOS" && multa.status !== statusFilter) return false;
    const term = normalize(search.trim());
    if (!term) return true;
    return [multa.veiculo?.placa, multa.veiculo?.renavam, multa.autoInfracao, multa.codigoInfracao, multa.orgaoAutuador, multa.descricao, multa.local, multa.motorista?.nome, multa.status].some((value) => normalize(value).includes(term));
  }), [multas, search, veiculoFilter, statusFilter]);

  const pendentes = multas.filter((item) => item.status === "PENDENTE" || item.status === "EM_RECURSO");
  const valorPendente = pendentes.reduce((total, item) => total + Number(item.valorAtual || item.valorOriginal || 0), 0);
  const vencidas = pendentes.filter((item) => item.vencimento && item.vencimento < today()).length;

  const startCreate = () => { setEditing(null); setForm(emptyForm()); setOpen(true); };
  const startEdit = (item: Multa) => {
    setEditing(item);
    setForm({
      veiculoId: item.veiculoId, motoristaId: item.motoristaId || "", autoInfracao: item.autoInfracao || "", codigoInfracao: item.codigoInfracao || "", orgaoAutuador: item.orgaoAutuador || "", dataInfracao: item.dataInfracao, hora: item.hora || "", local: item.local || "", descricao: item.descricao || "", pontos: String(item.pontos || 0), valorOriginal: String(item.valorOriginal || ""), valorAtual: String(item.valorAtual || ""), vencimento: item.vencimento || "", status: item.status, observacoes: item.observacoes || "", documentoUrl: item.documentoUrl || null, documentoNome: item.documentoNome || null,
    });
    setOpen(true);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!form.veiculoId || saving) return;
    setSaving(true);
    try {
      const payload = {
        veiculoId: form.veiculoId, motoristaId: form.motoristaId || null, autoInfracao: form.autoInfracao, codigoInfracao: form.codigoInfracao, orgaoAutuador: form.orgaoAutuador, dataInfracao: form.dataInfracao, hora: form.hora, local: form.local, descricao: form.descricao, pontos: Number(form.pontos || 0), valorOriginal: Number(String(form.valorOriginal || "0").replace(",", ".")), valorAtual: Number(String(form.valorAtual || form.valorOriginal || "0").replace(",", ".")), vencimento: form.vencimento || null, status: form.status, observacoes: form.observacoes, documentoUrl: form.documentoUrl, documentoNome: form.documentoNome,
      } as any;
      if (editing) await update(editing.id, payload); else await create(payload);
      toast.success(editing ? "Multa atualizada." : "Multa registrada.");
      setOpen(false); setEditing(null);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível salvar a multa."); }
    finally { setSaving(false); }
  };

  const consultar = async () => {
    if (veiculoFilter === "TODOS") { toast.error("Selecione uma placa para verificar."); return; }
    try {
      const response = await consultarVeiculo(veiculoFilter);
      toast.info(`${response.multas.length} multa(s) registrada(s) nesta placa. ${response.mensagem}`);
    } catch (error: any) { toast.error(error?.response?.data?.message || "Não foi possível verificar a placa."); }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Multas</h1>
            <p className="text-sm text-muted-foreground">Controle de infrações por placa da frota.</p>
          </div>
          <Button onClick={startCreate}><Plus className="mr-2 h-4 w-4" />Nova multa</Button>
        </div>

        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 text-amber-600" />
            <div className="text-sm"><p className="font-semibold">Consulta oficial SENATRAN/RENAINF</p><p className="text-muted-foreground">A aba já usa placa e RENAVAM do cadastro da frota. A consulta automática externa ficará disponível quando a credencial/autorização oficial for configurada; até lá, os registros abaixo são do controle interno do Radasa System.</p></div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="rounded-xl border bg-card p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Pendentes / recurso</p><p className="mt-1 text-2xl font-bold">{pendentes.length}</p></div>
          <div className="rounded-xl border bg-card p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Valor em aberto</p><p className="mt-1 text-2xl font-bold">{formatBRL(valorPendente)}</p></div>
          <div className="rounded-xl border bg-card p-4"><p className="text-xs font-medium uppercase text-muted-foreground">Vencidas</p><p className="mt-1 text-2xl font-bold">{vencidas}</p></div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl border bg-card p-4 lg:flex-row lg:items-end">
          <div className="min-w-0 flex-1"><Label>Pesquisar</Label><div className="relative mt-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Placa, auto, órgão, descrição ou motorista" /></div></div>
          <div className="w-full lg:w-64"><Label>Placa</Label><Select value={veiculoFilter} onValueChange={setVeiculoFilter}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todas as placas</SelectItem>{veiculos.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — {v.modelo || v.marca || "Veículo"}</SelectItem>)}</SelectContent></Select></div>
          <div className="w-full lg:w-52"><Label>Status</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos</SelectItem>{Object.entries(statusLabel).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
          <Button variant="outline" onClick={consultar}>Ver multas da placa</Button>
        </div>

        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full min-w-[1050px] text-sm">
            <thead className="bg-muted/30"><tr><th className="px-4 py-3 text-left">Placa</th><th className="px-4 py-3 text-left">Data</th><th className="px-4 py-3 text-left">Auto</th><th className="px-4 py-3 text-left">Órgão</th><th className="px-4 py-3 text-left">Infração</th><th className="px-4 py-3 text-left">Motorista</th><th className="px-4 py-3 text-left">Valor</th><th className="px-4 py-3 text-left">Status</th><th className="px-4 py-3 text-left">Ações</th></tr></thead>
            <tbody>
              {filtered.map((item) => <tr key={item.id} className="border-t"><td className="px-4 py-3 font-semibold">{item.veiculo.placa}</td><td className="px-4 py-3">{formatDate(item.dataInfracao)}</td><td className="px-4 py-3">{item.autoInfracao || "—"}</td><td className="px-4 py-3">{item.orgaoAutuador || "—"}</td><td className="max-w-[260px] truncate px-4 py-3" title={item.descricao}>{item.descricao || item.codigoInfracao || "—"}</td><td className="px-4 py-3">{item.motorista?.nome || "Não identificado"}</td><td className="px-4 py-3 font-medium">{formatBRL(item.valorAtual || item.valorOriginal)}</td><td className="px-4 py-3"><span className="rounded-full border px-2 py-1 text-xs font-medium">{statusLabel[item.status]}</span></td><td className="px-4 py-3"><div className="flex gap-1"><Button size="icon" variant="ghost" onClick={() => setViewing(item)} title="Visualizar"><Eye className="h-4 w-4" /></Button><Button size="icon" variant="ghost" onClick={() => startEdit(item)} title="Editar"><Pencil className="h-4 w-4" /></Button><Button size="icon" variant="ghost" className="text-destructive" title="Excluir" onClick={async () => { if (!window.confirm("Excluir esta multa?")) return; try { await remove(item.id); toast.success("Multa excluída."); } catch (error:any) { toast.error(error?.response?.data?.message || "Não foi possível excluir."); } }}><Trash2 className="h-4 w-4" /></Button></div></td></tr>)}
              {!filtered.length && <tr><td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">Nenhuma multa encontrada.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={open} onOpenChange={(value) => { if (!saving) setOpen(value); }}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-[760px]">
          <DialogHeader><DialogTitle>{editing ? "Editar multa" : "Nova multa"}</DialogTitle></DialogHeader>
          <form onSubmit={submit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div><Label>Veículo *</Label><Select value={form.veiculoId} onValueChange={(value) => setForm({ ...form, veiculoId: value })}><SelectTrigger className="mt-1"><SelectValue placeholder="Selecione a placa" /></SelectTrigger><SelectContent>{veiculos.map((v) => <SelectItem key={v.id} value={v.id}>{v.placa} — RENAVAM {v.renavam || "não informado"}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Motorista</Label><Select value={form.motoristaId || "AUTO"} onValueChange={(value) => setForm({ ...form, motoristaId: value === "AUTO" ? "" : value })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="AUTO">Identificar automaticamente pela viagem</SelectItem>{motoristas.map((m) => <SelectItem key={m.id} value={m.id}>{m.nome}</SelectItem>)}</SelectContent></Select></div>
              <div><Label>Data da infração *</Label><Input className="mt-1" type="date" required value={form.dataInfracao} onChange={(e) => setForm({ ...form, dataInfracao: e.target.value })} /></div>
              <div><Label>Hora</Label><Input className="mt-1" type="time" value={form.hora} onChange={(e) => setForm({ ...form, hora: e.target.value })} /></div>
              <div><Label>Auto de infração</Label><Input className="mt-1" value={form.autoInfracao} onChange={(e) => setForm({ ...form, autoInfracao: e.target.value })} /></div>
              <div><Label>Código da infração</Label><Input className="mt-1" value={form.codigoInfracao} onChange={(e) => setForm({ ...form, codigoInfracao: e.target.value })} /></div>
              <div><Label>Órgão autuador</Label><Input className="mt-1" value={form.orgaoAutuador} onChange={(e) => setForm({ ...form, orgaoAutuador: e.target.value })} /></div>
              <div><Label>Local</Label><Input className="mt-1" value={form.local} onChange={(e) => setForm({ ...form, local: e.target.value })} /></div>
              <div><Label>Pontos</Label><Input className="mt-1" type="number" min="0" value={form.pontos} onChange={(e) => setForm({ ...form, pontos: e.target.value })} /></div>
              <div><Label>Vencimento</Label><Input className="mt-1" type="date" value={form.vencimento} onChange={(e) => setForm({ ...form, vencimento: e.target.value })} /></div>
              <div><Label>Valor original</Label><Input className="mt-1" inputMode="decimal" value={form.valorOriginal} onChange={(e) => setForm({ ...form, valorOriginal: e.target.value })} placeholder="0,00" /></div>
              <div><Label>Valor atualizado</Label><Input className="mt-1" inputMode="decimal" value={form.valorAtual} onChange={(e) => setForm({ ...form, valorAtual: e.target.value })} placeholder="0,00" /></div>
              <div><Label>Status</Label><Select value={form.status} onValueChange={(value) => setForm({ ...form, status: value as StatusMulta })}><SelectTrigger className="mt-1"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(statusLabel).map(([key, label]) => <SelectItem key={key} value={key}>{label}</SelectItem>)}</SelectContent></Select></div>
            </div>
            <div><Label>Descrição da infração</Label><textarea className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
            <div><Label>Observações</Label><textarea className="mt-1 min-h-20 w-full rounded-md border bg-background px-3 py-2 text-sm" value={form.observacoes} onChange={(e) => setForm({ ...form, observacoes: e.target.value })} /></div>
            <div><Label>Documento / comprovante (PDF)</Label><input ref={fileRef} className="hidden" type="file" accept="application/pdf,.pdf" onChange={async (e) => { const file=e.target.files?.[0]; if (!file) return; if (!(file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf"))) { toast.error("Selecione um PDF válido."); return; } const dataUrl = await fileToDataUrl(file); setForm((current) => ({ ...current, documentoUrl: dataUrl, documentoNome: file.name })); }} />{form.documentoNome ? <div className="mt-1 flex items-center justify-between rounded-lg border p-3"><div className="flex items-center gap-2"><FileText className="h-4 w-4" /><span className="text-sm">{form.documentoNome}</span></div><Button type="button" size="icon" variant="ghost" onClick={() => setForm({ ...form, documentoUrl: null, documentoNome: null })}><X className="h-4 w-4" /></Button></div> : <Button className="mt-1 w-full" type="button" variant="outline" onClick={() => fileRef.current?.click()}><Upload className="mr-2 h-4 w-4" />Anexar PDF</Button>}</div>
            <DialogFooter><Button type="button" variant="outline" disabled={saving} onClick={() => setOpen(false)}>Cancelar</Button><Button type="submit" disabled={saving || !form.veiculoId}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(value) => !value && setViewing(null)}>
        <DialogContent className="sm:max-w-[700px]">
          <DialogHeader><DialogTitle>Detalhes da multa</DialogTitle></DialogHeader>
          {viewing && <div className="space-y-4 text-sm"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><Detail label="Placa" value={viewing.veiculo.placa} /><Detail label="RENAVAM" value={viewing.veiculo.renavam || "—"} /><Detail label="Data" value={formatDate(viewing.dataInfracao)} /><Detail label="Hora" value={viewing.hora || "—"} /><Detail label="Auto" value={viewing.autoInfracao || "—"} /><Detail label="Código" value={viewing.codigoInfracao || "—"} /><Detail label="Órgão" value={viewing.orgaoAutuador || "—"} /><Detail label="Motorista" value={viewing.motorista?.nome || "Não identificado"} /><Detail label="Valor" value={formatBRL(viewing.valorAtual || viewing.valorOriginal)} /><Detail label="Status" value={statusLabel[viewing.status]} /></div><Detail label="Local" value={viewing.local || "—"} /><Detail label="Infração" value={viewing.descricao || "—"} />{viewing.documentoStored && <Button variant="outline" onClick={async () => { try { const response = await api.get<{ dataUrl:string; name:string }>(`/multas/${viewing.id}/documento`); const win = window.open(response.data.dataUrl, "_blank"); if (!win) { const link=document.createElement("a"); link.href=response.data.dataUrl; link.download=response.data.name; link.click(); } } catch (error:any) { toast.error(error?.response?.data?.message || "Não foi possível abrir o documento."); } }}><FileText className="mr-2 h-4 w-4" />Abrir documento</Button>}</div>}
        </DialogContent>
      </Dialog>
    </Layout>
  );
}

function Detail({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium uppercase text-muted-foreground">{label}</p><p className="mt-0.5 font-medium">{value}</p></div>; }
