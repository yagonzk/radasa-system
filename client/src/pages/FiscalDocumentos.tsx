import { useCallback, useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, FileCheck2, LoaderCircle, RefreshCcw, Search, Wrench } from "lucide-react";
import { toast } from "sonner";

type StatusData = {
  empresa: { id:string; razaoSocial:string; cnpj:string; uf:string; certificadoValidade:string|null };
  state: { ultNsu:string; maxNsu:string; lastCStat:string; lastMessage:string; lastQueryAt:string|null } | null;
  counts: Record<string,number>;
};
type Doc = { id:string; chave:string; nsu:string; schema:string; tipo:string; classificacao:string; status:string; numero:string; serie:string; dataEmissao:string|null; emitenteCnpj:string; emitenteNome:string; valorTotal:number|string; placa:string; hodometro:number|string|null; erro:string; importedAt:string|null; createdAt:string };

const money=(v:unknown)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const date=(v?:string|null)=>v?new Date(`${String(v).slice(0,10)}T12:00:00`).toLocaleDateString("pt-BR"):"—";

function statusLabel(v:string){return ({NOVO:"Novo",IMPORTADO:"Importado",PENDENTE:"Pendente",IGNORADO:"Ignorado",ERRO:"Erro"} as Record<string,string>)[v]||v;}
function classLabel(v:string){return ({ABASTECIMENTO:"Abastecimento",MANUTENCAO:"Manutenção",OUTRO:"Outro"} as Record<string,string>)[v]||v;}

