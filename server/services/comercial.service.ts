import { prisma } from "../lib/prisma.js";
import { parseDateOnly } from "../utils/date.js";
import { number, dateOnly, created } from "../utils/serialize.js";
import { AppError } from "../utils/app-error.js";

const money=(v:any)=>Number(v||0);
const proposal=(x:any)=>({...x,distanciaKm:number(x.distanciaKm),valorFrete:number(x.valorFrete),custoEstimado:number(x.custoEstimado),margemPrevista:number(x.margemPrevista),validade:x.validade?dateOnly(x.validade):null,createdAt:created(x.createdAt)});
const table=(x:any)=>({...x,valorFrete:number(x.valorFrete),valorKm:number(x.valorKm),vigenciaInicio:dateOnly(x.vigenciaInicio),vigenciaFim:x.vigenciaFim?dateOnly(x.vigenciaFim):null,createdAt:created(x.createdAt)});
const contract=(x:any)=>({...x,inicio:dateOnly(x.inicio),fim:x.fim?dateOnly(x.fim):null,createdAt:created(x.createdAt)});

export const comercialService={
 async dashboard(){
  const [propostas,contratos,tabelas]=await Promise.all([prisma.comercialProposta.findMany(),prisma.comercialContrato.findMany(),prisma.comercialTabelaFrete.findMany()]);
  const abertas=propostas.filter(x=>["RASCUNHO","ENVIADA","NEGOCIACAO"].includes(x.status));
  const aprovadas=propostas.filter(x=>x.status==="APROVADA");
  return{propostasAbertas:abertas.length,propostasAprovadas:aprovadas.length,valorEmNegociacao:abertas.reduce((s,x)=>s+money(x.valorFrete),0),contratosAtivos:contratos.filter(x=>x.status==="ATIVO").length,tabelasAtivas:tabelas.length};
 },
 async propostas(){return (await prisma.comercialProposta.findMany({orderBy:{createdAt:"desc"}})).map(proposal)},
 async criarProposta(i:any){
  const count=await prisma.comercialProposta.count();const codigo=`PROP-${String(count+1).padStart(5,"0")}`;const valor=money(i.valorFrete),custo=money(i.custoEstimado),margem=valor?((valor-custo)/valor)*100:0;
  return proposal(await prisma.comercialProposta.create({data:{codigo,clienteId:i.clienteId,origem:i.origem||"",destino:i.destino||"",distanciaKm:money(i.distanciaKm),valorFrete:valor,custoEstimado:custo,margemPrevista:margem,status:i.status||"RASCUNHO",validade:i.validade?parseDateOnly(i.validade):null,observacoes:i.observacoes||""}}));
 },
 async atualizarProposta(id:string,i:any){const x=await prisma.comercialProposta.findUnique({where:{id}});if(!x)throw new AppError(404,"Proposta não encontrada.");const valor=i.valorFrete!==undefined?money(i.valorFrete):money(x.valorFrete),custo=i.custoEstimado!==undefined?money(i.custoEstimado):money(x.custoEstimado);return proposal(await prisma.comercialProposta.update({where:{id},data:{clienteId:i.clienteId??x.clienteId,origem:i.origem??x.origem,destino:i.destino??x.destino,distanciaKm:i.distanciaKm!==undefined?money(i.distanciaKm):x.distanciaKm,valorFrete:valor,custoEstimado:custo,margemPrevista:valor?((valor-custo)/valor)*100:0,status:i.status??x.status,validade:i.validade!==undefined?(i.validade?parseDateOnly(i.validade):null):x.validade,observacoes:i.observacoes??x.observacoes}}))},
 async removerProposta(id:string){await prisma.comercialProposta.delete({where:{id}})},
 async tabelas(){return (await prisma.comercialTabelaFrete.findMany({orderBy:{vigenciaInicio:"desc"}})).map(table)},
 async criarTabela(i:any){return table(await prisma.comercialTabelaFrete.create({data:{clienteId:i.clienteId||null,origem:i.origem||"",destino:i.destino||"",valorFrete:money(i.valorFrete),valorKm:money(i.valorKm),vigenciaInicio:parseDateOnly(i.vigenciaInicio),vigenciaFim:i.vigenciaFim?parseDateOnly(i.vigenciaFim):null,observacoes:i.observacoes||""}}))},
 async removerTabela(id:string){await prisma.comercialTabelaFrete.delete({where:{id}})},
 async contratos(){return (await prisma.comercialContrato.findMany({orderBy:{inicio:"desc"}})).map(contract)},
 async criarContrato(i:any){const count=await prisma.comercialContrato.count();return contract(await prisma.comercialContrato.create({data:{numero:i.numero||`CTR-${String(count+1).padStart(5,"0")}`,clienteId:i.clienteId,inicio:parseDateOnly(i.inicio),fim:i.fim?parseDateOnly(i.fim):null,status:i.status||"ATIVO",indiceReajuste:i.indiceReajuste||"",observacoes:i.observacoes||""}}))},
 async removerContrato(id:string){await prisma.comercialContrato.delete({where:{id}})}
};
