import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { parseDateOnly } from "../utils/date.js";
import { dateOnly, number, created } from "../utils/serialize.js";

const d = (v: any) => v ? parseDateOnly(String(v)) : null;
const nonNegative = (v: unknown) => Math.max(0, number(v) || 0);
const nullableNumber = (v: unknown) => v === "" || v === null || v === undefined ? null : number(v);
const plano = (x: any) => ({
  ...x,
  intervaloKm: x.intervaloKm == null ? null : number(x.intervaloKm),
  ultimoKm: x.ultimoKm == null ? null : number(x.ultimoKm),
  proximoKm: x.proximoKm == null ? null : number(x.proximoKm),
  ultimaData: x.ultimaData ? dateOnly(x.ultimaData) : null,
  proximaData: x.proximaData ? dateOnly(x.proximaData) : null,
  createdAt: created(x.createdAt),
});

const supplierName = (x: any) => x?.fornecedorCadastro?.nomeFantasia || x?.fornecedorCadastro?.razaoSocial || x?.fornecedor || "";
const totalOs = (x: any) => Math.max(0, number(x.valorPecas) + number(x.valorMaoObra) + number(x.valorOutros) - number(x.desconto));
const notaMeta = (x: any) => ({
  id: x.id,
  numero: x.numero,
  serie: x.serie,
  chaveAcesso: x.chaveAcesso,
  dataEmissao: x.dataEmissao ? dateOnly(x.dataEmissao) : null,
  valor: number(x.valor),
  arquivoNome: x.arquivoNome,
  arquivoMime: x.arquivoMime,
  arquivoStored: Boolean(x.arquivoUrl),
  createdAt: created(x.createdAt),
});
const anexoMeta = (x: any) => ({
  id: x.id,
  tipo: x.tipo,
  descricao: x.descricao,
  arquivoNome: x.arquivoNome,
  arquivoMime: x.arquivoMime,
  arquivoStored: Boolean(x.arquivoUrl),
  createdAt: created(x.createdAt),
});

const os = (x: any) => ({
  ...x,
  fornecedor: supplierName(x),
  kmAbertura: x.kmAbertura == null ? null : number(x.kmAbertura),
  kmConclusao: x.kmConclusao == null ? null : number(x.kmConclusao),
  valorPecas: number(x.valorPecas),
  valorMaoObra: number(x.valorMaoObra),
  valorOutros: number(x.valorOutros),
  desconto: number(x.desconto),
  valorTotal: totalOs(x),
  dataAbertura: dateOnly(x.dataAbertura),
  dataConclusao: x.dataConclusao ? dateOnly(x.dataConclusao) : null,
  createdAt: created(x.createdAt),
  updatedAt: x.updatedAt?.toISOString?.() ?? x.updatedAt,
  itens: Array.isArray(x.itens) ? x.itens.map((item: any) => ({
    id: item.id,
    produtoId: item.produtoId,
    tipo: item.tipo,
    descricao: item.descricao || item.produto?.nome || "",
    quantidade: number(item.quantidade),
    valorUnitario: number(item.valorUnitario),
    valorTotal: number(item.valorTotal),
    produto: item.produto ? { id: item.produto.id, nome: item.produto.nome, codigoInterno: item.produto.codigoInterno } : null,
  })) : undefined,
  notasFiscais: Array.isArray(x.notasFiscais) ? x.notasFiscais.map(notaMeta) : undefined,
  anexos: Array.isArray(x.anexos) ? x.anexos.map(anexoMeta) : undefined,
  fornecedorCadastro: x.fornecedorCadastro ? {
    id: x.fornecedorCadastro.id,
    razaoSocial: x.fornecedorCadastro.razaoSocial,
    nomeFantasia: x.fornecedorCadastro.nomeFantasia,
    documento: x.fornecedorCadastro.documento,
    telefone: x.fornecedorCadastro.telefone,
  } : null,
});

