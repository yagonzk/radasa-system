import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('client/src/components/cadastros/VeiculoTab.tsx', 'utf8');
const routes = fs.readFileSync('server/routes/veiculos.routes.ts', 'utf8');
const pdfService = fs.readFileSync('server/services/crlv-pdf.service.ts', 'utf8');

assert.match(ui, /\/veiculos\/crlv-pdf\/interpretar/);
assert.match(ui, /handleCrlvFile/);
assert.match(ui, /Arraste e solte o CRLV aqui/);
assert.match(ui, /placa:data\.placa/);
assert.match(ui, /renavam:data\.renavam/);
assert.match(ui, /chassi:data\.chassi/);
assert.match(ui, /anoFabricacao:data\.anoFabricacao/);
assert.match(ui, /subcategoria:data\.subcategoria/);
assert.match(routes, /post\("\/crlv-pdf\/interpretar"/);
assert.match(pdfService, /interpretarTextoCrlv/);
console.log('CRLV import UI/API regression: OK');
