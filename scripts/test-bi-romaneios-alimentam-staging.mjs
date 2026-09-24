import fs from 'node:fs';
const p='client/src/pages/BIGerencial.tsx';
const s=fs.readFileSync(p,'utf8');
const need=[
  'useRomaneios',
  'liveStagingFacts',
  'mergeStagingBiFacts(manualFacts,liveStagingFacts)',
  'const stagingFacts=',
  'const facts=useMemo<Fact[]>(()=>stagingFacts.map'
];
for(const x of need) if(!s.includes(x)) throw new Error(`BI não alimenta staging com Romaneios atuais: ${x}`);
if(s.includes('const stagingFacts=manualFacts;')) throw new Error('BI ainda está congelado somente na planilha física');
console.log('OK: Romaneios atuais alimentam staging antes dos cálculos do BI.');
