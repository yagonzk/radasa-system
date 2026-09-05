import { prisma } from "../lib/prisma.js";
import { AppError } from "../utils/app-error.js";
import { created, dateOnly, number } from "../utils/serialize.js";
import { calcularValorAtualEstoque } from "./estoque-valuation.js";
import { parseEstoqueNfeXml } from "../../shared/estoque-nfe.js";

const serializeTipoProduto = (item: any) => ({
  ...item,
  createdAt: created(item.createdAt),
});

const serializeProduto = (item: any) => ({
  ...item,
  ncm: item.ncm ?? "",
  createdAt: created(item.createdAt),
});

const serialize = (item: any) => ({
  ...item,
  produto: item.produto ? serializeProduto(item.produto) : item.produto,
  quantidade: number(item.quantidade),
  valorUnitario: number(item.valorUnitario),
  valorTotal: number(item.valorTotal),
  data: dateOnly(item.data),
  fornecedor: item.notaFiscal?.fornecedor ?? null,
  chaveNfe: item.notaFiscal?.chave ?? "",
  numeroNfe: item.notaFiscal?.numero ?? "",
  serieNfe: item.notaFiscal?.serie ?? "",
  notaFiscalId: item.notaFiscalId ?? item.notaFiscal?.id ?? null,
  pdfUrl: item.pdfUrl ?? null,
  pdfName: item.pdfName ?? item.notaFiscal?.pdfName ?? null,
  pdfStored: Boolean(item.pdfUrl || item.notaFiscal?.pdfName),
  xmlUrl: item.xmlUrl ?? null,
  xmlName: item.xmlName ?? item.notaFiscal?.xmlName ?? null,
  xmlStored: Boolean(item.xmlUrl || item.notaFiscal?.xmlName),
  createdAt: created(item.createdAt),
});

function decodeXmlPayload(value: unknown) {
  const raw = String(value ?? "");
  if (!raw) throw new AppError(400, "Envie o XML da NF-e.");
  if (!raw.startsWith("data:")) return raw;
  const comma = raw.indexOf(",");
  if (comma < 0) throw new AppError(400, "XML da NF-e inválido.");
  const header = raw.slice(0, comma);
  const body = raw.slice(comma + 1);
  try {
    return header.includes(";base64") ? Buffer.from(body, "base64").toString("utf8") : decodeURIComponent(body);
  } catch {
    throw new AppError(400, "Não foi possível decodificar o XML da NF-e.");
  }
}

const onlyDigits = (value: unknown) => String(value ?? "").replace(/\D/g, "");
const cleanText = (value: unknown) => String(value ?? "").trim();

async function resolveCategoria(value: unknown) {
  const nome = String(value ?? "").trim();
  if (!nome) throw new AppError(400, "Informe o tipo de produto do almoxarifado.");

  const tipo = await prisma.estoqueTipoProduto.findFirst({
    where: { nome: { equals: nome, mode: "insensitive" } },
  });
  if (!tipo) throw new AppError(400, "Tipo de produto não cadastrado no almoxarifado.");
  return tipo.nome;
}

async function saldoProduto(produtoId: string, excludeId?: string) {
  const rows = await prisma.estoqueMovimentacao.findMany({
    where: { produtoId, ...(excludeId ? { id: { not: excludeId } } : {}) },
  });
  return rows.reduce(
    (total: number, row: any) =>
      total + (row.tipo === "ENTRADA" ? number(row.quantidade) : -number(row.quantidade)),
    0,
  );
}

