// dnit-agent/index.ts
import "dotenv/config";
import { chromium } from "playwright-core";

// server/lib/prisma.ts
import { AsyncLocalStorage as AsyncLocalStorage2 } from "node:async_hooks";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

// server/lib/runtime-bindings.ts
import { AsyncLocalStorage } from "node:async_hooks";
var runtimeBindings = new AsyncLocalStorage();
function getRuntimeDatabaseUrl() {
  return runtimeBindings.getStore()?.databaseUrl;
}

// server/lib/prisma.ts
var requestPrisma = new AsyncLocalStorage2();
var nodePrisma;
function connectionString() {
  const hyperdriveUrl = getRuntimeDatabaseUrl();
  if (hyperdriveUrl) return hyperdriveUrl;
  const value = process.env.DATABASE_URL;
  if (!value) throw new Error("DATABASE_URL n\xE3o foi configurada para o Prisma.");
  return value;
}
function isUsingHyperdrive() {
  return Boolean(getRuntimeDatabaseUrl());
}
function createPrismaClient(connection) {
  const adapter = new PrismaPg({
    connectionString: connection,
    // Hyperdrive já faz pooling global. O pequeno pool local só permite que
    // Promise.all dentro da mesma request execute algumas queries em paralelo.
    // Um pool local pequeno evita multiplicar conexões quando várias requests
    // chegam juntas. Com Hyperdrive, o pooling pesado acontece fora do Worker.
    max: isUsingHyperdrive() ? 2 : 1,
    connectionTimeoutMillis: 5e3,
    idleTimeoutMillis: 2e3
  });
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"]
  });
}
function currentPrisma() {
  const scoped = requestPrisma.getStore();
  if (scoped) {
    if (!scoped.client) scoped.client = createPrismaClient(connectionString());
    return scoped.client;
  }
  if (!nodePrisma) nodePrisma = createPrismaClient(connectionString());
  return nodePrisma;
}
var prisma = new Proxy({}, {
  get(_target, property) {
    const client = currentPrisma();
    const value = Reflect.get(client, property, client);
    return typeof value === "function" ? value.bind(client) : value;
  }
});

// server/utils/app-error.ts
var AppError = class extends Error {
  constructor(statusCode, message, details) {
    super(message);
    this.statusCode = statusCode;
    this.details = details;
    this.name = "AppError";
  }
};

