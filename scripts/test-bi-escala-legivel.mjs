import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
if(!s.includes('min-w-[1720px]')) throw new Error('BI precisa manter escala legível na Consulta Geral');
if(!s.includes('max-w-full overflow-auto overscroll-contain')) throw new Error('Tabela do BI precisa permitir rolagem horizontal');
if(!s.includes('bi-chart-scroll max-h-[620px]')) throw new Error('Gráficos precisam de altura limitada e rolagem independente');
console.log('OK: BI mantém colunas legíveis, rolagem horizontal e gráficos com altura adaptável.');
