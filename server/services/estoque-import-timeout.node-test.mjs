import fs from 'node:fs';
import assert from 'node:assert/strict';

const source = fs.readFileSync(new URL('./estoque.service.ts', import.meta.url), 'utf8');
const importarStart = source.indexOf('async importarNfe(data: any)');
assert.notEqual(importarStart, -1, 'importarNfe deve existir');
const importarSource = source.slice(importarStart, source.indexOf('\n  async create(data: any)', importarStart));

assert.match(importarSource, /timeout:\s*60_000/, 'importarNfe deve permitir até 60s para NF-e com vários itens');
assert.match(importarSource, /maxWait:\s*10_000/, 'importarNfe deve permitir espera de conexão antes da transação');
assert.match(importarSource, /tiposProdutoCadastrados/, 'categorias devem ser pré-carregadas antes da transação');
assert.match(importarSource, /subcategoriasCadastradas/, 'subcategorias devem ser pré-carregadas antes da transação');

console.log('estoque importar NF-e timeout regression: PASS');
