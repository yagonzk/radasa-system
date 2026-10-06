import fs from "node:fs";

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), "utf8");
const assert = (condition, message) => { if (!condition) throw new Error(message); };

const api = read("client/src/lib/api.ts");
const realtime = read("client/src/lib/realtime.ts");
const store = read("client/src/lib/store.ts");
const romaneios = read("client/src/pages/Romaneios.tsx");
const manifestos = read("server/services/manifestos.service.ts");
const veiculos = read("server/services/veiculos.service.ts");
const motoristas = read("server/services/motoristas.service.ts");
const abastecimentos = read("server/services/abastecimentos.service.ts");
const empresa = read("server/services/empresa.service.ts");
const audit = read("server/middlewares/audit-log.ts");

assert(api.includes('const HEAVY_RESOURCES = new Set(["viagens", "fechamentos", "manifestos", "abastecimentos", "pneus"])'), "Recursos pesados precisam de fila própria.");
const batchBlock = api.slice(api.indexOf("const BATCHABLE_RESOURCES"), api.indexOf("const HEAVY_RESOURCES"));
assert(!batchBlock.includes('"manifestos"'), "Romaneios não deve ficar preso ao bootstrap de cadastros.");
assert(api.includes("function runHeavyTask"), "Fila de concorrência pesada ausente.");
assert(api.includes("export function getResourceRange"), "Deduplicação de consultas por período ausente.");
assert(store.includes("rangeRevision"), "Proteção contra resposta antiga de período ausente.");

assert(realtime.includes("REALTIME_COALESCE_MS = 300"), "Realtime precisa agrupar rajadas de mutações.");
assert(realtime.includes("pendingResources.add(resource)"), "Coalescência de recursos realtime ausente.");

assert(manifestos.includes("manifestoDedupeCandidateWhere"), "Deduplicação de romaneio precisa consultar apenas candidatos.");
assert(manifestos.includes("select: manifestoListSelect"), "Listagem/gravação de romaneio precisa usar payload compacto.");
assert(manifestos.includes("pdfStored: Boolean(input.pdfUrl)"), "Resposta de criação deve indicar PDF sem devolver base64.");
assert(!manifestos.includes("current.pdfUrl"), "Atualização de romaneio não deve carregar PDF base64 só para preservá-lo.");

assert(romaneios.includes("romaneioMetricsById"), "Romaneios precisa pré-calcular métricas uma vez.");
assert(romaneios.includes("clientesById") && romaneios.includes("produtosById"), "Lookups O(1) de cliente/produto ausentes.");
assert(romaneios.includes("valorTotalResumo"), "Resumo deve reaproveitar métrica calculada.");

assert(veiculos.includes("omit: { crlvPdfUrl: true }"), "Listagem de veículos não pode carregar CRLV base64.");
assert(motoristas.includes("omit: { cnhPdfUrl: true, toxicologicoPdfUrl: true }"), "Listagem de motoristas não pode carregar documentos base64.");
assert(abastecimentos.includes("select: { id: true }"), "Abastecimentos deve checar presença de documentos sem carregar conteúdo.");
assert(empresa.includes("certificadoConfigurado"), "Empresa deve expor somente estado do certificado.");
assert(empresa.includes("omit: { certificadoArquivo: true, certificadoSenha: true }"), "Listagem de empresas não pode devolver certificado A1.");
assert(audit.includes('"certificadoArquivo"') && audit.includes('"pdfUrl"') && audit.includes("sanitizeAuditValue"), "Auditoria precisa remover anexos/base64 do corpo logado.");

console.log("OK - otimização geral v2.2 protegida por regressão estrutural.");
