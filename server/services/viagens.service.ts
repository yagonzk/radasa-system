import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { created, dateOnly, number } from "../utils/serialize.js";
import { createHash } from "node:crypto";

const serialize = (item: any) => {
  const despesas = Array.isArray(item.despesasExtrato) ? item.despesasExtrato : [];
  const pedagioImportado = despesas.filter((x: any) => x.tipo === "PEDAGIO").reduce((s: number, x: any) => s + number(x.valor), 0);
  const chapaImportada = despesas.filter((x: any) => x.tipo === "CHAPA").reduce((s: number, x: any) => s + number(x.valor), 0);
  const valorPedagioManual = number(item.valorPedagio);
  const valorChapaManual = number(item.valorChapa);
  return {
    ...item,
    valorFrete: number(item.valorFrete), distanciaKm: number(item.distanciaKm),
    valorPedagioManual, valorChapaManual,
    valorPedagioImportado: pedagioImportado, valorChapaImportado: chapaImportada,
    valorPedagio: valorPedagioManual + pedagioImportado, valorDiaria: number(item.valorDiaria),
    valorAbastecimento: number(item.valorAbastecimento), valorChapa: valorChapaManual + chapaImportada,
    valorMulta: number(item.valorMulta), custoExtraTag: String(item.custoExtraTag || ""), valorCustoExtra: number(item.valorCustoExtra),
    despesasExtrato: despesas.map((x: any) => ({ ...x, valor: number(x.valor), data: dateOnly(x.data), createdAt: created(x.createdAt) })),
    kmSaida: item.kmSaida == null ? null : number(item.kmSaida), kmChegada: item.kmChegada == null ? null : number(item.kmChegada),
    dataManifesto: dateOnly(item.dataManifesto),
    dataSaida: item.dataSaida ? item.dataSaida.toISOString() : null,
    previsaoChegada: item.previsaoChegada ? item.previsaoChegada.toISOString() : null,
    dataChegada: item.dataChegada ? item.dataChegada.toISOString() : null,
    createdAt: created(item.createdAt),
  };
};
const data = (input: any) => {
  const result: any = {
    ...input,
    ...(Object.prototype.hasOwnProperty.call(input, "dataManifesto")
      ? { dataManifesto: parseDateOnly(input.dataManifesto) }
      : {}),
    createdAt: input.createdAt ? new Date(input.createdAt) : undefined,
  };

  // Acerto de Viagem: origem operacional padronizada e status removido do formulário.
  result.cidadeOrigem = "Ipiranga do Norte, MT";
  delete result.status;

  // Cliente foi removido do formulário de Viagens. Não force clienteId=null em edições:
  // bases antigas podem conservar um vínculo legado e o UPDATE deve preservar esse valor.
  if (!Object.prototype.hasOwnProperty.call(input, "clienteId")) delete result.clienteId;

  // A timeline operacional foi removida do cadastro de viagens.
  // Só altera estes campos em chamadas legadas que os enviarem explicitamente.
  if (Object.prototype.hasOwnProperty.call(input, "dataSaida")) result.dataSaida = input.dataSaida ? new Date(input.dataSaida) : null;
  if (Object.prototype.hasOwnProperty.call(input, "previsaoChegada")) result.previsaoChegada = input.previsaoChegada ? new Date(input.previsaoChegada) : null;
  if (Object.prototype.hasOwnProperty.call(input, "dataChegada")) result.dataChegada = input.dataChegada ? new Date(input.dataChegada) : null;
  if (Object.prototype.hasOwnProperty.call(input, "kmSaida")) result.kmSaida = input.kmSaida === "" || input.kmSaida == null ? null : input.kmSaida;
  if (Object.prototype.hasOwnProperty.call(input, "kmChegada")) result.kmChegada = input.kmChegada === "" || input.kmChegada == null ? null : input.kmChegada;

  return result;
};

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


const normalizeText = (value: unknown) => String(value ?? "")
  .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]+/g, " ").replace(/\s+/g, " ").trim();

