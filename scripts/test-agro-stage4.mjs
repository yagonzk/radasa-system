import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const checks = [];
const check = (name, condition) => checks.push({ name, ok: Boolean(condition) });

const schema = read("prisma/schema.prisma");
const migration = read("prisma/migrations/20261007113000_add_agro_stock_stage4/migration.sql");
const service = read("server/services/agro-estoque.service.ts");
const routes = read("server/routes/agro.routes.ts");
const worker = read("worker/index.ts");
const estoque = read("client/src/pages/AgroEstoque.tsx");
const movimentos = read("client/src/pages/AgroMovimentacoes.tsx");
const dashboard = read("client/src/pages/AgroHome.tsx");

check("schema possui produto Agro separado", schema.includes('model AgroProduto') && schema.includes('@@map("agro_produtos")'));
check("schema possui lotes Agro", schema.includes('model AgroLote') && schema.includes('@@map("agro_lotes")'));
check("schema possui movimentações Agro", schema.includes('model AgroMovimentacao') && schema.includes('@@map("agro_movimentacoes")'));
check("movimentação possui entrada/saída/ajustes", schema.includes('AJUSTE_ENTRADA') && schema.includes('AJUSTE_SAIDA'));
check("migração cria tabelas exclusivas do Agro", migration.includes('CREATE TABLE "agro_produtos"') && migration.includes('CREATE TABLE "agro_movimentacoes"'));
check("saldo vem de movimentações", service.includes('groupBy') && service.includes('balancesFromGroups'));
check("saída valida saldo", service.includes('Saldo insuficiente') && service.includes('MOVIMENTOS_SAIDA'));
check("movimentação usa transação serializável", service.includes('TransactionIsolationLevel.Serializable'));
check("produto com saldo não pode ser inativado", service.includes('Zere o saldo do produto antes de inativá-lo'));
check("lote com saldo não pode ser inativado", service.includes('Zere o saldo do lote antes de inativá-lo'));
check("data futura é bloqueada", service.includes('não pode ter data futura'));
check("API Agro expõe estoque", routes.includes('get("/estoque"'));
check("API Agro expõe produtos", routes.includes('post("/produtos"'));
check("API Agro expõe lotes", routes.includes('post("/lotes"'));
check("API Agro expõe movimentações", routes.includes('post("/movimentacoes"'));
check("realtime conhece Agro", worker.includes('agro/estoque') && worker.includes('agro/movimentacoes'));
check("tela Estoque não é placeholder", estoque.includes('Novo produto') && estoque.includes('/agro/estoque'));
check("tela Estoque administra lotes", estoque.includes('/agro/lotes') && estoque.includes('Lotes ·'));
check("tela Movimentações registra entradas e saídas", movimentos.includes('/agro/movimentacoes') && movimentos.includes('Registrar movimentação'));
check("tela Movimentações mostra saldo disponível", movimentos.includes('Disponível:'));
check("Dashboard Agro usa dados reais", dashboard.includes('/agro/dashboard') && !dashboard.includes('Aguardando dados do módulo Agro'));
check("nenhum saldo é editado diretamente", !estoque.includes('setEstoque') && !service.includes('saldo: {'));

const failed = checks.filter((item) => !item.ok);
for (const item of checks) console.log(`${item.ok ? "OK" : "FALHA"} - ${item.name}`);
if (failed.length) {
  console.error(`\n${failed.length} verificação(ões) falharam.`);
  process.exit(1);
}
console.log(`\n${checks.length} verificações da Etapa 4 passaram.`);
