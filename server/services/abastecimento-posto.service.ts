import { prisma } from "../lib/prisma.js";

export interface AbastecimentoEmitentePosto {
  emitenteCnpj?: string | null;
  emitenteRazaoSocial?: string | null;
  emitenteNomeFantasia?: string | null;
  emitenteEndereco?: string | null;
  emitenteCidade?: string | null;
  emitenteUf?: string | null;
}

function digits(value: unknown) {
  return String(value ?? "").replace(/\D/g, "");
}

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

function firstText(...values: unknown[]) {
  for (const value of values) {
    const text = String(value ?? "").trim();
    if (text) return text;
  }
  return "";
}

function enderecoFiscal(input: AbastecimentoEmitentePosto) {
  return [input.emitenteEndereco, input.emitenteCidade, input.emitenteUf]
    .map((value) => String(value ?? "").trim())
    .filter(Boolean)
    .join(" - ");
}

function codigoPosto(cnpj: string, nome: string) {
  if (cnpj.length === 14) return `POSTO-${cnpj.slice(-8)}`;

  const slug = normalizeText(nome)
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);

  return `POSTO-${slug || "SEM-CNPJ"}`;
}

function postoPayload(input: AbastecimentoEmitentePosto) {
  const cnpj = digits(input.emitenteCnpj);
  const nomeFantasia = firstText(
    input.emitenteNomeFantasia,
    input.emitenteRazaoSocial,
    cnpj ? `Posto ${cnpj}` : "",
  );
  const razaoSocial = firstText(input.emitenteRazaoSocial, nomeFantasia);

  return {
    cnpj,
    nomeFantasia,
    razaoSocial,
    codigoInterno: codigoPosto(cnpj, nomeFantasia || razaoSocial),
    email: "",
    telefone: "",
    enderecoFiscal: enderecoFiscal(input),
  };
}

/**
 * Resolve o posto exclusivamente pelo emitente da NF-e.
 * Quando há CNPJ no XML/PDF, nunca usa aproximação por palavras do nome: isso
 * evita que termos genéricos como COMERCIO/COMBUSTIVEIS associem a nota a outro posto.
 *
 * Pode ser executado dentro da mesma transação Prisma do lançamento.
 * A resolução prioriza CNPJ exato e evita aproximação por palavras.
 */
export async function resolveOrCreatePostoFromEmitente(
  tx: any,
  input: AbastecimentoEmitentePosto,
  fallbackClienteId?: string | null,
) {
  const payload = postoPayload(input);
  const cnpj = payload.cnpj;
  const nome = firstText(payload.nomeFantasia, payload.razaoSocial);

  if (cnpj.length === 14) {
    // Não usamos advisory lock aqui. Em conexões Neon/pooled/serverless esse
    // lock pode falhar ou prender a confirmação do XML, mesmo quando a
    // conferência já apareceu como COMPLETA. Primeiro reaproveitamos o posto
    // existente pelo CNPJ e só criamos quando realmente necessário.
    let existing = await tx.cliente.findFirst({
      where: { cnpj },
      select: {
        id: true,
        nomeFantasia: true,
        razaoSocial: true,
        enderecoFiscal: true,
      },
    });

    // Compatibilidade com cadastros antigos que possam ter CNPJ pontuado.
    if (!existing) {
      const legacyCandidates = await tx.cliente.findMany({
        where: { cnpj: { not: "" } },
        select: {
          id: true,
          cnpj: true,
          nomeFantasia: true,
          razaoSocial: true,
          enderecoFiscal: true,
        },
      });
      existing =
        legacyCandidates.find((candidate: any) => digits(candidate.cnpj) === cnpj) ??
        null;
    }

    if (existing) {
      const updates: Record<string, string> = {};
      if (!String(existing.nomeFantasia ?? "").trim() && payload.nomeFantasia) {
        updates.nomeFantasia = payload.nomeFantasia;
      }
      if (!String(existing.razaoSocial ?? "").trim() && payload.razaoSocial) {
        updates.razaoSocial = payload.razaoSocial;
      }
      if (!String(existing.enderecoFiscal ?? "").trim() && payload.enderecoFiscal) {
        updates.enderecoFiscal = payload.enderecoFiscal;
      }

      if (Object.keys(updates).length) {
        await tx.cliente.update({ where: { id: existing.id }, data: updates });
      }

      return existing.id as string;
    }

    const created = await tx.cliente.create({
      data: payload,
      select: { id: true },
    });
    return created.id as string;
  }

  // Sem CNPJ, só aceitamos correspondência EXATA de nome. Não há busca fuzzy.
  // Isso mantém PDFs antigos utilizáveis sem repetir o erro de vincular tudo ao
  // primeiro cliente que compartilha uma palavra genérica.
  if (nome) {
    const existing = await tx.cliente.findFirst({
      where: {
        OR: [
          { nomeFantasia: { equals: nome, mode: "insensitive" } },
          { razaoSocial: { equals: nome, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (existing) return existing.id as string;

    const created = await tx.cliente.create({
      data: payload,
      select: { id: true },
    });
    return created.id as string;
  }

  return String(fallbackClienteId ?? "").trim() || null;
}

let lastHistoricalSync = 0;
let runningHistoricalSync: Promise<void> | null = null;
const HISTORICAL_SYNC_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Corrige os abastecimentos já gravados usando os dados do emitente que já
 * estão preservados no próprio registro (CNPJ/razão/nome fantasia).
 */
export async function syncHistoricalAbastecimentoPostos(force = false) {
  const now = Date.now();
  if (!force && now - lastHistoricalSync < HISTORICAL_SYNC_INTERVAL_MS) return;
  if (runningHistoricalSync) return runningHistoricalSync;

  runningHistoricalSync = (async () => {
    const abastecimentos = await prisma.abastecimento.findMany({
      select: {
        id: true,
        clienteId: true,
        emitenteCnpj: true,
        emitenteRazaoSocial: true,
        emitenteNomeFantasia: true,
        emitenteEndereco: true,
        emitenteCidade: true,
        emitenteUf: true,
      },
      orderBy: { createdAt: "asc" },
    });

    const resolvedByIssuer = new Map<string, string>();

    for (const item of abastecimentos) {
      try {
        const cnpj = digits(item.emitenteCnpj);
        const nome = firstText(item.emitenteNomeFantasia, item.emitenteRazaoSocial);
        const issuerKey = cnpj.length === 14
          ? `CNPJ:${cnpj}`
          : nome
            ? `NOME:${normalizeText(nome)}`
            : "";

        if (!issuerKey) continue;

        let clienteId = resolvedByIssuer.get(issuerKey);
        if (!clienteId) {
          clienteId = await prisma.$transaction((tx) =>
            resolveOrCreatePostoFromEmitente(tx, item, item.clienteId),
          ) ?? undefined;
          if (!clienteId) continue;
          resolvedByIssuer.set(issuerKey, clienteId);
        }

        if (item.clienteId !== clienteId) {
          await prisma.abastecimento.update({
            where: { id: item.id },
            data: { clienteId },
          });
        }
      } catch (error) {
        // Um registro antigo malformado não pode impedir a correção dos demais.
        console.error(
          `[Abastecimentos] Falha ao corrigir posto do abastecimento ${item.id}:`,
          error,
        );
      }
    }

    lastHistoricalSync = Date.now();
  })();

  try {
    await runningHistoricalSync;
  } finally {
    runningHistoricalSync = null;
  }
}