const detailInclude = {
  fornecedorCadastro: { select: { id: true, razaoSocial: true, nomeFantasia: true, documento: true, telefone: true } },
  itens: { orderBy: { createdAt: "asc" as const }, include: { produto: { select: { id: true, nome: true, codigoInterno: true } } } },
  notasFiscais: { orderBy: { createdAt: "asc" as const } },
  anexos: { orderBy: { createdAt: "asc" as const } },
};

async function getOsDetail(id: string) {
  const item = await prisma.ordemServico.findUnique({ where: { id }, include: detailInclude });
  if (!item) throw new AppError(404, "OS não encontrada.");
  return os(item);
}

async function resolveFornecedor(i: any) {
  const fornecedorId = String(i.fornecedorId ?? "").trim() || null;
  if (!fornecedorId) return { fornecedorId: null, fornecedor: String(i.fornecedor ?? "").trim() };
  const found = await prisma.fornecedor.findUnique({ where: { id: fornecedorId }, select: { id: true, razaoSocial: true, nomeFantasia: true } });
  if (!found) throw new AppError(400, "Fornecedor cadastrado não encontrado.");
  return { fornecedorId: found.id, fornecedor: found.nomeFantasia || found.razaoSocial };
}

async function ensureVehicle(id: unknown) {
  const veiculoId = String(id ?? "").trim();
  if (!veiculoId) throw new AppError(400, "Selecione o veículo.");
  const exists = await prisma.veiculo.findUnique({ where: { id: veiculoId }, select: { id: true } });
  if (!exists) throw new AppError(400, "Veículo não encontrado.");
  return veiculoId;
}

function normalizeItems(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => {
    const produtoId = String(item.produtoId ?? "").trim() || null;
    const tipo = String(item.tipo ?? (produtoId ? "PECA" : "SERVICO")).trim().toUpperCase();
    const quantidade = Math.max(0, number(item.quantidade) || 0);
    const valorUnitario = Math.max(0, number(item.valorUnitario) || 0);
    return {
      produtoId,
      tipo: ["SERVICO", "PECA", "OUTRO"].includes(tipo) ? tipo : "OUTRO",
      descricao: String(item.descricao ?? "").trim(),
      quantidade,
      valorUnitario,
      valorTotal: quantidade * valorUnitario,
    };
  }).filter((item) => item.quantidade > 0 && (item.descricao || item.produtoId));
}

async function validateStock(items: ReturnType<typeof normalizeItems>) {
  for (const item of items) {
    if (!item.produtoId) continue;
    const movimentos = await prisma.estoqueMovimentacao.findMany({ where: { produtoId: item.produtoId }, select: { tipo: true, quantidade: true } });
    const saldo = movimentos.reduce((acc, mov) => acc + (mov.tipo === "ENTRADA" ? number(mov.quantidade) : -number(mov.quantidade)), 0);
    if (item.quantidade > saldo) throw new AppError(409, `Saldo insuficiente para uma das peças. Disponível: ${saldo}.`);
  }
}

function fileDataUrl(file: Express.Multer.File) {
  const mime = file.mimetype || "application/octet-stream";
  return `data:${mime};base64,${file.buffer.toString("base64")}`;
}

function decodeDataUrl(value: string) {
  const match = /^data:([^;,]+)?;base64,(.+)$/s.exec(value || "");
  if (!match) throw new AppError(404, "Arquivo não encontrado.");
  return { mime: match[1] || "application/octet-stream", buffer: Buffer.from(match[2], "base64") };
}

async function nextOsNumber() {
  const rows = await prisma.ordemServico.findMany({ select: { numero: true }, orderBy: { createdAt: "desc" }, take: 500 });
  const max = rows.reduce((current, row) => {
    const match = /OS-(\d+)/i.exec(row.numero || "");
    return match ? Math.max(current, Number(match[1]) || 0) : current;
  }, 0);
  return `OS-${String(max + 1).padStart(5, "0")}`;
}

