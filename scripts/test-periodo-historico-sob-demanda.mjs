import fs from 'node:fs';
import assert from 'node:assert/strict';

const store = fs.readFileSync(new URL('../client/src/lib/store.ts', import.meta.url), 'utf8');
const abastecimentos = fs.readFileSync(new URL('../client/src/pages/Abastecimentos.tsx', import.meta.url), 'utf8');
const romaneios = fs.readFileSync(new URL('../client/src/pages/Romaneios.tsx', import.meta.url), 'utf8');
const viagens = fs.readFileSync(new URL('../client/src/pages/Viagens.tsx', import.meta.url), 'utf8');
const fechamentos = fs.readFileSync(new URL('../client/src/pages/Fechamentos.tsx', import.meta.url), 'utf8');

assert.match(store, /loadRange/,'CRUD deve oferecer carregamento de período sob demanda');
assert.match(abastecimentos, /loadRange\(filters\.emissao, filters\.emissaoAte\)/,'Abastecimentos deve recarregar ao trocar período');
assert.match(romaneios, /loadRange\(columnFilters\.dataInicio, columnFilters\.dataFim\)/,'Romaneios deve recarregar ao trocar período');
assert.match(viagens, /loadRange\(columnFilters\.dataInicio, columnFilters\.dataFim\)/,'Viagens deve recarregar ao trocar período');
assert.match(fechamentos, /loadRange\(filterInicio, filterFim\)/,'Fechamentos deve recarregar ao trocar período');
console.log('OK: filtros de período consultam o servidor sob demanda.');
