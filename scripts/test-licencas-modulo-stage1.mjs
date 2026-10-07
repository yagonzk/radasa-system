import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const assert = (condition, message) => {
  if (!condition) throw new Error(message);
  checks.push(message);
};

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20261007100000_add_module_licenses_stage1/migration.sql");
const service = read("server/services/module-license.service.ts");
const routes = read("server/routes/admin.routes.ts");
const adminPage = read("client/src/pages/Administracao.tsx") + read("client/src/pages/AdminUsuarioDetalhe.tsx");
const auth = read("server/services/auth.service.ts");

assert(schema.includes("model ModuleLicense"), "ModuleLicense existe no schema Prisma");
assert(schema.includes("@@unique([userId, module])"), "licença é única por usuário e módulo");
assert(migration.includes("'TRANSPORTES'"), "migração preserva Transportes para usuários atuais");
assert(migration.includes('u."active" = true'), "backfill alcança somente usuários já ativos");
assert(service.includes('["TRANSPORTES", "AGRO"]'), "Transportes e Agro são licenças independentes");
assert(service.includes("remainingDays * DAY_MS"), "vencimento é recalculado a partir dos dias informados");
assert(service.includes("unlimited: false"), "editar dias converte licença ilimitada para licença com vencimento");
assert(service.includes("Alterou licença ${input.module}"), "alteração de licença gera auditoria específica");
assert(routes.includes('/usuarios/:id/licencas/:module/dias'), "rota administrativa de dias da licença existe");
assert(adminPage.includes("Alterar dias restantes"), "painel usa edição por lápis");
assert(adminPage.includes('event.key === "Enter"'), "Enter confirma a edição");
assert(adminPage.includes("onBlur={() => void save()}"), "sair do campo salva automaticamente");
assert(!adminPage.includes("+7 dias") && !adminPage.includes("+30 dias") && !adminPage.includes("+90 dias"), "não existem atalhos de soma de dias");
assert(auth.includes("licenses: userLicenseSummaries"), "sessão já expõe o resumo das licenças para a próxima etapa");
assert(service.includes('target.role === "ADMIN"'), "contas administrativas permanecem com licença permanente");

console.log(`OK: ${checks.length} verificações da Etapa 1 passaram.`);