export const estoqueService = {

  async listSubcategorias() {
    return prisma.estoqueSubcategoria.findMany({ orderBy: [{ categoria: "asc" }, { nome: "asc" }] });
  },

  async createSubcategoria(data: any) {
    const nome = String(data.nome ?? "").trim();
    const categoria = await resolveCategoria(data.categoria);
    if (!nome) throw new AppError(400, "Informe o nome da subcategoria.");
    const existente = await prisma.estoqueSubcategoria.findFirst({ where: { categoria, nome: { equals: nome, mode: "insensitive" } } });
    if (existente) throw new AppError(409, "Esta subcategoria já existe nesta categoria.");
    return prisma.estoqueSubcategoria.create({ data: { nome, categoria } });
  },

  async removeSubcategoria(id: string) {
    const item = await prisma.estoqueSubcategoria.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Subcategoria não encontrada.");
    const usados = await prisma.estoqueProduto.count({ where: { categoria: item.categoria, subcategoria: item.nome } });
    if (usados) throw new AppError(409, "Subcategoria em uso por produtos do almoxarifado.");
    await prisma.estoqueSubcategoria.delete({ where: { id } });
  },
  async listTiposProduto() {
    return (
      await prisma.estoqueTipoProduto.findMany({ orderBy: { nome: "asc" } })
    ).map(serializeTipoProduto);
  },

  async createTipoProduto(data: any) {
    const nome = String(data.nome ?? "").trim();
    if (!nome) throw new AppError(400, "Informe o nome do tipo de produto.");

    const existente = await prisma.estoqueTipoProduto.findFirst({
      where: { nome: { equals: nome, mode: "insensitive" } },
    });
    if (existente) throw new AppError(409, "Este tipo de produto já está cadastrado no almoxarifado.");

    const item = await prisma.estoqueTipoProduto.create({
      data: {
        ...(data.id ? { id: String(data.id) } : {}),
        nome,
        ...(data.createdAt ? { createdAt: new Date(data.createdAt) } : {}),
      },
    });
    return serializeTipoProduto(item);
  },

  async removeTipoProduto(id: string) {
    const item = await prisma.estoqueTipoProduto.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Tipo de produto não encontrado.");

    const produtosVinculados = await prisma.estoqueProduto.count({
      where: { categoria: item.nome },
    });
    if (produtosVinculados > 0) {
      throw new AppError(
        409,
        `O tipo "${item.nome}" está sendo usado por ${produtosVinculados} produto(s) e não pode ser removido.`,
      );
    }

    await prisma.estoqueTipoProduto.delete({ where: { id } });
  },

  async listProdutos() {
    return (
      await prisma.estoqueProduto.findMany({
        orderBy: [{ categoria: "asc" }, { nome: "asc" }, { codigoInterno: "asc" }],
      })
    ).map(serializeProduto);
  },

  async createProduto(data: any) {
    const categoria = await resolveCategoria(data.categoria);
    const nome = String(data.nome ?? "").trim();
    const subcategoria = String(data.subcategoria ?? "").trim();
    if (subcategoria) {
      const sub = await prisma.estoqueSubcategoria.findFirst({ where: { categoria, nome: { equals: subcategoria, mode: "insensitive" } } });
      if (!sub) throw new AppError(400, "Subcategoria não cadastrada para esta categoria.");
    }
    const quantidade = data.quantidade === undefined ? null : Number(data.quantidade);
    const valorUnitario = Number(data.valorUnitario || 0);
    const item = await prisma.$transaction(async (tx) => {
      const codigos = await tx.estoqueProduto.findMany({ where: { codigoInterno: { startsWith: "RAD-" } }, select: { codigoInterno: true } });
      const maiorNumero = codigos.reduce((maior: number, produto: { codigoInterno: string }) => { const m=/^RAD-(\d+)$/.exec(produto.codigoInterno.trim().toUpperCase()); return m ? Math.max(maior, Number(m[1]) || 0) : maior; }, 0);
      const codigoInterno = `RAD-${String(maiorNumero + 1).padStart(5, "0")}`;
      const produto = await tx.estoqueProduto.create({ data: { nome, codigoInterno, categoria, subcategoria } });
      if (quantidade && data.dataCompra) {
        await tx.estoqueMovimentacao.create({ data: { produtoId: produto.id, tipo: "ENTRADA", quantidade, valorUnitario, valorTotal: quantidade * valorUnitario, data: new Date(`${data.dataCompra}T12:00:00.000Z`), observacoes: data.observacoes || "", pdfUrl: data.pdfUrl || null, pdfName: data.pdfName || null, xmlUrl: data.xmlUrl || null, xmlName: data.xmlName || null } });
      }
      return produto;
    });
    return serializeProduto(item);
  },

  async updateProduto(id: string, data: any) {
    const atual = await prisma.estoqueProduto.findUnique({ where: { id } });
    if (!atual) throw new AppError(404, "Produto do almoxarifado não encontrado.");

    const categoria = data.categoria === undefined ? atual.categoria : await resolveCategoria(data.categoria);
    const { createdAt: _createdAt, codigoInterno: _codigoIgnorado, quantidade: _quantidade, valorUnitario: _valorUnitario, dataCompra: _dataCompra, observacoes: _observacoes, pdfUrl: _pdfUrl, pdfName: _pdfName, xmlUrl: _xmlUrl, xmlName: _xmlName, ...rest } = data;
    const item = await prisma.estoqueProduto.update({
      where: { id },
      data: {
        ...rest,
        categoria,
        ...(data.nome !== undefined ? { nome: String(data.nome).trim() } : {}),
        // Código interno é imutável após a criação para preservar a sequência RAD-00001...
        codigoInterno: atual.codigoInterno,
      },
    });
    return serializeProduto(item);
  },

  async removeProduto(id: string) {
    const item = await prisma.estoqueProduto.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Produto do almoxarifado não encontrado.");
    const movimentacoes = await prisma.estoqueMovimentacao.count({ where: { produtoId: id } });
    if (movimentacoes > 0) {
      throw new AppError(409, "Este produto possui movimentações e não pode ser excluído.");
    }
    await prisma.estoqueProduto.delete({ where: { id } });
  },

  async list() {
    return (
      await prisma.estoqueMovimentacao.findMany({
        include: { produto: true, notaFiscal: { select: { id: true, chave: true, numero: true, serie: true, xmlName: true, pdfName: true, fornecedor: true } } },
        orderBy: [{ data: "desc" }, { createdAt: "desc" }],
      })
    ).map(serialize);
  },

  async getNotaDocumento(id: string, tipo: "xml" | "pdf") {
    const select = tipo === "xml"
      ? { xmlUrl: true as const, xmlName: true as const }
      : { pdfUrl: true as const, pdfName: true as const };
    const nota = await prisma.estoqueNotaFiscal.findUnique({ where: { id }, select });
    if (!nota) throw new AppError(404, "Nota fiscal do Almoxarifado não encontrada.");
    const dataUrl = tipo === "xml" ? (nota as any).xmlUrl : (nota as any).pdfUrl;
    const name = tipo === "xml" ? (nota as any).xmlName : (nota as any).pdfName;
    if (!dataUrl) throw new AppError(404, `Arquivo ${tipo.toUpperCase()} não encontrado nesta nota fiscal.`);
    return { dataUrl, name: name || `nota_fiscal.${tipo}` };
  },

  async resumo() {
    const [produtos, movimentos] = await Promise.all([
      prisma.estoqueProduto.findMany({ orderBy: [{ categoria: "asc" }, { nome: "asc" }] }),
      prisma.estoqueMovimentacao.findMany(),
    ]);

    return produtos.map((produto: any) => {
      const rows = movimentos.filter((row: any) => row.produtoId === produto.id);
      const { entradas, saidas, estoque, valorEstoque } = calcularValorAtualEstoque(rows);

      return {
        produto: serializeProduto(produto),
        entradas,
        saidas,
        estoque,
        valorEstoque,
      };
    });
  },

  async importarNfe(data: any) {
    const xmlUrl = String(data.xmlUrl ?? "");
    let parsed;
    try {
      parsed = parseEstoqueNfeXml(decodeXmlPayload(xmlUrl));
    } catch (error: any) {
      throw new AppError(400, error?.message || "Não foi possível ler a NF-e.");
    }
    if (!parsed.chave) throw new AppError(400, "A NF-e não possui uma chave de acesso válida.");
    if (!parsed.fornecedor.documento || !parsed.fornecedor.razaoSocial) {
      throw new AppError(400, "Não foi possível identificar o fornecedor da NF-e.");
    }

    const configuracoes = Array.isArray(data.itens) ? data.itens : [];
    const selecionados = parsed.itens.filter((item) => {
      const cfg = configuracoes.find((x: any) => String(x.nItem) === item.nItem);
      return cfg ? cfg.incluir !== false : true;
    });
    if (!selecionados.length) throw new AppError(400, "Selecione ao menos um item da NF-e para importar.");

    return prisma.$transaction(async (tx: any) => {
      const notaExistente = await tx.estoqueNotaFiscal.findUnique({ where: { chave: parsed.chave }, select: { id: true } });
      if (notaExistente) throw new AppError(409, `A NF-e ${parsed.numero || parsed.chave} já foi importada no Almoxarifado.`);

      const documento = onlyDigits(parsed.fornecedor.documento);
      let fornecedor = await tx.fornecedor.findFirst({ where: { documento } });
      if (!fornecedor) {
        fornecedor = await tx.fornecedor.create({
          data: {
            razaoSocial: parsed.fornecedor.razaoSocial,
            nomeFantasia: parsed.fornecedor.nomeFantasia,
            documento,
            tipos: ["Almoxarifado"],
            telefone: parsed.fornecedor.telefone,
            endereco: parsed.fornecedor.endereco,
            cidade: parsed.fornecedor.cidade,
            uf: parsed.fornecedor.uf,
            observacoes: parsed.fornecedor.inscricaoEstadual ? `IE: ${parsed.fornecedor.inscricaoEstadual}` : "",
            ativo: true,
          },
        });
      } else {
        const tipos = Array.from(new Set([...(fornecedor.tipos || []), "Almoxarifado"]));
        fornecedor = await tx.fornecedor.update({
          where: { id: fornecedor.id },
          data: {
            tipos,
            nomeFantasia: fornecedor.nomeFantasia || parsed.fornecedor.nomeFantasia,
            telefone: fornecedor.telefone || parsed.fornecedor.telefone,
            endereco: fornecedor.endereco || parsed.fornecedor.endereco,
            cidade: fornecedor.cidade || parsed.fornecedor.cidade,
            uf: fornecedor.uf || parsed.fornecedor.uf,
          },
        });
      }

      const dataEmissao = parsed.dataEmissao || new Date().toISOString().slice(0, 10);
      const nota = await tx.estoqueNotaFiscal.create({
        data: {
          chave: parsed.chave,
          numero: parsed.numero,
          serie: parsed.serie,
          dataEmissao: new Date(`${dataEmissao}T12:00:00.000Z`),
          fornecedorId: fornecedor.id,
          xmlUrl,
          xmlName: cleanText(data.xmlName) || `NFe_${parsed.chave}.xml`,
          pdfUrl: data.pdfUrl || null,
          pdfName: cleanText(data.pdfName) || null,
        },
      });

      const codigos = await tx.estoqueProduto.findMany({ where: { codigoInterno: { startsWith: "RAD-" } }, select: { codigoInterno: true } });
      let proximoNumero = codigos.reduce((maior: number, produto: { codigoInterno: string }) => {
        const match = /^RAD-(\d+)$/.exec(produto.codigoInterno.trim().toUpperCase());
        return match ? Math.max(maior, Number(match[1]) || 0) : maior;
      }, 0) + 1;

      const resultados: any[] = [];
      for (const itemXml of selecionados) {
        const cfg = configuracoes.find((x: any) => String(x.nItem) === itemXml.nItem) ?? {};
        const categoria = await resolveCategoria(cfg.categoria ?? data.categoria);
        const subcategoria = cleanText(cfg.subcategoria ?? data.subcategoria);
        if (subcategoria) {
          const sub = await tx.estoqueSubcategoria.findFirst({ where: { categoria, nome: { equals: subcategoria, mode: "insensitive" } } });
          if (!sub) throw new AppError(400, `Subcategoria "${subcategoria}" não cadastrada para ${categoria}.`);
        }
        const nome = cleanText(cfg.nome) || itemXml.nome;
        const codigoFornecedor = itemXml.codigoFornecedor;

        let produto: any = null;
        if (codigoFornecedor) {
          const movimentoAnterior = await tx.estoqueMovimentacao.findFirst({
            where: { codigoFornecedor, notaFiscal: { fornecedorId: fornecedor.id } },
            select: { produto: true },
            orderBy: { createdAt: "desc" },
          });
          produto = movimentoAnterior?.produto ?? null;
        }
        if (!produto && itemXml.ncm) {
          produto = await tx.estoqueProduto.findFirst({
            where: { nome: { equals: nome, mode: "insensitive" }, ncm: itemXml.ncm },
          });
        }
        if (!produto) {
          produto = await tx.estoqueProduto.findFirst({ where: { nome: { equals: nome, mode: "insensitive" } } });
        }

        let criado = false;
        if (!produto) {
          const codigoInterno = `RAD-${String(proximoNumero++).padStart(5, "0")}`;
          produto = await tx.estoqueProduto.create({ data: { nome, codigoInterno, categoria, subcategoria, ncm: itemXml.ncm } });
          criado = true;
        } else if (!produto.ncm && itemXml.ncm) {
          produto = await tx.estoqueProduto.update({ where: { id: produto.id }, data: { ncm: itemXml.ncm } });
        }

        await tx.estoqueMovimentacao.create({
          data: {
            produtoId: produto.id,
            notaFiscalId: nota.id,
            tipo: "ENTRADA",
            quantidade: itemXml.quantidade,
            valorUnitario: itemXml.valorUnitario,
            valorTotal: itemXml.valorTotal || itemXml.quantidade * itemXml.valorUnitario,
            data: new Date(`${dataEmissao}T12:00:00.000Z`),
            observacoes: `NF-e ${parsed.numero || parsed.chave} · ${fornecedor.nomeFantasia || fornecedor.razaoSocial}`,
            codigoFornecedor,
            unidade: itemXml.unidade,
          },
        });
        resultados.push({ produtoId: produto.id, codigoInterno: produto.codigoInterno, nome: produto.nome, quantidade: itemXml.quantidade, criado });
      }

      return {
        chave: parsed.chave,
        numero: parsed.numero,
        fornecedor: { id: fornecedor.id, razaoSocial: fornecedor.razaoSocial, nomeFantasia: fornecedor.nomeFantasia, documento: fornecedor.documento },
        itens: resultados,
        criados: resultados.filter((x) => x.criado).length,
        atualizados: resultados.filter((x) => !x.criado).length,
      };
    });
  },

  async create(data: any) {
    const produto = await prisma.estoqueProduto.findUnique({ where: { id: data.produtoId } });
    if (!produto) throw new AppError(404, "Produto do almoxarifado não encontrado.");

    const quantidade = Number(data.quantidade);
    const valorUnitario = Number(data.valorUnitario || 0);
    if (data.tipo === "SAIDA") {
      const saldo = await saldoProduto(data.produtoId);
      if (quantidade > saldo) {
        throw new AppError(409, `Saldo insuficiente. Disponível: ${saldo.toLocaleString("pt-BR")}.`);
      }
    }

    const item = await prisma.estoqueMovimentacao.create({
      data: {
        ...data,
        quantidade,
        valorUnitario,
        valorTotal: quantidade * valorUnitario,
        data: new Date(`${data.data}T12:00:00.000Z`),
      },
      include: { produto: true },
    });
    return serialize(item);
  },

  async remove(id: string) {
    const item = await prisma.estoqueMovimentacao.findUnique({ where: { id } });
    if (!item) throw new AppError(404, "Movimentação não encontrada.");
    if (item.tipo === "ENTRADA") {
      const saldoSemEntrada = await saldoProduto(item.produtoId, id);
      if (saldoSemEntrada < 0) {
        throw new AppError(409, "Esta entrada não pode ser removida porque deixaria o saldo negativo.");
      }
    }
    await prisma.estoqueMovimentacao.delete({ where: { id } });
  },
};