export default function FiscalDocumentos(){
  const [statusData,setStatusData]=useState<StatusData|null>(null);
  const [docs,setDocs]=useState<Doc[]>([]);
  const [loading,setLoading]=useState(true);
  const [status,setStatus]=useState("TODOS");
  const [classification,setClassification]=useState("TODOS");
  const [search,setSearch]=useState("");

  const params=useMemo(()=>({status:status==="TODOS"?undefined:status,classificacao:classification==="TODOS"?undefined:classification,search:search.trim()||undefined}),[status,classification,search]);
  const load=useCallback(async()=>{setLoading(true);try{const [s,d]=await Promise.all([api.get<StatusData>("/sefaz/status"),api.get<Doc[]>("/sefaz/documentos",{params})]);setStatusData(s.data);setDocs(d.data);}catch(e:any){toast.error(e?.response?.data?.message||"Não foi possível carregar os documentos da SEFAZ.");}finally{setLoading(false);}},[params]);
  useEffect(()=>{const t=setTimeout(()=>void load(),search?250:0);return()=>clearTimeout(t);},[load,search]);

  async function downloadXml(doc:Doc){try{const r=await api.get<{url:string;nome:string}>(`/sefaz/documentos/${doc.id}/xml`);const a=document.createElement("a");a.href=r.data.url;a.download=r.data.nome;document.body.appendChild(a);a.click();a.remove();}catch(e:any){toast.error(e?.response?.data?.message||"Não foi possível baixar o XML.");}}

  return <Layout><div className="w-full min-w-0 space-y-5">
    <div><div className="flex items-center gap-2"><h1 className="font-display text-2xl font-bold">Documentos Fiscais</h1><Badge variant="outline">SEFAZ automática</Badge></div><p className="mt-1 text-sm text-muted-foreground">As NF-e são processadas automaticamente em segundo plano. Abastecimentos reconhecidos são lançados diretamente na aba Abastecimentos.</p></div>

    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase text-muted-foreground">Importados</p><p className="mt-1 text-2xl font-bold">{statusData?.counts?.IMPORTADO||0}</p></div><FileCheck2 className="h-5 w-5 text-primary"/></div></CardContent></Card>
      <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase text-muted-foreground">Pendentes</p><p className="mt-1 text-2xl font-bold">{statusData?.counts?.PENDENTE||0}</p></div><LoaderCircle className="h-5 w-5 text-muted-foreground"/></div></CardContent></Card>
      <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs uppercase text-muted-foreground">Certificado</p><p className="mt-1 truncate text-sm font-bold">{statusData?.empresa?.razaoSocial||"—"}</p><p className="text-xs text-muted-foreground">{statusData?.empresa?.cnpj||""}</p></div><Wrench className="h-5 w-5 text-primary"/></div></CardContent></Card>
    </div>

    {statusData?.state?.lastMessage&&<Card className="border-dashed"><CardContent className="p-3 text-xs text-muted-foreground">Última resposta SEFAZ: <strong className="text-foreground">{statusData.state.lastCStat}</strong> — {statusData.state.lastMessage}</CardContent></Card>}

    <Card><CardHeader><CardTitle className="text-base">Documentos recebidos</CardTitle></CardHeader><CardContent className="space-y-4">
      <div className="grid gap-2 lg:grid-cols-[minmax(220px,1fr)_190px_190px_auto]"><div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"/><Input className="pl-9" placeholder="Chave, fornecedor, CNPJ, NF ou placa" value={search} onChange={e=>setSearch(e.target.value)}/></div><Select value={classification} onValueChange={setClassification}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todas as classes</SelectItem><SelectItem value="ABASTECIMENTO">Abastecimentos</SelectItem><SelectItem value="MANUTENCAO">Manutenção</SelectItem><SelectItem value="OUTRO">Outros</SelectItem></SelectContent></Select><Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><SelectItem value="TODOS">Todos os status</SelectItem><SelectItem value="IMPORTADO">Importados</SelectItem><SelectItem value="NOVO">Novos</SelectItem><SelectItem value="PENDENTE">Pendentes</SelectItem><SelectItem value="ERRO">Com erro</SelectItem></SelectContent></Select><Button variant="outline" onClick={()=>void load()} disabled={loading}><RefreshCcw className={`h-4 w-4 ${loading?"animate-spin":""}`}/></Button></div>
      <div className="overflow-x-auto rounded-lg border"><table className="w-full min-w-[1180px] text-sm"><thead className="bg-muted/40 text-xs uppercase text-muted-foreground"><tr><th className="px-3 py-3 text-left">Emissão</th><th className="px-3 py-3 text-left">NF-e</th><th className="px-3 py-3 text-left">Fornecedor</th><th className="px-3 py-3 text-left">Classificação</th><th className="px-3 py-3 text-left">Placa / KM</th><th className="px-3 py-3 text-right">Valor</th><th className="px-3 py-3 text-left">Status</th><th className="px-3 py-3 text-right">XML</th></tr></thead><tbody>{docs.map(doc=><tr key={doc.id} className="border-t"><td className="px-3 py-3 whitespace-nowrap">{date(doc.dataEmissao)}</td><td className="px-3 py-3"><div className="font-medium">{doc.numero||"—"}{doc.serie?` / ${doc.serie}`:""}</div><div className="max-w-56 truncate text-[11px] text-muted-foreground" title={doc.chave}>{doc.chave}</div></td><td className="px-3 py-3"><div className="max-w-72 truncate font-medium" title={doc.emitenteNome}>{doc.emitenteNome||"—"}</div><div className="text-[11px] text-muted-foreground">{doc.emitenteCnpj||""}</div></td><td className="px-3 py-3"><Badge variant={doc.classificacao==="ABASTECIMENTO"?"default":"secondary"}>{classLabel(doc.classificacao)}</Badge></td><td className="px-3 py-3"><div>{doc.placa||"—"}</div><div className="text-xs text-muted-foreground">{doc.hodometro?`${Number(doc.hodometro).toLocaleString("pt-BR")} km`:"KM não informado"}</div></td><td className="px-3 py-3 text-right font-semibold tabular-nums">{money(doc.valorTotal)}</td><td className="px-3 py-3"><Badge variant={doc.status==="ERRO"?"destructive":doc.status==="IMPORTADO"?"default":"outline"}>{statusLabel(doc.status)}</Badge>{doc.erro&&<p className="mt-1 max-w-64 text-[11px] text-muted-foreground" title={doc.erro}>{doc.erro}</p>}</td><td className="px-3 py-3 text-right"><Button size="sm" variant="ghost" onClick={()=>void downloadXml(doc)}><Download className="mr-1 h-4 w-4"/>XML</Button></td></tr>)}{!loading&&docs.length===0&&<tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Nenhum documento encontrado.</td></tr>}{loading&&<tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground"><LoaderCircle className="mx-auto h-6 w-6 animate-spin"/></td></tr>}</tbody></table></div>
    </CardContent></Card>

    <Card className="border-dashed"><CardContent className="p-4 text-xs leading-relaxed text-muted-foreground"><strong className="text-foreground">Automação:</strong> A sincronização com a SEFAZ não exige atualização manual de NSU. NF-e de combustível com XML completo, placa reconhecida e veículo cadastrado é importada automaticamente em Abastecimentos. NF-e de peças/manutenção fica classificada para conferência. NFS-e de serviço municipal não é distribuída pelo NFeDistribuicaoDFe e exige integração própria do provedor/prefeitura.</CardContent></Card>
  </div></Layout>;
}
