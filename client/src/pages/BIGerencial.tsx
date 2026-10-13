import { useEffect, useMemo, useState } from "react";
import Layout from "@/components/Layout";
import { useTheme } from "@/contexts/ThemeContext";
import { useClientes, useProdutos, type Manifesto } from "@/lib/store";
import { api, getResourceRange } from "@/lib/api";
import { canonicalClientIdentity, canonicalProductIdentity, formatPlate, mergeStagingBiFacts, readStagingBiFacts, type StagingBiFact } from "@/lib/bi-staging";
import { BarChart3, Check, ChevronDown, Database, FileSpreadsheet, RotateCcw, Search, ClipboardCopy, Activity } from "lucide-react";
import * as XLSX from "xlsx";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BiMetrics, BiRanking, BiConsultation, type BiFact } from "@/components/bi/BiPresentation";
import "./bi-gerencial.css";

type LinkedNfeItem = {id:string;manifestoId:string|null;numero:string;serie:string;codigo:string;descricao:string;quantidade:number;valorUnitario:number;valorTotal:number;municipio:string;uf:string;dataEmissao:string};
const canonNum=(value:unknown)=>String(value??"").replace(/\D/g,"").replace(/^0+(?=\d)/,"");
const partsNf=(numero:unknown,serie:unknown)=>{const a=String(numero??"").split("/");return `${canonNum(a[0])}|${canonNum(serie||a[1])}`};
const matchNfeForManifesto=(r:Manifesto,p:Manifesto["produtos"][number], nfeItems:LinkedNfeItem[], produtoNome:string, produtoCodigo:string)=>{
 const doc=partsNf(p.notaFiscal,p.serieNf);
 const possible=nfeItems.filter(n=>n.manifestoId===r.id&&partsNf(n.numero,n.serie)===doc);
 if(!possible.length)return null;
 const productMatches=possible.filter(n=>{
   const c=canonNum(n.codigo),pc=canonNum(produtoCodigo);
   return (c&&pc&&c===pc)||(norm(n.descricao)&&norm(n.descricao)===norm(produtoNome));
 });
 const qtd=Number(p.quantidade||0);
 const exact=productMatches.filter(n=>Number(n.quantidade)===qtd);
 if(exact.length===1)return exact[0];
 if(productMatches.length===1&&Number(productMatches[0].quantidade)===qtd)return productMatches[0];
 // Produto pode ter códigos diferentes no romaneio e na NF-e.
 const byQtd=possible.filter(n=>Number(n.quantidade)===qtd);
 if(!productMatches.length&&byQtd.length===1)return byQtd[0];
 return null; // ambiguidade: nunca atribuir faturamento de outro item
};
type Fact=BiFact;
type Option={value:string;label:string};
const money=(v:number)=>v.toLocaleString("pt-BR",{style:"currency",currency:"BRL"});
const num=(v:number)=>v.toLocaleString("pt-BR",{maximumFractionDigits:2});
const pct=(v:number)=>`${v.toLocaleString("pt-BR",{minimumFractionDigits:2,maximumFractionDigits:2})}%`;
const norm=(v:unknown)=>String(v??"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase().replace(/[^A-Z0-9]/g,"");
const animateCharts = typeof window !== "undefined" && (typeof window.matchMedia !== "function" || !window.matchMedia("(prefers-reduced-motion: reduce)").matches);
const formatDateBR=(v:string)=>{const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?`${m[3]}/${m[2]}/${m[1]}`:(v||"—")};
// Excel recebe data numerica verdadeira, nao texto em formato ISO.
const excelDate=(v:string)=>{const m=String(v||"").match(/^(\d{4})-(\d{2})-(\d{2})/);return m?(Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]))-Date.UTC(1899,11,30))/86400000:null};
const formatExcelDateColumn=(sheet:XLSX.WorkSheet,rows:number,col:number)=>{for(let r=1;r<rows;r++){const cell=sheet[XLSX.utils.encode_cell({r,c:col})];if(cell&&typeof cell.v==="number")cell.z="dd/mm/yyyy"}};
const monthLabel=(v:string)=>v?`${v.slice(5,7)}/${v.slice(0,4)}`:"—";
function currentMonthRange(){const d=new Date(),y=d.getFullYear(),m=d.getMonth(),pad=(n:number)=>String(n).padStart(2,"0");return{from:`${y}-${pad(m+1)}-01`,to:`${y}-${pad(m+1)}-${pad(new Date(y,m+1,0).getDate())}`}}
function MultiFilter({label,values,onChange,options}:{label:string;values:string[];onChange:(v:string[])=>void;options:Option[]}){
 const [open,setOpen]=useState(false),[query,setQuery]=useState("");
 const shown=options.filter(o=>norm(o.label).includes(norm(query))); const toggle=(v:string)=>onChange(values.includes(v)?values.filter(x=>x!==v):[...values,v]);
 return <div className="space-y-1"><label className="text-xs font-semibold text-muted-foreground">{label}</label><Popover open={open} onOpenChange={setOpen}><PopoverTrigger asChild><Button variant="outline" className="h-10 w-full min-w-0 justify-between bg-background text-foreground border-border text-xs font-normal"><span className="truncate">{values.length===0?`Todos (${options.length})`:values.length===1?(options.find(o=>o.value===values[0])?.label||values[0]):`${values.length} selecionados`}</span><ChevronDown className="h-3.5 w-3.5"/></Button></PopoverTrigger><PopoverContent align="start" className="w-[min(320px,calc(100vw-32px))] p-2 border-border bg-popover text-popover-foreground"><div className="relative mb-2"><Search className="absolute left-2 top-2.5 h-3.5 w-3.5 text-muted-foreground"/><input aria-label={`Pesquisar ${label.toLowerCase()}`} placeholder={`Pesquisar ${label.toLowerCase()}...`} value={query} onChange={e=>setQuery(e.target.value)} className="h-9 w-full rounded-md border border-border bg-background text-foreground pl-8 pr-2 text-xs outline-none focus:border-[#0A508E]"/></div><div className="mb-2 flex justify-between border-b pb-2 text-xs"><button className="font-semibold text-primary dark:text-foreground" onClick={()=>onChange(options.map(o=>o.value))}>Selecionar todos</button><button className="text-muted-foreground" onClick={()=>onChange([])}>Limpar</button></div><div className="max-h-60 overflow-y-auto">{shown.map(o=><button type="button" key={o.value} onClick={()=>toggle(o.value)} className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-muted"><Check className={`h-3.5 w-3.5 ${values.includes(o.value)?"opacity-100 text-primary":"opacity-0"}`}/><span className="truncate">{o.label}</span></button>)}</div></PopoverContent></Popover></div>
}
export default function BIGerencial(){
 const { theme } = useTheme();
 const isDark = theme === "dark";
 const chartTooltipStyle = { backgroundColor: isDark ? "#0f172a" : "#ffffff", borderColor: isDark ? "#334155" : "#e2e8f0", color: isDark ? "#f8fafc" : "#0f172a" };
 const {items:clientes}=useClientes(); const {items:produtos}=useProdutos();
 const [romaneios,setRomaneios]=useState<Manifesto[]>([]);
 const [nfeItems,setNfeItems]=useState<LinkedNfeItem[]>([]);
 const [romaneiosLoading,setRomaneiosLoading]=useState(false);
 const [romaneiosError,setRomaneiosError]=useState("");
 const [showFreightDiagnostic,setShowFreightDiagnostic]=useState(false);
 const [manualFacts,setManualFacts]=useState<StagingBiFact[]>([]); const [loading,setLoading]=useState(true);
 useEffect(()=>{setLoading(true);void fetch("/dados/romaneio_nf_staging.xlsx",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error(`HTTP ${r.status}`);return r.arrayBuffer()}).then(b=>setManualFacts(readStagingBiFacts(b))).catch(e=>{console.warn("[BI Gerencial] Falha ao carregar staging",e);setManualFacts([])}).finally(()=>setLoading(false))},[]);
 const range=useMemo(()=>currentMonthRange(),[]); const [from,setFrom]=useState(range.from),[to,setTo]=useState(range.to); const [placas,setPlacas]=useState<string[]>([]),[clienteIds,setClienteIds]=useState<string[]>([]),[produtoKeys,setProdutoKeys]=useState<string[]>([]);
 // A lista compartilhada de Romaneios carrega somente o mês atual.
 // O BI precisa consultar explicitamente o período selecionado pelo usuário.
 useEffect(()=>{
  let active=true;
  setRomaneiosLoading(true);
  setRomaneiosError("");
  void getResourceRange<Manifesto>("manifestos",from||undefined,to||undefined)
   .then(async items=>{
     if(!active)return;
     setRomaneios(items);
     const ids=items.map(r=>r.id).filter(Boolean);
     if(!ids.length){setNfeItems([]);return}
     try {
       const resposta=await api.post<LinkedNfeItem[]>("/bi/nfes/itens-romaneios",{manifestoIds:ids});
       if(active)setNfeItems(resposta.data);
     } catch (error) {
       if(active){setNfeItems([]);setRomaneiosError("Não foi possível carregar as NF-es vinculadas para calcular o faturamento.")}
       console.error("[BI Gerencial] NF-es vinculadas indisponíveis",error);
     }
   })
   .catch(error=>{if(active){setRomaneios([]);setNfeItems([]);setRomaneiosError(error instanceof Error?error.message:"Falha ao carregar romaneios")}})
   .finally(()=>{if(active)setRomaneiosLoading(false)});
  return ()=>{active=false};
 },[from,to]);
 const [tableQuery,setTableQuery]=useState("");
 const [tab,setTab]=useState("geral"),[columnFilters,setColumnFilters]=useState<Record<string,string[]>>({}),[sort,setSort]=useState("data-desc");
 const [tabProdutos,setTabProdutos]=useState<string[]>([]),[tabClientes,setTabClientes]=useState<string[]>([]),[tabPlacas,setTabPlacas]=useState<string[]>([]);
 const clienteMap=useMemo(()=>new Map(clientes.map(c=>[c.id,c])),[clientes]); const produtoMap=useMemo(()=>new Map(produtos.map(p=>[p.id,p])),[produtos]);
 const clienteLookup=useMemo(()=>{const m=new Map<string,(typeof clientes)[number]>();for(const c of clientes)for(const n of [c.nomeFantasia,c.razaoSocial]){const k=norm(n);if(k&&!m.has(k))m.set(k,c)}return m},[clientes]);
 const clienteByCode=useMemo(()=>{const m=new Map<string,(typeof clientes)[number]>();for(const c of clientes){const key=canonicalClientIdentity(c.codigoInterno,"","");if(c.codigoInterno&&!m.has(key))m.set(key,c)}return m},[clientes]);
 const produtoByCode=useMemo(()=>{const m=new Map<string,(typeof produtos)[number]>();for(const p of produtos){const key=canonicalProductIdentity(p.codigoInterno,"");if(p.codigoInterno&&key&&!m.has(key))m.set(key,p)}return m},[produtos]);
 const liveStagingFacts=useMemo<StagingBiFact[]>(()=>romaneios.flatMap(r=>r.produtos.map((p,i)=>{const clienteId=p.clienteId||r.clienteId,c=clienteMap.get(clienteId),prod=produtoMap.get(p.produtoId),qtd=Number(p.quantidade||0),frete=Number(p.valorTotal||0);const nfe=matchNfeForManifesto(r,p,nfeItems,prod?.nome||"",prod?.codigoInterno||"");const faturamento=nfe?Number(nfe.valorTotal||0):0;return{id:`biv2-live-${r.id}-${p.id||i}`,data:r.dataManifesto,romaneio:p.romaneio||r.romaneios||"",nf:p.notaFiscal||"",serie:p.serieNf||"",nfSerie:p.notaFiscal?`${p.notaFiscal}${p.serieNf?`/${p.serieNf}`:""}`:"",clienteId,cliente:c?.nomeFantasia||c?.razaoSocial||"Sem cliente",razaoSocial:c?.razaoSocial||c?.nomeFantasia||"",clienteCod:c?.codigoInterno||"",clienteLoja:"",produtoId:p.produtoId,produtoCod:prod?.codigoInterno||"",produto:prod?.nome||"Produto não identificado",placa:formatPlate(r.placaVeiculo),quantidade:qtd,valorUnitProduto:nfe?Number(nfe.valorUnitario||0):0,freteUnit:qtd?frete/qtd:0,frete,faturamento,municipio:nfe?[nfe.municipio,nfe.uf].filter(Boolean).join(" - "):c?.enderecoFiscal||"",tipo:p.tipoManifesto||r.tipoManifesto,instrucao:p.instrucaoCobranca||""}})),[romaneios,clienteMap,produtoMap,nfeItems]);
 const stagingFacts=useMemo(()=>mergeStagingBiFacts(manualFacts,liveStagingFacts),[manualFacts,liveStagingFacts]);
 const facts=useMemo<Fact[]>(()=>stagingFacts.map(x=>{
  const clienteCadastro=x.clienteCod?clienteByCode.get(canonicalClientIdentity(x.clienteCod,"","")):(clienteLookup.get(norm(x.cliente))||clienteLookup.get(norm(x.razaoSocial)));
  const clienteCod=x.clienteCod||clienteCadastro?.codigoInterno||"";
  const produtoCadastro=x.produtoCod?produtoByCode.get(canonicalProductIdentity(x.produtoCod,"")):undefined;
  const produtoCod=x.produtoCod||produtoCadastro?.codigoInterno||"";
  const produto=produtoCadastro?.nome||x.produto;
  const produtoKey=canonicalProductIdentity(produtoCod,produto);
  const cliente=clienteCadastro?.nomeFantasia||x.cliente;
  const razaoSocial=clienteCadastro?.razaoSocial||x.razaoSocial||cliente;
  return{...x,clienteId:`bi-cliente:${canonicalClientIdentity(clienteCod,cliente,razaoSocial)}`,cliente,razaoSocial,clienteCod,produtoId:`bi-produto:${produtoKey}`,produtoCod,produto,produtoKey,mes:String(x.data||"").slice(0,7),percentual:x.faturamento?x.frete/x.faturamento*100:0}
 }),[stagingFacts,clienteLookup,clienteByCode,produtoByCode]);
 const plateOptions=useMemo(()=>[...new Set(facts.map(x=>x.placa).filter(x=>x&&x!=="Sem placa"))].sort().map(x=>({value:x,label:x})),[facts]);
 const clientOptions=useMemo(()=>Array.from(new Map(facts.map(x=>[x.clienteId,{value:x.clienteId,label:`${x.clienteCod?`${x.clienteCod} - `:""}${x.cliente}`}])).values()).sort((a,b)=>a.label.localeCompare(b.label,"pt-BR")),[facts]);
 const productOptions=useMemo(()=>Array.from(new Map(facts.map(x=>[x.produtoKey,{value:x.produtoKey,label:`${x.produtoCod?`${x.produtoCod} - `:""}${x.produto}`}])).values()).filter(x=>x.value).sort((a,b)=>a.label.localeCompare(b.label,"pt-BR",{numeric:true})),[facts]);
 const filtered=useMemo(()=>facts.filter(x=>(!from||x.data>=from)&&(!to||x.data<=to)&&(placas.length===0||placas.includes(x.placa))&&(clienteIds.length===0||clienteIds.includes(x.clienteId))&&(produtoKeys.length===0||produtoKeys.includes(x.produtoKey))),[facts,from,to,placas,clienteIds,produtoKeys]);
 const totals=useMemo(()=>{const quantidade=filtered.reduce((s,x)=>s+x.quantidade,0),faturamento=filtered.reduce((s,x)=>s+x.faturamento,0),frete=filtered.reduce((s,x)=>s+x.frete,0);return{quantidade,faturamento,frete,valorProduto:quantidade?faturamento/quantidade:0,valorFrete:quantidade?frete/quantidade:0,percentual:faturamento?frete/faturamento*100:0}},[filtered]);
 const calcTotals=(items:Fact[])=>{const quantidade=items.reduce((s,x)=>s+x.quantidade,0),faturamento=items.reduce((s,x)=>s+x.faturamento,0),frete=items.reduce((s,x)=>s+x.frete,0);return{quantidade,faturamento,frete,valorProduto:quantidade?faturamento/quantidade:0,valorFrete:quantidade?frete/quantidade:0,percentual:faturamento?frete/faturamento*100:0}};
 const productTabFacts=useMemo(()=>filtered.filter(x=>tabProdutos.length===0||tabProdutos.includes(x.produtoKey)),[filtered,tabProdutos]);
 const clientTabFacts=useMemo(()=>filtered.filter(x=>tabClientes.length===0||tabClientes.includes(x.clienteId)),[filtered,tabClientes]);
 const plateTabFacts=useMemo(()=>filtered.filter(x=>tabPlacas.length===0||tabPlacas.includes(x.placa)),[filtered,tabPlacas]);
 const productTabTotals=useMemo(()=>calcTotals(productTabFacts),[productTabFacts]);
 const clientTabTotals=useMemo(()=>calcTotals(clientTabFacts),[clientTabFacts]);
 const plateTabTotals=useMemo(()=>calcTotals(plateTabFacts),[plateTabFacts]);
 const byMonth=useMemo(()=>{const m=new Map<string,{mes:string;faturamento:number;frete:number}>();for(const x of filtered){const v=m.get(x.mes)||{mes:x.mes,faturamento:0,frete:0};v.faturamento+=x.faturamento;v.frete+=x.frete;m.set(x.mes,v)}return [...m.values()].sort((a,b)=>a.mes.localeCompare(b.mes)).map(x=>({...x,label:monthLabel(x.mes)}))},[filtered]);
 const byProduct=useMemo(()=>{const m=new Map<string,{name:string;faturamento:number;frete:number}>();for(const x of productTabFacts){const key=x.produtoKey||x.produto;const v=m.get(key)||{name:x.produto,faturamento:0,frete:0};v.faturamento+=x.faturamento;v.frete+=x.frete;m.set(key,v)}return [...m.values()].sort((a,b)=>b.faturamento-a.faturamento).slice(0,10)},[productTabFacts]);
 const byClient=useMemo(()=>{const m=new Map<string,{name:string;faturamento:number;frete:number}>();for(const x of clientTabFacts){const v=m.get(x.clienteId)||{name:x.cliente,faturamento:0,frete:0};v.faturamento+=x.faturamento;v.frete+=x.frete;m.set(x.clienteId,v)}return [...m.values()].sort((a,b)=>b.faturamento-a.faturamento).slice(0,10)},[clientTabFacts]);
 const byPlate=useMemo(()=>{const m=new Map<string,{name:string;faturamento:number;frete:number}>();for(const x of plateTabFacts){const k=x.placa||"Sem placa",v=m.get(k)||{name:k,faturamento:0,frete:0};v.faturamento+=x.faturamento;v.frete+=x.frete;m.set(k,v)}return [...m.values()].sort((a,b)=>b.faturamento-a.faturamento)},[plateTabFacts]);
 const clear=()=>{setTableQuery("");setFrom(range.from);setTo(range.to);setPlacas([]);setClienteIds([]);setProdutoKeys([]);setColumnFilters({});setTabProdutos([]);setTabClientes([]);setTabPlacas([])};
 const columns=[
  {key:"nfSerie",label:"NF/Série",get:(x:Fact)=>x.nfSerie||"—"},{key:"cliente",label:"Cliente",get:(x:Fact)=>x.cliente},{key:"clienteCod",label:"Cód. Cliente",get:(x:Fact)=>x.clienteCod||"—"},{key:"produtoCod",label:"Cód. Produto",get:(x:Fact)=>x.produtoCod||"—"},{key:"produto",label:"Produto",get:(x:Fact)=>x.produto},{key:"quantidade",label:"Quantidade",get:(x:Fact)=>String(x.quantidade)},{key:"valorUnitProduto",label:"Valor Unitário do Produto",get:(x:Fact)=>String(x.valorUnitProduto)},{key:"faturamento",label:"Faturamento",get:(x:Fact)=>String(x.faturamento)},{key:"freteUnit",label:"Valor Unitário do Frete",get:(x:Fact)=>String(x.freteUnit)},{key:"frete",label:"Frete Total",get:(x:Fact)=>String(x.frete)},{key:"percentual",label:"% Frete/Faturamento",get:(x:Fact)=>String(x.percentual)},{key:"placa",label:"Placa",get:(x:Fact)=>x.placa},{key:"data",label:"Data",get:(x:Fact)=>formatDateBR(x.data)},{key:"municipio",label:"Município/Endereço",get:(x:Fact)=>x.municipio||"—"}
 ];
 const columnOptions=useMemo(()=>Object.fromEntries(columns.map(c=>[c.key,[...new Set(filtered.map(c.get))].sort((a,b)=>a.localeCompare(b,"pt-BR",{numeric:true}))])),[filtered]);
 const consultaFiltered=useMemo(()=>filtered.filter(x=>{
  if (tableQuery.trim()) {
   const needle=norm(tableQuery.trim());
   const content=[x.nfSerie,x.cliente,x.clienteCod,x.produto,x.produtoCod,x.placa,x.municipio,formatDateBR(x.data),x.romaneio].map(norm).join(" ");
   if(!content.includes(needle))return false;
  }
  return columns.every(c=>{const values=columnFilters[c.key]||[];return !values.length||values.includes(c.get(x))});
 }),[filtered,columnFilters,tableQuery]);
 const rows=useMemo(()=>{const [field,dir]=sort.split("-");return [...consultaFiltered].sort((a,b)=>{let av:any=(a as any)[field],bv:any=(b as any)[field];const cmp=typeof av==="number"&&typeof bv==="number"?av-bv:String(av??"").localeCompare(String(bv??""),"pt-BR",{numeric:true});return dir==="desc"?-cmp:cmp})},[consultaFiltered,sort]);
 const tableTotals=useMemo(()=>{const quantidade=rows.reduce((s,x)=>s+x.quantidade,0),faturamento=rows.reduce((s,x)=>s+x.faturamento,0),frete=rows.reduce((s,x)=>s+x.frete,0);return{quantidade,faturamento,frete,valorProduto:quantidade?faturamento/quantidade:0,valorFrete:quantidade?frete/quantidade:0,percentual:faturamento?frete/faturamento*100:0}},[rows]);
 const freightDiagnostic=useMemo(()=>{
  const documentKey=(item:StagingBiFact)=>{
   const input=String(item.nfSerie||`${item.nf||""}/${item.serie||""}`).split("/");
   const nf=String(item.nf||input[0]||"").split("/")[0].replace(/\D/g,"").replace(/^0+/,"")||"0";
   const serie=String(item.serie||input[1]||"").replace(/\D/g,"").replace(/^0+/,"")||"0";
   return `${nf}/${serie}`;
  };
  const allLiveByNf=new Map<string,StagingBiFact[]>();
  for(const live of liveStagingFacts){const key=documentKey(live);const group=allLiveByNf.get(key)||[];group.push(live);allLiveByNf.set(key,group)}
  const problems=consultaFiltered.filter(x=>x.frete===0&&x.quantidade>0&&x.faturamento>0);
  const details=problems.map(x=>{
   const candidates=allLiveByNf.get(documentKey(x))||[];
   const sameQuantity=candidates.filter(y=>y.quantidade===x.quantidade);
   const sameProduct=candidates.filter(y=>canonicalProductIdentity(y.produtoCod,y.produto)===canonicalProductIdentity(x.produtoCod,x.produto));
   const exact=candidates.filter(y=>y.quantidade===x.quantidade&&canonicalProductIdentity(y.produtoCod,y.produto)===canonicalProductIdentity(x.produtoCod,x.produto));
   const status=!candidates.length?"NF não encontrada nos romaneios carregados":exact.length===1?"Item correspondente encontrado; verificar consolidação":exact.length>1?"Vários itens correspondentes (ambíguo)":sameQuantity.length===1?"Quantidade encontrada, código/descrição do produto divergente":sameProduct.length?"Produto encontrado, quantidade divergente":"NF encontrada, mas item não conciliado";
   return {nf:x.nfSerie,cliente:x.cliente,data:x.data,produto:x.produto,codigo:x.produtoCod,quantidade:x.quantidade,placa:x.placa,freteBI:x.frete,status,romaneiosEncontrados:candidates.length,mesmaQuantidade:sameQuantity.length,mesmoProduto:sameProduct.length,fretesRomaneios:candidates.map(y=>({romaneio:y.romaneio,produto:y.produto,codigo:y.produtoCod,quantidade:y.quantidade,frete:y.frete,placa:y.placa}))};
  });
  return {resumo:{registrosFiltrados:consultaFiltered.length,fretesZerados:problems.length,romaneiosCarregados:romaneios.length,romaneiosLoading,romaneiosError,itensCarregados:liveStagingFacts.length,linhasPlanilha:manualFacts.length},filtros:{de:from,ate:to,placas,clientes:clienteIds,produtos:produtoKeys,colunas:columnFilters},detalhes:details};
 },[consultaFiltered,liveStagingFacts,romaneios.length,romaneiosLoading,romaneiosError,manualFacts.length,from,to,placas,clienteIds,produtoKeys,columnFilters]);
 const copyFreightDiagnostic=async()=>{try{await navigator.clipboard.writeText(JSON.stringify(freightDiagnostic,null,2))}catch(e){console.error("Falha ao copiar diagnóstico",e);window.alert("Não foi possível copiar automaticamente. Verifique a permissão da área de transferência.")}};
 const monthNames=["JANEIRO","FEVEREIRO","MARÇO","ABRIL","MAIO","JUNHO","JULHO","AGOSTO","SETEMBRO","OUTUBRO","NOVEMBRO","DEZEMBRO"];
 const monthSheetName=(mes:string)=>{const [ano,m]=mes.split("-");return `${monthNames[Math.max(0,Number(m)-1)]||mes} ${ano}`.slice(0,31)};
 const exportFaturamentoXlsx=()=>{
  const exportRows=consultaFiltered;
  const headers=["Data","Cod Cliente","Cliente","Cod. Produto","Produto","Valor Unitário","Quantidade"];
  const makeSheet=(items:Fact[])=>{
   const data:any[][]=[headers,...items.map(x=>[excelDate(x.data),x.clienteCod||"",x.cliente,x.produtoCod||"",x.produto,x.valorUnitProduto,x.quantidade])];
   const ws=XLSX.utils.aoa_to_sheet(data); formatExcelDateColumn(ws,data.length,0); ws["!cols"]=[{wch:12},{wch:14},{wch:32},{wch:14},{wch:32},{wch:16},{wch:12}];
   for(let r=1;r<data.length;r++){const valor=ws[XLSX.utils.encode_cell({r,c:5})];if(valor)valor.z='R$ #,##0.00';const qtd=ws[XLSX.utils.encode_cell({r,c:6})];if(qtd)qtd.z='#,##0.00'}
   return ws;
  };
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,makeSheet(exportRows),"GERAL");
  const months=[...new Set(exportRows.map(x=>x.mes).filter(Boolean))].sort();
  for(const mes of months)XLSX.utils.book_append_sheet(wb,makeSheet(exportRows.filter(x=>x.mes===mes)),monthSheetName(mes));
  XLSX.writeFile(wb,"BI-Gerencial_faturamento_filtrado.xlsx");
 };
 const exportFreteUnitXlsx=()=>{
  // Uma linha para cada cliente e valor unitario exato, mesmo quando repetido em varias datas.
  // A data exibida e a mais recente dos registros filtrados; faturamento soma todos do grupo.
  type LinhaFreteUnit={cliente:string;data:string;municipio:string;faturamento:number;freteUnit:number};
  const consolidado=new Map<string,LinhaFreteUnit>();
  for(const x of consultaFiltered){
   const cliente=norm(x.cliente)||norm(x.razaoSocial)||x.clienteId;
   const data=x.data||"";
   const municipio=x.municipio||"";
   const freteUnit=Math.round((Number(x.freteUnit)||0)*100)/100;
   const chave=JSON.stringify([cliente,freteUnit]);
   const atual=consolidado.get(chave);
   if(atual){
    atual.faturamento+=Number(x.faturamento)||0;
    // Repeticoes do mesmo frete nao criam novas linhas; retemos a ultima data e municipio correspondente.
    if(data>atual.data){atual.data=data;atual.municipio=municipio;}
   }else{
    consolidado.set(chave,{cliente:x.cliente,data,municipio,faturamento:Number(x.faturamento)||0,freteUnit});
   }
  }
  const dados=[...consolidado.values()].sort((a,b)=>a.cliente.localeCompare(b.cliente,"pt-BR",{numeric:true})||b.data.localeCompare(a.data)||a.freteUnit-b.freteUnit||a.municipio.localeCompare(b.municipio,"pt-BR"));
  const tabela:any[][]=[["Cliente","Frete Unitário","Data","Faturamento Total","Município"],...dados.map(x=>[x.cliente,x.freteUnit,excelDate(x.data),x.faturamento,x.municipio||"Não informado"])];
  const ws=XLSX.utils.aoa_to_sheet(tabela);
  formatExcelDateColumn(ws,tabela.length,2);
  ws["!cols"]=[{wch:40},{wch:20},{wch:19},{wch:22},{wch:36}];
  ws["!autofilter"]={ref:XLSX.utils.encode_range({s:{r:0,c:0},e:{r:Math.max(0,tabela.length-1),c:4}})};
  for(let r=1;r<tabela.length;r++)for(const c of [1,3]){const cel=ws[XLSX.utils.encode_cell({r,c})];if(cel)cel.z='"R$ "#,##0.00';}
  const wb=XLSX.utils.book_new();XLSX.utils.book_append_sheet(wb,ws,"FRETE UNIT");
  XLSX.writeFile(wb,"BI-Gerencial_frete-unit_por-cliente.xlsx");
 };
 const exportFreteXlsx=()=>{
  type FreteRow={data:string;clienteCod:string;cliente:string;romaneio:string;valorRomaneio:number;mes:string};
  const map=new Map<string,FreteRow>();
  for(const x of consultaFiltered){
   if(!x.romaneio)continue;
   const key=[x.data,x.romaneio,x.clienteCod||x.clienteId,x.cliente].join("|");
   const atual=map.get(key);
   if(!atual||Math.abs(x.frete)>Math.abs(atual.valorRomaneio))map.set(key,{data:x.data,clienteCod:x.clienteCod||"",cliente:x.cliente,romaneio:x.romaneio,valorRomaneio:x.frete,mes:x.mes});
  }
  const exportRows=[...map.values()].filter(x=>Math.abs(x.valorRomaneio)>0.000001).sort((a,b)=>a.data.localeCompare(b.data)||a.cliente.localeCompare(b.cliente,"pt-BR",{numeric:true})||a.romaneio.localeCompare(b.romaneio,"pt-BR",{numeric:true}));
  const makeSheet=(items:FreteRow[])=>{
   const data:any[][]=[["Data","Cod Cliente","Cliente","Romaneio","Valor Romaneio"],...items.map(x=>[excelDate(x.data),x.clienteCod,x.cliente,x.romaneio,x.valorRomaneio])];
   const ws=XLSX.utils.aoa_to_sheet(data);formatExcelDateColumn(ws,data.length,0);ws["!cols"]=[{wch:12},{wch:14},{wch:34},{wch:18},{wch:18}];
   for(let r=1;r<data.length;r++){const valor=ws[XLSX.utils.encode_cell({r,c:4})];if(valor)valor.z='R$ #,##0.00'}
   return ws;
  };
  const wb=XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb,makeSheet(exportRows),"GERAL");
  const months=[...new Set(exportRows.map(x=>x.mes).filter(Boolean))].sort();
  for(const mes of months)XLSX.utils.book_append_sheet(wb,makeSheet(exportRows.filter(x=>x.mes===mes)),monthSheetName(mes));
  XLSX.writeFile(wb,"BI-Gerencial_frete_filtrado.xlsx");
 };
 return (
  <Layout>
   <div className="bi-v3" aria-label="BI Gerencial">
    <div className="bi-v3__inner">
     <header className="bi-v3__hero">
      <div className="bi-v3__identity">
       <div className="bi-v3__logo" aria-hidden="true"><BarChart3 className="h-6 w-6" /></div>
       <div className="min-w-0">
        <h1 className="bi-v3__title">BI Gerencial</h1>
        <p className="bi-v3__subtitle">Faturamento, fretes e desempenho da operação em um painel organizado e responsivo.</p>
       </div>
      </div>
      <div className="bi-v3__hero-actions">
       <Button type="button" variant="outline" size="sm" onClick={() => { setShowFreightDiagnostic((current) => !current); setTab("consulta"); }}>
        <Activity className="h-4 w-4" /> Diagnosticar fretes
       </Button>
       <Popover>
        <PopoverTrigger asChild>
         <Button variant="outline" size="sm" disabled={!consultaFiltered.length}>
          <FileSpreadsheet className="h-4 w-4" /> Exportar Excel <ChevronDown className="h-3.5 w-3.5" />
         </Button>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-[min(270px,calc(100vw-36px))] space-y-2 bg-popover p-3 text-popover-foreground">
         <p className="text-xs font-semibold text-muted-foreground">Exportar dados com os filtros atuais</p>
         <Button type="button" variant="outline" className="w-full justify-start" onClick={exportFreteXlsx}>Frete por romaneio</Button>
         <Button type="button" variant="outline" className="w-full justify-start" onClick={exportFreteUnitXlsx}>Frete unitário por cliente</Button>
         <Button type="button" variant="outline" className="w-full justify-start" onClick={exportFaturamentoXlsx}>Faturamento</Button>
        </PopoverContent>
       </Popover>
       <span className="bi-v3__status" title="Registros consolidados disponíveis para análise">
        <Database className="h-4 w-4" />
        {loading || romaneiosLoading ? "Atualizando dados..." : `${facts.length.toLocaleString("pt-BR")} registros consolidados`}
        {!loading && !romaneiosLoading && !romaneiosError && <i className="bi-v3__status-dot" aria-label="Consulta concluída" />}
       </span>
      </div>
     </header>

     {romaneiosError && (
      <div role="alert" className="rounded-xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-700 dark:text-amber-300">
       {romaneiosError} Os dados disponíveis continuam visíveis, mas podem estar incompletos.
      </div>
     )}
     {from && to && from > to && (
      <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
       A data inicial deve ser anterior ou igual à data final.
      </div>
     )}

     <section className="bi-v3__panel bi-v3__filter-panel" aria-label="Filtros gerais">
      <div className="bi-v3__filter-head">
       <div><h2>Filtros da análise</h2><p>Escolha o período e refine os resultados por veículo, cliente ou produto.</p></div>
       <span className="text-xs font-medium text-muted-foreground">{filtered.length.toLocaleString("pt-BR")} registros no período</span>
      </div>
      <div className="bi-v3__filter-grid">
       <div className="bi-v3__field">
        <label htmlFor="bi-data-inicial">Data inicial</label>
        <input id="bi-data-inicial" type="date" lang="pt-BR" value={from} onChange={(event) => setFrom(event.target.value)} className="bi-v3__input" />
       </div>
       <div className="bi-v3__field">
        <label htmlFor="bi-data-final">Data final</label>
        <input id="bi-data-final" type="date" lang="pt-BR" value={to} onChange={(event) => setTo(event.target.value)} className="bi-v3__input" />
       </div>
       <MultiFilter label="Placa" values={placas} onChange={setPlacas} options={plateOptions} />
       <MultiFilter label="Cliente" values={clienteIds} onChange={setClienteIds} options={clientOptions} />
       <MultiFilter label="Produto" values={produtoKeys} onChange={setProdutoKeys} options={productOptions} />
       <Button type="button" variant="outline" className="bi-v3__filter-clear" onClick={clear}><RotateCcw className="h-4 w-4" /> Limpar filtros</Button>
      </div>
     </section>

     <nav className="bi-v3__navigation" aria-label="Análises do BI Gerencial">
      {([
       ["geral", "Visão geral"],
       ["produtos", "Produtos"],
       ["clientes", "Clientes"],
       ["placas", "Veículos / Placas"],
       ["consulta", "Consulta geral"],
      ] as const).map(([key, label]) => (
       <button type="button" key={key} className="bi-v3__nav-item" aria-current={tab === key ? "page" : undefined} onClick={() => setTab(key)}>{label}</button>
      ))}
     </nav>

     {tab === "geral" && <>
      <BiMetrics totals={totals} />
      <section className="bi-v3__panel">
       <header className="bi-v3__panel-heading">
        <p className="bi-v3__overline">Histórico financeiro</p>
        <h2>Evolução por mês</h2>
        <p className="bi-v3__secondary">Comparação entre faturamento e valor de frete dentro do período selecionado.</p>
       </header>
       <div className="bi-v3__chart-body">
        {byMonth.length === 0 ? <div className="bi-v3__empty">Não há dados para o período selecionado.</div> :
         <div className="bi-v3__chart-frame"><div className="bi-v3__chart-inner">
          <ResponsiveContainer width="100%" height="100%">
           <LineChart data={byMonth} margin={{ top: 14, right: 20, bottom: 12, left: 6 }}>
            <CartesianGrid stroke={isDark ? "#334155" : "#e2e8f0"} strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="label" fontSize={12} tickLine={false} axisLine={false} tick={{ fill: isDark ? "#cbd5e1" : "#64748b" }} />
            <YAxis width={68} fontSize={11} tickLine={false} axisLine={false} tick={{ fill: isDark ? "#cbd5e1" : "#64748b" }} tickFormatter={(value: number) => new Intl.NumberFormat("pt-BR", { notation: "compact", maximumFractionDigits: 1 }).format(value)} />
            <Tooltip contentStyle={chartTooltipStyle} labelStyle={{ color: isDark ? "#f8fafc" : "#0f172a" }} formatter={(value) => money(Number(value || 0))} />
            <Legend wrapperStyle={{ fontSize: 12, paddingTop: 10 }} />
            <Line type="monotone" dataKey="faturamento" name="Faturamento" stroke="#0b5684" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={animateCharts} animationDuration={750} />
            <Line type="monotone" dataKey="frete" name="Frete" stroke="#e8ae29" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} isAnimationActive={animateCharts} animationDuration={750} />
           </LineChart>
          </ResponsiveContainer>
         </div></div>}
       </div>
      </section>
     </>}

     {tab === "produtos" && <>
      <BiMetrics totals={productTabTotals} testId="produtos-mini-dashboard" />
      <section className="bi-v3__panel">
       <header className="bi-v3__panel-heading">
        <p className="bi-v3__overline">Comparativo operacional</p>
        <h2>Análise por Produtos</h2>
        <p className="bi-v3__secondary">Os dez produtos com maior faturamento, comparados ao frete associado.</p>
        <div className="bi-v3__analysis-controls"><MultiFilter label="Filtrar produtos nesta análise" values={tabProdutos} onChange={setTabProdutos} options={productOptions} /></div>
       </header>
       <div className="bi-v3__chart-body"><div className="bi-v3__legend"><span className="bi-v3__legend-item">Faturamento</span><span className="bi-v3__legend-item bi-v3__legend-item--gold">Frete</span></div><BiRanking rows={byProduct} /></div>
      </section>
     </>}

     {tab === "clientes" && <>
      <BiMetrics totals={clientTabTotals} testId="clientes-mini-dashboard" />
      <section className="bi-v3__panel">
       <header className="bi-v3__panel-heading">
        <p className="bi-v3__overline">Relacionamento comercial</p>
        <h2>Análise por Clientes</h2>
        <p className="bi-v3__secondary">Comparativo dos dez clientes com maior faturamento.</p>
        <div className="bi-v3__analysis-controls"><MultiFilter label="Filtrar clientes nesta análise" values={tabClientes} onChange={setTabClientes} options={clientOptions} /></div>
       </header>
       <div className="bi-v3__chart-body"><div className="bi-v3__legend"><span className="bi-v3__legend-item">Faturamento</span><span className="bi-v3__legend-item bi-v3__legend-item--gold">Frete</span></div><BiRanking rows={byClient} /></div>
      </section>
     </>}

     {tab === "placas" && <>
      <BiMetrics totals={plateTabTotals} testId="placas-mini-dashboard" />
      <section className="bi-v3__panel">
       <header className="bi-v3__panel-heading">
        <p className="bi-v3__overline">Desempenho da frota</p>
        <h2>Análise por Veículos / Placas</h2>
        <p className="bi-v3__secondary">Faturamento e frete por placa, com os valores completos de cada veículo.</p>
        <div className="bi-v3__analysis-controls"><MultiFilter label="Filtrar placas nesta análise" values={tabPlacas} onChange={setTabPlacas} options={plateOptions} /></div>
       </header>
       <div className="bi-v3__chart-body"><div className="bi-v3__legend"><span className="bi-v3__legend-item">Faturamento</span><span className="bi-v3__legend-item bi-v3__legend-item--gold">Frete</span></div><BiRanking rows={byPlate} /></div>
      </section>
     </>}

     {tab === "consulta" && <>
      <BiMetrics totals={tableTotals} testId="consulta-mini-dashboard" />
      <div className="bi-v3__panel p-4 sm:p-5">
       <label className="bi-v3__field" htmlFor="bi-consulta-busca">
        <span className="bi-v3__field-label">Pesquisar na Consulta Geral</span>
        <div className="relative w-full">
         <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
         <input id="bi-consulta-busca" type="search" value={tableQuery} onChange={(event) => setTableQuery(event.target.value)} placeholder="NF, cliente, produto, código, placa, município ou data..." className="bi-v3__input pl-10" />
        </div>
       </label>
      </div>
      {showFreightDiagnostic && (
       <section className="bi-v3__panel bi-v3__diagnostic">
        <header className="bi-v3__panel-heading bi-v3__panel-heading--wrap">
         <div>
          <h2>Diagnóstico de fretes — filtros atuais</h2>
          <p className="bi-v3__secondary">{freightDiagnostic.resumo.fretesZerados} registros com faturamento e frete zero entre {freightDiagnostic.resumo.registrosFiltrados} filtrados. {freightDiagnostic.resumo.itensCarregados} itens de romaneio carregados.</p>
         </div>
         <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => void copyFreightDiagnostic()}><ClipboardCopy className="h-4 w-4" /> Copiar relatório</Button>
          <Button variant="outline" size="sm" onClick={() => setShowFreightDiagnostic(false)}>Fechar</Button>
         </div>
        </header>
        <p className="bi-v3__secondary px-5 pb-4">Compara NF/série, produto e quantidade com os romaneios carregados. Uma NF ausente pode indicar falta de carregamento ou vínculo no sistema; este diagnóstico não altera os valores.</p>
        <div className="bi-v3__diagnostic-table">
         <table>
          <thead><tr>{["NF / Série", "Data", "Cliente", "Produto", "Qtd.", "Itens no romaneio", "Diagnóstico"].map((label) => <th key={label}>{label}</th>)}</tr></thead>
          <tbody>{freightDiagnostic.detalhes.slice(0, 150).map((row, index) => (
           <tr key={`${row.nf}-${index}`}><td>{row.nf}</td><td>{formatDateBR(row.data)}</td><td>{row.cliente}</td><td>{row.produto}</td><td>{row.quantidade}</td><td>{row.romaneiosEncontrados}</td><td>{row.status}</td></tr>
          ))}</tbody>
         </table>
         {freightDiagnostic.detalhes.length > 150 && <p className="bi-v3__secondary p-3">Exibindo os primeiros 150 registros. O relatório copiado contém todos os registros.</p>}
         {freightDiagnostic.detalhes.length === 0 && <p className="bi-v3__secondary p-3">Não foram encontrados fretes zerados com faturamento positivo nos filtros atuais.</p>}
        </div>
       </section>
      )}
      <BiConsultation
       rows={rows}
       totals={tableTotals}
       columns={columns}
       columnOptions={columnOptions}
       columnFilters={columnFilters}
       setColumnFilters={setColumnFilters}
       sort={sort}
       onSort={setSort}
       resetKey={`${sort}|${tableQuery}|${from}|${to}|${placas.join(",")}|${clienteIds.join(",")}|${produtoKeys.join(",")}|${JSON.stringify(columnFilters)}`}
      />
     </>}
    </div>
   </div>
  </Layout>
 );
}
