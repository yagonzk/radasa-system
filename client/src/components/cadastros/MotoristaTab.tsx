import { useMemo, useState, type ReactNode } from "react";
import { useMotoristas, type Motorista, type StatusMotorista } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import DataTable from "./DataTable";
import { Plus, User, UserCheck, UserX, AlertTriangle, BadgeCheck, Clock3 } from "lucide-react";
import { toast } from "sonner";

interface FormState {
  nome:string; cpf:string; rg:string; dataNascimento:string; telefone:string; email:string; endereco:string; cidade:string; uf:string; cep:string;
  salarioBase:string; dataAdmissao:string; cnhNumero:string; cnhRegistro:string; cnhCategoria:string; cnhValidade:string;
  primeiraHabilitacao:string; moppValidade:string; toxicologicoValidade:string; observacoes:string;
}
type StatusFilter = "TODOS" | StatusMotorista;
const emptyForm:FormState={nome:"",cpf:"",rg:"",dataNascimento:"",telefone:"",email:"",endereco:"",cidade:"",uf:"",cep:"",salarioBase:"",dataAdmissao:"",cnhNumero:"",cnhRegistro:"",cnhCategoria:"",cnhValidade:"",primeiraHabilitacao:"",moppValidade:"",toxicologicoValidade:"",observacoes:""};
const daysUntil=(date?:string|null)=>{if(!date)return null;const a=new Date(`${date}T00:00:00`),b=new Date();b.setHours(0,0,0,0);return Math.ceil((a.getTime()-b.getTime())/86400000)};
const dateStatus=(date?:string|null)=>{const d=daysUntil(date);if(d===null)return "SEM_DATA";if(d<0)return "VENCIDO";if(d<=30)return "ATENCAO";return "OK"};
const dateLabel=(v?:string|null)=>v?v.split("-").reverse().join("/"):"—";