// server/services/dnit-jobs.service.ts
var ready = null;
function ensureDnitTables() {
  if (ready) return ready;
  ready = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "dnit_consultas" (
      "id" TEXT PRIMARY KEY,
      "veiculoId" TEXT NOT NULL,
      "placa" TEXT NOT NULL,
      "renavam" TEXT NOT NULL,
      "status" TEXT NOT NULL DEFAULT 'PENDENTE',
      "mensagem" TEXT NOT NULL DEFAULT '',
      "erro" TEXT NOT NULL DEFAULT '',
      "multasEncontradas" INTEGER NOT NULL DEFAULT 0,
      "multasImportadas" INTEGER NOT NULL DEFAULT 0,
      "tentativas" INTEGER NOT NULL DEFAULT 0,
      "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "startedAt" TIMESTAMP(3),
      "completedAt" TIMESTAMP(3),
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "dnit_consultas_veiculo_status_idx" ON "dnit_consultas"("veiculoId", "status")`);
    await prisma.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "dnit_consultas_requested_idx" ON "dnit_consultas"("requestedAt")`);
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "dnit_agent_state" (
      "id" TEXT PRIMARY KEY,
      "lastSeenAt" TIMESTAMP(3),
      "status" TEXT NOT NULL DEFAULT 'OFFLINE',
      "mensagem" TEXT NOT NULL DEFAULT '',
      "currentJobId" TEXT,
      "version" TEXT NOT NULL DEFAULT '',
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`);
    await prisma.$executeRawUnsafe(`INSERT INTO "dnit_agent_state" ("id") VALUES ('main') ON CONFLICT ("id") DO NOTHING`);
  })().catch((error) => {
    ready = null;
    throw error;
  });
  return ready;
}
var rows = async (sql, ...values) => prisma.$queryRawUnsafe(sql, ...values);
var serialize = (r) => r ? {
  ...r,
  requestedAt: r.requestedAt?.toISOString?.() ?? r.requestedAt ?? null,
  startedAt: r.startedAt?.toISOString?.() ?? r.startedAt ?? null,
  completedAt: r.completedAt?.toISOString?.() ?? r.completedAt ?? null,
  updatedAt: r.updatedAt?.toISOString?.() ?? r.updatedAt ?? null,
  agentLastSeenAt: r.agentLastSeenAt?.toISOString?.() ?? r.agentLastSeenAt ?? null
} : null;
var dnitJobsService = {
  async create(veiculoId) {
    await ensureDnitTables();
    const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoId }, select: { id: true, placa: true, renavam: true } });
    if (!veiculo) throw new AppError(404, "Ve\xEDculo n\xE3o encontrado.");
    const placa = String(veiculo.placa || "").replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    const renavam = String(veiculo.renavam || "").replace(/\D/g, "");
    if (placa.length !== 7) throw new AppError(400, "A placa cadastrada \xE9 inv\xE1lida para consulta no SENATRAN.");
    const active = await rows(`SELECT * FROM "dnit_consultas" WHERE "veiculoId"=$1 AND "status" IN ('PENDENTE','CONSULTANDO','AGUARDANDO_LOGIN','AGUARDANDO_VALIDACAO') ORDER BY "requestedAt" DESC LIMIT 1`, veiculoId);
    if (active[0]) return serialize(active[0]);
    const id = crypto.randomUUID();
    const created2 = await rows(`INSERT INTO "dnit_consultas" ("id","veiculoId","placa","renavam","status","mensagem") VALUES ($1,$2,$3,$4,'PENDENTE','Aguardando agente SENATRAN') RETURNING *`, id, veiculoId, placa, renavam);
    return serialize(created2[0]);
  },
  async get(id) {
    await ensureDnitTables();
    const result = await rows(`SELECT c.*, a."lastSeenAt" AS "agentLastSeenAt", a."status" AS "agentStatus", a."mensagem" AS "agentMensagem" FROM "dnit_consultas" c LEFT JOIN "dnit_agent_state" a ON a."id"='main' WHERE c."id"=$1 LIMIT 1`, id);
    if (!result[0]) throw new AppError(404, "Consulta SENATRAN n\xE3o encontrada.");
    return serialize(result[0]);
  },
  async latest(veiculoId) {
    await ensureDnitTables();
    const result = veiculoId ? await rows(`SELECT c.*, a."lastSeenAt" AS "agentLastSeenAt", a."status" AS "agentStatus", a."mensagem" AS "agentMensagem" FROM "dnit_consultas" c LEFT JOIN "dnit_agent_state" a ON a."id"='main' WHERE c."veiculoId"=$1 ORDER BY c."requestedAt" DESC LIMIT 1`, veiculoId) : await rows(`SELECT c.*, a."lastSeenAt" AS "agentLastSeenAt", a."status" AS "agentStatus", a."mensagem" AS "agentMensagem" FROM "dnit_consultas" c LEFT JOIN "dnit_agent_state" a ON a."id"='main' ORDER BY c."requestedAt" DESC LIMIT 1`);
    return serialize(result[0]);
  },
  async claimNextJob() {
    await ensureDnitTables();
    return prisma.$transaction(async (tx) => {
      const found = await tx.$queryRawUnsafe(`SELECT * FROM "dnit_consultas" WHERE "status"='PENDENTE' ORDER BY "requestedAt" ASC FOR UPDATE SKIP LOCKED LIMIT 1`);
      if (!found[0]) return null;
      const updated = await tx.$queryRawUnsafe(`UPDATE "dnit_consultas" SET "status"='CONSULTANDO', "mensagem"='Consultando Portal de Servi\xE7os SENATRAN', "startedAt"=COALESCE("startedAt", CURRENT_TIMESTAMP), "tentativas"="tentativas"+1, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1 RETURNING *`, found[0].id);
      return updated[0] ?? null;
    });
  },
  async setJob(id, status, data = {}) {
    await ensureDnitTables();
    const final = ["CONCLUIDO", "SEM_MULTAS", "ERRO"].includes(status);
    await prisma.$executeRawUnsafe(`UPDATE "dnit_consultas" SET "status"=$2, "mensagem"=$3, "erro"=$4, "multasEncontradas"=COALESCE($5,"multasEncontradas"), "multasImportadas"=COALESCE($6,"multasImportadas"), "completedAt"=CASE WHEN $7 THEN CURRENT_TIMESTAMP ELSE "completedAt" END, "updatedAt"=CURRENT_TIMESTAMP WHERE "id"=$1`, id, status, data.mensagem ?? "", data.erro ?? "", data.encontradas ?? null, data.importadas ?? null, final);
  },
  async heartbeat(status = "ONLINE", mensagem = "", currentJobId = null) {
    await ensureDnitTables();
    await prisma.$executeRawUnsafe(`INSERT INTO "dnit_agent_state" ("id","lastSeenAt","status","mensagem","currentJobId","version","updatedAt") VALUES ('main',CURRENT_TIMESTAMP,$1,$2,$3,'1.0.0',CURRENT_TIMESTAMP) ON CONFLICT ("id") DO UPDATE SET "lastSeenAt"=CURRENT_TIMESTAMP,"status"=$1,"mensagem"=$2,"currentJobId"=$3,"version"='1.0.0',"updatedAt"=CURRENT_TIMESTAMP`, status, mensagem, currentJobId);
  }
};

// server/utils/date.ts
function formatDateOnly(value) {
  return value.toISOString().slice(0, 10);
}

// server/utils/serialize.ts
var number = (value) => Number(value);
var created = (value) => value.toISOString();
var dateOnly = formatDateOnly;

// server/services/multas-match.ts
var normalizePlate = (value) => String(value ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();
function motoristaDaViagemParaPlaca(viagens, placa) {
  return viagens.find((viagem) => normalizePlate(viagem.placa) === normalizePlate(placa))?.motoristaId ?? null;
}

// server/services/multas.service.ts
var multasTableReady = null;
function ensureMultasTable() {
  if (multasTableReady) return multasTableReady;
  multasTableReady = (async () => {
    await prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "multas" (
      "id" TEXT NOT NULL, "veiculoId" TEXT NOT NULL, "motoristaId" TEXT,
      "autoInfracao" TEXT NOT NULL DEFAULT '', "codigoInfracao" TEXT NOT NULL DEFAULT '',
      "orgaoAutuador" TEXT NOT NULL DEFAULT '', "dataInfracao" DATE NOT NULL, "hora" TEXT NOT NULL DEFAULT '',
      "local" TEXT NOT NULL DEFAULT '', "descricao" TEXT NOT NULL DEFAULT '', "pontos" INTEGER NOT NULL DEFAULT 0,
      "valorOriginal" DECIMAL(14,2) NOT NULL DEFAULT 0, "valorAtual" DECIMAL(14,2) NOT NULL DEFAULT 0,
      "vencimento" DATE, "status" TEXT NOT NULL DEFAULT 'PENDENTE', "observacoes" TEXT NOT NULL DEFAULT '',
      "documentoUrl" TEXT, "documentoNome" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
      "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, CONSTRAINT "multas_pkey" PRIMARY KEY ("id")
    )`);
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "multas" ADD CONSTRAINT "multas_veiculoId_fkey" FOREIGN KEY ("veiculoId") REFERENCES "veiculos"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await prisma.$executeRawUnsafe(`DO $$ BEGIN ALTER TABLE "multas" ADD CONSTRAINT "multas_motoristaId_fkey" FOREIGN KEY ("motoristaId") REFERENCES "motoristas"("id") ON DELETE SET NULL ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    for (const sql of [
      `CREATE INDEX IF NOT EXISTS "multas_veiculoId_idx" ON "multas"("veiculoId")`,
      `CREATE INDEX IF NOT EXISTS "multas_motoristaId_idx" ON "multas"("motoristaId")`,
      `CREATE INDEX IF NOT EXISTS "multas_dataInfracao_idx" ON "multas"("dataInfracao")`,
      `CREATE INDEX IF NOT EXISTS "multas_vencimento_idx" ON "multas"("vencimento")`,
      `CREATE INDEX IF NOT EXISTS "multas_status_idx" ON "multas"("status")`,
      `CREATE INDEX IF NOT EXISTS "multas_autoInfracao_idx" ON "multas"("autoInfracao")`
    ]) await prisma.$executeRawUnsafe(sql);
  })().catch((error) => {
    multasTableReady = null;
    throw error;
  });
  return multasTableReady;
}
var asDate = (value) => /* @__PURE__ */ new Date(`${value}T12:00:00.000Z`);
var serialize2 = (item) => ({
  ...item,
  dataInfracao: dateOnly(item.dataInfracao),
  vencimento: item.vencimento ? dateOnly(item.vencimento) : null,
  valorOriginal: number(item.valorOriginal),
  valorAtual: number(item.valorAtual),
  documentoStored: Boolean(item.documentoUrl || item.documentoNome),
  createdAt: created(item.createdAt)
});
async function resolveMotorista(veiculo, dataInfracao, motoristaId) {
  if (motoristaId) {
    const motorista = await prisma.motorista.findUnique({ where: { id: motoristaId }, select: { id: true } });
    if (!motorista) throw new AppError(404, "Motorista n\xE3o encontrado.");
    return motorista.id;
  }
  const viagens = await prisma.viagem.findMany({
    where: { dataManifesto: asDate(dataInfracao) },
    select: { placa: true, motoristaId: true },
    orderBy: { createdAt: "desc" }
  });
  return motoristaDaViagemParaPlaca(viagens, veiculo.placa);
}
async function vehicleOrThrow(veiculoId) {
  const veiculo = await prisma.veiculo.findUnique({ where: { id: veiculoId } });
  if (!veiculo) throw new AppError(404, "Ve\xEDculo n\xE3o encontrado.");
  return veiculo;
}
var veiculoSelect = { id: true, placa: true, renavam: true, modelo: true, marca: true };
var include = {
  veiculo: { select: veiculoSelect },
  motorista: { select: { id: true, nome: true, cpf: true } }
};
var listSelect = {
  id: true,
  veiculoId: true,
  motoristaId: true,
  autoInfracao: true,
  codigoInfracao: true,
  orgaoAutuador: true,
  dataInfracao: true,
  hora: true,
  local: true,
  descricao: true,
  pontos: true,
  valorOriginal: true,
  valorAtual: true,
  vencimento: true,
  status: true,
  observacoes: true,
  documentoNome: true,
  createdAt: true,
  updatedAt: true,
  veiculo: { select: veiculoSelect },
  motorista: { select: { id: true, nome: true, cpf: true } }
};
var multasService = {
  async list() {
    await ensureMultasTable();
    return (await prisma.multa.findMany({ select: listSelect, orderBy: [{ dataInfracao: "desc" }, { createdAt: "desc" }] })).map(serialize2);
  },
  async create(data) {
    await ensureMultasTable();
    const veiculo = await vehicleOrThrow(data.veiculoId);
    const motoristaId = await resolveMotorista(veiculo, data.dataInfracao, data.motoristaId || null);
    const item = await prisma.multa.create({
      data: {
        veiculoId: data.veiculoId,
        motoristaId,
        autoInfracao: data.autoInfracao || "",
        codigoInfracao: data.codigoInfracao || "",
        orgaoAutuador: data.orgaoAutuador || "",
        dataInfracao: asDate(data.dataInfracao),
        hora: data.hora || "",
        local: data.local || "",
        descricao: data.descricao || "",
        pontos: Number(data.pontos || 0),
        valorOriginal: Number(data.valorOriginal || 0),
        valorAtual: Number(data.valorAtual || data.valorOriginal || 0),
        vencimento: data.vencimento ? asDate(data.vencimento) : null,
        status: data.status || "PENDENTE",
        observacoes: data.observacoes || "",
        documentoUrl: data.documentoUrl || null,
        documentoNome: data.documentoNome || null
      },
      include
    });
    return serialize2(item);
  },
  async update(id, data) {
    await ensureMultasTable();
    const current = await prisma.multa.findUnique({ where: { id } });
    if (!current) throw new AppError(404, "Multa n\xE3o encontrada.");
    const veiculo = await vehicleOrThrow(data.veiculoId);
    const motoristaId = await resolveMotorista(veiculo, data.dataInfracao, data.motoristaId || null);
    const item = await prisma.multa.update({
      where: { id },
      data: {
        veiculoId: data.veiculoId,
        motoristaId,
        autoInfracao: data.autoInfracao || "",
        codigoInfracao: data.codigoInfracao || "",
        orgaoAutuador: data.orgaoAutuador || "",
        dataInfracao: asDate(data.dataInfracao),
        hora: data.hora || "",
        local: data.local || "",
        descricao: data.descricao || "",
        pontos: Number(data.pontos || 0),
        valorOriginal: Number(data.valorOriginal || 0),
        valorAtual: Number(data.valorAtual || data.valorOriginal || 0),
        vencimento: data.vencimento ? asDate(data.vencimento) : null,
        status: data.status || "PENDENTE",
        observacoes: data.observacoes || "",
        documentoUrl: data.documentoUrl || (data.documentoNome ? current.documentoUrl : null),
        documentoNome: data.documentoNome || null
      },
      include
    });
    return serialize2(item);
  },
  async remove(id) {
    await ensureMultasTable();
    const current = await prisma.multa.findUnique({ where: { id }, select: { id: true } });
    if (!current) throw new AppError(404, "Multa n\xE3o encontrada.");
    await prisma.multa.delete({ where: { id } });
  },
  async getDocumento(id) {
    await ensureMultasTable();
    const item = await prisma.multa.findUnique({ where: { id }, select: { documentoUrl: true, documentoNome: true } });
    if (!item) throw new AppError(404, "Multa n\xE3o encontrada.");
    if (!item.documentoUrl) throw new AppError(404, "Documento n\xE3o encontrado nesta multa.");
    return { dataUrl: item.documentoUrl, name: item.documentoNome || "multa.pdf" };
  }
};

// dnit-agent/portal.js
var clean = (value = "") => String(value ?? "").replace(/\u00a0/g, " ").trim();
var normalizePlate2 = (value) => clean(value).replace(/[^A-Za-z0-9]/g, "").toUpperCase();
var brDateToIso = (value) => {
  const m = clean(value).match(/(\d{2})\/(\d{2})\/(\d{4})/);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : "";
};
var brMoney = (value) => {
  const raw = clean(value).replace(/R\$\s*/gi, "").replace(/\./g, "").replace(",", ".").replace(/[^0-9.-]/g, "");
  const n = Number(raw || 0);
  return Number.isFinite(n) ? n : 0;
};
var pick = (text, labels) => {
  for (const label of labels) {
    const re = new RegExp(`${label}\\s*:?\\s*([^\\n\\r]+)`, "i");
    const m = text.match(re);
    if (m?.[1]) return clean(m[1]);
  }
  return "";
};
var statusFrom = (value) => {
  const v = clean(value).toLowerCase();
  if (/pago|quitad|baixad/.test(v)) return "PAGO";
  if (/recurso|defesa/.test(v)) return "EM_RECURSO";
  if (/cancelad|anulad/.test(v)) return "CANCELADO";
  return "PENDENTE";
};
function detectSenatranState(text) {
  const value = clean(text).toLowerCase();
  if (/captcha|não sou um robô|nao sou um robo|recaptcha/.test(value)) return "CAPTCHA";
  if (/nenhuma infração|nenhuma infracao|não possui infrações|nao possui infracoes|não foram encontradas infrações|nao foram encontradas infracoes|sem infrações|sem infracoes/.test(value)) return "SEM_MULTAS";
  if (/auto de infração|auto de infracao|número do auto|numero do auto|órgão autuador|orgao autuador/.test(value)) return "COM_MULTAS";
  return "INDEFINIDO";
}
function extractSenatranRowsFromText(text) {
  const source = String(text ?? "").replace(/\r/g, "");
  const starts = [...source.matchAll(/(?:Auto de Infra(?:ç|c)ão|N[úu]mero do Auto|Nº do Auto)\s*:?\s*/gi)].map((m) => m.index ?? 0);
  if (!starts.length) return [];
  const chunks = starts.map((start, i) => source.slice(start, starts[i + 1] ?? source.length));
  const out = [];
  for (const chunk of chunks) {
    const autoInfracao = pick(chunk, ["Auto de Infra(?:\xE7|c)\xE3o", "N[\xFAu]mero do Auto", "N\xBA do Auto"]);
    const dataInfracao = brDateToIso(pick(chunk, ["Data da Infra(?:\xE7|c)\xE3o", "Data da Autua(?:\xE7|c)\xE3o", "Data do Cometimento", "Data"]));
    if (!autoInfracao && !dataInfracao) continue;
    const valorText = pick(chunk, ["Valor Atualizado", "Valor Atual", "Valor da Multa", "Valor"]);
    const valor = brMoney(valorText);
    out.push({
      autoInfracao,
      codigoInfracao: pick(chunk, ["C[\xF3o]digo da Infra(?:\xE7|c)\xE3o", "C[\xF3o]digo do Enquadramento", "Enquadramento", "C[\xF3o]digo"]),
      orgaoAutuador: pick(chunk, ["[\xD3O]rg\xE3o Autuador", "Org\xE3o Autuador", "[\xD3O]rg\xE3o", "Orgao Autuador"]),
      dataInfracao: dataInfracao || (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
      hora: pick(chunk, ["Hora da Infra(?:\xE7|c)\xE3o", "Hora do Cometimento", "Hora"]).match(/\d{2}:\d{2}/)?.[0] || "",
      local: pick(chunk, ["Local da Infra(?:\xE7|c)\xE3o", "Local do Cometimento", "Local"]),
      descricao: pick(chunk, ["Descri(?:\xE7|c)\xE3o da Infra(?:\xE7|c)\xE3o", "Descri(?:\xE7|c)\xE3o do Enquadramento", "Infra(?:\xE7|c)\xE3o", "Descri(?:\xE7|c)\xE3o"]),
      pontos: Number(pick(chunk, ["Pontos"]).match(/\d+/)?.[0] || 0),
      valorOriginal: valor,
      valorAtual: valor,
      vencimento: brDateToIso(pick(chunk, ["Data de Vencimento", "Vencimento"])) || null,
      status: statusFrom(pick(chunk, ["Situa(?:\xE7|c)\xE3o", "Status"]))
    });
  }
  return out;
}

// dnit-agent/login.ts
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
var SENATRAN_HOME = "https://portalservicos.senatran.serpro.gov.br/#/home";
var SENATRAN_LOGIN_VEHICLES = "https://portalservicos.senatran.serpro.gov.br/#/login?nextRoute=%2Fveiculos%2Fmeus-veiculos";
function candidateBrowsers() {
  const pf = process.env.PROGRAMFILES || "C:\\Program Files";
  const pf86 = process.env["PROGRAMFILES(X86)"] || "C:\\Program Files (x86)";
  const local = process.env.LOCALAPPDATA || "";
  return [
    process.env.SENATRAN_BROWSER_PATH,
    process.env.DNIT_BROWSER_PATH,
    path.join(pf, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    path.join(pf86, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    path.join(local, "BraveSoftware", "Brave-Browser", "Application", "brave.exe"),
    path.join(pf, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(pf86, "Google", "Chrome", "Application", "chrome.exe"),
    path.join(local, "Google", "Chrome", "Application", "chrome.exe"),
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser"
  ].filter(Boolean);
}
function findBrowserPath() {
  return candidateBrowsers().find((browserPath) => fs.existsSync(browserPath));
}
function getProfileDir() {
  return path.resolve(process.env.SENATRAN_AGENT_PROFILE_DIR || path.join(process.cwd(), ".senatran-agent-cdp-profile"));
}
function getCdpPort() {
  return Number(process.env.SENATRAN_AGENT_CDP_PORT || 9224);
}
function getCdpUrl() {
  return `http://127.0.0.1:${getCdpPort()}`;
}
async function cdpAvailable() {
  try {
    const response = await fetch(`${getCdpUrl()}/json/version`, { signal: AbortSignal.timeout(1e3) });
    return response.ok;
  } catch {
    return false;
  }
}
async function waitForCdp(timeoutMs = 15e3) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await cdpAvailable()) return true;
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  return false;
}
async function waitForEnter() {
  const rl = createInterface({ input, output });
  try {
    await rl.question("[senatran-agent] fa\xE7a o login no GOV.BR e, quando o Portal SENATRAN estiver autenticado, pressione ENTER para continuar...");
  } finally {
    rl.close();
  }
}
async function openNormalLoginBrowser() {
  const executablePath = findBrowserPath();
  if (!executablePath) throw new Error("Brave/Chrome n\xE3o encontrado. Defina SENATRAN_BROWSER_PATH com o caminho do navegador.");
  const profileDir = getProfileDir();
  fs.mkdirSync(profileDir, { recursive: true });
  if (!await cdpAvailable()) {
    const child = spawn(executablePath, [
      `--user-data-dir=${profileDir}`,
      `--remote-debugging-port=${getCdpPort()}`,
      "--remote-debugging-address=127.0.0.1",
      "--no-first-run",
      "--no-default-browser-check",
      "--start-maximized",
      SENATRAN_LOGIN_VEHICLES
    ], { detached: true, stdio: "ignore" });
    child.unref();
    if (!await waitForCdp()) throw new Error("O navegador abriu, mas a porta local do SENATRAN Agent n\xE3o respondeu. Feche a janela dedicada e tente novamente.");
  }
  console.log(`[senatran-agent] Portal SENATRAN aberto para login manual: ${SENATRAN_LOGIN_VEHICLES}`);
  console.log("[senatran-agent] use o m\xE9todo de login desejado no GOV.BR (inclusive certificado digital, se preferir).");
  await waitForEnter();
  if (!await cdpAvailable()) throw new Error("A janela do navegador SENATRAN foi fechada antes da confirma\xE7\xE3o do login.");
  return { cdpUrl: getCdpUrl(), profileDir };
}

