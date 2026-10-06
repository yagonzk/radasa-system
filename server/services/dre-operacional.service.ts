import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { number, dateOnly } from "../utils/serialize.js";
import { runWithConcurrency } from "../utils/concurrency.js";
import { maintenanceDreValue } from "./financeiro-dre.js";
import { valorComissaoPorDestino } from "../utils/comissao.js";

const MAX_DAYS = 366;
const norm = (v: unknown) => String(v ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
const normPlate = (v: unknown) => norm(v).replace(/[^A-Z0-9]/g, "");
const asStr = (v: unknown) => typeof v === "string" ? v.trim() : "";
const monthKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const localDate = (d: Date) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;

export type DreFilters = {
  from?: string; to?: string; clienteId?: string; grupoCliente?: string; filialId?: string; centroCustoId?: string;
  veiculoId?: string; frota?: string; motoristaId?: string; tipoOperacao?: string; tipoVeiculo?: string;
  cidadeOrigem?: string; cidadeDestino?: string; ufOrigem?: string; ufDestino?: string; viagemId?: string;
  cte?: string; conhecimento?: string; numeroCarga?: string; gestor?: string;
};

function range(filters: DreFilters) {
  const now = new Date();
  const from = filters.from || localDate(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = filters.to || localDate(new Date(now.getFullYear(), now.getMonth() + 1, 0));
  const start = parseDateOnly(from), end = parseDateOnly(to);
  if (start > end) throw new AppError(400, "A data inicial não pode ser maior que a data final.");
  const days = Math.floor((end.getTime() - start.getTime()) / 86400000) + 1;
  if (days > MAX_DAYS) throw new AppError(400, `Para proteger o sistema, o DRE Operacional aceita no máximo ${MAX_DAYS} dias por consulta.`);
  return { from, to, start, end, days, date: { gte: start, lte: end } };
}

const includes = (value: unknown, terms: string[]) => terms.some(t => norm(value).includes(t));
const isDeduction = (c: unknown) => includes(c,["CANCEL","DEVOL","ABAT","DESCONTO","ICMS","ISS","PIS","COFINS","IMPOSTO SOBRE FATUR","DEDUCAO"]);
const isDepreciation = (c: unknown) => includes(c,["DEPRECI","AMORTIZA"]);
const isIndirect = (c: unknown) => includes(c,["ADMINISTR","ENCARGO","ALUGUEL","ENERGIA","INTERNET","TELEFON","TMS","ERP","SOFTWARE","LICEN","BANCAR","CONTABIL","JURID","RECURSOS HUMANOS","RH","DESPESA GERAL"]);
const isFuel = (v: unknown) => includes(v,["DIESEL","ARLA","COMBUST"]);
const category = (v: unknown) => norm(v) || "OUTROS";

function directCategory(raw: unknown) {
  const c = category(raw);
  if (includes(c,["DIESEL","COMBUST","ABASTEC"])) return "Combustível";
  if (includes(c,["LUBRIFIC"])) return "Lubrificantes";
  if (includes(c,["ARLA"])) return "ARLA";
  if (includes(c,["PEDAG"])) return "Pedágios pagos";
  if (includes(c,["PREVENTIVA"])) return "Manutenção preventiva";
  if (includes(c,["CORRETIVA","MANUTENCAO","MANUTENÇÃO"])) return "Manutenção corretiva";
  if (includes(c,["PNEU"]) && !includes(c,["RECAP"])) return "Pneus";
  if (includes(c,["RECAP"])) return "Recapagens";
  if (includes(c,["LAVAG"])) return "Lavagens";
  if (includes(c,["AGREGAD"])) return "Agregados";
  if (includes(c,["TERCEIR"])) return "Terceiros contratados";
  if (includes(c,["COMISSAO","COMISSÃO"])) return "Comissão de motorista";
  if (includes(c,["DIARIA","DIÁRIA"])) return "Diárias";
  if (includes(c,["CHAPA","AJUDANTE"])) return "Ajudantes";
  if (includes(c,["RASTREAMENTO"])) return "Rastreamento";
  if (includes(c,["RISCO"])) return "Gerenciamento de risco";
  if (includes(c,["SEGURO CARGA"])) return "Seguros da carga";
  if (includes(c,["SEGURO"])) return "Seguros da operação";
  if (includes(c,["COLETA"])) return "Custos de coleta";
  if (includes(c,["ENTREGA"])) return "Custos de entrega";
  if (includes(c,["TRANSFER"])) return "Custos de transferência";
  if (includes(c,["VIAGEM","ESTACION","ALIMENTA"])) return "Despesas de viagem";
  if (includes(c,["TAXA"])) return "Taxas operacionais";
  return "Outros custos diretos";
}

function indirectCategory(raw: unknown) {
  const c = category(raw);
  if (includes(c,["SALARIO","SALÁRIO"])) return "Salários administrativos";
  if (includes(c,["ENCARGO"])) return "Encargos trabalhistas";
  if (includes(c,["ALUGUEL"])) return "Aluguel";
  if (includes(c,["ENERGIA"])) return "Energia";
  if (includes(c,["INTERNET"])) return "Internet";
  if (includes(c,["TELEFON"])) return "Telefonia";
  if (includes(c,["TMS"])) return "Sistema TMS";
  if (includes(c,["ERP"])) return "Sistema ERP";
  if (includes(c,["SOFTWARE","LICEN"])) return "Licenças de software";
  if (includes(c,["BANCAR"])) return "Despesas bancárias";
  if (includes(c,["TERCEIR"])) return "Serviços terceirizados";
  if (includes(c,["CONTABIL"])) return "Contabilidade";
  if (includes(c,["JURID"])) return "Jurídico";
  if (includes(c,["RECURSOS HUMANOS","RH"])) return "Recursos humanos";
  return "Despesas gerais";
}

function deductionCategory(raw: unknown) {
  const c = category(raw);
  if (includes(c,["CANCEL"])) return "Cancelamentos";
  if (includes(c,["DEVOL"])) return "Devoluções";
  if (includes(c,["ABAT"])) return "Abatimentos";
  if (includes(c,["DESCONTO"])) return "Descontos concedidos";
  if (includes(c,["ICMS"])) return "ICMS";
  if (includes(c,["ISS"])) return "ISS";
  if (includes(c,["PIS"])) return "PIS";
  if (includes(c,["COFINS"])) return "COFINS";
  return "Outros impostos/deduções";
}

function depreciationCategory(raw: unknown) {
  return includes(raw,["FROTA","VEIC"]) ? "Depreciação da frota" : includes(raw,["EQUIP"]) ? "Depreciação de equipamentos" : "Amortizações";
}

function add(map: Map<string, number>, key: string, value: unknown) { const n = number(value); if (n) map.set(key, (map.get(key) || 0) + n); }
function toRows(map: Map<string, number>) { return Array.from(map.entries()).map(([label, valor]) => ({ label, valor })).sort((a,b)=>b.valor-a.valor); }

export const dreOperacionalService = {
  async dashboard(filters: DreFilters) {
    const r = range(filters);
    const [clientes, veiculos, motoristas, empresas, centros, manifestos, viagens, abastecimentos, pneus, recapagens, consertos, ordens, financeiros, ciots, locais] = await runWithConcurrency([
      () => prisma.cliente.findMany({select:{id:true,nomeFantasia:true,codigoInterno:true},orderBy:{nomeFantasia:"asc"}}),
      () => prisma.veiculo.findMany({select:{id:true,placa:true,modelo:true,subcategoria:true,motoristaId:true},orderBy:{placa:"asc"}}),
      () => prisma.motorista.findMany({select:{id:true,nome:true},orderBy:{nome:"asc"}}),
      () => prisma.empresa.findMany({where:{ativa:true},select:{id:true,razaoSocial:true,nomeFantasia:true},orderBy:{razaoSocial:"asc"}}),
      () => prisma.centroCusto.findMany({where:{ativo:true},select:{id:true,nome:true,tipo:true},orderBy:{nome:"asc"}}),
      () => prisma.manifesto.findMany({where:{dataManifesto:r.date},select:{id:true,clienteId:true,dataManifesto:true,tipoManifesto:true,placaVeiculo:true,romaneios:true,notasFiscais:true,cliente:{select:{nomeFantasia:true,codigoInterno:true}},produtos:{select:{valorTotal:true,clienteId:true,romaneio:true,notaFiscal:true,instrucaoCobranca:true}}}}),
      () => prisma.viagem.findMany({where:{dataManifesto:r.date},select:{id:true,codigo:true,placa:true,motoristaId:true,clienteId:true,valorFrete:true,dataManifesto:true,cidadeOrigem:true,cidadeEntrega:true,distanciaKm:true,valorPedagio:true,valorDiaria:true,valorChapa:true,valorMulta:true,valorComissao:true,custoExtraTag:true,valorCustoExtra:true,motorista:{select:{nome:true}}}}),
      () => prisma.abastecimento.findMany({where:{dataEmissao:r.date},select:{id:true,dataEmissao:true,veiculoId:true,produtos:{select:{valorTotal:true,produto:{select:{nome:true}}}}}}),
      () => prisma.pneu.findMany({where:{dataCompra:r.date},select:{id:true,dataCompra:true,valorCompra:true,instalacoes:{where:{ativo:true},take:1,select:{veiculoId:true}}}}),
      () => prisma.pneuRecapagem.findMany({where:{dataEnvio:r.date},select:{id:true,dataEnvio:true,valor:true,pneu:{select:{instalacoes:{where:{ativo:true},take:1,select:{veiculoId:true}}}}}}),
      () => prisma.pneuConserto.findMany({where:{data:r.date},select:{id:true,data:true,valor:true,pneu:{select:{instalacoes:{where:{ativo:true},take:1,select:{veiculoId:true}}}}}}),
      () => prisma.ordemServico.findMany({where:{status:"CONCLUIDA",dataConclusao:r.date},select:{id:true,numero:true,veiculoId:true,tipo:true,dataConclusao:true,valorPecas:true,valorMaoObra:true,valorOutros:true,desconto:true}}),
      () => prisma.lancamentoFinanceiro.findMany({where:{dataCompetencia:r.date,status:{not:"CANCELADO"}},select:{id:true,tipo:true,descricao:true,categoria:true,subcategoria:true,valor:true,dataCompetencia:true,clienteId:true,veiculoId:true,viagemId:true,centroCustoId:true,numeroDocumento:true,fornecedor:true}}),
      () => prisma.ciot.findMany({where:{dataInicio:r.date},select:{id:true,empresaId:true,clienteId:true,motoristaId:true,veiculoId:true,tipoOperacao:true,origemCidade:true,origemUf:true,destinoCidade:true,destinoUf:true,dataInicio:true,empresa:{select:{razaoSocial:true,nomeFantasia:true}},ctes:{select:{id:true,numero:true,chave:true,valorFrete:true,valorPedagio:true,dataEmissao:true,origemCidade:true,origemUf:true,destinoCidade:true,destinoUf:true}}}}),
      () => prisma.local.findMany({select:{cidade:true,uf:true,valorComissao:true}})
    ] as const, 3);

    const vehicleById = new Map(veiculos.map(v=>[v.id,v]));
    const vehicleByPlate = new Map(veiculos.map(v=>[normPlate(v.placa),v]));
    const clientById = new Map(clientes.map(c=>[c.id,c]));
    const driverById = new Map(motoristas.map(m=>[m.id,m]));

    const filterVehicle = filters.veiculoId ? vehicleById.get(filters.veiculoId) : null;
    const targetPlate = filterVehicle ? normPlate(filterVehicle.placa) : "";
    const ciotScopeActive = Boolean(filters.filialId || filters.tipoOperacao || filters.ufOrigem || filters.ufDestino || filters.cte || filters.conhecimento);
    const acceptedCiots = ciots.filter(c => {
      if (filters.filialId && c.empresaId !== filters.filialId) return false;
      if (filters.clienteId && c.clienteId !== filters.clienteId) return false;
      if (filters.motoristaId && c.motoristaId !== filters.motoristaId) return false;
      if (filters.veiculoId && c.veiculoId !== filters.veiculoId) return false;
      if (filters.tipoOperacao && String(c.tipoOperacao) !== filters.tipoOperacao) return false;
      if (filters.cidadeOrigem && norm(c.origemCidade)!==norm(filters.cidadeOrigem)) return false;
      if (filters.cidadeDestino && norm(c.destinoCidade)!==norm(filters.cidadeDestino)) return false;
      if (filters.ufOrigem && norm(c.origemUf)!==norm(filters.ufOrigem)) return false;
      if (filters.ufDestino && norm(c.destinoUf)!==norm(filters.ufDestino)) return false;
      const doc = norm(filters.cte || filters.conhecimento);
      if (doc && !c.ctes.some(x=>norm(x.numero).includes(doc)||norm(x.chave).includes(doc))) return false;
      return true;
    });
    const ciotVehicleIds = new Set(acceptedCiots.map(c=>c.veiculoId));
    const ciotPlates = new Set(Array.from(ciotVehicleIds).map(id=>normPlate(vehicleById.get(id)?.placa)).filter(Boolean));
    const ciotClientIds = new Set(acceptedCiots.map(c=>c.clienteId).filter(Boolean) as string[]);
    const ciotDriverIds = new Set(acceptedCiots.map(c=>c.motoristaId));
    const acceptedTrips = viagens.filter(v => {
      if (filters.viagemId && v.id !== filters.viagemId) return false;
      if (filters.clienteId && v.clienteId !== filters.clienteId) return false;
      if (filters.veiculoId && normPlate(v.placa) !== targetPlate) return false;
      if (filters.motoristaId && v.motoristaId !== filters.motoristaId) return false;
      if (filters.tipoVeiculo) { const veh = vehicleByPlate.get(normPlate(v.placa)); if (String(veh?.subcategoria||"") !== filters.tipoVeiculo) return false; }
      if (filters.cidadeOrigem && norm(v.cidadeOrigem) !== norm(filters.cidadeOrigem)) return false;
      if (filters.cidadeDestino && norm(v.cidadeEntrega) !== norm(filters.cidadeDestino)) return false;
      if (ciotScopeActive && !ciotPlates.has(normPlate(v.placa)) && !(v.clienteId && ciotClientIds.has(v.clienteId)) && !ciotDriverIds.has(v.motoristaId)) return false;
      return true;
    });
    const tripIds = new Set(acceptedTrips.map(v=>v.id));
    const acceptedPlates = new Set(acceptedTrips.map(v=>normPlate(v.placa)));
    if (targetPlate) acceptedPlates.add(targetPlate);

    const acceptedManifests = manifestos.filter(m => {
      if (filters.clienteId && m.clienteId !== filters.clienteId && !m.produtos.some(p=>p.clienteId===filters.clienteId)) return false;
      if (filters.veiculoId && normPlate(m.placaVeiculo) !== targetPlate) return false;
      if (filters.numeroCarga && !norm(m.romaneios).includes(norm(filters.numeroCarga)) && !m.produtos.some(p=>norm(p.romaneio).includes(norm(filters.numeroCarga)))) return false;
      if ((filters.motoristaId || filters.viagemId || filters.cidadeOrigem || filters.cidadeDestino || filters.tipoVeiculo) && !acceptedPlates.has(normPlate(m.placaVeiculo))) return false;
      if (ciotScopeActive && !ciotPlates.has(normPlate(m.placaVeiculo)) && !ciotClientIds.has(m.clienteId)) return false;
      return true;
    });

    const direct = new Map<string,number>(), indirect = new Map<string,number>(), deductions = new Map<string,number>(), depreciation = new Map<string,number>();
    const monthly = new Map<string,{mes:string;receita:number;custos:number;ebitda:number;resultado:number}>();
    const entity = new Map<string,{id:string;nome:string;receita:number;custos:number;km:number;viagens:Set<string>}>();
    const client = new Map<string,{id:string;nome:string;receita:number;custos:number;km:number;viagens:Set<string>}>();
    const driver = new Map<string,{id:string;nome:string;receita:number;custos:number;km:number;viagens:Set<string>}>();
    const getAgg=(map:typeof entity,id:string,nome:string)=>{if(!map.has(id))map.set(id,{id,nome,receita:0,custos:0,km:0,viagens:new Set()});return map.get(id)!};
    const ensureMonth=(d:Date)=>{const k=monthKey(d);if(!monthly.has(k))monthly.set(k,{mes:k,receita:0,custos:0,ebitda:0,resultado:0});return monthly.get(k)!};

    let grossRevenue=0, totalKm=0, tripCount=0;
    for (const m of acceptedManifests) {
      const rev = m.produtos.reduce((s,p)=>s+number(p.valorTotal),0); grossRevenue += rev; ensureMonth(m.dataManifesto).receita += rev;
      const plateKey = normPlate(m.placaVeiculo)||"SEM-PLACA"; getAgg(entity,plateKey,m.placaVeiculo||"Sem placa").receita += rev;
      const cid = filters.clienteId || m.clienteId; const cn = clientById.get(cid)?.nomeFantasia || m.cliente.nomeFantasia || "Sem cliente"; getAgg(client,cid||"sem-cliente",cn).receita += rev;
    }

    for (const v of acceptedTrips) {
      tripCount++; totalKm += number(v.distanciaKm); const plateKey=normPlate(v.placa)||"SEM-PLACA"; const ve=getAgg(entity,plateKey,v.placa||"Sem placa"); ve.km+=number(v.distanciaKm);ve.viagens.add(v.id);
      const dr=getAgg(driver,v.motoristaId,v.motorista.nome||"Sem motorista");dr.km+=number(v.distanciaKm);dr.viagens.add(v.id);
      if(v.clienteId){const cl=getAgg(client,v.clienteId,clientById.get(v.clienteId)?.nomeFantasia||"Sem cliente");cl.km+=number(v.distanciaKm);cl.viagens.add(v.id)}
      const loc=locais.find(l=>norm(l.cidade)===norm(v.cidadeEntrega)); const commission=loc?valorComissaoPorDestino({cidade:loc.cidade,uf:loc.uf,valorLegado:number(loc.valorComissao)}):number(v.valorComissao);
      const costs:[[string,number],...Array<[string,number]>]=[["Pedágios pagos",number(v.valorPedagio)],["Diárias",number(v.valorDiaria)],["Ajudantes",number(v.valorChapa)],["Comissão de motorista",commission],["Despesas de viagem",number(v.valorCustoExtra)],["Outros custos diretos",number(v.valorMulta)]];
      for(const [label,val] of costs){if(!val)continue;add(direct,label,val);ensureMonth(v.dataManifesto).custos+=val;ve.custos+=val;dr.custos+=val;if(v.clienteId)getAgg(client,v.clienteId,clientById.get(v.clienteId)?.nomeFantasia||"Sem cliente").custos+=val;}
    }

    for(const a of abastecimentos){ const veh=vehicleById.get(a.veiculoId); if(filters.veiculoId&&a.veiculoId!==filters.veiculoId)continue;if((filters.motoristaId||filters.viagemId||filters.cidadeOrigem||filters.cidadeDestino)&&veh&&!acceptedPlates.has(normPlate(veh.placa)))continue; const ve=veh?getAgg(entity,normPlate(veh.placa),veh.placa):null; for(const p of a.produtos){if(!isFuel(p.produto.nome))continue;const label=includes(p.produto.nome,["ARLA"])?"ARLA":"Combustível";const val=number(p.valorTotal);add(direct,label,val);ensureMonth(a.dataEmissao).custos+=val;if(ve)ve.custos+=val;} }
    for(const p of pneus){const vid=p.instalacoes[0]?.veiculoId;if(filters.veiculoId&&vid!==filters.veiculoId)continue;const val=number(p.valorCompra);add(direct,"Pneus",val);ensureMonth(p.dataCompra).custos+=val;const veh=vid?vehicleById.get(vid):null;if(veh)getAgg(entity,normPlate(veh.placa),veh.placa).custos+=val;}
    for(const p of recapagens){const vid=p.pneu.instalacoes[0]?.veiculoId;if(filters.veiculoId&&vid!==filters.veiculoId)continue;const val=number(p.valor);add(direct,"Recapagens",val);ensureMonth(p.dataEnvio).custos+=val;}
    for(const p of consertos){const vid=p.pneu.instalacoes[0]?.veiculoId;if(filters.veiculoId&&vid!==filters.veiculoId)continue;const val=number(p.valor);add(direct,"Pneus",val);ensureMonth(p.data).custos+=val;}
    for(const os of ordens){if(filters.veiculoId&&os.veiculoId!==filters.veiculoId)continue;const val=maintenanceDreValue(os);if(!val)continue;add(direct,String(os.tipo).toUpperCase().includes("PREVENT")?"Manutenção preventiva":"Manutenção corretiva",val);if(os.dataConclusao)ensureMonth(os.dataConclusao).custos+=val;const veh=vehicleById.get(os.veiculoId);if(veh)getAgg(entity,normPlate(veh.placa),veh.placa).custos+=val;}

    for(const f of financeiros){
      if(filters.centroCustoId&&f.centroCustoId!==filters.centroCustoId)continue;if(filters.clienteId&&f.clienteId&&f.clienteId!==filters.clienteId)continue;if(filters.veiculoId&&f.veiculoId&&f.veiculoId!==filters.veiculoId)continue;if(filters.viagemId&&f.viagemId&&f.viagemId!==filters.viagemId)continue;if(filters.viagemId&&f.viagemId&&!tripIds.has(f.viagemId))continue;
      if(ciotScopeActive){const byVeh=f.veiculoId&&ciotVehicleIds.has(f.veiculoId);const byCli=f.clienteId&&ciotClientIds.has(f.clienteId);const byTrip=f.viagemId&&tripIds.has(f.viagemId);if(!byVeh&&!byCli&&!byTrip)continue;}
      const val=number(f.valor); if(f.tipo==="RECEITA"){ if(isDeduction(f.categoria))add(deductions,deductionCategory(f.categoria),val); else if(!includes(f.categoria,["FRETE"])) { grossRevenue+=val;ensureMonth(f.dataCompetencia).receita+=val; } continue; }
      if(isDeduction(f.categoria)){add(deductions,deductionCategory(f.categoria),val);continue;} if(isDepreciation(f.categoria)){add(depreciation,depreciationCategory(f.categoria),val);continue;} if(isIndirect(f.categoria)){add(indirect,indirectCategory(f.categoria),val);continue;}
      if(isFuel(f.categoria)||includes(f.categoria,["COMISSAO","MANUTENCAO"]))continue;
      const label=directCategory(f.categoria);add(direct,label,val);ensureMonth(f.dataCompetencia).custos+=val;
    }

    const deductionsTotal=Array.from(deductions.values()).reduce((a,b)=>a+b,0), netRevenue=grossRevenue-deductionsTotal;
    const directTotal=Array.from(direct.values()).reduce((a,b)=>a+b,0), contribution=netRevenue-directTotal;
    const indirectTotal=Array.from(indirect.values()).reduce((a,b)=>a+b,0), ebitda=contribution-indirectTotal;
    const depreciationTotal=Array.from(depreciation.values()).reduce((a,b)=>a+b,0), result=ebitda-depreciationTotal;
    const avgTicket=tripCount?grossRevenue/tripCount:0;
    for(const m of monthly.values()){m.ebitda=m.receita-m.custos-indirectTotal/Math.max(monthly.size,1);m.resultado=m.ebitda-depreciationTotal/Math.max(monthly.size,1);}
    const finish=(map:typeof entity)=>Array.from(map.values()).map(x=>{const resultado=x.receita-x.custos;return{id:x.id,nome:x.nome,receita:x.receita,custos:x.custos,resultado,margem:x.receita?resultado/x.receita*100:0,km:x.km,viagens:x.viagens.size}}).sort((a,b)=>b.resultado-a.resultado);
    const veiculosRank=finish(entity), clientesRank=finish(client), motoristasRank=finish(driver);
    const filiaisRank=acceptedCiots.reduce((acc,c)=>{const id=c.empresaId||"sem-filial",nome=c.empresa?.nomeFantasia||c.empresa?.razaoSocial||"Sem filial";const rev=c.ctes.reduce((s,x)=>s+number(x.valorFrete),0);const row=acc.get(id)||{id,nome,receita:0,custos:0,resultado:0,margem:0};row.receita+=rev;row.resultado=row.receita;row.margem=row.receita?100:0;acc.set(id,row);return acc},new Map<string,any>());

    const cteDocs = acceptedCiots.flatMap(c=>c.ctes.map(x=>({id:x.id,numero:x.numero,chave:x.chave,filialId:c.empresaId||"",filial:c.empresa?.nomeFantasia||c.empresa?.razaoSocial||"",valor:number(x.valorFrete)})));
    const directRows=toRows(direct), indirectRows=toRows(indirect), deductionRows=toRows(deductions), depreciationRows=toRows(depreciation);
    return {
      periodo:{from:r.from,to:r.to,dias:r.days},
      cobertura:{fonteReceita:"Romaneios + receitas financeiras não classificadas como frete",cte:"CT-e é usado como documento/dimensão quando disponível; não é somado novamente à receita para evitar duplicidade com Romaneios.",indisponiveis:["Grupo de clientes (sem campo próprio no cadastro atual)","Frota (sem campo próprio no cadastro atual)","Gestor responsável (sem campo próprio no cadastro atual)"]},
      filtros:{clientes,filiais:empresas,centrosCusto:centros,veiculos,motoristas,tiposOperacao:["LOTACAO","FRACIONADA","TAC_AGREGADO"],tiposVeiculo:["CAMINHAO","CARRO","MOTO"],cidadesOrigem:Array.from(new Set([...viagens.map(v=>v.cidadeOrigem),...ciots.map(c=>c.origemCidade)].filter(Boolean))).sort(),cidadesDestino:Array.from(new Set([...viagens.map(v=>v.cidadeEntrega),...ciots.map(c=>c.destinoCidade)].filter(Boolean))).sort(),ufsOrigem:Array.from(new Set(ciots.map(c=>c.origemUf).filter(Boolean))).sort(),ufsDestino:Array.from(new Set(ciots.map(c=>c.destinoUf).filter(Boolean))).sort(),viagens:viagens.map(v=>({id:v.id,label:v.codigo||`${dateOnly(v.dataManifesto)} · ${v.placa}`})),ctes:cteDocs,cargas:Array.from(new Set(manifestos.flatMap(m=>m.romaneios.split(/[,;\s]+/)).map(x=>x.trim()).filter(Boolean))).slice(0,500)},
      kpis:{receitaBruta:grossRevenue,receitaLiquida:netRevenue,custosDiretos:directTotal,custosIndiretos:indirectTotal,ebitda,resultadoOperacional:result,margemOperacional:grossRevenue?result/grossRevenue*100:0,margemEbitda:netRevenue?ebitda/netRevenue*100:0,custoKm:totalKm?(directTotal+indirectTotal+depreciationTotal)/totalKm:0,receitaKm:totalKm?grossRevenue/totalKm:0,lucroKm:totalKm?result/totalKm:0,ticketMedio:avgTicket,faturamentoVeiculo:veiculosRank.length?grossRevenue/veiculosRank.length:0,rentabilidadeCliente:clientesRank.length?clientesRank.reduce((s,x)=>s+x.margem,0)/clientesRank.length:0,km:totalKm,viagens:tripCount},
      dre:[
        {id:"receita-bruta",label:"1. Receita Bruta de Frete",tipo:"subtotal",valor:grossRevenue,filhos:[{label:"Fretes / Romaneios",valor:grossRevenue}]},
        {id:"deducoes",label:"2. Deduções da Receita",tipo:"custo",valor:deductionsTotal,filhos:deductionRows},
        {id:"receita-liquida",label:"3. Receita Operacional Líquida",tipo:"resultado",valor:netRevenue,filhos:[]},
        {id:"custos-diretos",label:"4. Custos Operacionais Diretos",tipo:"custo",valor:directTotal,filhos:directRows},
        {id:"margem-contribuicao",label:"5. Margem de Contribuição",tipo:"resultado",valor:contribution,filhos:[]},
        {id:"custos-indiretos",label:"6. Custos Indiretos Operacionais",tipo:"custo",valor:indirectTotal,filhos:indirectRows},
        {id:"ebitda",label:"7. EBITDA Operacional",tipo:"resultado",valor:ebitda,filhos:[]},
        {id:"depreciacao",label:"8. Depreciação e Amortização",tipo:"custo",valor:depreciationTotal,filhos:depreciationRows},
        {id:"resultado",label:"9. Resultado Operacional",tipo:"resultado",valor:result,filhos:[]},
      ],
      seriesMensais:Array.from(monthly.values()).sort((a,b)=>a.mes.localeCompare(b.mes)),
      rankings:{clientesMais:clientesRank.slice(0,10),clientesMenos:[...clientesRank].sort((a,b)=>a.resultado-b.resultado).slice(0,10),filiais:Array.from(filiaisRank.values()).sort((a:any,b:any)=>b.resultado-a.resultado),motoristas:motoristasRank.slice(0,10),veiculos:veiculosRank.slice(0,10)},
      custosPorCategoria:directRows,
      receitaCustoResultado:Array.from(monthly.values()).sort((a,b)=>a.mes.localeCompare(b.mes)).map(x=>({mes:x.mes,receita:x.receita,custo:x.custos,resultado:x.resultado})),
    };
  },

  async detalhes(filters: DreFilters & { tipo?: string; categoria?: string }) {
    const r=range(filters); const tipo=asStr(filters.tipo); const cat=asStr(filters.categoria);
    const filterVehicle=filters.veiculoId?await prisma.veiculo.findUnique({where:{id:filters.veiculoId},select:{id:true,placa:true}}):null;
    if(tipo==="receita"){
      const rows=await prisma.manifesto.findMany({where:{dataManifesto:r.date,...(filters.clienteId?{clienteId:filters.clienteId}:{}),...(filterVehicle?{placaVeiculo:filterVehicle.placa}:{})},select:{id:true,dataManifesto:true,placaVeiculo:true,romaneios:true,notasFiscais:true,cliente:{select:{nomeFantasia:true}},produtos:{select:{valorTotal:true,romaneio:true,notaFiscal:true}}},orderBy:{dataManifesto:"desc"},take:200});
      return rows.map(x=>({id:x.id,data:dateOnly(x.dataManifesto),tipo:"Receita",categoria:"Frete",cliente:x.cliente.nomeFantasia,documento:x.notasFiscais||x.produtos.map(p=>p.notaFiscal).filter(Boolean).join(", "),viagem:x.romaneios||x.produtos.map(p=>p.romaneio).filter(Boolean).join(", "),placa:x.placaVeiculo,valor:x.produtos.reduce((sum,p)=>sum+number(p.valorTotal),0)}));
    }
    const out:any[]=[]; const wants=(...terms:string[])=>!cat||terms.some(t=>norm(cat).includes(norm(t))||norm(t).includes(norm(cat)));
    if(wants("Combustível","ARLA","Diesel")){
      const rows=await prisma.abastecimento.findMany({where:{dataEmissao:r.date,...(filterVehicle?{veiculoId:filterVehicle.id}:{})},select:{id:true,dataEmissao:true,numeroNfe:true,veiculo:{select:{placa:true}},produtos:{select:{id:true,valorTotal:true,produto:{select:{nome:true}}}}},orderBy:{dataEmissao:"desc"},take:120});
      for(const a of rows)for(const p of a.produtos){if(!isFuel(p.produto.nome))continue;const label=includes(p.produto.nome,["ARLA"])?"ARLA":"Combustível";if(cat&&norm(label)!==norm(cat)&&!norm(cat).includes("DIESEL"))continue;out.push({id:`${a.id}-${p.id}`,data:dateOnly(a.dataEmissao),tipo:"Custo",categoria:label,cliente:"",documento:a.numeroNfe,viagem:"",placa:a.veiculo.placa,valor:number(p.valorTotal),descricao:p.produto.nome});}
    }
    if(wants("Pedágios pagos","Diárias","Ajudantes","Comissão de motorista","Despesas de viagem","Outros custos diretos")){
      const rows=await prisma.viagem.findMany({where:{dataManifesto:r.date,...(filters.viagemId?{id:filters.viagemId}:{}),...(filters.motoristaId?{motoristaId:filters.motoristaId}:{}),...(filters.clienteId?{clienteId:filters.clienteId}:{}),...(filterVehicle?{placa:filterVehicle.placa}:{})},select:{id:true,codigo:true,dataManifesto:true,placa:true,valorPedagio:true,valorDiaria:true,valorChapa:true,valorComissao:true,valorCustoExtra:true,valorMulta:true},orderBy:{dataManifesto:"desc"},take:120});
      for(const v of rows){for(const [label,val] of [["Pedágios pagos",v.valorPedagio],["Diárias",v.valorDiaria],["Ajudantes",v.valorChapa],["Comissão de motorista",v.valorComissao],["Despesas de viagem",v.valorCustoExtra],["Outros custos diretos",v.valorMulta]] as const){if(!number(val)||(cat&&norm(label)!==norm(cat)))continue;out.push({id:`${v.id}-${label}`,data:dateOnly(v.dataManifesto),tipo:"Custo",categoria:label,cliente:"",documento:"",viagem:v.codigo||v.id,placa:v.placa,valor:number(val)});}}
    }
    if(wants("Manutenção preventiva","Manutenção corretiva")){
      const rows=await prisma.ordemServico.findMany({where:{status:"CONCLUIDA",dataConclusao:r.date,...(filterVehicle?{veiculoId:filterVehicle.id}:{})},select:{id:true,numero:true,veiculoId:true,tipo:true,dataConclusao:true,valorPecas:true,valorMaoObra:true,valorOutros:true,desconto:true},orderBy:{dataConclusao:"desc"},take:120});
      const osVehicleIds=Array.from(new Set(rows.map(x=>x.veiculoId)));
      const osVehicles=filterVehicle?[filterVehicle]:(osVehicleIds.length?await prisma.veiculo.findMany({where:{id:{in:osVehicleIds}},select:{id:true,placa:true}}):[]);
      const osPlate=new Map(osVehicles.map(v=>[v.id,v.placa]));
      for(const os of rows){const label=String(os.tipo).toUpperCase().includes("PREVENT")?"Manutenção preventiva":"Manutenção corretiva";if(cat&&norm(label)!==norm(cat))continue;const val=maintenanceDreValue(os);if(val)out.push({id:os.id,data:os.dataConclusao?dateOnly(os.dataConclusao):"",tipo:"Custo",categoria:label,cliente:"",documento:os.numero,viagem:"",placa:osPlate.get(os.veiculoId)||"",valor:val});}
    }
    if(wants("Pneus","Recapagens")){
      const [pneusRows,recRows]=await Promise.all([
        prisma.pneu.findMany({where:{dataCompra:r.date},select:{id:true,dataCompra:true,valorCompra:true,numeroFogo:true,instalacoes:{where:{ativo:true},take:1,select:{veiculo:{select:{placa:true}}}}},orderBy:{dataCompra:"desc"},take:120}),
        prisma.pneuRecapagem.findMany({where:{dataEnvio:r.date},select:{id:true,dataEnvio:true,valor:true,pneu:{select:{numeroFogo:true,instalacoes:{where:{ativo:true},take:1,select:{veiculo:{select:{placa:true}}}}}}},orderBy:{dataEnvio:"desc"},take:120})
      ]);
      if(wants("Pneus")&&!cat||norm(cat)==="PNEUS")for(const x of pneusRows){const placa=x.instalacoes[0]?.veiculo.placa||"";if(filterVehicle&&normPlate(placa)!==normPlate(filterVehicle.placa))continue;out.push({id:x.id,data:dateOnly(x.dataCompra),tipo:"Custo",categoria:"Pneus",cliente:"",documento:x.numeroFogo,viagem:"",placa,valor:number(x.valorCompra)});}
      if(!cat||norm(cat)==="RECAPAGENS")for(const x of recRows){const placa=x.pneu.instalacoes[0]?.veiculo.placa||"";if(filterVehicle&&normPlate(placa)!==normPlate(filterVehicle.placa))continue;out.push({id:x.id,data:dateOnly(x.dataEnvio),tipo:"Custo",categoria:"Recapagens",cliente:"",documento:x.pneu.numeroFogo,viagem:"",placa,valor:number(x.valor)});}
    }
    const financial=await prisma.lancamentoFinanceiro.findMany({where:{dataCompetencia:r.date,tipo:"DESPESA",status:{not:"CANCELADO"},...(filters.clienteId?{clienteId:filters.clienteId}:{}),...(filterVehicle?{veiculoId:filterVehicle.id}:{}),...(filters.viagemId?{viagemId:filters.viagemId}:{}),...(filters.centroCustoId?{centroCustoId:filters.centroCustoId}:{})},select:{id:true,dataCompetencia:true,descricao:true,categoria:true,subcategoria:true,numeroDocumento:true,fornecedor:true,valor:true,veiculoId:true,viagemId:true},orderBy:{dataCompetencia:"desc"},take:200});
    const detailVehicleIds=Array.from(new Set(financial.map(x=>x.veiculoId).filter(Boolean) as string[]));
    const detailVehicles=detailVehicleIds.length?await prisma.veiculo.findMany({where:{id:{in:detailVehicleIds}},select:{id:true,placa:true}}):[];
    const detailPlate=new Map(detailVehicles.map(v=>[v.id,v.placa]));
    for(const x of financial){const labels=[x.categoria,directCategory(x.categoria),indirectCategory(x.categoria),deductionCategory(x.categoria),depreciationCategory(x.categoria)];if(cat&&!labels.some(l=>norm(l)===norm(cat)||norm(l).includes(norm(cat))))continue;out.push({id:x.id,data:dateOnly(x.dataCompetencia),tipo:"Custo",categoria:x.categoria,cliente:"",documento:x.numeroDocumento||x.fornecedor,viagem:x.viagemId||"",placa:x.veiculoId?detailPlate.get(x.veiculoId)||"":"",valor:number(x.valor),descricao:x.descricao});}
    return out.sort((a,b)=>String(b.data).localeCompare(String(a.data))).slice(0,200);
  }
};

