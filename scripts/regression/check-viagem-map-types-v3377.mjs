import fs from 'node:fs';
const src = fs.readFileSync('server/services/viagens.service.ts','utf8');
const count = (src.match(/new Map<string, number>\(/g) || []).length;
if (count < 2) {
  console.error(`FAIL expected explicit Map<string, number> in create/update, found ${count}`);
  process.exit(1);
}
console.log('PASS explicit Map<string, number> used in create/update');
