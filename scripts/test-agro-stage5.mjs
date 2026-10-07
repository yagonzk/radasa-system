import fs from "node:fs";

const checks = [];
function check(name, condition) {
  checks.push([name, Boolean(condition)]);
  if (!condition) process.exitCode = 1;
}

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const migration = fs.readFileSync("prisma/migrations/20261007143000_add_agro_lavouras_stage5/migration.sql", "utf8");
const service = fs.readFileSync("server/services/agro-lavouras.service.ts", "utf8");
const routes = fs.readFileSync("server/routes/agro.routes.ts", "utf8");
const controller = fs.readFileSync("server/controllers/agro.controller.ts", "utf8");
const page = fs.readFileSync("client/src/pages/AgroLavouras.tsx", "utf8");
const cadastros = fs.readFileSync("client/src/pages/AgroCadastros.tsx", "utf8");
const worker = fs.readFileSync("worker/index.ts", "utf8");
const home = fs.readFileSync("client/src/pages/AgroHome.tsx", "utf8");

check("schema fazendas", schema.includes("model AgroFazenda"));
check("schema talhoes", schema.includes("model AgroTalhao"));
check("schema safras", schema.includes("model AgroSafra"));
check("schema culturas", schema.includes("model AgroCultura"));
check("schema lavouras", schema.includes("model AgroLavoura"));
check("schema operacoes", schema.includes("model AgroOperacao"));
check("movimentacao vinculada a operacao", schema.includes("agroOperacaoId String?"));
check("migration cria estrutura", migration.includes('CREATE TABLE "agro_lavouras"') && migration.includes('CREATE TABLE "agro_operacoes"'));
check("migration conecta estoque", migration.includes('agro_movimentacoes_agroOperacaoId_fkey'));
check("service serializable", service.includes("TransactionIsolationLevel.Serializable"));
check("service trava produto", service.includes('FOR UPDATE'));
check("service valida saldo", service.includes("Saldo insuficiente"));
check("service gera saida", service.includes('tipo: "SAIDA"'));
check("service vincula operacao", service.includes("agroOperacaoId: operation.id"));
check("rota fazendas", routes.includes('agroRoutes.get("/fazendas"'));
check("rota lavouras", routes.includes('agroRoutes.post("/lavouras"'));
check("rota operacoes", routes.includes('agroRoutes.post("/operacoes"'));
check("controller usa novo service", controller.includes("agroLavourasService"));
check("pagina mini abas", page.includes('value="lavouras"') && page.includes('value="operacoes"'));
check("pagina baixa automatica", page.includes("estoque baixado automaticamente"));
check("pagina produtos utilizados", page.includes("Produtos utilizados"));
check("cadastros funcionais", cadastros.includes("/agro/fazendas") && cadastros.includes("/agro/talhoes") && cadastros.includes("/agro/safras") && cadastros.includes("/agro/culturas"));
check("realtime lavouras", worker.includes('resources.add("agro/lavouras")'));
check("realtime operacoes atualiza estoque", worker.includes('"produtos", "lotes", "movimentacoes", "operacoes"'));
check("dashboard lavouras", home.includes("lavourasEmAndamento") && home.includes("operacoesMes"));

for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
console.log(`\n${checks.filter(([, ok]) => ok).length}/${checks.length} verificações passaram.`);