const parseMoneyBR = (value: unknown) => {
  if (typeof value === "number") return Number.isFinite(value) ? Math.abs(value) : 0;

  let raw = String(value ?? "")
    .replace(/-?R\$/gi, "")
    .replace(/\s/g, "")
    .replace(/[^0-9,.-]/g, "");
  if (!raw) return 0;

  const negative = raw.startsWith("-");
  raw = raw.replace(/-/g, "");

  const lastComma = raw.lastIndexOf(",");
  const lastDot = raw.lastIndexOf(".");
  let normalized = raw;

  if (lastComma >= 0 && lastDot >= 0) {
    // O último separador é o decimal; o outro é separador de milhar.
    if (lastComma > lastDot) normalized = raw.replace(/\./g, "").replace(",", ".");
    else normalized = raw.replace(/,/g, "");
  } else if (lastComma >= 0) {
    // Formato brasileiro: 385,60 / 3.856,00.
    normalized = raw.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0) {
    const parts = raw.split(".");
    const decimalDigits = parts[parts.length - 1]?.length ?? 0;
    if (parts.length === 2 && decimalDigits >= 1 && decimalDigits <= 2) {
      // Planilhas XLSX podem chegar como 385.6 ou 385.60 mesmo no locale pt-BR.
      normalized = raw;
    } else {
      // 3.856 ou 1.234.567 sem vírgula: tratar como separador de milhar.
      normalized = raw.replace(/\./g, "");
    }
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return 0;
  return Math.abs(negative ? -n : n);
};

const parseTruckPagCsv = (text: string) => {
  const lines = String(text ?? "").replace(/^\uFEFF/, "").split(/\r?\n/);
  const header = lines.findIndex((line) => line.startsWith("Data;Hora;Lançamento;Colaborador;Descrição;Valor;"));
  if (header < 0) throw new AppError(400, "Arquivo TruckPag inválido: cabeçalho não encontrado.");
  const rows: any[] = [];
  for (const line of lines.slice(header + 1)) {
    if (!line.trim()) continue;
    const cols = line.split(";");
    if (cols.length < 6) continue;
    rows.push({ data: cols[0]?.trim(), hora: cols[1]?.trim(), lancamento: cols[2]?.trim(), colaborador: cols[3]?.trim(), descricao: cols[4]?.trim(), valor: cols[5]?.trim() });
  }
  return rows;
};

const classifyTruckPag = (row: any) => {
  if (normalizeText(row.lancamento) !== "SAIDA") return "IGNORAR";
  const valor = parseMoneyBR(row.valor);
  const desc = normalizeText(row.descricao);
  if (Math.abs(valor - 248) < 0.001) return "IGNORAR";
  if (desc.includes("PIX ENVIADO") && [150, 300, 600].some((v) => Math.abs(valor - v) < 0.001)) return "CHAPA";
  // Pedágio só pode ser classificado quando o estabelecimento/descrição identifica
  // explicitamente uma concessionária ou praça conhecida. Valor baixo, sozinho, NÃO
  // é evidência de pedágio (PIX, restaurante e outras compras pequenas causavam
  // somas indevidas de R$ 1.000+ em uma única viagem).
  const tollTerms = [
    "VIA BRASIL", "VIANORTESUL", "APASI CONCESSIONARIA", "CONCESSIONARIA ROTA",
    "ROTA DO OESTE", "ADMINISTRADORA DE PEDA", "ASSOCIACAO WAYMAR", "WAY 306",
    "NOVA ROTA DO OESTE", "MORRO DA MESA", "VIA 040", "ECOVIAS", "CCR"
  ];
  if (tollTerms.some((term) => desc.includes(term))) return "PEDAGIO";
  return "IGNORAR";
};

const parseBrDate = (value: string) => {
  const [d, m, y] = String(value).split("/").map(Number);
  if (!d || !m || !y) return null;
  const date = new Date(Date.UTC(y, m - 1, d));
  return Number.isNaN(date.getTime()) ? null : date;
};


const normalizePlate = (value: unknown) => String(value ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const parseImportDate = (value: unknown) => {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
  }
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const br = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (br) return new Date(Date.UTC(Number(br[3]), Number(br[2]) - 1, Number(br[1])));
  const iso = raw.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return new Date(Date.UTC(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3])));
  return null;
};

const optionalMoney = (row: any, keys: string[]) => {
  for (const key of keys) {
    if (!Object.prototype.hasOwnProperty.call(row ?? {}, key)) continue;
    const value = row?.[key];
    if (value === "" || value == null) return null;
    if (typeof value === "number") return Number.isFinite(value) ? Math.abs(value) : null;
    return parseMoneyBR(value);
  }
  return null;
};

