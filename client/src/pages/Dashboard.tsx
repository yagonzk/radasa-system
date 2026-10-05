import Layout from "@/components/Layout";
import {api} from "@/lib/api";
import {useEffect,useState} from "react";
import {Link} from "wouter";
import {Card,CardContent,CardHeader,CardTitle} from "@/components/ui/card";
import {Button} from "@/components/ui/button";
import {Truck,WalletCards,TrendingUp,Fuel,Route,AlertTriangle,Wrench,ArrowRight,Building2} from "lucide-react";

const money=(v:number)=>Number(v||0).toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const num=(v:number)=>Number(v||0).toLocaleString("pt-BR",{maximumFractionDigits:1});

export default function Dashboard(){
 const[data,setData]=useState<any>(null);
 const[financeiro,setFinanceiro]=useState<any>(null);
 const[alertas,setAlertas]=useState<any[]|null>(null);
 const[rankings,setRankings]=useState<any>(null);
 const[loading,setLoading]=useState(true);
 const[financeLoading,setFinanceLoading]=useState(true);
 const[alertsLoading,setAlertsLoading]=useState(true);
 const[rankingsLoading,setRankingsLoading]=useState(false);
 const[error,setError]=useState("");
 const[financeError,setFinanceError]=useState("");
 const[alertsError,setAlertsError]=useState("");
 const[rankingsError,setRankingsError]=useState("");

 useEffect(()=>{
  let active=true;
  const load=async()=>{
   try{
    const core=await api.get("/dashboard/gerencial");
    if(active){setData(core.data);setError("");}
   }catch(e:any){if(active)setError(e?.response?.data?.message||"Não foi possível carregar a Visão Geral.");}
   finally{if(active)setLoading(false);}

   try{
    const fin=await api.get("/dashboard/financeiro");
    if(active){setFinanceiro(fin.data?.financeiro||{});setFinanceError("");}
   }catch(e:any){if(active)setFinanceError(e?.response?.data?.message||"Financeiro indisponível nesta atualização.");}
   finally{if(active)setFinanceLoading(false);}

   try{
    const alerts=await api.get("/dashboard/alertas",{params:{limit:12}});
    if(active){setAlertas(Array.isArray(alerts.data)?alerts.data:[]);setAlertsError("");}
   }catch(e:any){if(active)setAlertsError(e?.response?.data?.message||"Alertas indisponíveis nesta atualização.");}
   finally{if(active)setAlertsLoading(false);}
  };
  void load();
  return()=>{active=false};
 },[]);

 const loadRankings=async()=>{
  if(rankingsLoading)return;
  setRankingsLoading(true);setRankingsError("");
  try{const r=await api.get("/dashboard/rankings");setRankings(r.data);}
  catch(e:any){setRankingsError(e?.response?.data?.message||"Não foi possível carregar os rankings.");}
  finally{setRankingsLoading(false);}
 };

 const cards=[
  ["Faturamento do mês",financeLoading?"…":money(financeiro?.receitas||0),TrendingUp],
  ["Resultado",financeLoading?"…":money(financeiro?.resultado||0),WalletCards],
  ["Acertos de viagem",data?.operacao?.emAndamento||0,Route],
  ["KM rodado",`${num(data?.operacao?.km||0)} km`,Truck],
  ["Combustível",money(data?.operacao?.combustivel||0),Fuel],
  ["OS abertas",data?.frota?.osAbertas||0,Wrench]
 ] as const;

 return <Layout><div className="mx-auto w-full max-w-7xl space-y-6">
  {loading&&<div className="rounded-xl border p-4 text-sm text-muted-foreground">Carregando resumo operacional...</div>}
  {error&&<div className="rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-700">{error}</div>}
  {data?.parcial&&<div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-700">Alguns indicadores operacionais não responderam nesta atualização ({(data.indisponiveis||[]).join(", ")}). Os demais dados continuam disponíveis.</div>}
  <div className="flex flex-wrap items-end justify-between gap-3"><div><h1 className="text-2xl font-bold">Visão Geral</h1><p className="text-sm text-muted-foreground">Resumo do que exige atenção agora na operação.</p></div><div className="text-xs text-muted-foreground">Período: {data?.periodo?.from||"—"} a {data?.periodo?.to||"—"}</div></div>
  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">{cards.map(([label,value,Icon])=><Card key={label}><CardContent className="p-4"><div className="flex items-center justify-between text-xs text-muted-foreground"><span>{label}</span><Icon className="h-4 w-4"/></div><div className="mt-2 text-xl font-bold">{value}</div></CardContent></Card>)}</div>

  <div className="grid gap-4 xl:grid-cols-2">
   <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Alertas prioritários</CardTitle><Link href="/alertas" className="text-xs font-semibold text-primary">Ver todos</Link></CardHeader><CardContent className="space-y-2">{alertsLoading?<p className="text-sm text-muted-foreground">Carregando alertas...</p>:alertsError?<p className="text-sm text-amber-700">{alertsError}</p>:(alertas||[]).length===0?<p className="text-sm text-muted-foreground">Nenhum alerta prioritário no momento.</p>:(alertas||[]).slice(0,6).map((a:any)=><Link href={a.href||"/alertas"} key={a.id} className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/40"><AlertTriangle className={`mt-0.5 h-4 w-4 ${a.nivel==="VENCIDO"?"text-red-600":"text-amber-500"}`}/><div><div className="text-sm font-medium">{a.titulo}</div><div className="text-xs text-muted-foreground">{a.detalhe}</div></div></Link>)}</CardContent></Card>
   <Card><CardHeader><CardTitle className="text-base">Fluxo de caixa</CardTitle></CardHeader><CardContent className="grid grid-cols-2 gap-3">{financeLoading?<div className="col-span-2 py-4 text-sm text-muted-foreground">Carregando financeiro sem bloquear a página...</div>:financeError?<div className="col-span-2 py-4 text-sm text-amber-700">{financeError}</div>:<><Mini label="A receber" value={money(financeiro?.aReceber||0)}/><Mini label="A pagar" value={money(financeiro?.aPagar||0)}/><Mini label="Projeção 7 dias" value={money(financeiro?.projecao7||0)}/><Mini label="Projeção 30 dias" value={money(financeiro?.projecao30||0)}/></>}<Link href="/financeiro" className="col-span-2 inline-flex items-center justify-end gap-1 text-sm font-semibold text-primary">Abrir DRE Operacional <ArrowRight className="h-4 w-4"/></Link></CardContent></Card>
  </div>

  <div className="grid gap-4 xl:grid-cols-2">
   {rankings?<><Ranking title="Rentabilidade por caminhão" icon={Truck} rows={rankings?.rankingVeiculos||[]}/><Ranking title="Rentabilidade por cliente" icon={Building2} rows={rankings?.rankingClientes||[]}/></>:<Card className="xl:col-span-2"><CardHeader><CardTitle className="text-base">Análises de rentabilidade</CardTitle></CardHeader><CardContent className="flex flex-wrap items-center justify-between gap-4"><div><p className="text-sm text-muted-foreground">Os rankings detalhados ficaram sob demanda para evitar uma análise pesada toda vez que a Visão Geral é aberta.</p>{rankingsError&&<p className="mt-2 text-sm text-amber-700">{rankingsError}</p>}</div><Button onClick={()=>void loadRankings()} disabled={rankingsLoading}>{rankingsLoading?"Calculando rankings...":"Carregar rankings"}</Button></CardContent></Card>}
  </div>

  <Card><CardHeader className="flex flex-row items-center justify-between"><CardTitle className="text-base">Acertos de viagem recentes</CardTitle><Link href="/viagens" className="text-xs font-semibold text-primary">Abrir acertos</Link></CardHeader><CardContent className="overflow-x-auto"><table className="w-full min-w-[700px] text-sm"><thead><tr className="border-b text-left text-muted-foreground"><th className="pb-2">Código</th><th>Data</th><th>Placa</th><th>Destino</th><th className="text-right">Frete</th></tr></thead><tbody>{(data?.viagensRecentes||[]).map((v:any)=><tr key={v.id} className="border-b"><td className="py-3 font-medium">{v.codigo||"—"}</td><td>{v.data}</td><td>{v.placa}</td><td>{v.destino}</td><td className="text-right font-semibold">{money(v.frete)}</td></tr>)}</tbody></table></CardContent></Card>
 </div></Layout>;
}

function Mini({label,value}:{label:string;value:string}){return <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-1 font-bold">{value}</div></div>}
function Ranking({title,icon:Icon,rows}:{title:string;icon:any;rows:any[]}){return <Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Icon className="h-4 w-4"/>{title}</CardTitle></CardHeader><CardContent className="space-y-2">{rows.length===0?<p className="text-sm text-muted-foreground">Sem dados no período.</p>:rows.map((r:any,i:number)=><div key={r.id} className="flex items-center justify-between rounded-lg border p-3"><div><div className="text-sm font-medium">{i+1}. {r.nome}</div><div className="text-xs text-muted-foreground">Margem {Number(r.margem||0).toFixed(1)}% · {r.viagens} viagem(ns)</div></div><strong>{money(r.resultado)}</strong></div>)}</CardContent></Card>}
