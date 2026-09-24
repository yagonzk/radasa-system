import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIV2.tsx','utf8');
for(const token of ['useTheme','bg-background','bg-card','text-foreground','text-muted-foreground','chartTooltipStyle']) if(!s.includes(token)) throw new Error(`tema integrado incompleto: ${token}`);
if(s.includes('min-h-screen bg-[#F7FAFC] dark:bg-slate-950')) throw new Error('BI v2 não deve forçar um fundo escuro diferente do sistema');
console.log('OK: BI v2 acompanha claro/escuro usando o tema original do sistema.');
