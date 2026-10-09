import { readFileSync } from "node:fs";
import assert from "node:assert/strict";

const source = readFileSync(new URL("../client/src/pages/Manutencao.tsx", import.meta.url), "utf8");
const start = source.indexOf('<h3 className="font-semibold">Dados principais</h3>');
const end = source.indexOf('2. Serviços, peças e valores', start);
assert.ok(start !== -1 && end > start, "Bloco de dados principais não encontrado");
const form = source.slice(start, end);
assert.match(form, /grid min-w-0 gap-3 md:grid-cols-2/, "Formulário deve usar colunas responsivas");
assert.equal((form.match(/grid-cols-\[minmax\(0,1fr\)_2\.5rem\]/g) || []).length, 2, "Veículo e oficina precisam reservar espaço fixo para seus botões +");
assert.match(form, /aria-label="Cadastrar novo veículo"/, "Atalho de veículo ausente");
assert.match(form, /aria-label="Cadastrar nova oficina"/, "Atalho de oficina ausente");
assert.match(form, /min-w-0 flex-1 truncate text-left/, "O nome da oficina precisa truncar sem invadir a coluna vizinha");
assert.match(form, /min-h-20 min-w-0 w-full/, "O campo de motivo precisa respeitar sua coluna");
assert.doesNotMatch(form, /lg:grid-cols-4/, "A grade antiga causava competição por largura");
console.log("OK: formulário da manutenção com campos e atalhos + em colunas sem sobreposição estrutural.");
