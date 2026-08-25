import { prisma } from "../lib/prisma.js";
import { interpretarAbastecimentoXml } from "./abastecimento-xml.service.js";
import { parseDateOnly } from "../utils/date.js";
import { dateOnly, number } from "../utils/serialize.js";

function normalizeKey(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
}

function fallbackKey(numero: string, serie: string, emitenteCnpj: string) {
  return `SEMCHAVE:${normalizeKey(emitenteCnpj)}:${normalizeKey(numero)}:${normalizeKey(serie)}`;
}

export const biNfeService = {
  async importarXml(items: Array<{ nome?: string; xml?: string }>) {
    if (!Array.isArray(items) || !items.length) {
      return { importadas: 0, atualizadas: 0, falhas: [] as Array<{ nome: string; erro: string }> };
    }
    if (items.length > 150) throw new Error("Importe no máximo 150 NF-e por lote.");

    let importadas = 0;
    let atualizadas = 0;
    const falhas: Array<{ nome: string; erro: string }> = [];

    for (const input of items) {
      const nome = String(input?.nome || "NF-e.xml");
      const xml = String(input?.xml || "");
      try {
        if (!xml.trim()) throw new Error("XML vazio.");
        const doc = interpretarAbastecimentoXml(xml);
        const chave = doc.chaveNfe || fallbackKey(doc.numero, doc.serie, doc.emitente.cnpj);
        const existing = await prisma.biNfe.findUnique({ where: { chave }, select: { id: true } });
        await prisma.biNfe.upsert({
          where: { chave },
          create: {
            chave,
            numero: doc.numero,
            serie: doc.serie,
            dataEmissao: doc.dataEmissao ? parseDateOnly(doc.dataEmissao) : null,
            emitenteCnpj: doc.emitente.cnpj,
            emitenteNome: doc.emitente.nomeFantasia || doc.emitente.razaoSocial,
            destinatarioCnpj: doc.destinatario.cnpjCpf,
            destinatarioNome: doc.destinatario.razaoSocial,
            valorProdutos: doc.totais.produtos,
            valorNota: doc.totais.nota,
            arquivoNome: nome,
            itens: {
              create: doc.produtos.map((p) => ({
                codigo: p.codigo,
                descricao: p.nome,
                ncm: p.ncm,
                cfop: p.cfop,
                unidade: p.unidade,
                quantidade: p.quantidade,
                valorUnitario: p.valorUnitario,
                valorTotal: p.valorTotal,
              })),
            },
          },
          update: {
            numero: doc.numero,
            serie: doc.serie,
            dataEmissao: doc.dataEmissao ? parseDateOnly(doc.dataEmissao) : null,
            emitenteCnpj: doc.emitente.cnpj,
            emitenteNome: doc.emitente.nomeFantasia || doc.emitente.razaoSocial,
            destinatarioCnpj: doc.destinatario.cnpjCpf,
            destinatarioNome: doc.destinatario.razaoSocial,
            valorProdutos: doc.totais.produtos,
            valorNota: doc.totais.nota,
            arquivoNome: nome,
            itens: {
              deleteMany: {},
              create: doc.produtos.map((p) => ({
                codigo: p.codigo,
                descricao: p.nome,
                ncm: p.ncm,
                cfop: p.cfop,
                unidade: p.unidade,
                quantidade: p.quantidade,
                valorUnitario: p.valorUnitario,
                valorTotal: p.valorTotal,
              })),
            },
          },
        });
        if (existing) atualizadas += 1;
        else importadas += 1;
      } catch (error: any) {
        falhas.push({ nome, erro: error?.message || "Não foi possível interpretar a NF-e." });
      }
    }

    return { importadas, atualizadas, falhas };
  },

  async itens() {
    const nfes = await prisma.biNfe.findMany({
      include: { itens: true },
      orderBy: [{ dataEmissao: "desc" }, { numero: "desc" }],
    });
    return nfes.flatMap((nfe) => nfe.itens.map((item) => ({
      id: item.id,
      nfeId: nfe.id,
      chave: nfe.chave,
      numero: nfe.numero,
      serie: nfe.serie,
      dataEmissao: nfe.dataEmissao ? dateOnly(nfe.dataEmissao) : "",
      emitenteCnpj: nfe.emitenteCnpj,
      emitenteNome: nfe.emitenteNome,
      destinatarioCnpj: nfe.destinatarioCnpj,
      destinatarioNome: nfe.destinatarioNome,
      codigo: item.codigo,
      descricao: item.descricao,
      ncm: item.ncm,
      cfop: item.cfop,
      unidade: item.unidade,
      quantidade: number(item.quantidade),
      valorUnitario: number(item.valorUnitario),
      valorTotal: number(item.valorTotal),
    })));
  },
};
