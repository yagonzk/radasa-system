import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizePlate,
  normalizeRenavam,
  extractDnitRowsFromText,
  detectPortalState,
} from '../dnit-agent/portal.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

assert.equal(normalizePlate('rau-3i63'), 'RAU3I63');
assert.equal(normalizeRenavam('012.643.808-41'), '01264380841');
assert.equal(detectPortalState('Confirme que você não é um robô CAPTCHA'), 'CAPTCHA');
assert.equal(detectPortalState('Nenhuma multa encontrada para o veículo informado.'), 'SEM_MULTAS');

const parsed = extractDnitRowsFromText(`
Auto de Infração: A123456789\nCódigo da Infração: 7455\nData da Infração: 06/09/2026\nHora: 13:45\nLocal: BR-163 KM 100\nDescrição: Excesso de velocidade\nValor: R$ 195,23\nVencimento: 30/09/2026\nSituação: Pendente
`);
assert.equal(parsed.length, 1);
assert.equal(parsed[0].autoInfracao, 'A123456789');
assert.equal(parsed[0].codigoInfracao, '7455');
assert.equal(parsed[0].dataInfracao, '2026-09-06');
assert.equal(parsed[0].hora, '13:45');
assert.equal(parsed[0].valorOriginal, 195.23);
assert.equal(parsed[0].vencimento, '2026-09-30');

const packageJson = JSON.parse(read('package.json'));
assert.ok(packageJson.scripts['build:dnit-agent']);
assert.ok(packageJson.scripts['start:dnit-agent']);
assert.ok(packageJson.dependencies['playwright-core']);
assert.ok(fs.existsSync(path.join(root, 'Iniciar-DNIT-Agent.bat')));

const routes = read('server/routes/multas.routes.ts');
assert.match(routes, /dnit\/consultas/);
const page = read('client/src/pages/Multas.tsx');
assert.match(page, /Buscar multas/);
assert.match(page, /Aguardando agente|Consultando DNIT/);
assert.doesNotMatch(page, /Radasa DNIT instalado|Abrir DNIT já preenchido/);
const agent = read('dnit-agent/index.ts');
assert.match(agent, /processNextJob/);
assert.match(agent, /DATABASE_URL/);

console.log('dnit agent regression: ok');
