import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { dateOnly, number, created } from "../utils/serialize.js";
const clean=(v:any)=>v?String(v):null;
const serialize=(x:any)=>({...x,valor:number(x.valor),dataCompetencia:dateOnly(x.dataCompetencia),dataVencimento:x.dataVencimento?dateOnly(x.dataVencimento):null,dataPagamento:x.dataPagamento?dateOnly(x.dataPagamento):null,createdAt:created(x.createdAt)});
const data=(i:any)=>{
 const out:any={...i};
 for(const key of ["clienteId","veiculoId","viagemId","centroCustoId"]){if(key in i)out[key]=clean(i[key]);}
 if("dataCompetencia" in i)out.dataCompetencia=parseDateOnly(i.dataCompetencia);
 if("dataVencimento" in i)out.dataVencimento=i.dataVencimento?parseDateOnly(i.dataVencimento):null;
 if("dataPagamento" in i)out.dataPagamento=i.dataPagamento?parseDateOnly(i.dataPagamento):null;
 if("createdAt" in i)out.createdAt=i.createdAt?new Date(i.createdAt):undefined;
 return out;
};
export const financeiroService={
 async list(){return (await prisma.lancamentoFinanceiro.findMany({orderBy:[{dataCompetencia:"desc"},{createdAt:"desc"}]})).map(serialize)},
 async get(id:string){const x=await prisma.lancamentoFinanceiro.findUnique({where:{id}});if(!x)throw new AppError(404,"Lançamento não encontrado.");return serialize(x)},
 async create(i:any){return serialize(await prisma.lancamentoFinanceiro.create({data:data(i)}))},
 async update(id:string,i:any){const d=data(i);delete d.id;delete d.createdAt;return serialize(await prisma.lancamentoFinanceiro.update({where:{id},data:d}))},
 async remove(id:string){await prisma.lancamentoFinanceiro.delete({where:{id}})},
 async resumo(from?:string,to?:string){
  const range=(from||to)?{...(from?{gte:parseDateOnly(from)}:{}),...(to?{lte:parseDateOnly(to)}:{})}:undefined;
  const [manual,viagens,abastecimentos,fechamentos,estoque,pneus,recapagens,consertos]=await Promise.all([
   prisma.lancamentoFinanceiro.findMany({where:range?{dataCompetencia:range}:undefined}),
   prisma.viagem.findMany({where:range?{dataManifesto:range}:undefined}), prisma.abastecimento.findMany({where:range?{dataEmissao:range}:undefined}), prisma.fechamento.findMany({where:range?{dataFim:range}:undefined}), prisma.estoqueMovimentacao.findMany({where:{tipo:"ENTRADA",...(range?{data:range}:{})}}), prisma.pneu.findMany({where:range?{dataCompra:range}:undefined}), prisma.pneuRecapagem.findMany({where:range?{dataEnvio:range}:undefined}), prisma.pneuConserto.findMany({where:range?{data:range}:undefined})
  ]);
  const categorias:Record<string,number>={}; const add=(k:string,v:any)=>categorias[k]=(categorias[k]||0)+number(v);
  let receitasAutomaticas=0,despesasAutomaticas=0;
  for(const v of viagens){receitasAutomaticas+=number(v.valorFrete); add("Receita de fretes",v.valorFrete); for(const [k,val] of [["Pedágios",v.valorPedagio],["Diárias",v.valorDiaria],["Chapas",v.valorChapa]] as const){despesasAutomaticas+=number(val);add(k,val)}}
  for(const x of abastecimentos){despesasAutomaticas+=number(x.valorTotal);add("Abastecimento",x.valorTotal)} for(const x of fechamentos){despesasAutomaticas+=number(x.valorTotal);add("Comissões",x.valorTotal)} for(const x of estoque){despesasAutomaticas+=number(x.valorTotal);add("Almoxarifado",x.valorTotal)} for(const x of pneus){despesasAutomaticas+=number(x.valorCompra);add("Pneus",x.valorCompra)} for(const x of recapagens){despesasAutomaticas+=number(x.valor);add("Recapagem",x.valor)} for(const x of consertos){despesasAutomaticas+=number(x.valor);add("Conserto de pneus",x.valor)}
  let receitasManuais=0,despesasManuais=0,aReceber=0,aPagar=0; for(const x of manual){if(x.status==="CANCELADO")continue; const v=number(x.valor); if(x.tipo==="RECEITA"){receitasManuais+=v;add(x.categoria,v);if(x.status!=="RECEBIDO")aReceber+=v}else{despesasManuais+=v;add(x.categoria,v);if(x.status!=="PAGO")aPagar+=v}}
  const receitas=receitasAutomaticas+receitasManuais, despesas=despesasAutomaticas+despesasManuais, resultado=receitas-despesas; return {receitas,despesas,resultado,margem:receitas?resultado/receitas*100:0,aReceber,aPagar,receitasAutomaticas,despesasAutomaticas,receitasManuais,despesasManuais,categorias:Object.entries(categorias).map(([categoria,valor])=>({categoria,valor})).sort((a,b)=>b.valor-a.valor)};
 },
 async analise(from?:string,to?:string){
  const range=(from||to)?{...(from?{gte:parseDateOnly(from)}:{}),...(to?{lte:parseDateOnly(to)}:{})}:undefined;
  const [viagens,manual,clientes,veiculos]=await Promise.all([
   prisma.viagem.findMany({where:range?{dataManifesto:range}:undefined}),
   prisma.lancamentoFinanceiro.findMany({where:{...(range?{dataCompetencia:range}:{}),status:{not:"CANCELADO"}}}),
   prisma.cliente.findMany({select:{id:true,nomeFantasia:true,razaoSocial:true}}),
   prisma.veiculo.findMany({select:{id:true,placa:true}})
  ]);
  const clienteNome=new Map(clientes.map(x=>[x.id,x.nomeFantasia||x.razaoSocial||"Sem cliente"]));
  const veiculoPlaca=new Map(veiculos.map(x=>[x.id,x.placa]));
  const norm=(v:any)=>String(v||"").replace(/[^A-Z0-9]/gi,"").toUpperCase();
  const viagemMap=new Map(viagens.map(v=>[v.id,v]));
  type Row={id:string;nome:string;receita:number;despesa:number;resultado:number;margem:number;viagens:number;distanciaKm:number;custoKm:number;lucroKm:number};
  const buckets=(key:"veiculo"|"cliente")=>new Map<string,{id:string;nome:string;receita:number;despesa:number;viagens:Set<string>;distanciaKm:number}>();
  const byVeiculo=buckets("veiculo"),byCliente=buckets("cliente");
  const ensure=(m:any,id:string,nome:string)=>{if(!m.has(id))m.set(id,{id,nome,receita:0,despesa:0,viagens:new Set<string>(),distanciaKm:0});return m.get(id)};
  const viagensRows=new Map<string,{id:string;codigo:string;placa:string;cliente:string;destino:string;data:string;receita:number;despesa:number;distanciaKm:number}>();
  for(const v of viagens){
   const placa=String(v.placa||"Sem placa"); const cliente=v.clienteId?clienteNome.get(v.clienteId)||"Sem cliente":"Sem cliente";
   const receita=number(v.valorFrete),despesa=number(v.valorPedagio)+number(v.valorDiaria)+number(v.valorAbastecimento)+number(v.valorChapa),dist=number(v.distanciaKm);
   const vr=ensure(byVeiculo,norm(placa)||placa,placa);vr.receita+=receita;vr.despesa+=despesa;vr.viagens.add(v.id);vr.distanciaKm+=dist;
   const cr=ensure(byCliente,v.clienteId||"SEM_CLIENTE",cliente);cr.receita+=receita;cr.despesa+=despesa;cr.viagens.add(v.id);cr.distanciaKm+=dist;
   viagensRows.set(v.id,{id:v.id,codigo:`VIAGEM ${dateOnly(v.dataManifesto)}`,placa,cliente,destino:v.cidadeEntrega||"—",data:dateOnly(v.dataManifesto),receita,despesa,distanciaKm:dist});
  }
  for(const x of manual){
   const val=number(x.valor),isRec=x.tipo==="RECEITA"; const viagem=x.viagemId?viagemMap.get(x.viagemId):null;
   let placa=x.veiculoId?veiculoPlaca.get(x.veiculoId)||"":viagem?.placa||""; let clienteId=x.clienteId||viagem?.clienteId||"";
   if(placa){const r=ensure(byVeiculo,norm(placa)||placa,placa);if(isRec)r.receita+=val;else r.despesa+=val;if(x.viagemId)r.viagens.add(x.viagemId)}
   if(clienteId){const r=ensure(byCliente,clienteId,clienteNome.get(clienteId)||"Sem cliente");if(isRec)r.receita+=val;else r.despesa+=val;if(x.viagemId)r.viagens.add(x.viagemId)}
   if(x.viagemId&&viagensRows.has(x.viagemId)){const r=viagensRows.get(x.viagemId)!;if(isRec)r.receita+=val;else r.despesa+=val}
  }
  const finish=(m:any):Row[]=>Array.from(m.values()).map((x:any)=>{const resultado=x.receita-x.despesa;return{id:x.id,nome:x.nome,receita:x.receita,despesa:x.despesa,resultado,margem:x.receita?resultado/x.receita*100:0,viagens:x.viagens.size,distanciaKm:x.distanciaKm,custoKm:x.distanciaKm?x.despesa/x.distanciaKm:0,lucroKm:x.distanciaKm?resultado/x.distanciaKm:0}}).sort((a:any,b:any)=>b.resultado-a.resultado);
  const porViagem=Array.from(viagensRows.values()).map(x=>{const resultado=x.receita-x.despesa;return{...x,resultado,margem:x.receita?resultado/x.receita*100:0,custoKm:x.distanciaKm?x.despesa/x.distanciaKm:0,lucroKm:x.distanciaKm?resultado/x.distanciaKm:0}}).sort((a,b)=>b.resultado-a.resultado);
  const totalReceita=porViagem.reduce((a,x)=>a+x.receita,0),totalDespesa=porViagem.reduce((a,x)=>a+x.despesa,0),totalResultado=totalReceita-totalDespesa;
  return{resumo:{receita:totalReceita,despesa:totalDespesa,resultado:totalResultado,margem:totalReceita?totalResultado/totalReceita*100:0,viagens:porViagem.length},porVeiculo:finish(byVeiculo),porCliente:finish(byCliente),porViagem};
 }
};