export default function MotoristaTab(){
 const{items,create,update}=useMotoristas();const[open,setOpen]=useState(false);const[editingId,setEditingId]=useState<string|null>(null);const[form,setForm]=useState<FormState>(emptyForm);const[statusFilter,setStatusFilter]=useState<StatusFilter>("TODOS");const[query,setQuery]=useState("");const[saving,setSaving]=useState(false);
 const alertas=useMemo(()=>items.filter(x=>x.status==="ATIVO").flatMap(x=>[
   {motorista:x,tipo:"CNH",data:x.cnhValidade,status:dateStatus(x.cnhValidade)},
   {motorista:x,tipo:"MOPP",data:x.moppValidade,status:dateStatus(x.moppValidade)},
   {motorista:x,tipo:"Toxicológico",data:x.toxicologicoValidade,status:dateStatus(x.toxicologicoValidade)},
 ]).filter(x=>x.status==="VENCIDO"||x.status==="ATENCAO").sort((a,b)=>(daysUntil(a.data)??99999)-(daysUntil(b.data)??99999)),[items]);
 const filteredItems=useMemo(()=>{const q=normalizeSearch(query).trim();return items.filter(x=>(statusFilter==="TODOS"||x.status===statusFilter)&&(!q||normalizeSearch([x.nome,x.cpf,x.rg,x.telefone,x.cidade,x.cnhNumero,x.cnhCategoria,x.status].join(" ")).includes(q)))},[items,query,statusFilter]);
 const ativos=items.filter(x=>x.status==="ATIVO").length;
 const handleOpenCreate=()=>{setForm(emptyForm);setEditingId(null);setOpen(true)};
 const handleOpenEdit=(x:Motorista)=>{setForm({nome:x.nome,cpf:x.cpf,rg:x.rg||"",dataNascimento:x.dataNascimento||"",telefone:x.telefone||"",email:x.email||"",endereco:x.endereco||"",cidade:x.cidade||"",uf:x.uf||"",cep:x.cep||"",salarioBase:String(x.salarioBase),dataAdmissao:x.dataAdmissao||"",cnhNumero:x.cnhNumero||"",cnhRegistro:x.cnhRegistro||"",cnhCategoria:x.cnhCategoria||"",cnhValidade:x.cnhValidade||"",primeiraHabilitacao:x.primeiraHabilitacao||"",moppValidade:x.moppValidade||"",toxicologicoValidade:x.toxicologicoValidade||"",observacoes:x.observacoes||""});setEditingId(x.id);setOpen(true)};
 const handleSubmit=async(e:React.FormEvent)=>{e.preventDefault();if(saving)return;if(!form.nome.trim()||!form.cpf.trim())return toast.error("Preencha nome e CPF.");setSaving(true);try{const payload={...form,salarioBase:parseFloat(form.salarioBase)||0,uf:form.uf.toUpperCase().slice(0,2),status:"ATIVO" as StatusMotorista};if(editingId){const current=items.find(x=>x.id===editingId);await update(editingId,{...payload,status:current?.status||"ATIVO"})}else await create(payload);toast.success(editingId?"Motorista atualizado!":"Motorista cadastrado!");setOpen(false)}catch(error:any){toast.error(error?.response?.data?.message??"Não foi possível salvar o motorista.")}finally{setSaving(false)}};
 const toggle=async(x:Motorista)=>{const status:StatusMotorista=x.status==="ATIVO"?"DEMITIDO":"ATIVO";if(!confirm(`${status==="DEMITIDO"?"Demitir":"Reativar"} ${x.nome}?`))return;await update(x.id,{status})};
 const columns:any[]=[
  {key:"nome",label:"Motorista",render:(x:Motorista)=><div><div className="flex items-center gap-2 font-medium"><User className="h-4 w-4"/>{x.nome}</div><div className="text-xs text-muted-foreground">{x.telefone||x.cpf}</div></div>},
  {key:"cnh",label:"CNH",render:(x:Motorista)=><div><div className="font-medium">{x.cnhNumero||"—"} {x.cnhCategoria?`· ${x.cnhCategoria}`:""}</div><Validity date={x.cnhValidade}/></div>},
  {key:"cidade",label:"Cidade",render:(x:Motorista)=><span>{x.cidade?`${x.cidade}${x.uf?`/${x.uf}`:""}`:"—"}</span>},
  {key:"salarioBase",label:"Salário",render:(x:Motorista)=><span>R$ {x.salarioBase.toFixed(2).replace(".",",")}</span>},
  {key:"status",label:"Status",render:(x:Motorista)=><span className={x.status==="ATIVO"?"rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-700":"rounded-full bg-red-100 px-2 py-1 text-xs font-semibold text-red-700"}>{x.status==="ATIVO"?"Ativo":"Demitido"}</span>},
  {key:"situacao",label:"Ação",render:(x:Motorista)=><Button type="button" variant="outline" size="sm" onClick={()=>toggle(x)}>{x.status==="ATIVO"?<UserX className="mr-1 h-4 w-4"/>:<UserCheck className="mr-1 h-4 w-4"/>}{x.status==="ATIVO"?"Demitir":"Reativar"}</Button>}
 ];
 return <div className="space-y-4">
  <div className="grid gap-3 sm:grid-cols-3">
   <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Motoristas ativos</div><div className="mt-1 text-2xl font-bold">{ativos}</div></CardContent></Card>
   <Card><CardContent className="p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Documentos vencidos</span><AlertTriangle className="h-4 w-4"/></div><div className="mt-1 text-2xl font-bold">{alertas.filter(a=>a.status==="VENCIDO").length}</div></CardContent></Card>
   <Card><CardContent className="p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>Vencem em 30 dias</span><Clock3 className="h-4 w-4"/></div><div className="mt-1 text-2xl font-bold">{alertas.filter(a=>a.status==="ATENCAO").length}</div></CardContent></Card>
  </div>
  {alertas.length>0&&<div className="rounded-xl border p-4"><div className="mb-3 flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4"/>Alertas de documentos</div><div className="grid gap-2 md:grid-cols-2">{alertas.slice(0,8).map((a,i)=><div key={`${a.motorista.id}-${a.tipo}-${i}`} className="rounded-lg border p-3 text-sm"><div className="font-medium">{a.motorista.nome} · {a.tipo}</div><div className={a.status==="VENCIDO"?"text-red-600":"text-amber-600"}>{a.status==="VENCIDO"?"Vencido":"Próximo do vencimento"} · {dateLabel(a.data)}</div></div>)}</div></div>}
  <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div className="flex flex-col gap-3 sm:flex-row"><div className="w-full sm:w-72"><Label>Pesquisar</Label><Input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Nome, CPF, CNH, cidade..."/></div><div className="w-full sm:w-44"><Label>Status</Label><Select value={statusFilter} onValueChange={v=>setStatusFilter(v as StatusFilter)}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos</SelectItem><SelectItem value="ATIVO">Ativos</SelectItem><SelectItem value="DEMITIDO">Demitidos</SelectItem></SelectContent></Select></div></div><Button onClick={handleOpenCreate}><Plus className="mr-1 h-4 w-4"/>Novo Motorista</Button></div>
  <DataTable columns={columns} data={filteredItems} onEdit={handleOpenEdit} emptyMessage="Nenhum motorista encontrado."/>
  <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto"><DialogHeader><DialogTitle>{editingId?"Editar Motorista":"Novo Motorista"}</DialogTitle></DialogHeader><form onSubmit={handleSubmit} className="space-y-5">
   <Section title="Dados pessoais"><div className="grid gap-3 md:grid-cols-3"><Field label="Nome"><Input value={form.nome} onChange={e=>setForm({...form,nome:e.target.value})}/></Field><Field label="CPF"><Input value={form.cpf} onChange={e=>setForm({...form,cpf:e.target.value})}/></Field><Field label="RG"><Input value={form.rg} onChange={e=>setForm({...form,rg:e.target.value})}/></Field><Field label="Nascimento"><Input type="date" value={form.dataNascimento} onChange={e=>setForm({...form,dataNascimento:e.target.value})}/></Field><Field label="Telefone"><Input value={form.telefone} onChange={e=>setForm({...form,telefone:e.target.value})}/></Field><Field label="E-mail"><Input type="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})}/></Field></div></Section>
   <Section title="Endereço"><div className="grid gap-3 md:grid-cols-4"><Field label="Endereço"><Input value={form.endereco} onChange={e=>setForm({...form,endereco:e.target.value})}/></Field><Field label="Cidade"><Input value={form.cidade} onChange={e=>setForm({...form,cidade:e.target.value})}/></Field><Field label="UF"><Input maxLength={2} value={form.uf} onChange={e=>setForm({...form,uf:e.target.value.toUpperCase()})}/></Field><Field label="CEP"><Input value={form.cep} onChange={e=>setForm({...form,cep:e.target.value})}/></Field></div></Section>
   <Section title="CNH e qualificações"><div className="grid gap-3 md:grid-cols-3"><Field label="Número CNH"><Input value={form.cnhNumero} onChange={e=>setForm({...form,cnhNumero:e.target.value})}/></Field><Field label="Registro CNH"><Input value={form.cnhRegistro} onChange={e=>setForm({...form,cnhRegistro:e.target.value})}/></Field><Field label="Categoria"><Input placeholder="Ex.: AE" value={form.cnhCategoria} onChange={e=>setForm({...form,cnhCategoria:e.target.value.toUpperCase()})}/></Field><Field label="Validade CNH"><Input type="date" value={form.cnhValidade} onChange={e=>setForm({...form,cnhValidade:e.target.value})}/></Field><Field label="1ª habilitação"><Input type="date" value={form.primeiraHabilitacao} onChange={e=>setForm({...form,primeiraHabilitacao:e.target.value})}/></Field><Field label="Validade MOPP"><Input type="date" value={form.moppValidade} onChange={e=>setForm({...form,moppValidade:e.target.value})}/></Field><Field label="Exame toxicológico"><Input type="date" value={form.toxicologicoValidade} onChange={e=>setForm({...form,toxicologicoValidade:e.target.value})}/></Field></div></Section>
   <Section title="Vínculo e observações"><div className="grid gap-3 md:grid-cols-2"><Field label="Data de admissão"><Input type="date" value={form.dataAdmissao} onChange={e=>setForm({...form,dataAdmissao:e.target.value})}/></Field><Field label="Salário Base (R$)"><Input type="number" step="0.01" value={form.salarioBase} onChange={e=>setForm({...form,salarioBase:e.target.value})}/></Field><Field label="Observações"><Input value={form.observacoes} onChange={e=>setForm({...form,observacoes:e.target.value})}/></Field></div></Section>
   <DialogFooter><Button type="submit" disabled={saving}>{saving?"Salvando...":editingId?"Salvar alterações":"Cadastrar"}</Button></DialogFooter>
  </form></DialogContent></Dialog>
 </div>
}
function Validity({date}:{date?:string|null}){const s=dateStatus(date);return <div className={s==="VENCIDO"?"text-xs text-red-600":s==="ATENCAO"?"text-xs text-amber-600":"text-xs text-muted-foreground"}>{date?`Validade ${dateLabel(date)}`:"Validade não informada"}</div>}
function Section({title,children}:{title:string;children:ReactNode}){return <div><div className="mb-2 flex items-center gap-2 text-sm font-semibold"><BadgeCheck className="h-4 w-4"/>{title}</div>{children}</div>}
function Field({label,children}:{label:string;children:ReactNode}){return <div className="space-y-1"><Label>{label}</Label>{children}</div>}
function normalizeSearch(v:unknown){return String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toLocaleLowerCase("pt-BR")}
