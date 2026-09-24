import fs from 'node:fs';
const p='client/src/pages/BIV2.tsx';
const s=fs.readFileSync(p,'utf8');
if(!s.includes('min-h-screen bg-background')) throw new Error('BI v2 deve usar o fundo semântico do sistema');
if(!s.includes('bg-card')) throw new Error('BI v2 deve usar cards do tema do sistema');
if(!s.includes('text-muted-foreground')) throw new Error('BI v2 deve usar texto secundário do tema');
if(s.includes('min-h-screen bg-[#F7FAFC] dark:bg-slate-950')) throw new Error('BI v2 ainda força fundo próprio');
console.log('OK: BI v2 integrado ao tema original do sistema.');