export const manutencaoService = {
  async dashboard() {
    const [planos, ordens, docs, ab] = await Promise.all([
      prisma.planoManutencao.findMany({ where: { ativo: true } }),
      prisma.ordemServico.findMany(),
      prisma.documentoFrota.findMany(),
      prisma.abastecimento.findMany({ orderBy: { dataEmissao: "desc" } }),
    ]);
    const km = new Map<string, number>();
    for (const a of ab) if (!km.has(a.veiculoId)) km.set(a.veiculoId, number(a.hodometro));
    const limite = new Date(); limite.setDate(limite.getDate() + 30);
    const alertas: any[] = [];
    for (const p of planos) {
      const atual = km.get(p.veiculoId) || 0;
      if (p.proximoKm != null && number(p.proximoKm) - atual <= 2000) alertas.push({ tipo: "KM", veiculoId: p.veiculoId, titulo: p.nome, detalhe: `${Math.max(0, number(p.proximoKm) - atual).toFixed(0)} km restantes` });
      if (p.proximaData && p.proximaData <= limite) alertas.push({ tipo: "DATA", veiculoId: p.veiculoId, titulo: p.nome, detalhe: `Vence em ${dateOnly(p.proximaData)}` });
    }
    for (const x of docs) if (x.validade && x.validade <= limite) alertas.push({ tipo: "DOCUMENTO", veiculoId: x.veiculoId, titulo: x.tipo, detalhe: `Validade ${dateOnly(x.validade)}` });
    return {
      osAbertas: ordens.filter((x) => x.status !== "CONCLUIDA" && x.status !== "CANCELADA").length,
      planosAtivos: planos.length,
      alertas,
      documentos: docs.length,
      custoTotal: ordens.filter((x) => x.status === "CONCLUIDA").reduce((acc, x) => acc + totalOs(x), 0),
    };
  },
  async planos() { return (await prisma.planoManutencao.findMany({ orderBy: { createdAt: "desc" } })).map(plano); },
  async criarPlano(i: any) {
    const ultimoKm = i.ultimoKm === "" ? null : i.ultimoKm, intervaloKm = i.intervaloKm === "" ? null : i.intervaloKm;
    return plano(await prisma.planoManutencao.create({ data: { veiculoId: i.veiculoId, nome: i.nome, categoria: i.categoria || "PREVENTIVA", intervaloKm, intervaloDias: i.intervaloDias || null, ultimoKm, ultimaData: d(i.ultimaData), proximoKm: i.proximoKm || ((ultimoKm != null && intervaloKm != null) ? number(ultimoKm) + number(intervaloKm) : null), proximaData: d(i.proximaData), observacoes: i.observacoes || "" } }));
  },
  async removerPlano(id: string) { await prisma.planoManutencao.delete({ where: { id } }); },

  async ordens() {
    const rows = await prisma.ordemServico.findMany({
      orderBy: [{ dataAbertura: "desc" }, { createdAt: "desc" }],
      include: {
        fornecedorCadastro: { select: { id: true, razaoSocial: true, nomeFantasia: true, documento: true, telefone: true } },
        _count: { select: { itens: true, notasFiscais: true, anexos: true } },
      },
    });
    return rows.map((row: any) => ({ ...os(row), itensCount: row._count.itens, notasCount: row._count.notasFiscais, anexosCount: row._count.anexos, _count: undefined }));
  },
  async obterOs(id: string) { return getOsDetail(id); },
  async criarOs(i: any) {
    const veiculoId = await ensureVehicle(i.veiculoId);
    const items = normalizeItems(i.itens);
    await validateStock(items);
    const supplier = await resolveFornecedor(i);
    const valorPecasItens = items.filter((item) => item.tipo === "PECA").reduce((acc, item) => acc + item.valorTotal, 0);
    const valorServicosItens = items.filter((item) => item.tipo === "SERVICO").reduce((acc, item) => acc + item.valorTotal, 0);
    const valorOutrosItens = items.filter((item) => item.tipo === "OUTRO").reduce((acc, item) => acc + item.valorTotal, 0);
    const dataAbertura = parseDateOnly(String(i.dataAbertura));
    const numero = await nextOsNumber();

    const createdOrder = await prisma.$transaction(async (tx) => {
      const ordem = await tx.ordemServico.create({ data: {
        numero,
        numeroFornecedor: String(i.numeroFornecedor ?? "").trim(),
        veiculoId,
        tipo: String(i.tipo ?? "CORRETIVA").trim().toUpperCase(),
        status: String(i.status ?? "ABERTA").trim().toUpperCase(),
        descricao: String(i.descricao ?? "").trim(),
        servicoRealizado: String(i.servicoRealizado ?? "").trim(),
        responsavel: String(i.responsavel ?? "").trim(),
        fornecedorId: supplier.fornecedorId,
        fornecedor: supplier.fornecedor,
        kmAbertura: nullableNumber(i.kmAbertura),
        kmConclusao: nullableNumber(i.kmConclusao),
        dataAbertura,
        dataConclusao: d(i.dataConclusao),
        valorPecas: valorPecasItens + nonNegative(i.valorPecas),
        valorMaoObra: valorServicosItens + nonNegative(i.valorMaoObra),
        valorOutros: valorOutrosItens + nonNegative(i.valorOutros),
        desconto: nonNegative(i.desconto),
        observacoes: String(i.observacoes ?? "").trim(),
      } });
      for (const item of items) {
        await tx.ordemServicoItem.create({ data: { ordemServicoId: ordem.id, produtoId: item.produtoId, tipo: item.tipo, descricao: item.descricao, quantidade: item.quantidade, valorUnitario: item.valorUnitario, valorTotal: item.valorTotal } });
        if (item.produtoId) await tx.estoqueMovimentacao.create({ data: { produtoId: item.produtoId, tipo: "SAIDA", quantidade: item.quantidade, valorUnitario: item.valorUnitario, valorTotal: item.valorTotal, data: dataAbertura, observacoes: `Utilizado na ${ordem.numero}` } });
      }
      return ordem;
    });
    await prisma.veiculo.update({ where: { id: veiculoId }, data: { situacaoOperacional: "MANUTENCAO" } }).catch(() => undefined);
    return getOsDetail(createdOrder.id);
  },
  async atualizarOs(id: string, i: any) {
    const current = await prisma.ordemServico.findUnique({ where: { id }, include: { itens: true } });
    if (!current) throw new AppError(404, "OS não encontrada.");
    const supplier = ("fornecedorId" in i || "fornecedor" in i) ? await resolveFornecedor({ fornecedorId: i.fornecedorId ?? current.fornecedorId, fornecedor: i.fornecedor ?? current.fornecedor }) : { fornecedorId: current.fornecedorId, fornecedor: current.fornecedor };
    const nextVeiculoId = i.veiculoId !== undefined ? await ensureVehicle(i.veiculoId) : current.veiculoId;
    const hasItems = Array.isArray(i.itens);
    const items = hasItems ? normalizeItems(i.itens) : [];
    const dataAbertura = i.dataAbertura ? parseDateOnly(String(i.dataAbertura)) : current.dataAbertura;

    if (hasItems) {
      const oldByProduct = new Map<string, number>();
      for (const item of current.itens) if (item.produtoId) oldByProduct.set(item.produtoId, (oldByProduct.get(item.produtoId) || 0) + number(item.quantidade));
      for (const item of items) {
        if (!item.produtoId) continue;
        const movimentos = await prisma.estoqueMovimentacao.findMany({ where: { produtoId: item.produtoId }, select: { tipo: true, quantidade: true } });
        const saldoAtual = movimentos.reduce((acc, mov) => acc + (mov.tipo === "ENTRADA" ? number(mov.quantidade) : -number(mov.quantidade)), 0);
        const disponivelConsiderandoOsAtual = saldoAtual + (oldByProduct.get(item.produtoId) || 0);
        if (item.quantidade > disponivelConsiderandoOsAtual) throw new AppError(409, `Saldo insuficiente para uma das peças. Disponível: ${disponivelConsiderandoOsAtual}.`);
      }
    }

    const valorPecasItens = hasItems ? items.filter((item) => item.tipo === "PECA").reduce((acc, item) => acc + item.valorTotal, 0) : number(current.valorPecas);
    const valorServicosItens = hasItems ? items.filter((item) => item.tipo === "SERVICO").reduce((acc, item) => acc + item.valorTotal, 0) : number(current.valorMaoObra);
    const valorOutrosItens = hasItems ? items.filter((item) => item.tipo === "OUTRO").reduce((acc, item) => acc + item.valorTotal, 0) : number(current.valorOutros);

    await prisma.$transaction(async (tx) => {
      if (hasItems) {
        await tx.estoqueMovimentacao.deleteMany({ where: { observacoes: `Utilizado na ${current.numero}` } });
        await tx.ordemServicoItem.deleteMany({ where: { ordemServicoId: id } });
        for (const item of items) {
          await tx.ordemServicoItem.create({ data: { ordemServicoId: id, produtoId: item.produtoId, tipo: item.tipo, descricao: item.descricao, quantidade: item.quantidade, valorUnitario: item.valorUnitario, valorTotal: item.valorTotal } });
          if (item.produtoId) await tx.estoqueMovimentacao.create({ data: { produtoId: item.produtoId, tipo: "SAIDA", quantidade: item.quantidade, valorUnitario: item.valorUnitario, valorTotal: item.valorTotal, data: dataAbertura, observacoes: `Utilizado na ${current.numero}` } });
        }
      }
      await tx.ordemServico.update({ where: { id }, data: {
        ...(i.veiculoId !== undefined ? { veiculoId: nextVeiculoId } : {}),
        ...(i.numeroFornecedor !== undefined ? { numeroFornecedor: String(i.numeroFornecedor ?? "").trim() } : {}),
        ...(i.tipo !== undefined ? { tipo: String(i.tipo).trim().toUpperCase() } : {}),
        ...(i.status !== undefined ? { status: String(i.status).trim().toUpperCase() } : {}),
        ...(i.descricao !== undefined ? { descricao: String(i.descricao).trim() } : {}),
        ...(i.servicoRealizado !== undefined ? { servicoRealizado: String(i.servicoRealizado).trim() } : {}),
        ...(i.responsavel !== undefined ? { responsavel: String(i.responsavel).trim() } : {}),
        fornecedorId: supplier.fornecedorId,
        fornecedor: supplier.fornecedor,
        ...(i.kmAbertura !== undefined ? { kmAbertura: nullableNumber(i.kmAbertura) } : {}),
        ...(i.kmConclusao !== undefined ? { kmConclusao: nullableNumber(i.kmConclusao) } : {}),
        ...(i.dataAbertura ? { dataAbertura } : {}),
        ...(i.dataConclusao !== undefined ? { dataConclusao: d(i.dataConclusao) } : {}),
        ...(hasItems ? { valorPecas: valorPecasItens, valorMaoObra: valorServicosItens, valorOutros: valorOutrosItens } : {}),
        ...(i.desconto !== undefined ? { desconto: nonNegative(i.desconto) } : {}),
        ...(i.observacoes !== undefined ? { observacoes: String(i.observacoes).trim() } : {}),
      } });
    });

    const updated = await getOsDetail(id);
    if (nextVeiculoId !== current.veiculoId) {
      if (updated.status !== "CONCLUIDA" && updated.status !== "CANCELADA") await prisma.veiculo.update({ where: { id: nextVeiculoId }, data: { situacaoOperacional: "MANUTENCAO" } }).catch(() => undefined);
      const oldVehicleHasActiveOrder = await prisma.ordemServico.findFirst({ where: { veiculoId: current.veiculoId, id: { not: id }, status: { notIn: ["CONCLUIDA", "CANCELADA"] } }, select: { id: true } });
      if (!oldVehicleHasActiveOrder) await prisma.veiculo.update({ where: { id: current.veiculoId }, data: { situacaoOperacional: "DISPONIVEL" } }).catch(() => undefined);
    }
    if (updated.status === "CONCLUIDA") {
      const total = totalOs(updated);
      const financeData = { tipo: "DESPESA" as const, descricao: `Manutenção ${updated.numero} - ${updated.descricao.slice(0, 120)}`, categoria: "Manutenção", valor: total, dataCompetencia: parseDateOnly(String(updated.dataConclusao || updated.dataAbertura)), status: "PENDENTE" as const, veiculoId: updated.veiculoId, fornecedor: updated.fornecedor, numeroDocumento: updated.numero };
      const existing = await prisma.lancamentoFinanceiro.findFirst({ where: { numeroDocumento: updated.numero, categoria: "Manutenção" } });
      if (existing) await prisma.lancamentoFinanceiro.update({ where: { id: existing.id }, data: financeData });
      else if (total > 0) await prisma.lancamentoFinanceiro.create({ data: financeData });
    }
    return updated;
  },
  async removerOs(id: string) {
    const current = await prisma.ordemServico.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "OS não encontrada.");
    await prisma.$transaction(async (tx) => {
      await tx.estoqueMovimentacao.deleteMany({ where: { observacoes: `Utilizado na ${current.numero}` } });
      await tx.lancamentoFinanceiro.deleteMany({ where: { numeroDocumento: current.numero, categoria: "Manutenção" } });
      await tx.ordemServico.delete({ where: { id } });
    });
    const outraAtiva = await prisma.ordemServico.findFirst({ where: { veiculoId: current.veiculoId, status: { notIn: ["CONCLUIDA", "CANCELADA"] } }, select: { id: true } });
    if (!outraAtiva) await prisma.veiculo.update({ where: { id: current.veiculoId }, data: { situacaoOperacional: "DISPONIVEL" } }).catch(() => undefined);
  },
  async concluirOs(id: string, i: any) {
    const x = await prisma.ordemServico.findUnique({ where: { id } });
    if (!x) throw new AppError(404, "OS não encontrada.");
    const dataConclusao = parseDateOnly(String(i.dataConclusao || dateOnly(new Date())));
    const upd = await prisma.ordemServico.update({ where: { id }, data: {
      status: "CONCLUIDA",
      dataConclusao,
      kmConclusao: i.kmConclusao === undefined ? x.kmConclusao : nullableNumber(i.kmConclusao),
      servicoRealizado: i.servicoRealizado === undefined ? x.servicoRealizado : String(i.servicoRealizado ?? "").trim(),
      valorPecas: i.valorPecas ?? x.valorPecas,
      valorMaoObra: i.valorMaoObra ?? x.valorMaoObra,
      valorOutros: i.valorOutros ?? x.valorOutros,
      desconto: i.desconto ?? x.desconto,
    } });
    const total = totalOs(upd);
    await prisma.veiculo.update({ where: { id: upd.veiculoId }, data: { situacaoOperacional: "DISPONIVEL" } }).catch(() => undefined);
    if (total > 0) {
      const existing = await prisma.lancamentoFinanceiro.findFirst({ where: { numeroDocumento: upd.numero, categoria: "Manutenção" } });
      const financeData = { tipo: "DESPESA" as const, descricao: `Manutenção ${upd.numero} - ${upd.descricao.slice(0, 120)}`, categoria: "Manutenção", valor: total, dataCompetencia: dataConclusao, status: "PENDENTE" as const, veiculoId: upd.veiculoId, fornecedor: upd.fornecedor, numeroDocumento: upd.numero };
      if (existing) await prisma.lancamentoFinanceiro.update({ where: { id: existing.id }, data: financeData });
      else await prisma.lancamentoFinanceiro.create({ data: financeData });
    }
    return getOsDetail(id);
  },

  async adicionarNotaFiscal(id: string, i: any, file: Express.Multer.File) {
    await getOsDetail(id);
    const row = await prisma.ordemServicoNotaFiscal.create({ data: {
      ordemServicoId: id,
      numero: String(i.numero ?? "").trim(),
      serie: String(i.serie ?? "").trim(),
      chaveAcesso: String(i.chaveAcesso ?? "").replace(/\D/g, "").slice(0, 44),
      dataEmissao: d(i.dataEmissao),
      valor: nonNegative(i.valor),
      arquivoNome: file.originalname,
      arquivoMime: file.mimetype || "application/octet-stream",
      arquivoUrl: fileDataUrl(file),
    } });
    return notaMeta(row);
  },
  async removerNotaFiscal(id: string, notaId: string) {
    const row = await prisma.ordemServicoNotaFiscal.findFirst({ where: { id: notaId, ordemServicoId: id } });
    if (!row) throw new AppError(404, "Nota fiscal não encontrada.");
    await prisma.ordemServicoNotaFiscal.delete({ where: { id: notaId } });
  },
  async arquivoNotaFiscal(id: string, notaId: string) {
    const row = await prisma.ordemServicoNotaFiscal.findFirst({ where: { id: notaId, ordemServicoId: id } });
    if (!row) throw new AppError(404, "Nota fiscal não encontrada.");
    const decoded = decodeDataUrl(row.arquivoUrl);
    return { ...decoded, nome: row.arquivoNome || `nota-${notaId}` };
  },
  async adicionarAnexo(id: string, i: any, file: Express.Multer.File) {
    await getOsDetail(id);
    const row = await prisma.ordemServicoAnexo.create({ data: {
      ordemServicoId: id,
      tipo: String(i.tipo ?? "OUTRO").trim().toUpperCase(),
      descricao: String(i.descricao ?? "").trim(),
      arquivoNome: file.originalname,
      arquivoMime: file.mimetype || "application/octet-stream",
      arquivoUrl: fileDataUrl(file),
    } });
    return anexoMeta(row);
  },
  async removerAnexo(id: string, anexoId: string) {
    const row = await prisma.ordemServicoAnexo.findFirst({ where: { id: anexoId, ordemServicoId: id } });
    if (!row) throw new AppError(404, "Anexo não encontrado.");
    await prisma.ordemServicoAnexo.delete({ where: { id: anexoId } });
  },
  async arquivoAnexo(id: string, anexoId: string) {
    const row = await prisma.ordemServicoAnexo.findFirst({ where: { id: anexoId, ordemServicoId: id } });
    if (!row) throw new AppError(404, "Anexo não encontrado.");
    const decoded = decodeDataUrl(row.arquivoUrl);
    return { ...decoded, nome: row.arquivoNome || `anexo-${anexoId}` };
  },

  async documentos() { return (await prisma.documentoFrota.findMany({ orderBy: { validade: "asc" } })).map((x: any) => ({ ...x, validade: x.validade ? dateOnly(x.validade) : null, createdAt: created(x.createdAt) })); },
  async criarDocumento(i: any) { const x = await prisma.documentoFrota.create({ data: { veiculoId: i.veiculoId, tipo: i.tipo, numero: i.numero || "", validade: d(i.validade), observacoes: i.observacoes || "" } }); return { ...x, validade: x.validade ? dateOnly(x.validade) : null, createdAt: created(x.createdAt) }; },
  async removerDocumento(id: string) { await prisma.documentoFrota.delete({ where: { id } }); },
};
