import { prisma } from "../lib/prisma.js";
import { financeiroService } from "./financeiro.service.js";
import { manutencaoService } from "./manutencao.service.js";
import { number, dateOnly } from "../utils/serialize.js";

const daysUntil=(d:Date|null|undefined)=>{if(!d)return null;const a=new Date(d);a.setHours(0,0,0,0);const b=new Date();b.setHours(0,0,0,0);return Math.ceil((a.getTime()-b.getTime())/86400000)};
const nivel=(dias:number|null)=>dias==null?null:dias<0?"VENCIDO":dias<=30?"ATENCAO":null;
const monthRange=()=>{const now=new Date();const from=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);const to=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10);return{from,to,range:{gte:new Date(from+'T00:00:00Z'),lte:new Date(to+'T23:59:59.999Z')}}};

async function buildAlertas(limit?:number){
  const motoristas=await prisma.motorista.findMany({where:{status:"ATIVO"},select:{id:true,nome:true,cnhNumero:true,cnhCategoria:true,cnhValidade:true,moppValidade:true,toxicologicoValidade:true}});
  const veiculos=await prisma.veiculo.findMany({select:{id:true,placa:true,renavam:true,chassi:true,crlvValidade:true,ipvaPago:true,ipvaVencimento:true,licenciamentoVencimento:true,seguroValidade:true}});
  const manut=await manutencaoService.dashboard();
  const rows:any[]=[];
  const pushMissing=(id:string,origem:string,titulo:string,detalhe:string,href:string)=>rows.push({id,origem,nivel:"ATENCAO",titulo,detalhe,href});

  for(const m of motoristas){
    if(!String(m.cnhNumero||"").trim()) pushMissing(`mot-${m.id}-CNH-NUMERO`,"MOTORISTA",`${m.nome} · CNH`,`Número da CNH não informado.`,"/cadastros/motoristas");
    if(!String(m.cnhCategoria||"").trim()) pushMissing(`mot-${m.id}-CNH-CATEGORIA`,"MOTORISTA",`${m.nome} · CNH`,`Categoria da CNH não informada.`,"/cadastros/motoristas");
    if(!m.cnhValidade) pushMissing(`mot-${m.id}-CNH-VALIDADE`,"MOTORISTA",`${m.nome} · CNH`,`Validade da CNH não informada.`,"/cadastros/motoristas");
    for(const [tipo,data] of [["CNH",m.cnhValidade],["MOPP",m.moppValidade],["Toxicológico",m.toxicologicoValidade]] as const){
      const dias=daysUntil(data);const n=nivel(dias);
      if(n)rows.push({id:`mot-${m.id}-${tipo}`,origem:"MOTORISTA",nivel:n,titulo:`${m.nome} · ${tipo}`,detalhe:dias! < 0?`Vencido há ${Math.abs(dias!)} dia(s)`:`Vence em ${dias} dia(s)`,href:"/cadastros/motoristas"});
    }
  }

  for(const v of veiculos){
    if(!String(v.renavam||"").trim()) pushMissing(`vei-${v.id}-RENAVAM`,"VEICULO",`${v.placa} · RENAVAM`,`RENAVAM não informado.`,"/cadastros/veiculos");
    if(!String(v.chassi||"").trim()) pushMissing(`vei-${v.id}-CHASSI`,"VEICULO",`${v.placa} · Chassi`,`Chassi não informado.`,"/cadastros/veiculos");
    if(!v.crlvValidade) pushMissing(`vei-${v.id}-CRLV-VALIDADE`,"VEICULO",`${v.placa} · CRLV`,`Validade do CRLV não informada.`,"/cadastros/veiculos");
    if(!v.ipvaPago && !v.ipvaVencimento) pushMissing(`vei-${v.id}-IPVA-VENCIMENTO`,"VEICULO",`${v.placa} · IPVA`,`Vencimento do IPVA não informado.`,"/cadastros/veiculos");
    if(!v.licenciamentoVencimento) pushMissing(`vei-${v.id}-LICENCIAMENTO`,"VEICULO",`${v.placa} · Licenciamento`,`Vencimento do licenciamento não informado.`,"/cadastros/veiculos");
    for(const [tipo,data,ignorar] of [["CRLV",v.crlvValidade,false],["IPVA",v.ipvaVencimento,v.ipvaPago],["Licenciamento",v.licenciamentoVencimento,false],["Seguro",v.seguroValidade,false]] as const){
      if(ignorar)continue;const dias=daysUntil(data);const n=nivel(dias);
      if(n)rows.push({id:`vei-${v.id}-${tipo}`,origem:"VEICULO",nivel:n,titulo:`${v.placa} · ${tipo}`,detalhe:dias! < 0?`Vencido há ${Math.abs(dias!)} dia(s)`:`Vence em ${dias} dia(s)`,href:"/cadastros/veiculos"});
    }
  }

  for(const a of manut.alertas||[]){
    const isExpired=/venc|atras|restantes?\s*0\b/i.test(String(a.detalhe||""));
    rows.push({id:`man-${a.veiculoId}-${a.tipo}-${a.titulo}`,origem:"MANUTENCAO",nivel:isExpired?"VENCIDO":"ATENCAO",titulo:a.titulo,detalhe:a.detalhe,href:"/manutencao"});
  }

  const unique=Array.from(new Map(rows.map((row:any)=>[row.id,row])).values());
  const sorted=unique.sort((a:any,b:any)=>a.nivel==="VENCIDO"&&b.nivel!=="VENCIDO"?-1:b.nivel==="VENCIDO"&&a.nivel!=="VENCIDO"?1:String(a.titulo).localeCompare(String(b.titulo),"pt-BR"));
  return limit&&limit>0?sorted.slice(0,Math.min(limit,100)):sorted;
}

