import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const src = readFileSync(new URL("../client/src/pages/Manutencao.tsx", import.meta.url), "utf8");
const itemStart = src.indexOf("{osForm.itens.length === 0");
const itemEnd = src.indexOf("</section>", itemStart);
assert.ok(itemStart !== -1 && itemEnd > itemStart, "Bloco de itens da OS não encontrado");
const items = src.slice(itemStart, itemEnd);

assert.match(items, /sm:grid-cols-\[minmax\(9rem,0\.75fr\)_minmax\(0,2fr\)\]/, "Tipo e descrição devem ter uma linha com largura suficiente");
assert.match(items, /item\.tipo === "PECA" && <div className="min-w-0"/, "Almoxarifado deve aparecer apenas para peças");
assert.match(items, /Peça externa \/ Consumo direto/, "Peça externa precisa continuar disponível");
assert.match(items, /grid-cols-2 items-end gap-3 sm:grid-cols-\[minmax\(0,1fr\)_minmax\(0,1fr\)_minmax\(0,1\.2fr\)_auto\]/, "Quantidade, valor, total e remover devem ter grade responsiva");
assert.match(items, /Total do item/, "Total deve possuir sua própria área com rótulo");
assert.match(items, /aria-label=\{`Remover item \$\{index \+ 1\}`\}/, "Botão de remover deve ser acessível");
assert.doesNotMatch(items, /sm:grid-cols-12|sm:col-span-1/, "Não usar 12 colunas estreitas nos itens");

const docStart = src.indexOf("<h3 className=\"font-semibold\">Notas Fiscais</h3>");
const docEnd = src.indexOf("<Label>Observações</Label>", docStart);
assert.ok(docStart !== -1 && docEnd > docStart, "Área de documentos não encontrada");
const docs = src.slice(docStart, docEnd);
assert.match(docs, /Nota fiscal \{index \+ 1\}/, "Nota fiscal deve ter identificação própria");
assert.match(docs, /Anexo \{index \+ 1\}/, "Anexo deve ter identificação própria");
assert.match(docs, /sm:col-span-2/, "Campos longos dos documentos devem usar linha inteira");
assert.doesNotMatch(docs, /sm:grid-cols-12|sm:col-span-1/, "Não usar 12 colunas estreitas nos documentos");
console.log("OK: linhas de itens, notas fiscais e anexos têm layout responsivo sem colunas estreitas.");
