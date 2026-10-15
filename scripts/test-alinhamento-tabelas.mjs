import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const stock = read("client/src/pages/Estoque.tsx");
const table = read("client/src/components/cadastros/DataTable.tsx");
const viagens = read("client/src/pages/Viagens.tsx");
const abastecimentos = read("client/src/pages/Abastecimentos.tsx");
const css = read("client/src/index.css");

function section(source, first, last) {
  const start = source.indexOf(first);
  const end = source.indexOf(last, start + first.length);
  assert.ok(start >= 0 && end > start, `Trecho ${first} não encontrado`);
  return source.slice(start, end);
}

function colWidths(jsx) {
  return [...jsx.matchAll(/<col style=\{\{ width: "(\d+)%" \}\} \/>/g)].map((match) => Number(match[1]));
}

const resumo = section(stock, "function ResumoTable(", "type MovimentacaoFilterKey");
const movimentos = section(stock, "function MovimentacoesTable(", "function downloadDocument");
assert.deepEqual(colWidths(resumo), [20, 10, 10, 11, 7, 7, 7, 13, 15]);
assert.deepEqual(colWidths(movimentos), [12, 25, 11, 11, 12, 9, 20]);
assert.ok(resumo.includes('"justify-center text-center"') && resumo.includes('"justify-end text-right"'));
assert.ok(movimentos.includes('"justify-center text-center"') && movimentos.includes('"justify-end text-right"'));
assert.ok(resumo.includes('"radasa-table-actions flex items-center justify-center gap-1 whitespace-nowrap"'));
assert.ok(movimentos.includes('"radasa-table-actions flex items-center justify-center gap-1 whitespace-nowrap"'));
assert.ok((resumo.match(/size="icon-sm"/g) || []).length === 3);
assert.ok((movimentos.match(/size="icon-sm"/g) || []).length === 4);
assert.ok(table.includes('radasa-cadastro-table-has-actions'));
assert.ok(viagens.includes('radasa-table-with-actions'));
assert.ok(abastecimentos.includes('radasa-table-with-actions'));
const abastecTable = section(abastecimentos, 'data-radasa-min-readable-width="760"', '</colgroup>');
assert.deepEqual(colWidths(abastecTable), [3, 13, 7, 7, 9, 9, 7, 9, 9, 9, 18]);
assert.ok(css.includes('@container radasa-compact-table (min-width: 620px)'));
assert.ok(css.includes('.radasa-table-actions > :is(button, a)'));
console.log("[alinhamento] OK: colunas, números, ações e adaptação das tabelas.");
