import fs from 'node:fs';

const file = 'client/src/pages/Viagens.tsx';
const source = fs.readFileSync(file, 'utf8');

const checks = [
  ['total lucro bruto is calculated from filtered trips', /const\s+totalLucroBruto\s*=\s*filteredViagens\.reduce\([\s\S]*?viagemLucroBruto\(v\)/],
  ['summary grid supports four cards', /Summary cards[\s\S]*?grid-cols-1[\s\S]*?lg:grid-cols-4/],
  ['summary dashboard has Lucro Bruto card', /Summary cards[\s\S]*?Lucro Bruto[\s\S]*?formatBRL\(totalLucroBruto\)/],
];

let failed = 0;
for (const [label, pattern] of checks) {
  const ok = pattern.test(source);
  console.log(`${ok ? 'PASS' : 'FAIL'} ${label}`);
  if (!ok) failed += 1;
}

if (failed) process.exit(1);
