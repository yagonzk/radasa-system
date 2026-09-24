import fs from 'node:fs';
const p='client/src/pages/BIV2.tsx';
const s=fs.readFileSync(p,'utf8');
if(!s.includes('tfoot className="sticky bottom-0 z-20 bg-card')) throw new Error('Rodape TOTAL precisa ser opaco e ficar acima das linhas');
if(!s.includes('border-t-2 border-[#0A508E]')) throw new Error('Rodape TOTAL precisa ter separacao visual propria');
console.log('OK: rodape TOTAL do BI v2 separado e opaco.');