async function runSettledWithConcurrency(tasks:Array<()=>Promise<any>>,limit:number){
  const results:PromiseSettledResult<any>[] = new Array(tasks.length);
  let next=0;
  const worker=async()=>{
    while(true){
      const index=next++;
      if(index>=tasks.length)return;
      try{results[index]={status:"fulfilled",value:await tasks[index]()};}
      catch(reason){results[index]={status:"rejected",reason};}
    }
  };
  await Promise.all(Array.from({length:Math.min(limit,tasks.length)},()=>worker()));
  return results;
}

export const dashboardService={
 alertas: buildAlertas,
 async gerencial(){
  const {from,to,range}=monthRange();
  const safeResult=(result:any,fallback:any)=>result.status==="fulfilled"?result.value:fallback;
  const taskNames=["viagensResumo","statusViagens","combustivel","veiculos","ordens","viagensRecentes"];
  const tasks:Array<()=>Promise<any>>=[
   ()=>prisma.viagem.aggregate({where:{dataManifesto:range},_count:{_all:true},_sum:{distanciaKm:true}}),
   ()=>prisma.viagem.groupBy({by:["status"],where:{dataManifesto:range},_count:{_all:true}}),
   ()=>prisma.abastecimento.aggregate({where:{dataEmissao:range},_sum:{valorTotal:true}}),
   ()=>prisma.veiculo.count(),
   ()=>prisma.ordemServico.count({where:{status:{notIn:["CONCLUIDA","CANCELADA"]}}}),
   ()=>prisma.viagem.findMany({where:{dataManifesto:range},orderBy:{createdAt:"desc"},take:6,select:{id:true,codigo:true,status:true,placa:true,cidadeEntrega:true,dataManifesto:true,valorFrete:true}})
  ];
  const results=await runSettledWithConcurrency(tasks,2);
  results.forEach((result,index)=>{if(result.status==="rejected")console.error(`[dashboard] bloco ${taskNames[index]} falhou:`,result.reason);});
  const viagensResumo:any=safeResult(results[0],{_count:{_all:0},_sum:{distanciaKm:null}});
  const statusRows:any[]=safeResult(results[1],[] as any[]);
  const combustivelResumo:any=safeResult(results[2],{_sum:{valorTotal:null}});
  const veiculos:number=safeResult(results[3],0);
  const osAbertas:number=safeResult(results[4],0);
  const viagensRecentes:any[]=safeResult(results[5],[] as any[]);
  const indisponiveis=taskNames.filter((_,i)=>results[i].status==="rejected");
  const status:Record<string,number>={};for(const row of statusRows)status[row.status]=Number(row._count?._all||0);
  return {periodo:{from,to},parcial:indisponiveis.length>0,indisponiveis,operacao:{viagens:Number(viagensResumo._count?._all||0),emAndamento:(status.EM_TRANSITO||0)+(status.CARREGANDO||0),entregues:(status.ENTREGUE||0)+(status.FINALIZADA||0),km:number(viagensResumo._sum?.distanciaKm),combustivel:number(combustivelResumo._sum?.valorTotal)},frota:{veiculos,osAbertas},viagensRecentes:viagensRecentes.map(v=>({id:v.id,codigo:v.codigo,status:v.status,placa:v.placa,destino:v.cidadeEntrega,data:dateOnly(v.dataManifesto),frete:number(v.valorFrete)}))};
 },
 async financeiro(){
  const {from,to}=monthRange();
  const taskNames=["resumo","fluxo"];
  const tasks:Array<()=>Promise<any>>=[()=>financeiroService.resumo(from,to),()=>financeiroService.fluxoCaixa()];
  const results=await runSettledWithConcurrency(tasks,1);
  results.forEach((result,index)=>{if(result.status==="rejected")console.error(`[dashboard-financeiro] bloco ${taskNames[index]} falhou:`,result.reason);});
  const safeResult=(result:any,fallback:any)=>result.status==="fulfilled"?result.value:fallback;
  const dre:any=safeResult(results[0],{});const fluxo:any=safeResult(results[1],{});
  const indisponiveis=taskNames.filter((_,i)=>results[i].status==="rejected");
  return{periodo:{from,to},parcial:indisponiveis.length>0,indisponiveis,financeiro:{...dre,...fluxo}};
 },
 async rankings(){
  const {from,to}=monthRange();
  const analise:any=await financeiroService.analise(from,to);
  return{periodo:{from,to},rankingVeiculos:(analise.porVeiculo||[]).slice(0,5),rankingClientes:(analise.porCliente||[]).slice(0,5)};
 }
};
