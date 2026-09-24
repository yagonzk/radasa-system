import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
if(!s.includes('min-w-[1180px]')) throw new Error('BI ainda encolhe abaixo da escala legível em telas estreitas');
if(!s.includes('overflow-x-auto')) throw new Error('Container precisa permitir rolagem horizontal sem reduzir o BI');
console.log('OK: BI preserva escala legível e usa rolagem horizontal quando necessário.');