const fingerprintExpense = (row: any, tipo: string) => createHash("sha256")
  .update([row.data, row.hora, row.colaborador, row.descricao, parseMoneyBR(row.valor).toFixed(2), tipo].join("|"))
  .digest("hex");

export const viagensService = {
  async list() { return (await prisma.viagem.findMany({ include: { despesasExtrato: true }, orderBy: { createdAt: "desc" } })).map(serialize); },
  async get(id: string) { const item = await prisma.viagem.findUnique({ where: { id }, include: { despesasExtrato: true } }); if (!item) throw new AppError(404, "Viagem não encontrada."); return serialize(item); },
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
  async update(id: string, input: any) {
    const atual = await prisma.viagem.findUnique({ where: { id }, select: { motoristaId: true } });
    if (!atual) throw new AppError(404, "Viagem não encontrada.");
    const motoristaId = input.motoristaId ?? atual.motoristaId;
    await ensureMotoristaDisponivel(motoristaId, id);
    const { createdAt, id: _id, clienteId: _clienteId, ...rest } = data(input);
    const item = await prisma.viagem.update({ where: { id }, data: rest });
    const veiculo = await prisma.veiculo.findFirst({ where: { placa: item.placa } });
    if (veiculo) {
      const sit = ["CARREGANDO", "EM_TRANSITO"].includes(item.status)
        ? "EM_VIAGEM"
        : ["ENTREGUE", "FINALIZADA", "CANCELADA"].includes(item.status)
          ? "DISPONIVEL"
          : veiculo.situacaoOperacional;
      await prisma.veiculo.update({ where: { id: veiculo.id }, data: { situacaoOperacional: sit } }).catch(() => undefined);
    }
    return serialize(item);
  },
  async remove(id: string) { await prisma.viagem.delete({ where: { id } }); },

  async importarCustosPorData(rows: any[]) {
    if (!Array.isArray(rows) || !rows.length) throw new AppError(400, "A planilha não possui linhas para importar.");

    const [viagens, motoristas] = await Promise.all([
      prisma.viagem.findMany({
        select: {
          id: true, codigo: true, placa: true, motoristaId: true, dataManifesto: true,
          valorPedagio: true, valorDiaria: true, valorChapa: true,
          despesasExtrato: { select: { tipo: true, valor: true } },
        },
      }),
      prisma.motorista.findMany({ select: { id: true, nome: true } }),
    ]);
    const motoristaNome = new Map(motoristas.map((m) => [m.id, m.nome]));

    let atualizadas = 0;
    const naoEncontradas: any[] = [];
    const ambiguas: any[] = [];
    const erros: any[] = [];

    for (let index = 0; index < rows.length; index += 1) {
      const row = rows[index] ?? {};
      const dataValue = row.DATA_VIAGEM ?? row.data_viagem ?? row.Data_Viagem ?? row.DATA ?? row.data ?? row["Data da Viagem"] ?? row["Data viagem"];
      const placaValue = row.PLACA ?? row.placa ?? row.Placa;
      const motoristaValue = row.MOTORISTA ?? row.motorista ?? row.Motorista;
      const dataViagem = parseImportDate(dataValue);
      const placaKey = normalizePlate(placaValue);
      const motoristaKey = normalizeText(motoristaValue);
      if (!dataViagem || !placaKey) {
        erros.push({ linha: index + 2, motivo: "Data da viagem ou placa inválida.", data: String(dataValue ?? ""), placa: String(placaValue ?? "") });
        continue;
      }

      let candidatos = viagens.filter((v) => v.dataManifesto.getTime() === dataViagem.getTime() && normalizePlate(v.placa) === placaKey);
      if (candidatos.length > 1 && motoristaKey) {
        const porMotorista = candidatos.filter((v) => {
          const nome = normalizeText(motoristaNome.get(v.motoristaId));
          return nome === motoristaKey || nome.includes(motoristaKey) || motoristaKey.includes(nome);
        });
        if (porMotorista.length) candidatos = porMotorista;
      }
      if (!candidatos.length) {
        naoEncontradas.push({ linha: index + 2, data: dateOnly(dataViagem), placa: String(placaValue ?? ""), motorista: String(motoristaValue ?? "") });
        continue;
      }
      if (candidatos.length > 1) {
        ambiguas.push({ linha: index + 2, data: dateOnly(dataViagem), placa: String(placaValue ?? ""), motorista: String(motoristaValue ?? ""), viagens: candidatos.map((v) => v.codigo || v.id) });
        continue;
      }

      const viagem = candidatos[0];
      const diaria = optionalMoney(row, ["DIARIA", "diaria", "Diária", "DIÁRIA", "valorDiaria", "VALOR_DIARIA"]);
      const chapa = optionalMoney(row, ["CHAPA", "chapa", "Chapa", "valorChapa", "VALOR_CHAPA"]);
      const pedagio = optionalMoney(row, ["PEDAGIO", "pedagio", "Pedágio", "PEDÁGIO", "valorPedagio", "VALOR_PEDAGIO"]);
      if (diaria == null && chapa == null && pedagio == null) {
        erros.push({ linha: index + 2, motivo: "Nenhum valor de diária, chapa ou pedágio encontrado." });
        continue;
      }

      const updateData: any = {};
      if (diaria != null) updateData.valorDiaria = diaria;
      if (pedagio != null) updateData.valorPedagio = pedagio;
      if (chapa != null) updateData.valorChapa = chapa;

      // A planilha de Acerto de Viagens é a fonte de verdade para estes três campos.
      // Se a viagem já possuir lançamentos TruckPag classificados anteriormente,
      // removemos apenas o tipo que está sendo sobrescrito para impedir soma dupla.
      // Assim, PEDAGIO=345,00 na planilha sempre termina em R$ 345,00 na viagem,
      // mesmo que uma importação antiga tenha associado lançamentos incorretos.
      await prisma.$transaction(async (tx) => {
        const tiposParaLimpar: string[] = [];
        if (pedagio != null) tiposParaLimpar.push("PEDAGIO");
        if (chapa != null) tiposParaLimpar.push("CHAPA");
        if (tiposParaLimpar.length) {
          await tx.viagemDespesaExtrato.deleteMany({
            where: { viagemId: viagem.id, tipo: { in: tiposParaLimpar } },
          });
        }
        await tx.viagem.update({ where: { id: viagem.id }, data: updateData });
      });
      atualizadas += 1;
    }

    return {
      atualizadas,
      naoEncontradas,
      ambiguas,
      erros,
      totalLinhas: rows.length,
      mensagem: `${atualizadas} viagem(ns) atualizada(s) automaticamente por data e placa.`,
    };
  },

  async previewExtratoTruckPag(arquivos: Array<{ nome?: string; texto?: string }>) {
    if (!Array.isArray(arquivos) || !arquivos.length) throw new AppError(400, "Selecione ao menos um extrato TruckPag.");
    const [motoristas, viagens, fingerprints] = await Promise.all([
      prisma.motorista.findMany({ select: { id: true, nome: true } }),
      prisma.viagem.findMany({ select: { id: true, codigo: true, motoristaId: true, placa: true, dataManifesto: true }, orderBy: { dataManifesto: "asc" } }),
      prisma.viagemDespesaExtrato.findMany({ select: { fingerprint: true } }),
    ]);
    const existing = new Set(fingerprints.map((x) => x.fingerprint));
    const items: any[] = [];
    let ignorados = 0;
    for (const arquivo of arquivos) {
      for (const row of parseTruckPagCsv(String(arquivo?.texto ?? ""))) {
        const tipo = classifyTruckPag(row);
        if (tipo === "IGNORAR") { ignorados += 1; continue; }
        const data = parseBrDate(row.data);
        if (!data) { ignorados += 1; continue; }
        const colaboradorNome = String(row.colaborador ?? "").split(" - Conta:")[0].trim();
        const colaboradorKey = normalizeText(colaboradorNome);
        const motorista = motoristas
          .map((m) => { const key = normalizeText(m.nome); const first = key.split(" ")[0]; let score = key === colaboradorKey ? 100 : 0; if (!score && first && colaboradorKey.includes(first)) score = 50 + first.length; return { ...m, score }; })
          .sort((a, b) => b.score - a.score)[0];
        const candidates = motorista?.score
          ? viagens.filter((v) => v.motoristaId === motorista.id && v.dataManifesto.getTime() <= data.getTime())
          : [];
        const candidate = candidates[candidates.length - 1];
        const gapDays = candidate ? Math.floor((data.getTime() - candidate.dataManifesto.getTime()) / 86400000) : null;
        const viagem = candidate && gapDays !== null && gapDays <= 10 ? candidate : null;
        const fingerprint = fingerprintExpense(row, tipo);
        items.push({
          fingerprint, arquivo: arquivo?.nome || "Extrato", data: dateOnly(data), hora: row.hora || "", tipo, valor: parseMoneyBR(row.valor),
          descricao: row.descricao || "", colaborador: colaboradorNome, motoristaId: motorista?.score ? motorista.id : null,
          viagemId: viagem?.id || null, viagemCodigo: viagem?.codigo || null, viagemData: viagem ? dateOnly(viagem.dataManifesto) : null, placa: viagem?.placa || null,
          diasDesdeInicio: viagem ? gapDays : null, duplicado: existing.has(fingerprint), status: existing.has(fingerprint) ? "DUPLICADO" : viagem ? "VINCULADO" : "REVISAR",
        });
      }
    }
    return {
      items,
      resumo: {
        total: items.length, ignorados, duplicados: items.filter((x) => x.duplicado).length, vinculados: items.filter((x) => x.status === "VINCULADO").length, revisar: items.filter((x) => x.status === "REVISAR").length,
        pedagios: items.filter((x) => x.tipo === "PEDAGIO").length, valorPedagios: items.filter((x) => x.tipo === "PEDAGIO").reduce((s, x) => s + x.valor, 0),
        chapas: items.filter((x) => x.tipo === "CHAPA").length, valorChapas: items.filter((x) => x.tipo === "CHAPA").reduce((s, x) => s + x.valor, 0),
      },
    };
  },
  async importarExtratoTruckPag(items: any[]) {
    if (!Array.isArray(items) || !items.length) throw new AppError(400, "Nenhum lançamento selecionado.");
    const valid = items.filter((x) => x?.viagemId && ["PEDAGIO", "CHAPA"].includes(String(x?.tipo)));
    if (!valid.length) throw new AppError(400, "Nenhum lançamento está vinculado a uma viagem.");
    const viagemIds = Array.from(new Set(valid.map((x) => String(x.viagemId))));
    const viagens = await prisma.viagem.findMany({ where: { id: { in: viagemIds } }, select: { id: true } });
    const allowed = new Set(viagens.map((v) => v.id));
    let importados = 0, duplicados = 0;
    for (const x of valid) {
      if (!allowed.has(String(x.viagemId))) continue;
      try {
        await prisma.viagemDespesaExtrato.create({ data: { viagemId: String(x.viagemId), tipo: String(x.tipo), data: parseDateOnly(String(x.data)), hora: String(x.hora || ""), valor: Number(x.valor || 0), descricao: String(x.descricao || ""), colaborador: String(x.colaborador || ""), origem: "TRUCKPAG", fingerprint: String(x.fingerprint) } });
        importados += 1;
      } catch (error: any) {
        if (String(error?.code) === "P2002") duplicados += 1; else throw error;
      }
    }
    return { importados, duplicados };
  },
  async despesasExtrato(id: string) {
    const rows = await prisma.viagemDespesaExtrato.findMany({ where: { viagemId: id }, orderBy: [{ data: "asc" }, { hora: "asc" }] });
    return rows.map((x) => ({ ...x, valor: number(x.valor), data: dateOnly(x.data), createdAt: created(x.createdAt) }));
  },
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
    const extrato = await prisma.viagemDespesaExtrato.findMany({ where: { viagemId: id }, select: { tipo: true, valor: true } });
    const pedagioImportado = extrato.filter((x) => x.tipo === "PEDAGIO").reduce((s, x) => s + number(x.valor), 0);
    const chapaImportada = extrato.filter((x) => x.tipo === "CHAPA").reduce((s, x) => s + number(x.valor), 0);
    const custosBase = [
      { categoria: "Combustível", valor: combustivelReal || number(viagem.valorAbastecimento) },
      { categoria: "Pedágio", valor: number(viagem.valorPedagio) + pedagioImportado },
      { categoria: "Diária", valor: number(viagem.valorDiaria) },
      { categoria: "Chapa", valor: number(viagem.valorChapa) + chapaImportada },
      { categoria: "Multas", valor: number(viagem.valorMulta) },
      { categoria: "Custo Extra", valor: number(viagem.valorCustoExtra) },
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
