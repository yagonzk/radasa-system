import fs from 'node:fs';
import assert from 'node:assert/strict';

const routes = fs.readFileSync('server/routes/sefaz-dfe.routes.ts', 'utf8');
const controller = fs.readFileSync('server/controllers/sefaz-dfe.controller.ts', 'utf8');
const page = fs.readFileSync('client/src/pages/Abastecimentos.tsx', 'utf8');
const service = fs.readFileSync('server/services/sefaz-dfe.service.ts', 'utf8');

assert.match(
  routes,
  /post\(["']\/documentos\/pendentes\/importar-local["'][^\n]*sefazDfeController\.importPendingLocal/,
  'deve existir endpoint local para importar pendências sem consultar a SEFAZ',
);


const retryBlock = service.match(/async retryPendingFuelImports[\s\S]*?\n  },\n\n  async syncLocal/)?.[0] || '';
assert.ok(retryBlock, 'deve localizar o reprocessador local');
assert.doesNotMatch(
  retryBlock,
  /classificacao:\s*["']ABASTECIMENTO["']/,
  'reprocessamento local não deve depender da classificação antiga; o XML completo deve ser reinterpretado',
);
assert.match(
  retryBlock,
  /tipo:\s*["']NFE["'][\s\S]*status:\s*\{\s*in:\s*\[["']NOVO["'],\s*["']PENDENTE["']\][\s\S]*xmlUrl:\s*\{\s*not:\s*["']["']\s*\}/,
  'deve buscar XMLs completos NFE armazenados em NOVO/PENDENTE',
);

assert.match(
  controller,
  /importPendingLocal[\s\S]*retryPendingFuelImports/,
  'controller deve chamar o reprocessador local de XMLs armazenados',
);

assert.match(
  page,
  /const processPendingSefazDocuments = async \(\) =>[\s\S]*\/sefaz\/documentos\/pendentes\/importar-local/,
  'tela deve possuir ação para importar pendências localmente',
);

assert.match(
  page,
  /onClick=\{\(\) => void processPendingSefazDocuments\(\)\}/,
  'botão Pendente deve executar a importação local diretamente',
);

assert.match(
  page,
  /processPendingSefazDocuments[\s\S]*await refresh\(\)[\s\S]*await loadSefazStatus\(\)/,
  'após importar deve atualizar abastecimentos e contador de pendências',
);

console.log('OK: pendências SEFAZ podem ser importadas localmente para Abastecimentos.');
