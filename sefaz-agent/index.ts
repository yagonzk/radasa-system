import "dotenv/config";
import { sefazDfeService } from "../server/services/sefaz-dfe.service.js";
import { prisma } from "../server/lib/prisma.js";

(globalThis as typeof globalThis & { __RADASA_SEFAZ_AGENT?: boolean }).__RADASA_SEFAZ_AGENT = true;

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL não configurada. Use o mesmo banco Neon do Radasa.");

const POLL_MS = Math.max(15_000, Number(process.env.SEFAZ_AGENT_POLL_SECONDS || 30) * 1000);
const AUTO_MS = Math.max(60_000, Number(process.env.SEFAZ_AGENT_AUTO_MINUTES || 90) * 60_000);
let lastAuto = 0;
let running = false;

async function heartbeat() {
  const companies = await prisma.empresa.findMany({ where: { ativa: true }, select: { id: true } });
  const now = new Date();
  for (const company of companies) {
    await prisma.sefazSyncState.upsert({
      where: { empresaId: company.id },
      create: { empresaId: company.id, agentLastSeenAt: now },
      update: { agentLastSeenAt: now },
    });
  }
}

async function syncUntilCaughtUp(empresaId: string) {
  let totalImported = 0;
  let totalReceived = 0;
  let batches = 0;
  let previousUltNsu = "";
  let lastResult: Awaited<ReturnType<typeof sefazDfeService.syncLocal>> | null = null;

  // Enquanto ultNSU < maxNSU, consumir sequencialmente os lotes sem esperar 1h30.
  // A espera de 1 hora passa a valer somente ao chegar ao fim da fila, cStat 137
  // ou cStat 656. O limite evita um loop infinito caso a SEFAZ não avance o NSU.
  while (batches < 100) {
    const result = await sefazDfeService.syncLocal(empresaId);
    lastResult = result;
    totalImported += result.imported;
    totalReceived += result.received;
    batches += 1;

    console.log("[sefaz-agent] lote processado", {
      empresaId,
      lote: batches,
      cStat: result.cStat,
      ultNsu: result.ultNsu,
      maxNsu: result.maxNsu,
      received: result.received,
      imported: result.imported,
      hasMore: result.hasMore,
      skippedCooldown: "skippedCooldown" in result ? result.skippedCooldown : false,
    });

    if (("skippedCooldown" in result && result.skippedCooldown) || !result.hasMore || result.cStat === "137" || result.cStat === "656") break;
    if (previousUltNsu && previousUltNsu === result.ultNsu) {
      console.warn("[sefaz-agent] NSU não avançou; drenagem interrompida para evitar Consumo Indevido.", { empresaId, ultNsu: result.ultNsu });
      break;
    }
    previousUltNsu = result.ultNsu;
    await new Promise((resolve) => setTimeout(resolve, 750));
  }

  return {
    imported: totalImported,
    received: totalReceived,
    batches,
    cStat: lastResult?.cStat ?? "",
    ultNsu: lastResult?.ultNsu ?? "",
    maxNsu: lastResult?.maxNsu ?? "",
    hasMore: lastResult?.hasMore ?? false,
  };
}

async function importPendingFuelInvoices() {
  const companies = await prisma.empresa.findMany({
    where: { ativa: true },
    select: { id: true, razaoSocial: true },
    orderBy: [{ empresaPadrao: "desc" }, { createdAt: "asc" }],
  });

  for (const company of companies) {
    try {
      const result = await sefazDfeService.retryPendingFuelImports(company.id, 50);
      if (result.checked || result.imported || result.normalized) {
        console.log("[sefaz-agent] fila local de abastecimentos", { empresaId: company.id, empresa: company.razaoSocial, ...result });
      }
    } catch (error) {
      console.warn(`[sefaz-agent] falha ao reprocessar abastecimentos de ${company.razaoSocial}:`, error instanceof Error ? error.message : error);
    }
  }
}

async function syncAllCompanies() {
  const companies = await prisma.empresa.findMany({
    where: { ativa: true, certificadoArquivo: { not: "" }, certificadoSenha: { not: "" } },
    select: { id: true, razaoSocial: true },
    orderBy: [{ empresaPadrao: "desc" }, { createdAt: "asc" }],
  });

  const results = [];
  for (const company of companies) {
    try {
      const result = await syncUntilCaughtUp(company.id);
      results.push({ empresaId: company.id, empresa: company.razaoSocial, ...result });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      console.warn(`[sefaz-agent] ${company.razaoSocial}: ${message}`);
      results.push({ empresaId: company.id, empresa: company.razaoSocial, imported: 0, received: 0, error: message });
    }
  }
  return results;
}

async function cycle() {
  if (running) return;
  running = true;
  try {
    await heartbeat();
    // A fila de XMLs completos já recebidos é reprocessada em TODO ciclo (30s por padrão).
    // Registros antigos presos em PENDENTE também são normalizados automaticamente:
    // resNFe vira AGUARDANDO_XML e XML completo termina como IMPORTADO/IGNORADO/ERRO.
    await importPendingFuelInvoices();
    const now = Date.now();
    const forceStates = await prisma.sefazSyncState.findMany({
      where: { forceRequestedAt: { not: null } },
      select: { empresaId: true, forceRequestedAt: true, lastQueryAt: true },
    });
    const forced = forceStates.filter((s) => s.forceRequestedAt && (!s.lastQueryAt || s.forceRequestedAt > s.lastQueryAt));

    if (forced.length) {
      for (const state of forced) {
        try {
          const r = await syncUntilCaughtUp(state.empresaId);
          console.log("[sefaz-agent] atualização solicitada concluída", state.empresaId, r);
        } catch (e) {
          console.warn("[sefaz-agent] atualização solicitada não executada", state.empresaId, e instanceof Error ? e.message : e);
        } finally {
          await prisma.sefazSyncState.update({ where: { empresaId: state.empresaId }, data: { forceRequestedAt: null, agentLastSeenAt: new Date() } }).catch(() => undefined);
        }
      }
    } else if (now - lastAuto >= AUTO_MS) {
      lastAuto = now;
      const results = await syncAllCompanies();
      console.log("[sefaz-agent] ciclo automático", results);
    }
  } catch (e) {
    console.error("[sefaz-agent] erro no ciclo", e);
  } finally {
    running = false;
  }
}

console.log(`[sefaz-agent] iniciado em loop. Fila local a cada ${POLL_MS/1000}s; tentativa de consulta SEFAZ a cada ${AUTO_MS/60000}min (respeitando cooldown oficial).`);
void cycle();
const timer = setInterval(() => void cycle(), POLL_MS);

async function shutdown(signal: string) {
  console.log(`[sefaz-agent] encerrando (${signal})`);
  clearInterval(timer);
  await prisma.$disconnect().catch(() => undefined);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
