import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { dateOnly, number, created } from "../utils/serialize.js";
import { maintenanceDreValue, isGeneratedMaintenanceEntry } from "./financeiro-dre.js";
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
const normalizeCategory=(value:any)=>String(value||"").normalize("NFD").replace(/[\u0300-\u036f]/g,"").toUpperCase();
const isManualFuelCategory=(value:any)=>{const c=normalizeCategory(value);return c.includes("COMBUST")||c.includes("DIESEL")||c.includes("ABASTEC")||c.includes("ARLA")};
const isFreightRevenueCategory=(value:any)=>{const c=normalizeCategory(value);return c.includes("FRETE")};
const classifyFuelProduct=(name:any)=>{const n=normalizeCategory(name);if(n.includes("ARLA"))return "ARLA";if(n.includes("DIESEL"))return "DIESEL";return null};
export const financeiroService={
 async list(){
  const [items,baixas]=await Promise.all([prisma.lancamentoFinanceiro.findMany({orderBy:[{dataCompetencia:"desc"},{createdAt:"desc"}]}),prisma.baixaFinanceira.groupBy({by:["lancamentoId"],_sum:{valor:true}})]);
  const pagos=new Map(baixas.map(x=>[x.lancamentoId,number(x._sum.valor)]));
  return items.map(x=>{const item=serialize(x),valorBaixado=pagos.get(x.id)||0;return{...item,valorBaixado,saldoRestante:Math.max(0,item.valor-valorBaixado)}})
 },
 async get(id:string){const x=await prisma.lancamentoFinanceiro.findUnique({where:{id}});if(!x)throw new AppError(404,"Lançamento não encontrado.");return serialize(x)},
 async create(i:any){return serialize(await prisma.lancamentoFinanceiro.create({data:data(i)}))},
 async update(id:string,i:any){const d=data(i);delete d.id;delete d.createdAt;return serialize(await prisma.lancamentoFinanceiro.update({where:{id},data:d}))},
 async remove(id:string){await prisma.$transaction([prisma.baixaFinanceira.deleteMany({where:{lancamentoId:id}}),prisma.lancamentoFinanceiro.delete({where:{id}})])},
 async removeAll(){
  const [baixas,lancamentos]=await prisma.$transaction([prisma.baixaFinanceira.deleteMany({}),prisma.lancamentoFinanceiro.deleteMany({})]);
  return {removidos:lancamentos.count,baixasRemovidas:baixas.count};
 },
 async resumo(from?:string,to?:string){
  const range=(from||to)?{...(from?{gte:parseDateOnly(from)}:{}),...(to?{lte:parseDateOnly(to)}:{})}:undefined;
  const [manual,viagens,romaneios,abastecimentos,fechamentos,estoque,pneus,recapagens,consertos,ordensManutencao,baixasResumo]=await Promise.all([
   prisma.lancamentoFinanceiro.findMany({where:range?{dataCompetencia:range}:undefined}),
   prisma.viagem.findMany({where:range?{dataManifesto:range}:undefined}),
   prisma.manifesto.findMany({where:range?{dataManifesto:range}:undefined,select:{produtos:{select:{valorTotal:true}}}}),
   prisma.abastecimento.findMany({where:range?{dataEmissao:range}:undefined,select:{produtos:{select:{valorTotal:true,produto:{select:{nome:true}}}}}}),
   prisma.fechamento.findMany({where:range?{dataFim:range}:undefined}), prisma.estoqueMovimentacao.findMany({where:{tipo:"ENTRADA",...(range?{data:range}:{})},include:{produto:{select:{categoria:true}}}}), prisma.pneu.findMany({where:range?{dataCompra:range}:undefined}), prisma.pneuRecapagem.findMany({where:range?{dataEnvio:range}:undefined}), prisma.pneuConserto.findMany({where:range?{data:range}:undefined}), prisma.ordemServico.findMany({where:{status:"CONCLUIDA",...(range?{dataConclusao:range}:{})},select:{numero:true,valorPecas:true,valorMaoObra:true,valorOutros:true,desconto:true}}), prisma.baixaFinanceira.findMany()
  ]);
  const categorias:Record<string,number>={}; const add=(k:string,v:any)=>categorias[k]=(categorias[k]||0)+number(v);
  let receitasAutomaticas=0,despesasAutomaticas=0;
  // Receita de frete da DRE vem exclusivamente dos Romaneios.
  for(const m of romaneios){for(const p of m.produtos){const valor=number(p.valorTotal);receitasAutomaticas+=valor;add("Receita de fretes",valor)}}
  // Custos operacionais da viagem continuam vindo do Acerto de Viagem, sem usar valorAbastecimento manual.
  for(const v of viagens){for(const [k,val] of [["Pedágios",v.valorPedagio],["Diárias",v.valorDiaria],["Chapas",v.valorChapa],["Multas",v.valorMulta],["Custo Extra",v.valorCustoExtra]] as const){despesasAutomaticas+=number(val);add(k,val)}}
  // Combustível é calculado pelos itens reais dos Abastecimentos: Diesel separado de ARLA.
  for(const x of abastecimentos){for(const p of x.produtos){const tipo=classifyFuelProduct(p.produto.nome);if(tipo==="DIESEL"){despesasAutomaticas+=number(p.valorTotal);add("Abastecimento",p.valorTotal)}else if(tipo==="ARLA"){despesasAutomaticas+=number(p.valorTotal);add("ARLA",p.valorTotal)}}}
  for(const x of fechamentos){despesasAutomaticas+=number(x.valorTotal);add("Comissões",x.valorTotal)} for(const x of estoque){despesasAutomaticas+=number(x.valorTotal);add(x.produto.categoria||"Almoxarifado",x.valorTotal)} for(const x of pneus){despesasAutomaticas+=number(x.valorCompra);add("Pneus",x.valorCompra)} for(const x of recapagens){despesasAutomaticas+=number(x.valor);add("Recapagem",x.valor)} for(const x of consertos){despesasAutomaticas+=number(x.valor);add("Conserto de pneus",x.valor)}
  // Manutenção no DRE vem diretamente das OS concluídas. Peças continuam separadas pelo Almoxarifado; aqui entram apenas mão de obra/outros, líquido do desconto.
  for(const os of ordensManutencao){const valor=maintenanceDreValue(os);if(valor>0){despesasAutomaticas+=valor;add("Manutenção",valor)}}
  const numerosOsManutencao=new Set(ordensManutencao.map(os=>os.numero));
  const pagosResumo=new Map<string,number>();for(const b of baixasResumo)pagosResumo.set(b.lancamentoId,(pagosResumo.get(b.lancamentoId)||0)+number(b.valor));
  let receitasManuais=0,despesasManuais=0,aReceber=0,aPagar=0; for(const x of manual){if(x.status==="CANCELADO")continue; const v=number(x.valor),saldo=Math.max(0,v-(pagosResumo.get(x.id)||0)); if(x.tipo==="RECEITA"){aReceber+=saldo;if(isFreightRevenueCategory(x.categoria))continue;receitasManuais+=v;add(x.categoria,v)}else{aPagar+=saldo;if(isManualFuelCategory(x.categoria)||isGeneratedMaintenanceEntry(x,numerosOsManutencao))continue;despesasManuais+=v;add(x.categoria,v)}}
  const receitas=receitasAutomaticas+receitasManuais, despesas=despesasAutomaticas+despesasManuais, resultado=receitas-despesas; return {receitas,despesas,resultado,margem:receitas?resultado/receitas*100:0,aReceber,aPagar,receitasAutomaticas,despesasAutomaticas,receitasManuais,despesasManuais,categorias:Object.entries(categorias).map(([categoria,valor])=>({categoria,valor})).sort((a,b)=>b.valor-a.valor)};
 },
 async analise(from?:string,to?:string){
  const range=(from||to)?{...(from?{gte:parseDateOnly(from)}:{}),...(to?{lte:parseDateOnly(to)}:{})}:undefined;
  const [viagens,manual,clientes,veiculos,manifestos,abastecimentos,pneusDetalhe]=await Promise.all([
   prisma.viagem.findMany({where:range?{dataManifesto:range}:undefined}),
   prisma.lancamentoFinanceiro.findMany({where:{...(range?{dataCompetencia:range}:{}),status:{not:"CANCELADO"}}}),
   prisma.cliente.findMany({select:{id:true,nomeFantasia:true,razaoSocial:true}}),
   prisma.veiculo.findMany({select:{id:true,placa:true,ipvaValor:true,ipvaVencimento:true,ipvaPago:true,licenciamentoValor:true,licenciamentoVencimento:true,seguroValor:true,seguroValidade:true}}),
   prisma.manifesto.findMany({where:range?{dataManifesto:range}:undefined,select:{id:true,clienteId:true,dataManifesto:true,placaVeiculo:true}}),
   prisma.abastecimento.findMany({where:range?{dataEmissao:range}:undefined,select:{veiculoId:true,valorTotal:true,produtos:{select:{valorTotal:true,produto:{select:{nome:true}}}}}}),
   prisma.pneu.findMany({where:{deletedAt:null,...(range?{dataCompra:range}:{})},select:{valorCompra:true,instalacoes:{orderBy:{createdAt:"asc"},take:1,select:{veiculoId:true}}}})
  ]);
  const clienteNome=new Map(clientes.map(x=>[x.id,x.nomeFantasia||x.razaoSocial||"Sem cliente"]));
  const veiculoPlaca=new Map(veiculos.map(x=>[x.id,x.placa]));
  const inRange=(d:Date|null)=>{if(!d)return false;const ds=dateOnly(d);return(!from||ds>=from)&&(!to||ds<=to)};
  const norm=(v:any)=>String(v||"").replace(/[^A-Z0-9]/gi,"").toUpperCase();
  const key=(data:any,placa:any)=>`${dateOnly(data)}|${norm(placa)}`;
  const clientesRomaneio=new Map<string,Set<string>>();
  for(const m of manifestos){
    const k=key(m.dataManifesto,m.placaVeiculo);
    if(!clientesRomaneio.has(k))clientesRomaneio.set(k,new Set<string>());
    clientesRomaneio.get(k)!.add(m.clienteId);
  }
  const clientesDaViagem=(v:any)=>{
    const ids=Array.from(clientesRomaneio.get(key(v.dataManifesto,v.placa))||[]);
    if(ids.length)return ids;
    return v.clienteId?[v.clienteId]:[];
  };
  const viagemMap=new Map(viagens.map(v=>[v.id,v]));
  type Row={id:string;nome:string;receita:number;despesa:number;resultado:number;margem:number;viagens:number;distanciaKm:number;custoKm:number;lucroKm:number};
  const buckets=()=>new Map<string,{id:string;nome:string;receita:number;despesa:number;viagens:Set<string>;distanciaKm:number}>();
  const byVeiculo=buckets(),byCliente=buckets();
  const ensure=(m:any,id:string,nome:string)=>{if(!m.has(id))m.set(id,{id,nome,receita:0,despesa:0,viagens:new Set<string>(),distanciaKm:0});return m.get(id)};
  const custosMap=new Map<string,{id:string;placa:string;categorias:Record<string,number>;total:number}>();
  const addCusto=(veiculoKey:string,placa:string,categoria:string,valor:any)=>{if(!veiculoKey)return; if(!custosMap.has(veiculoKey))custosMap.set(veiculoKey,{id:veiculoKey,placa,categorias:{},total:0});const row=custosMap.get(veiculoKey)!;const n=number(valor);row.categorias[categoria]=(row.categorias[categoria]||0)+n;row.total+=n};
  const viagensRows=new Map<string,{id:string;codigo:string;placa:string;cliente:string;destino:string;data:string;receita:number;despesa:number;distanciaKm:number}>();
  for(const v of viagens){
   const placa=String(v.placa||"Sem placa");
   const idsClientes=clientesDaViagem(v);
   const nomesClientes=idsClientes.map(id=>clienteNome.get(id)||"Sem cliente");
   const cliente=nomesClientes.length?nomesClientes.join(", "):"Sem cliente";
   const receita=number(v.valorFrete),despesa=number(v.valorPedagio)+number(v.valorDiaria)+number(v.valorChapa)+number(v.valorMulta)+number(v.valorCustoExtra),dist=number(v.distanciaKm);
   const vk=norm(placa)||placa;const vr=ensure(byVeiculo,vk,placa);vr.receita+=receita;vr.despesa+=despesa;vr.viagens.add(v.id);vr.distanciaKm+=dist;addCusto(vk,placa,"Pedágios",v.valorPedagio);addCusto(vk,placa,"Diárias",v.valorDiaria);addCusto(vk,placa,"Chapas",v.valorChapa);addCusto(vk,placa,"Multas",v.valorMulta);addCusto(vk,placa,"Custo Extra",v.valorCustoExtra);
   if(idsClientes.length){
     const divisor=idsClientes.length;
     for(const clienteId of idsClientes){
       const cr=ensure(byCliente,clienteId,clienteNome.get(clienteId)||"Sem cliente");
       cr.receita+=receita/divisor;cr.despesa+=despesa/divisor;cr.viagens.add(v.id);cr.distanciaKm+=dist/divisor;
     }
   }
   viagensRows.set(v.id,{id:v.id,codigo:`VIAGEM ${dateOnly(v.dataManifesto)}`,placa,cliente,destino:v.cidadeEntrega||"—",data:dateOnly(v.dataManifesto),receita,despesa,distanciaKm:dist});
  }
  for(const a of abastecimentos){const placa=veiculoPlaca.get(a.veiculoId)||"";if(placa){const vk=norm(placa)||placa,r=ensure(byVeiculo,vk,placa);for(const p of a.produtos){const tipo=classifyFuelProduct(p.produto.nome);if(!tipo)continue;const valor=number(p.valorTotal);r.despesa+=valor;addCusto(vk,placa,tipo==="ARLA"?"ARLA":"Diesel",valor)}}}
  for(const v of veiculos){const vk=norm(v.placa)||v.placa,r=ensure(byVeiculo,vk,v.placa);if(inRange(v.ipvaVencimento)&&!v.ipvaPago){r.despesa+=number(v.ipvaValor);addCusto(vk,v.placa,"IPVA",v.ipvaValor)}if(inRange(v.licenciamentoVencimento)){r.despesa+=number(v.licenciamentoValor);addCusto(vk,v.placa,"Licenciamento",v.licenciamentoValor)}if(inRange(v.seguroValidade)){r.despesa+=number(v.seguroValor);addCusto(vk,v.placa,"Seguro",v.seguroValor)}}
  for(const pneu of pneusDetalhe){const vid=pneu.instalacoes[0]?.veiculoId,placa=vid?veiculoPlaca.get(vid)||"":"";if(placa){const vk=norm(placa)||placa;const r=ensure(byVeiculo,vk,placa);r.despesa+=number(pneu.valorCompra);addCusto(vk,placa,"Pneus",pneu.valorCompra)}}
  for(const x of manual){
   const val=number(x.valor),isRec=x.tipo==="RECEITA"; const viagem=x.viagemId?viagemMap.get(x.viagemId):null;
   const placa=x.veiculoId?veiculoPlaca.get(x.veiculoId)||"":viagem?.placa||"";
   if(placa){const vk=norm(placa)||placa,r=ensure(byVeiculo,vk,placa);if(isRec)r.receita+=val;else if(!isManualFuelCategory(x.categoria)){r.despesa+=val;addCusto(vk,placa,x.categoria||"Outras despesas",val)}if(x.viagemId)r.viagens.add(x.viagemId)}
   const idsClientes=x.clienteId?[x.clienteId]:(viagem?clientesDaViagem(viagem):[]);
   if(idsClientes.length){
     const divisor=idsClientes.length;
     for(const clienteId of idsClientes){
       const r=ensure(byCliente,clienteId,clienteNome.get(clienteId)||"Sem cliente");
       if(isRec)r.receita+=val/divisor;else r.despesa+=val/divisor;
       if(x.viagemId)r.viagens.add(x.viagemId);
     }
   }
   if(x.viagemId&&viagensRows.has(x.viagemId)){const r=viagensRows.get(x.viagemId)!;if(isRec)r.receita+=val;else r.despesa+=val}
  }
  const finish=(m:any):Row[]=>Array.from(m.values()).map((x:any)=>{const resultado=x.receita-x.despesa;return{id:x.id,nome:x.nome,receita:x.receita,despesa:x.despesa,resultado,margem:x.receita?resultado/x.receita*100:0,viagens:x.viagens.size,distanciaKm:x.distanciaKm,custoKm:x.distanciaKm?x.despesa/x.distanciaKm:0,lucroKm:x.distanciaKm?resultado/x.distanciaKm:0}}).sort((a:any,b:any)=>b.resultado-a.resultado);
  const porViagem=Array.from(viagensRows.values()).map(x=>{const resultado=x.receita-x.despesa;return{...x,resultado,margem:x.receita?resultado/x.receita*100:0,custoKm:x.distanciaKm?x.despesa/x.distanciaKm:0,lucroKm:x.distanciaKm?resultado/x.distanciaKm:0}}).sort((a,b)=>b.resultado-a.resultado);
  const totalReceita=porViagem.reduce((a,x)=>a+x.receita,0),totalDespesa=porViagem.reduce((a,x)=>a+x.despesa,0),totalResultado=totalReceita-totalDespesa;
  return{resumo:{receita:totalReceita,despesa:totalDespesa,resultado:totalResultado,margem:totalReceita?totalResultado/totalReceita*100:0,viagens:porViagem.length},porVeiculo:finish(byVeiculo),porCliente:finish(byCliente),porViagem,custosPorVeiculo:Array.from(custosMap.values()).map(x=>({...x,categorias:Object.entries(x.categorias).map(([categoria,valor])=>({categoria,valor})).sort((a,b)=>b.valor-a.valor)})).sort((a,b)=>b.total-a.total)};
 },
 async baixas(lancamentoId?:string){return (await prisma.baixaFinanceira.findMany({where:lancamentoId?{lancamentoId}:undefined,orderBy:[{data:"desc"},{createdAt:"desc"}]})).map((x:any)=>({...x,valor:number(x.valor),data:dateOnly(x.data),createdAt:created(x.createdAt)}))},
 async adicionarBaixa(lancamentoId:string,i:any){
  const lanc=await prisma.lancamentoFinanceiro.findUnique({where:{id:lancamentoId}});if(!lanc)throw new AppError(404,"Lançamento não encontrado.");
  const existentes=await prisma.baixaFinanceira.aggregate({where:{lancamentoId},_sum:{valor:true}});
  const pago=number(existentes._sum.valor),valor=number(i.valor),total=number(lanc.valor);
  if(valor<=0||pago+valor>total+0.001)throw new AppError(400,"Valor da baixa inválido ou superior ao saldo restante.");
  const baixa=await prisma.baixaFinanceira.create({data:{lancamentoId,valor,data:parseDateOnly(i.data),formaPagamento:i.formaPagamento||"",observacoes:i.observacoes||"",comprovanteNome:i.comprovanteNome||null,comprovanteUrl:i.comprovanteUrl||null}});
  const novoPago=pago+valor,quitado=novoPago>=total-0.001;
  await prisma.lancamentoFinanceiro.update({where:{id:lancamentoId},data:{status:quitado?(lanc.tipo==="RECEITA"?"RECEBIDO":"PAGO"):"PENDENTE",dataPagamento:quitado?parseDateOnly(i.data):null}});
  return {...baixa,valor:number(baixa.valor),data:dateOnly(baixa.data),saldo:Math.max(0,total-novoPago)};
 },
 async removerBaixa(id:string){
  const baixa=await prisma.baixaFinanceira.findUnique({where:{id}});if(!baixa)throw new AppError(404,"Baixa não encontrada.");
  await prisma.baixaFinanceira.delete({where:{id}});
  const lanc=await prisma.lancamentoFinanceiro.findUnique({where:{id:baixa.lancamentoId}});
  if(lanc)await prisma.lancamentoFinanceiro.update({where:{id:lanc.id},data:{status:"PENDENTE",dataPagamento:null}});
 },
 async fluxoCaixa(){
  const [lancs,baixas]=await Promise.all([prisma.lancamentoFinanceiro.findMany({where:{status:{not:"CANCELADO"}}}),prisma.baixaFinanceira.findMany()]);
  const pagos=new Map<string,number>();for(const b of baixas)pagos.set(b.lancamentoId,(pagos.get(b.lancamentoId)||0)+number(b.valor));
  const hoje=new Date();hoje.setHours(0,0,0,0);const sete=new Date(hoje);sete.setDate(sete.getDate()+7);const trinta=new Date(hoje);trinta.setDate(trinta.getDate()+30);
  let saldoRealizado=0,aReceber=0,aPagar=0,vencidoReceber=0,vencidoPagar=0,receber7=0,pagar7=0,receber30=0,pagar30=0;
  for(const l of lancs){const total=number(l.valor),pago=pagos.get(l.id)||0,saldo=Math.max(0,total-pago);if(l.tipo==="RECEITA")saldoRealizado+=pago;else saldoRealizado-=pago;if(!saldo)continue;
   const venc=l.dataVencimento||l.dataCompetencia;if(l.tipo==="RECEITA")aReceber+=saldo;else aPagar+=saldo;
   if(venc<hoje){if(l.tipo==="RECEITA")vencidoReceber+=saldo;else vencidoPagar+=saldo}
   if(venc>=hoje&&venc<=sete){if(l.tipo==="RECEITA")receber7+=saldo;else pagar7+=saldo}
   if(venc>=hoje&&venc<=trinta){if(l.tipo==="RECEITA")receber30+=saldo;else pagar30+=saldo}
  }
  return{saldoRealizado,aReceber,aPagar,vencidoReceber,vencidoPagar,receber7,pagar7,projecao7:saldoRealizado+receber7-pagar7,receber30,pagar30,projecao30:saldoRealizado+receber30-pagar30};
 }
};
