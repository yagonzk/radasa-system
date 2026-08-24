import { useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useDemandas, type Demanda, type PrioridadeDemanda, type StatusDemanda } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, CalendarDays, UserRound, MoreHorizontal, Pencil, Trash2, ListTodo, Clock3 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

const COLUNAS: Array<{ value: StatusDemanda; label: string; hint: string }> = [
  { value: "BACKLOG", label: "Backlog", hint: "Ideias e anotações" },
  { value: "A_FAZER", label: "A fazer", hint: "Demandas priorizadas" },
  { value: "EM_ANDAMENTO", label: "Em andamento", hint: "Em execução" },
  { value: "AGUARDANDO", label: "Aguardando", hint: "Dependência ou retorno" },
  { value: "CONCLUIDA", label: "Concluídas", hint: "Finalizadas" },
];

const PRIORIDADES: Array<{ value: PrioridadeDemanda; label: string }> = [
  { value: "BAIXA", label: "Baixa" }, { value: "MEDIA", label: "Média" }, { value: "ALTA", label: "Alta" }, { value: "URGENTE", label: "Urgente" },
];

const priorityClass: Record<PrioridadeDemanda, string> = {
  BAIXA: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  MEDIA: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-200",
  ALTA: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
  URGENTE: "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200",
};

const emptyForm = { titulo: "", descricao: "", status: "A_FAZER" as StatusDemanda, prioridade: "MEDIA" as PrioridadeDemanda, responsavel: "", etiquetas: "", dataPrazo: "" };

