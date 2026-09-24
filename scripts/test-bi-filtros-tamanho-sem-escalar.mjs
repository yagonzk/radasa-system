import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
if(s.includes('min-w-[1180px]')) throw new Error('BI ainda força escala mínima do canvas');
if(!s.includes('bi-canvas relative mx-auto aspect-[16/9] w-full max-w-[1280px]')) throw new Error('Canvas não voltou ao tamanho responsivo original');
if(s.includes('overflow-visible px-[4%]')) throw new Error('Filtro ainda está sendo encolhido por padding percentual');
if(!s.includes('h-[72%] min-h-0 w-[calc(100%-8px)]')) throw new Error('Filtro não possui ajuste local de tamanho');
console.log('OK: canvas original preservado; somente filtros têm ajuste local.');
