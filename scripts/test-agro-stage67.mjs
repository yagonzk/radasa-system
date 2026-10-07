import fs from "node:fs";

const checks = [];
function check(name, condition) {
  checks.push([name, Boolean(condition)]);
  if (!condition) process.exitCode = 1;
}

const schema = fs.readFileSync("prisma/schema.prisma", "utf8");
const migration = fs.readFileSync("prisma/migrations/20261007152000_agro_reports_inventory_locations_stage67/migration.sql", "utf8");
const stockCore = fs.readFileSync("server/services/agro-stock-core.ts", "utf8");
const stockService = fs.readFileSync("server/services/agro-estoque.service.ts", "utf8");
const reportService = fs.readFileSync("server/services/agro-relatorios.service.ts", "utf8");
const cropService = fs.readFileSync("server/services/agro-lavouras.service.ts", "utf8");
const routes = fs.readFileSync("server/routes/agro.routes.ts", "utf8");
const controller = fs.readFileSync("server/controllers/agro.controller.ts", "utf8");
const app = fs.readFileSync("client/src/App.tsx", "utf8");
const layout = fs.readFileSync("client/src/components/agro/AgroLayout.tsx", "utf8");
const stockPage = fs.readFileSync("client/src/pages/AgroEstoque.tsx", "utf8");
const movementPage = fs.readFileSync("client/src/pages/AgroMovimentacoes.tsx", "utf8");
const inventoryPage = fs.readFileSync("client/src/pages/AgroInventario.tsx", "utf8");
const reportPage = fs.readFileSync("client/src/pages/AgroRelatorios.tsx", "utf8");
const homePage = fs.readFileSync("client/src/pages/AgroHome.tsx", "utf8");

check("schema locais estoque", schema.includes("model AgroEstoqueLocal"));
check("schema transferencias", schema.includes("model AgroTransferencia"));
check("schema inventarios", schema.includes("model AgroInventario") && schema.includes("model AgroInventarioItem"));
check("schema tipos transferencia inventario", schema.includes("TRANSFERENCIA_ENTRADA") && schema.includes("INVENTARIO_SAIDA"));
check("movimentacao exige local", schema.includes("localId       String") && schema.includes("local         AgroEstoqueLocal"));
check("migration cria barracao principal", migration.includes('Barracão Principal') && migration.includes('UPDATE "agro_movimentacoes" SET "localId"'));
check("migration cria transferencias", migration.includes('CREATE TABLE "agro_transferencias"'));
check("migration cria inventarios", migration.includes('CREATE TABLE "agro_inventarios"') && migration.includes('CREATE TABLE "agro_inventario_itens"'));
check("custo medio ponderado", stockCore.includes("calculateAgroAverageCosts") && stockCore.includes("state.value / state.qty"));
check("saldo considera transferencia inventario", stockCore.includes("TRANSFERENCIA_ENTRADA") && stockCore.includes("INVENTARIO_SAIDA"));
check("transferencia serializable", stockService.includes("createTransferencia") && stockService.includes("TransactionIsolationLevel.Serializable"));
check("transferencia gera par de movimentos", stockService.includes('tipo: "TRANSFERENCIA_SAIDA"') && stockService.includes('tipo: "TRANSFERENCIA_ENTRADA"'));
check("inventario cria itens em lote", stockService.includes("agroInventarioItem.createMany"));
check("inventario gera ajuste automatico", stockService.includes('tipo: diff > 0 ? "INVENTARIO_ENTRADA" : "INVENTARIO_SAIDA"'));
check("inventario bloqueia concorrencia", stockService.includes('FROM "agro_inventarios"') && stockService.includes("FOR UPDATE"));
check("dashboard tem valor e consumo", stockService.includes("valorEstoque") && stockService.includes("consumoMes") && stockService.includes("inventariosAbertos"));
check("relatorio limita periodo", reportService.includes("366") && reportService.includes("Consulte no máximo 366 dias"));
check("relatorio por dimensoes", reportService.includes("consumoPorFazenda") && reportService.includes("consumoPorTalhao") && reportService.includes("consumoPorSafra") && reportService.includes("consumoPorCultura") && reportService.includes("consumoPorOperacao"));
check("relatorio calcula custo por ha", reportService.includes("custoPorHa"));
check("operacao lavoura escolhe barracao", cropService.includes("localId") && cropService.includes("getDefaultAgroLocation"));
check("operacao usa custo medio", cropService.includes("calculateAgroAverageCosts"));
check("operacao baixa produtos em lote", cropService.includes("agroMovimentacao.createMany"));
check("rotas locais", routes.includes('agroRoutes.get("/locais"') && routes.includes('agroRoutes.post("/locais"'));
check("rotas transferencia", routes.includes('agroRoutes.post("/transferencias"'));
check("rotas inventario", routes.includes('agroRoutes.post("/inventarios"') && routes.includes('agroRoutes.post("/inventarios/:id/finalizar"'));
check("rota relatorios", routes.includes('agroRoutes.get("/relatorios"'));
check("controller stage67", controller.includes("agroRelatoriosService") && controller.includes("criarTransferencia") && controller.includes("finalizarInventario"));
check("rota frontend inventario", app.includes('/agro/inventario') && app.includes("AgroInventario"));
check("menu barracoes", layout.includes('/agro/inventario') && layout.includes("Barracões"));
check("estoque mostra custo medio", stockPage.includes("Custo médio") && stockPage.includes("Valor estoque"));
check("movimentacao escolhe local", movementPage.includes("Barracão / local") && movementPage.includes("loadFormStock"));
check("tela transferencia", inventoryPage.includes("Transferências") && inventoryPage.includes("localOrigemId") && inventoryPage.includes("localDestinoId"));
check("tela inventario fisico", inventoryPage.includes("Contagem física") && inventoryPage.includes("Finalizar e ajustar"));
check("relatorio exporta excel", reportPage.includes("XLSX.writeFile") && reportPage.includes("Excel"));
check("relatorio exporta pdf", reportPage.includes("window.print") && reportPage.includes("PDF"));
check("dashboard agro gerencial", homePage.includes("valorEstoque") && homePage.includes("consumoMes") && homePage.includes("inventariosAbertos"));

for (const [name, ok] of checks) console.log(`${ok ? "✓" : "✗"} ${name}`);
console.log(`\n${checks.filter(([, ok]) => ok).length}/${checks.length} verificações passaram.`);
