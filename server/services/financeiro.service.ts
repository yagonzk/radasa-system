import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { dateOnly, number, created } from "../utils/serialize.js";
const clean=(v:any)=>v?String(v):null;
const serialize=(x:any)=>({...x,valor:number(x.valor),dataCompetencia:dateOnly(x.dataCompetencia),dataVencimento:x.dataVencimento?dateOnly(x.dataVencimento):null,dataPagamento:x.dataPagamento?dateOnly(x.dataPagamento):null,createdAt:created(x.createdAt)});
const data=(i:any)=>({...i,clienteId:clean(i.clienteId),veiculoId:clean(i.veiculoId),viagemId:clean(i.viagemId),centroCustoId:clean(i.centroCustoId),dataCompetencia:parseDateOnly(i.dataCompetencia),dataVencimento:i.dataVencimento?parseDateOnly(i.dataVencimento):null,dataPagamento:i.dataPagamento?parseDateOnly(i.dataPagamento):null,createdAt:i.createdAt?new Date(i.createdAt):undefined});
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
 }
};
