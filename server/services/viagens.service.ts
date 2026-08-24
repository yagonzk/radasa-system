import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { created, dateOnly, number } from "../utils/serialize.js";

const serialize = (item: any) => ({
  ...item,
  valorFrete: number(item.valorFrete), distanciaKm: number(item.distanciaKm),
  valorPedagio: number(item.valorPedagio), valorDiaria: number(item.valorDiaria),
  valorAbastecimento: number(item.valorAbastecimento), valorChapa: number(item.valorChapa),
  dataManifesto: dateOnly(item.dataManifesto), createdAt: created(item.createdAt),
});
const data = (input: any) => ({
  ...input,
  clienteId: input.clienteId ? String(input.clienteId) : null,
  dataManifesto: parseDateOnly(input.dataManifesto),
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
  async create(input: any) { await ensureMotoristaDisponivel(input.motoristaId); return serialize(await prisma.viagem.create({ data: data(input) })); },
  async update(id: string, input: any) { await ensureMotoristaDisponivel(input.motoristaId, id); const { createdAt, id: _id, ...rest } = data(input); return serialize(await prisma.viagem.update({ where: { id }, data: rest })); },
  async remove(id: string) { await prisma.viagem.delete({ where: { id } }); },
  async rentabilidade(id: string) {
    const viagem = await prisma.viagem.findUnique({ where: { id } });
    if (!viagem) throw new AppError(404, "Viagem não encontrada.");

    const lancamentos = await prisma.lancamentoFinanceiro.findMany({
      where: { viagemId: id, status: { not: "CANCELADO" } },
      orderBy: [{ dataCompetencia: "asc" }, { createdAt: "asc" }],
    });

    const frete = number(viagem.valorFrete);
    const custosBase = [
      { categoria: "Combustível", valor: number(viagem.valorAbastecimento) },
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
    const distanciaKm = number(viagem.distanciaKm);

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