// dnit-agent/index.ts
if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL n\xE3o configurada. Use o mesmo banco Neon do Radasa.");
var POLL_MS = Math.max(5e3, Number(process.env.SENATRAN_AGENT_POLL_SECONDS || process.env.DNIT_AGENT_POLL_SECONDS || 10) * 1e3);
var HUMAN_TIMEOUT_MS = Math.max(6e4, Number(process.env.SENATRAN_AGENT_HUMAN_TIMEOUT_MINUTES || process.env.DNIT_AGENT_HUMAN_TIMEOUT_MINUTES || 10) * 6e4);
var running = false;
var managedBrowser = null;
var managedContext = null;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
var plateRegex = (plate) => {
  const p = normalizePlate2(plate);
  return p.length === 7 ? new RegExp(`${escapeRegex(p.slice(0, 3))}\\s*-?\\s*${escapeRegex(p.slice(3))}`, "i") : new RegExp(escapeRegex(p), "i");
};
async function visible(locator) {
  return locator.isVisible().catch(() => false);
}
async function bodyText(page) {
  return page.locator("body").innerText().catch(() => "");
}
async function isLoginRequired(page) {
  const url = page.url().toLowerCase();
  const text = (await bodyText(page)).toLowerCase();
  return /acesso\.gov\.br|sso\./.test(url) || /entrar com gov\.br|entrar com govbr|identifique-se no gov\.br/.test(text);
}
async function connectToManagedBrowser(cdpUrl) {
  managedBrowser = await chromium.connectOverCDP(cdpUrl);
  managedContext = managedBrowser.contexts()[0] || null;
  if (!managedContext) throw new Error("N\xE3o foi poss\xEDvel acessar a sess\xE3o do navegador SENATRAN.");
  console.log("[senatran-agent] conectado \xE0 janela normal do navegador via CDP; a sess\xE3o de login ser\xE1 reutilizada.");
  return managedContext;
}
async function verifyStartupLogin() {
  if (!managedContext) throw new Error("Navegador SENATRAN n\xE3o conectado.");
  const deadline = Date.now() + 2e4;
  while (Date.now() < deadline) {
    for (const page of managedContext.pages()) {
      const url = page.url();
      if (!url.includes("portalservicos.senatran.serpro.gov.br")) continue;
      if (!await isLoginRequired(page)) {
        console.log(`[senatran-agent] login manual confirmado em: ${url}`);
        return page;
      }
    }
    await sleep(400);
  }
  const urls = managedContext.pages().map((page) => page.url()).join(" | ") || "nenhuma aba";
  throw new Error(`O login GOV.BR ainda n\xE3o foi conclu\xEDdo. Fa\xE7a o login no Portal SENATRAN antes de pressionar ENTER. Abas detectadas: ${urls}`);
}
async function clickFirstVisible(locators) {
  for (const locator of locators) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const item = locator.nth(i);
      if (await visible(item)) {
        await item.click().catch(() => void 0);
        return true;
      }
    }
  }
  return false;
}
async function openVehicleInfractions(page, placa, jobId) {
  await page.goto(SENATRAN_HOME, { waitUntil: "domcontentloaded", timeout: 6e4 });
  await sleep(2500);
  if (await isLoginRequired(page)) {
    await dnitJobsService.setJob(jobId, "AGUARDANDO_LOGIN", { mensagem: "Sess\xE3o GOV.BR expirada. Fa\xE7a login novamente no navegador SENATRAN." });
    await dnitJobsService.heartbeat("AGUARDANDO_LOGIN", "Sess\xE3o GOV.BR expirada", jobId);
    throw new Error("Sess\xE3o GOV.BR expirada. Reinicie o SENATRAN Agent e fa\xE7a login novamente.");
  }
  const infractionsEntry = [
    page.getByRole("link", { name: /consultar minhas infra[cç][oõ]es|minhas infra[cç][oõ]es|infra[cç][oõ]es/i }),
    page.getByRole("button", { name: /consultar minhas infra[cç][oõ]es|minhas infra[cç][oõ]es|infra[cç][oõ]es/i }),
    page.getByText(/consultar minhas infra[cç][oõ]es/i, { exact: false }),
    page.getByText(/minhas infra[cç][oõ]es/i, { exact: false })
  ];
  const openedInfractions = await clickFirstVisible(infractionsEntry);
  if (!openedInfractions) {
    throw new Error('N\xE3o encontrei "Consultar Minhas Infra\xE7\xF5es" na p\xE1gina inicial do Portal SENATRAN. Deixe a p\xE1gina inicial aberta e tente novamente.');
  }
  await sleep(2e3);
  const byVehicle = [
    page.getByRole("button", { name: /por ve[ií]culo/i }),
    page.getByRole("link", { name: /por ve[ií]culo/i }),
    page.getByRole("tab", { name: /por ve[ií]culo/i }),
    page.getByText(/infra[cç][oõ]es por ve[ií]culo|por ve[ií]culo/i, { exact: false })
  ];
  await clickFirstVisible(byVehicle);
  await sleep(1500);
  const re = plateRegex(placa);
  const candidates = [
    page.getByRole("button", { name: re }),
    page.getByRole("link", { name: re }),
    page.getByText(re, { exact: false }),
    page.locator('button,a,[role="button"],[role="option"],mat-card,.card,.list-group-item').filter({ hasText: re })
  ];
  const clicked = await clickFirstVisible(candidates);
  if (!clicked) {
    const text = await bodyText(page);
    if (!re.test(text)) throw new Error(`A placa ${normalizePlate2(placa)} n\xE3o foi encontrada em "Infra\xE7\xF5es por ve\xEDculo" no Portal SENATRAN.`);
  }
  await sleep(2e3);
}
async function expandInfractionDetails(page) {
  const details = [
    page.getByRole("button", { name: /ver detalhes|detalhar|detalhes/i }),
    page.getByRole("link", { name: /ver detalhes|detalhar|detalhes/i }),
    page.getByText(/ver detalhes|detalhar/i, { exact: false })
  ];
  for (const locator of details) {
    const count = await locator.count().catch(() => 0);
    for (let i = 0; i < count; i += 1) {
      const item = locator.nth(i);
      if (await visible(item)) {
        await item.click().catch(() => void 0);
        await sleep(250);
      }
    }
  }
}
async function waitForResultOrHuman(page, jobId) {
  const deadline = Date.now() + HUMAN_TIMEOUT_MS;
  let validationAnnounced = false;
  while (Date.now() < deadline) {
    await page.waitForTimeout(1200);
    const text = await bodyText(page);
    const state = detectSenatranState(text);
    if (state === "CAPTCHA") {
      if (!validationAnnounced) {
        validationAnnounced = true;
        await dnitJobsService.setJob(jobId, "AGUARDANDO_VALIDACAO", { mensagem: "Aguardando valida\xE7\xE3o humana no Portal SENATRAN" });
        await dnitJobsService.heartbeat("AGUARDANDO_VALIDACAO", "Conclua a valida\xE7\xE3o exibida no navegador", jobId);
        console.log("[senatran-agent] valida\xE7\xE3o humana necess\xE1ria; conclua no navegador aberto.");
      }
      continue;
    }
    if (state === "SEM_MULTAS") return { state, text };
    if (state === "COM_MULTAS") {
      await expandInfractionDetails(page);
      return { state, text: await bodyText(page) };
    }
  }
  throw new Error("Tempo esgotado aguardando o resultado de Consultar Minhas Infra\xE7\xF5es no Portal SENATRAN.");
}
async function importRows(job, rows2) {
  let imported = 0;
  for (const row of rows2) {
    const auto = String(row.autoInfracao || "").trim();
    const existing = auto ? await prisma.multa.findFirst({ where: { veiculoId: job.veiculoId, autoInfracao: auto }, select: { id: true } }) : null;
    const payload = {
      ...row,
      veiculoId: job.veiculoId,
      orgaoAutuador: String(row.orgaoAutuador || "").trim() || "SENATRAN",
      observacoes: "Importada automaticamente pelo Portal de Servi\xE7os SENATRAN."
    };
    if (existing) await multasService.update(existing.id, payload);
    else await multasService.create(payload);
    imported += 1;
  }
  return imported;
}
async function processNextJob() {
  const job = await dnitJobsService.claimNextJob();
  if (!job) return false;
  let page = null;
  try {
    if (!managedContext) throw new Error("Navegador SENATRAN n\xE3o conectado. Reinicie o agente.");
    await dnitJobsService.heartbeat("CONSULTANDO", `Consultando infra\xE7\xF5es de ${job.placa} no SENATRAN`, job.id);
    page = await managedContext.newPage();
    await openVehicleInfractions(page, job.placa, job.id);
    const result = await waitForResultOrHuman(page, job.id);
    if (result.state === "SEM_MULTAS") {
      await dnitJobsService.setJob(job.id, "SEM_MULTAS", { mensagem: "Consulta conclu\xEDda: nenhuma infra\xE7\xE3o encontrada no SENATRAN", encontradas: 0, importadas: 0 });
      return true;
    }
    const rows2 = extractSenatranRowsFromText(result.text);
    if (!rows2.length) throw new Error("O Portal SENATRAN retornou infra\xE7\xF5es, mas o agente n\xE3o reconheceu os campos. O layout pode ter mudado.");
    const imported = await importRows(job, rows2);
    await dnitJobsService.setJob(job.id, "CONCLUIDO", { mensagem: `${rows2.length} infra\xE7\xE3o(\xF5es) encontrada(s); ${imported} sincronizada(s)`, encontradas: rows2.length, importadas: imported });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const current = await dnitJobsService.get(job.id).catch(() => null);
    if (current?.status !== "AGUARDANDO_LOGIN" && current?.status !== "AGUARDANDO_VALIDACAO") {
      await dnitJobsService.setJob(job.id, "ERRO", { mensagem: "Falha na consulta SENATRAN", erro: message }).catch(() => void 0);
    }
    console.error("[senatran-agent]", message);
    return true;
  } finally {
    if (page) await page.close().catch(() => void 0);
    await dnitJobsService.heartbeat("ONLINE", "SENATRAN Agent dispon\xEDvel", null).catch(() => void 0);
  }
}
async function cycle() {
  if (running) return;
  running = true;
  try {
    await dnitJobsService.heartbeat("ONLINE", "SENATRAN Agent dispon\xEDvel", null);
    await processNextJob();
  } catch (error) {
    console.error("[senatran-agent] ciclo:", error instanceof Error ? error.message : error);
  } finally {
    running = false;
  }
}
var timer = null;
async function startAgent() {
  console.log("[senatran-agent] aguardando login manual no GOV.BR antes de iniciar as consultas.");
  await dnitJobsService.heartbeat("AGUARDANDO_LOGIN", "Aguardando login manual no Portal SENATRAN", null).catch(() => void 0);
  const { cdpUrl } = await openNormalLoginBrowser();
  await connectToManagedBrowser(cdpUrl);
  await verifyStartupLogin();
  await dnitJobsService.heartbeat("ONLINE", "SENATRAN Agent autenticado e dispon\xEDvel", null);
  console.log(`[senatran-agent] login confirmado. Verifica\xE7\xE3o da fila a cada ${POLL_MS / 1e3}s.`);
  console.log("[senatran-agent] fluxo autom\xE1tico: Consultar Minhas Infra\xE7\xF5es > Por ve\xEDculo > placa selecionada no Radasa.");
  await cycle();
  timer = setInterval(() => void cycle(), POLL_MS);
}
async function shutdown(signal) {
  console.log(`[senatran-agent] encerrando (${signal})`);
  if (timer) clearInterval(timer);
  await dnitJobsService.heartbeat("OFFLINE", "SENATRAN Agent encerrado", null).catch(() => void 0);
  managedContext = null;
  managedBrowser = null;
  await prisma.$disconnect().catch(() => void 0);
  process.exit(0);
}
process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
startAgent().catch(async (error) => {
  console.error("[senatran-agent] falha ao iniciar:", error instanceof Error ? error.message : error);
  const message = error instanceof Error ? error.message : String(error);
  await dnitJobsService.heartbeat("LOGIN_ERRO", message, null).catch(() => void 0);
  managedContext = null;
  managedBrowser = null;
  await prisma.$disconnect().catch(() => void 0);
  process.exit(1);
});
export {
  processNextJob
};