export default function Demandas() {
  const { items, create, update, remove } = useDemandas();
  const [busca, setBusca] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Demanda | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [draggingId, setDraggingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return [...items].filter((d) => !q || [d.titulo, d.descricao, d.responsavel, ...(d.etiquetas ?? [])].some(v => String(v ?? "").toLowerCase().includes(q)))
      .sort((a,b) => a.ordem - b.ordem || a.titulo.localeCompare(b.titulo));
  }, [items, busca]);

  const openCreate = (status: StatusDemanda = "A_FAZER") => { setEditing(null); setForm({ ...emptyForm, status }); setDialogOpen(true); };
  const openEdit = (d: Demanda) => { setEditing(d); setForm({ titulo: d.titulo, descricao: d.descricao ?? "", status: d.status, prioridade: d.prioridade, responsavel: d.responsavel ?? "", etiquetas: (d.etiquetas ?? []).join(", "), dataPrazo: d.dataPrazo ?? "" }); setDialogOpen(true); };

  const save = async () => {
    if (!form.titulo.trim()) return toast.error("Informe o título da demanda.");
    setSaving(true);
    try {
      const payload = { ...form, titulo: form.titulo.trim(), etiquetas: form.etiquetas.split(",").map(v => v.trim()).filter(Boolean), dataPrazo: form.dataPrazo || null };
      if (editing) await update(editing.id, payload); else await create(payload);
      setDialogOpen(false); toast.success(editing ? "Demanda atualizada." : "Demanda criada.");
    } catch { toast.error("Não foi possível salvar a demanda."); } finally { setSaving(false); }
  };

  const deleteCard = async (d: Demanda) => {
    if (!window.confirm(`Excluir a demanda “${d.titulo}”?`)) return;
    try { await remove(d.id); toast.success("Demanda excluída."); } catch { toast.error("Não foi possível excluir."); }
  };

  const moveTo = async (id: string, status: StatusDemanda) => {
    const current = items.find(d => d.id === id); if (!current || current.status === status) return;
    try { await update(id, { status }); } catch { toast.error("Não foi possível mover o cartão."); }
  };

  const vencida = (d: Demanda) => !!d.dataPrazo && d.status !== "CONCLUIDA" && new Date(`${d.dataPrazo}T23:59:59`).getTime() < Date.now();
  const hoje = new Date().toISOString().slice(0,10);

  return <Layout>
    <div className="flex h-[calc(100vh-112px)] min-h-[620px] flex-col gap-5 overflow-hidden">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2"><ListTodo className="h-6 w-6 text-primary"/><h1 className="text-2xl font-bold tracking-tight">Demandas</h1></div>
          <p className="mt-1 text-sm text-muted-foreground">Organize tarefas e anotações em um quadro Kanban.</p>
        </div>
        <Button onClick={() => openCreate()} className="gap-2"><Plus className="h-4 w-4"/>Nova demanda</Button>
      </div>

      <div className="flex items-center gap-3">
        <div className="relative w-full max-w-md"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input value={busca} onChange={e=>setBusca(e.target.value)} placeholder="Pesquisar demandas..." className="pl-9"/></div>
        <div className="hidden text-sm text-muted-foreground md:block">{items.length} {items.length === 1 ? "cartão" : "cartões"}</div>
      </div>

      <div className="flex flex-1 gap-4 overflow-x-auto overflow-y-hidden pb-3">
        {COLUNAS.map(col => {
          const cards = filtered.filter(d => d.status === col.value);
          return <section key={col.value} onDragOver={e=>e.preventDefault()} onDrop={e=>{e.preventDefault(); if(draggingId) void moveTo(draggingId,col.value); setDraggingId(null);}} className="flex h-full w-[300px] min-w-[300px] flex-col rounded-xl border bg-muted/40 p-3">
            <div className="mb-3 flex items-start justify-between gap-2 px-1">
              <div><div className="flex items-center gap-2"><h2 className="text-sm font-semibold">{col.label}</h2><span className="rounded-full bg-background px-2 py-0.5 text-[11px] font-semibold text-muted-foreground shadow-sm">{cards.length}</span></div><p className="mt-0.5 text-[11px] text-muted-foreground">{col.hint}</p></div>
              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={()=>openCreate(col.value)} title={`Adicionar em ${col.label}`}><Plus className="h-4 w-4"/></Button>
            </div>
            <div className="flex-1 space-y-2 overflow-y-auto pr-1">
              {cards.map(d => <article key={d.id} draggable onDragStart={()=>setDraggingId(d.id)} onDragEnd={()=>setDraggingId(null)} onDoubleClick={()=>openEdit(d)} className="group cursor-grab rounded-lg border bg-card p-3 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:cursor-grabbing">
                <div className="mb-2 flex items-start gap-2">
                  <h3 className="min-w-0 flex-1 text-sm font-semibold leading-5">{d.titulo}</h3>
                  <DropdownMenu><DropdownMenuTrigger asChild><button className="rounded p-1 text-muted-foreground opacity-0 hover:bg-muted group-hover:opacity-100"><MoreHorizontal className="h-4 w-4"/></button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={()=>openEdit(d)}><Pencil className="mr-2 h-4 w-4"/>Editar</DropdownMenuItem><DropdownMenuItem onClick={()=>void deleteCard(d)} className="text-destructive"><Trash2 className="mr-2 h-4 w-4"/>Excluir</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
                </div>
                {d.descricao && <p className="mb-3 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-muted-foreground">{d.descricao}</p>}
                {(d.etiquetas?.length ?? 0) > 0 && <div className="mb-3 flex flex-wrap gap-1">{d.etiquetas.slice(0,4).map(tag=><span key={tag} className="rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-medium text-primary">{tag}</span>)}</div>}
                <div className="flex flex-wrap items-center gap-1.5"><Badge className={`border-0 text-[10px] ${priorityClass[d.prioridade]}`}>{PRIORIDADES.find(p=>p.value===d.prioridade)?.label}</Badge>{d.dataPrazo && <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] font-medium ${vencida(d) ? "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-200" : d.dataPrazo===hoje ? "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-200" : "bg-muted text-muted-foreground"}`}><CalendarDays className="h-3 w-3"/>{new Date(`${d.dataPrazo}T00:00:00`).toLocaleDateString("pt-BR")}</span>}</div>
                {d.responsavel && <div className="mt-3 flex items-center gap-1.5 border-t pt-2 text-[11px] text-muted-foreground"><UserRound className="h-3.5 w-3.5"/><span className="truncate">{d.responsavel}</span></div>}
              </article>)}
              {cards.length===0 && <button onClick={()=>openCreate(col.value)} className="flex w-full flex-col items-center justify-center rounded-lg border border-dashed px-4 py-8 text-center text-muted-foreground transition hover:border-primary/40 hover:bg-background hover:text-foreground"><Plus className="mb-2 h-5 w-5"/><span className="text-xs">Adicionar cartão</span></button>}
            </div>
          </section>;
        })}
      </div>
    </div>

    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="max-w-2xl"><DialogHeader><DialogTitle>{editing ? "Editar demanda" : "Nova demanda"}</DialogTitle></DialogHeader><div className="grid gap-4 py-2">
      <div className="space-y-2"><Label>Título *</Label><Input value={form.titulo} onChange={e=>setForm(f=>({...f,titulo:e.target.value}))} placeholder="Ex.: Conferir documentos do caminhão" autoFocus/></div>
      <div className="space-y-2"><Label>Descrição / anotações</Label><Textarea value={form.descricao} onChange={e=>setForm(f=>({...f,descricao:e.target.value}))} placeholder="Detalhes, checklist informal, observações..." className="min-h-28"/></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Coluna</Label><Select value={form.status} onValueChange={(v:StatusDemanda)=>setForm(f=>({...f,status:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{COLUNAS.map(c=><SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Prioridade</Label><Select value={form.prioridade} onValueChange={(v:PrioridadeDemanda)=>setForm(f=>({...f,prioridade:v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{PRIORIDADES.map(p=><SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}</SelectContent></Select></div></div>
      <div className="grid gap-4 sm:grid-cols-2"><div className="space-y-2"><Label>Responsável</Label><Input value={form.responsavel} onChange={e=>setForm(f=>({...f,responsavel:e.target.value}))} placeholder="Nome do responsável"/></div><div className="space-y-2"><Label>Prazo</Label><Input type="date" value={form.dataPrazo} onChange={e=>setForm(f=>({...f,dataPrazo:e.target.value}))}/></div></div>
      <div className="space-y-2"><Label>Etiquetas</Label><Input value={form.etiquetas} onChange={e=>setForm(f=>({...f,etiquetas:e.target.value}))} placeholder="Ex.: Fiscal, Frota, Urgente (separe por vírgulas)"/><p className="text-[11px] text-muted-foreground">Separe as etiquetas por vírgulas.</p></div>
    </div><DialogFooter><Button variant="outline" onClick={()=>setDialogOpen(false)}>Cancelar</Button><Button onClick={()=>void save()} disabled={saving}>{saving ? "Salvando..." : editing ? "Salvar alterações" : "Criar demanda"}</Button></DialogFooter></DialogContent></Dialog>
  </Layout>;
}
