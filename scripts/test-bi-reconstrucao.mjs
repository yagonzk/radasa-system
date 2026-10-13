import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const page = readFileSync("client/src/pages/BIGerencial.tsx", "utf8");
const ui = readFileSync("client/src/components/bi/BiPresentation.tsx", "utf8");
const css = readFileSync("client/src/pages/bi-gerencial.css", "utf8");
const theme = readFileSync("client/src/index.css", "utf8");

for (const required of [
  "matchNfeForManifesto", "mergeStagingBiFacts", "readStagingBiFacts", "getResourceRange",
  "/bi/nfes/itens-romaneios", "/dados/romaneio_nf_staging.xlsx", "columnFilters",
  "exportFreteXlsx", "exportFreteUnitXlsx", "exportFaturamentoXlsx",
  "copyFreightDiagnostic", "BiConsultation", "BiMetrics", "BiRanking",
  'tab === "geral"', 'tab === "produtos"', 'tab === "clientes"',
  'tab === "placas"', 'tab === "consulta"', "formatDateBR(row.data)",
  "formatExcelDateColumn", "tableQuery", "consultaFiltered",
]) assert.ok(page.includes(required), `Função ausente no BI: ${required}`);

for (const required of [
  "compactColumnKeys", "columnWidths", "BiColumnFilter", "BiConsultation",
  "Por página", "todos os campos", "Todas as colunas", "Filtros por coluna",
  "Página anterior", "Próxima página", "data-testid=\"bi-consulta\"",
  "formatMoney(row.faturamento)", "formatMoney(row.frete)", "formatDate(row.data)",
  "rows.slice", "viewColumns", "BiMetrics", "BiRanking",
]) assert.ok(ui.includes(required), `Funcionalidade da apresentação ausente: ${required}`);

assert.ok(css.includes("container: bi-dashboard / inline-size"), "Layout precisa considerar a largura real após a sidebar");
assert.ok(css.includes(".bi-v3__table-scroll"), "Tabela precisa de rolagem própria");
assert.ok(css.includes(".bi-v3__mobile-rows"), "Consulta precisa de cartões responsivos");
assert.ok(css.includes("@media(prefers-reduced-motion: reduce)"), "Animações devem respeitar movimento reduzido");
assert.ok(theme.includes("--background: #eef2ff;") && theme.includes("--background: #111827;"), "Fundos aprovados alterados");
console.log("OK: BI reconstruído com análises, filtros, exportações, dados exatos, responsividade e fundos preservados.");
