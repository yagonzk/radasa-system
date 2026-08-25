import { prisma } from "../lib/prisma.js";
import { financeiroService } from "./financeiro.service.js";
import { manutencaoService } from "./manutencao.service.js";
import { number, dateOnly } from "../utils/serialize.js";

const daysUntil=(d:Date|null|undefined)=>{if(!d)return null;const a=new Date(d);a.setHours(0,0,0,0);const b=new Date();b.setHours(0,0,0,0);return Math.ceil((a.getTime()-b.getTime())/86400000)};
const nivel=(dias:number|null)=>dias==null?null:dias<0?"VENCIDO":dias<=30?"ATENCAO":null;
async function buildAlertas(){
  const [motoristas,veiculos,manut]=await Promise.all([
   prisma.motorista.findMany({where:{status:"ATIVO"}}),prisma.veiculo.findMany(),manutencaoService.dashboard()
  ]);
  const rows:any[]=[];
  const pushMissing=(id:string,origem:string,titulo:string,detalhe:string,href:string)=>rows.push({id,origem,nivel:"ATENCAO",titulo,detalhe,href});

  for(const m of motoristas){
    // CNH é documento essencial do motorista: ausência de número, categoria ou validade também é prioridade.
    if(!String(m.cnhNumero||"").trim()) pushMissing(`mot-${m.id}-CNH-NUMERO`,"MOTORISTA",`${m.nome} · CNH`,`Número da CNH não informado.`,"/cadastros/motoristas");
    if(!String(m.cnhCategoria||"").trim()) pushMissing(`mot-${m.id}-CNH-CATEGORIA`,"MOTORISTA",`${m.nome} · CNH`,`Categoria da CNH não informada.`,"/cadastros/motoristas");
    if(!m.cnhValidade) pushMissing(`mot-${m.id}-CNH-VALIDADE`,"MOTORISTA",`${m.nome} · CNH`,`Validade da CNH não informada.`,"/cadastros/motoristas");

    for(const [tipo,data] of [["CNH",m.cnhValidade],["MOPP",m.moppValidade],["Toxicológico",m.toxicologicoValidade]] as const){
      const dias=daysUntil(data);const n=nivel(dias);
      if(n)rows.push({id:`mot-${m.id}-${tipo}`,origem:"MOTORISTA",nivel:n,titulo:`${m.nome} · ${tipo}`,detalhe:dias! < 0?`Vencido há ${Math.abs(dias!)} dia(s)`:`Vence em ${dias} dia(s)`,href:"/cadastros/motoristas"});
    }
  }

  for(const v of veiculos){
    // Dados/documentos essenciais da frota também geram alerta quando não foram cadastrados.
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

  // Remove duplicatas e prioriza vencidos; em seguida, alertas de cadastro incompleto.
  const unique=Array.from(new Map(rows.map((row:any)=>[row.id,row])).values());
  return unique.sort((a:any,b:any)=>a.nivel==="VENCIDO"&&b.nivel!=="VENCIDO"?-1:b.nivel==="VENCIDO"&&a.nivel!=="VENCIDO"?1:String(a.titulo).localeCompare(String(b.titulo),"pt-BR"));
}
export const dashboardService={
 alertas: buildAlertas,
 async gerencial(){
  const now=new Date();const from=new Date(now.getFullYear(),now.getMonth(),1).toISOString().slice(0,10);const to=new Date(now.getFullYear(),now.getMonth()+1,0).toISOString().slice(0,10);
  const [dre,fluxo,analise,alertas,viagens,veiculos,abastecimentos,ordens]=await Promise.all([
   financeiroService.resumo(from,to),financeiroService.fluxoCaixa(),financeiroService.analise(from,to),buildAlertas(),
   prisma.viagem.findMany({where:{dataManifesto:{gte:new Date(from+'T00:00:00Z'),lte:new Date(to+'T00:00:00Z')}},orderBy:{createdAt:"desc"}}),
   prisma.veiculo.findMany(),prisma.abastecimento.findMany({where:{dataEmissao:{gte:new Date(from+'T00:00:00Z'),lte:new Date(to+'T00:00:00Z')}}}),prisma.ordemServico.findMany({where:{status:{notIn:["CONCLUIDA","CANCELADA"]}}})
  ]);
  const km=viagens.reduce((a,x)=>a+number(x.distanciaKm),0);const combustivel=abastecimentos.reduce((a,x)=>a+number(x.valorTotal),0);
  const status:Record<string,number>={};for(const v of viagens)status[v.status]=(status[v.status]||0)+1;
  return {periodo:{from,to},financeiro:{...dre,...fluxo},operacao:{viagens:viagens.length,emAndamento:(status.EM_TRANSITO||0)+(status.CARREGANDO||0),entregues:(status.ENTREGUE||0)+(status.FINALIZADA||0),km,combustivel},frota:{veiculos:veiculos.length,osAbertas:ordens.length},alertas:alertas.slice(0,12),rankingVeiculos:analise.porVeiculo.slice(0,5),rankingClientes:analise.porCliente.slice(0,5),viagensRecentes:viagens.slice(0,6).map(v=>({id:v.id,codigo:v.codigo,status:v.status,placa:v.placa,destino:v.cidadeEntrega,data:dateOnly(v.dataManifesto),frete:number(v.valorFrete)}))};
 }
};
