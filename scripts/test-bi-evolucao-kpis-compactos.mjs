import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const read = (name) => readFileSync(name, "utf8");
const bi = read("client/src/pages/BIGerencial.tsx");
const biCss = read("client/src/pages/bi-gerencial.css");
const css = read("client/src/index.css");

assert.ok(bi.includes("<h2>Evolução</h2>"), "O painel deve se chamar Evolução");
assert.ok(!bi.includes("showEvolution"), "A evolução precisa permanecer aberta");
assert.ok(bi.includes("byEvolution.length * 56"), "Gráfico deve dimensionar sua largura pela quantidade de pontos");
for (const period of ["dia", "semana", "mes", "ano"]) {
  assert.ok(bi.includes(`'${period}'`), `Filtro de evolução ausente: ${period}`);
}
assert.match(biCss, /\.bi-v3__evolution-panel\s+\.bi-v3__chart-inner\s*\{[^}]*height:\s*clamp\(330px,\s*38vw,\s*430px\)/s);
assert.ok(css.includes(".radasa-compact-kpis"), "Falta layout compacto compartilhado");
assert.ok(css.includes("overflow-x: auto;"), "KPIs devem rolar horizontalmente sem sobreposição");
assert.ok(css.includes("--background: #eef2ff;") && css.includes("--background: #111827;"), "Fundos originais não podem mudar");

const dashboards = {
  "client/src/pages/Dashboard.tsx": 6,
  "client/src/pages/Romaneios.tsx": 6,
  "client/src/pages/Abastecimentos.tsx": 7,
  "client/src/pages/Pneus.tsx": 4,
  "client/src/pages/Manutencao.tsx": 4,
  "client/src/pages/Estoque.tsx": 4,
  "client/src/pages/AgroHome.tsx": 6,
  "client/src/pages/AgroEstoque.tsx": 4,
  "client/src/pages/AgroInventario.tsx": 3,
  "client/src/pages/AgroMovimentacoes.tsx": 4,
  "client/src/pages/AdminHome.tsx": 4,
  "client/src/pages/Financeiro.tsx": 5,
  "client/src/pages/Viagens.tsx": 5,
};
for (const [file, count] of Object.entries(dashboards)) {
  assert.ok(read(file).includes(`radasa-compact-kpis kpi-cols-${count}`), `Painel não compactado: ${file}`);
}
console.log("OK: evolução ampliada, quatro períodos, mini-dashboards em uma faixa e fundos preservados.");
