import fs from 'node:fs';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const cleanupPath = 'scripts/limpar-modulo-multas-obsoleto.mjs';
assert(fs.existsSync(cleanupPath), 'script de limpeza do módulo Multas ausente');

const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
assert(pkg.scripts?.precheck === 'node scripts/limpar-modulo-multas-obsoleto.mjs', 'precheck deve limpar arquivos obsoletos de Multas');
assert(pkg.scripts?.['prebuild:cloudflare'] === 'node scripts/limpar-modulo-multas-obsoleto.mjs', 'prebuild:cloudflare deve limpar arquivos obsoletos de Multas');

const source = fs.readFileSync(cleanupPath, 'utf8');
for (const path of [
  'client/src/pages/Multas.tsx',
  'server/routes/multas.routes.ts',
  'server/controllers/multas.controller.ts',
  'server/services/multas.service.ts',
  'server/services/dnit-jobs.service.ts',
]) {
  assert(source.includes(path), `limpeza não contempla ${path}`);
}

console.log('limpeza de arquivos obsoletos de Multas: ok');
