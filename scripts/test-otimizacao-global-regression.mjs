import fs from 'node:fs';
import assert from 'node:assert/strict';

const read = (file) => fs.readFileSync(file, 'utf8');

const bootstrap = read('server/routes/bootstrap.routes.ts');
assert.match(bootstrap, /mapWithConcurrency\(resources,\s*2,/,
  'bootstrap deve limitar concorrencia ao pool 2 do Hyperdrive');

const api = read('client/src/lib/api.ts');
assert.doesNotMatch(api, /mapWithLimit\(resources,\s*3,/,
  'fallbacks do bootstrap no cliente nao devem disparar 3 requests simultaneas');
assert.match(api, /mapWithLimit\(resources,\s*2,/,
  'fallbacks do bootstrap devem usar concorrencia 2');

const app = read('client/src/App.tsx');
assert.match(app, /lazy\(\(\)\s*=>\s*import\("\.\/pages\/Abastecimentos"\)\)/,
  'paginas pesadas devem ser carregadas sob demanda');
assert.doesNotMatch(app, /import Abastecimentos from "\.\/pages\/Abastecimentos"/,
  'Abastecimentos nao deve ficar no bundle inicial');
assert.match(app, /<Suspense\s+fallback=/,
  'roteador deve possuir fallback para chunks lazy');

const romaneios = read('client/src/pages/Romaneios.tsx');
assert.match(romaneios, /const BULK_SAVE_CHUNK_SIZE = 1;/,
  'importacao de romaneios deve enviar um PDF por request para limitar memoria e body');
assert.doesNotMatch(romaneios, /Promise\.all\(chunk\.map\(async \(entry\)/,
  'PDFs do chunk nao devem ser convertidos para base64 em paralelo');

const concurrency = read('server/utils/concurrency.ts');
assert.match(concurrency, /export async function runWithConcurrency/,
  'backend deve ter helper para consultas heterogeneas com limite de concorrencia');

const financeiro = read('server/services/financeiro.service.ts');
assert.match(financeiro, /runWithConcurrency\(/,
  'financeiro deve limitar rajadas de consultas');

const fiscal = read('server/services/fiscal.service.ts');
assert.match(fiscal, /runWithConcurrency\(/,
  'fiscal deve limitar rajadas de consultas');

const viagens = read('server/services/viagens.service.ts');
assert.match(viagens, /previewExtratoTruckPag[\s\S]*runWithConcurrency\(/, 'preview TruckPag deve limitar consultas paralelas');


const abastecimentos = read('server/services/abastecimentos.service.ts');
assert.match(abastecimentos, /ensureReferences[\s\S]*runWithConcurrency\(/, 'validacao de abastecimento deve respeitar concorrencia 2');

const abastecimentoXml = read('server/services/abastecimento-xml.service.ts');
assert.match(abastecimentoXml, /criarContextoSugestoesAbastecimento[\s\S]*runWithConcurrency\(/, 'contexto de abastecimento deve limitar consultas paralelas');

const comercial = read('server/services/comercial.service.ts');
assert.match(comercial, /runWithConcurrency\(/, 'dashboard comercial deve limitar consultas paralelas');

const manutencao = read('server/services/manutencao.service.ts');
assert.match(manutencao, /runWithConcurrency\(/,
  'dashboard de manutencao deve limitar rajadas de consultas');

console.log('otimizacao global regression: ok');
