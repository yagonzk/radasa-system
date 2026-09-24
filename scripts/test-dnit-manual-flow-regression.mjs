import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('client/src/pages/Multas.tsx', 'utf8');
assert.match(ui, /Abrir consulta oficial do DNIT/);
assert.match(ui, /Registrar resultado/);
assert.match(ui, /servicos\.dnit\.gov\.br\/multas/);
assert.doesNotMatch(ui, /Buscar multas no DNIT/);
assert.doesNotMatch(ui, /consultandoDnit/);

const store = fs.readFileSync('client/src/lib/store.ts', 'utf8');
assert.doesNotMatch(store, /consultarVeiculo/);

const routes = fs.readFileSync('server/routes/multas.routes.ts', 'utf8');
assert.doesNotMatch(routes, /consultar/);

const controller = fs.readFileSync('server/controllers/multas.controller.ts', 'utf8');
assert.doesNotMatch(controller, /consultarVeiculo/);

const service = fs.readFileSync('server/services/multas.service.ts', 'utf8');
assert.doesNotMatch(service, /consultarDnitPublico/);
assert.doesNotMatch(service, /async consultarVeiculo/);

assert.equal(fs.existsSync('server/services/dnit-public.service.ts'), false, 'scraper antigo deve ser removido');

console.log('DNIT manual flow regression: OK');
