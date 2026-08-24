import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { created, dateOnly, number } from "../utils/serialize.js";

const serialize = (item: any) => ({
  ...item,
  valorFrete: number(item.valorFrete), distanciaKm: number(item.distanciaKm),
  valorPedagio: number(item.valorPedagio), valorDiaria: number(item.valorDiaria),
  valorAbastecimento: number(item.valorAbastecimento), valorChapa: number(item.valorChapa),
  kmSaida: item.kmSaida == null ? null : number(item.kmSaida), kmChegada: item.kmChegada == null ? null : number(item.kmChegada),
  dataManifesto: dateOnly(item.dataManifesto),
  dataSaida: item.dataSaida ? item.dataSaida.toISOString() : null,
  previsaoChegada: item.previsaoChegada ? item.previsaoChegada.toISOString() : null,
  dataChegada: item.dataChegada ? item.dataChegada.toISOString() : null,
  createdAt: created(item.createdAt),
});
const data = (input: any) => ({
  ...input,
  clienteId: input.clienteId ? String(input.clienteId) : null,
  dataManifesto: parseDateOnly(input.dataManifesto),
  dataSaida: input.dataSaida ? new Date(input.dataSaida) : null,
  previsaoChegada: input.previsaoChegada ? new Date(input.previsaoChegada) : null,
  dataChegada: input.dataChegada ? new Date(input.dataChegada) : null,
  kmSaida: input.kmSaida === "" || input.kmSaida == null ? null : input.kmSaida,
  kmChegada: input.kmChegada === "" || input.kmChegada == null ? null : input.kmChegada,
  createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
});

async function ensureMotoristaDisponivel(motoristaId: string, viagemId?: string) {
  const motorista = await prisma.motorista.findUnique({
    where: { id: motoristaId },
    select: { status: true },
  });
  if (!motorista) throw new AppError(404, "Motorista não encontrado.");
  if (motorista.status === "ATIVO") return;

  if (viagemId) {
    const atual = await prisma.viagem.findUnique({
      where: { id: viagemId },
      select: { motoristaId: true },
    });
    if (atual?.motoristaId === motoristaId) return;
  }

  throw new AppError(409, "Motorista demitido não pode ser selecionado em uma nova viagem.");
}

export const viagensService = {
  async list() { return (await prisma.viagem.findMany({ orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.viagem.findUnique({ where: { id } }); if (!item) throw new AppError(404, "Viagem não encontrada."); return serialize(item); },
  async create(input: any) {
    await ensureMotoristaDisponivel(input.motoristaId);
    const count = await prisma.viagem.count();
    let codigo = input.codigo || `RAD-${String(count + 1).padStart(5, "0")}`;
    while (await prisma.viagem.findFirst({ where: { codigo }, select: { id: true } })) {
      codigo = `RAD-${String(Number(codigo.replace(/\D/g, "")) + 1).padStart(5, "0")}`;
    }
    const item=await prisma.viagem.create({ data: { ...data(input), codigo } });
    const veiculo=await prisma.veiculo.findFirst({where:{placa:input.placa}});if(veiculo&&["CARREGANDO","EM_TRANSITO"].includes(item.status))await prisma.veiculo.update({where:{id:veiculo.id},data:{situacaoOperacional:"EM_VIAGEM"}}).catch(()=>undefined);
    return serialize(item);
  },
  async update(id: string, input: any) { await ensureMotoristaDisponivel(input.motoristaId, id); const { createdAt, id: _id, ...rest } = data(input); const item=await prisma.viagem.update({ where: { id }, data: rest }); const veiculo=await prisma.veiculo.findFirst({where:{placa:item.placa}}); if(veiculo){const sit=["CARREGANDO","EM_TRANSITO"].includes(item.status)?"EM_VIAGEM":["ENTREGUE","FINALIZADA","CANCELADA"].includes(item.status)?"DISPONIVEL":veiculo.situacaoOperacional;await prisma.veiculo.update({where:{id:veiculo.id},data:{situacaoOperacional:sit}}).catch(()=>undefined)} return serialize(item); },
  async remove(id: string) { await prisma.viagem.delete({ where: { id } }); },
  async rentabilidade(id: string) {
    const viagem = await prisma.viagem.findUnique({ where: { id } });
    if (!viagem) throw new AppError(404, "Viagem não encontrada.");

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: { viagemId: id, status: { not: "CANCELADO" } },
      orderBy: [{ dataCompetencia: "asc" }, { createdAt: "asc" }],
    });

    const frete = number(viagem.valorFrete);
    const veiculos=await prisma.veiculo.findMany({select:{id:true,placa:true}});const norm=(v:any)=>String(v||"").replace(/[^A-Z0-9]/gi,"").toUpperCase();const veiculo=veiculos.find(v=>norm(v.placa)===norm(viagem.placa));
    let combustivelReal=0;if(veiculo){const inicio=viagem.dataSaida?new Date(viagem.dataSaida):new Date(`${dateOnly(viagem.dataManifesto)}T00:00:00Z`);const fim=viagem.dataChegada?new Date(viagem.dataChegada):new Date(inicio.getTime()+7*86400000);const abs=await prisma.abastecimento.findMany({where:{veiculoId:veiculo.id,dataEmissao:{gte:inicio,lte:fim}},select:{valorTotal:true}});combustivelReal=abs.reduce((a,x)=>a+number(x.valorTotal),0)}
    const custosBase = [
      { categoria: "Combustível", valor: combustivelReal || number(viagem.valorAbastecimento) },
      { categoria: "Pedágio", valor: number(viagem.valorPedagio) },
      { categoria: "Diária", valor: number(viagem.valorDiaria) },
      { categoria: "Chapa", valor: number(viagem.valorChapa) },
    ];
    const despesasBase = custosBase.reduce((total, item) => total + item.valor, 0);
    const receitasAdicionais = lancamentos
      .filter((item) => item.tipo === "RECEITA")
      .reduce((total, item) => total + number(item.valor), 0);
    const despesasFinanceiras = lancamentos
      .filter((item) => item.tipo === "DESPESA")
      .reduce((total, item) => total + number(item.valor), 0);
    const receitaTotal = frete + receitasAdicionais;
    const custoTotal = despesasBase + despesasFinanceiras;
    const lucro = receitaTotal - custoTotal;
    const distanciaPlanejada = number(viagem.distanciaKm);const distanciaReal=viagem.kmSaida!=null&&viagem.kmChegada!=null&&number(viagem.kmChegada)>number(viagem.kmSaida)?number(viagem.kmChegada)-number(viagem.kmSaida):0;const distanciaKm=distanciaReal||distanciaPlanejada;

    return {
      viagemId: id,
      clienteId: viagem.clienteId ?? null,
      receitaFrete: frete,
      receitasAdicionais,
      receitaTotal,
      despesasBase,
      despesasFinanceiras,
      custoTotal,
      lucro,
      margem: receitaTotal > 0 ? (lucro / receitaTotal) * 100 : 0,
      custoKm: distanciaKm > 0 ? custoTotal / distanciaKm : 0,
      lucroKm: distanciaKm > 0 ? lucro / distanciaKm : 0,
      distanciaPlanejada, distanciaReal, combustivelReal,
      custosBase,
      lancamentos: lancamentos.map((item) => ({
        id: item.id,
        tipo: item.tipo,
        descricao: item.descricao,
        categoria: item.categoria,
        valor: number(item.valor),
        status: item.status,
        dataCompetencia: dateOnly(item.dataCompetencia),
      })),
    };
  },
};
