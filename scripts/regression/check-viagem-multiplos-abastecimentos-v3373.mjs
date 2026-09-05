import fs from 'node:fs';

const read = (p) => fs.readFileSync(p, 'utf8');
const schema = read('prisma/schema.prisma');
const service = read('server/services/viagens.service.ts');
const validator = read('server/validators/schemas.ts');
const page = read('client/src/pages/Viagens.tsx');
const store = read('client/src/lib/store.ts');

const checks = [
  ['join model exists', /model\s+ViagemAbastecimento\s*\{/.test(schema)],
  ['viagem exposes linked fuel notes', /abastecimentosVinculados\s+ViagemAbastecimento\[\]/.test(schema)],
  ['validator accepts multiple ids', /abastecimentoIds:\s*z\.array\(id\)/.test(validator)],
  ['service validates multiple fuel notes', /abastecimentoIds/.test(service) && /findMany\([\s\S]*abastecimento/.test(service)],
  ['service persists join rows', /viagemAbastecimento\.(createMany|deleteMany)/.test(service)],
  ['store exposes multiple ids', /abastecimentoIds\?:\s*string\[\]/.test(store)],
  ['UI has textual search', /Pesquisar abastecimento|Buscar abastecimento/i.test(page)],
  ['UI supports multiple selection', /abastecimentoIds/.test(page) && /removerAbastecimento|removeAbastecimento/i.test(page)],
];

let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
