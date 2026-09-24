import fs from 'node:fs';
const p='client/src/pages/BIV2.tsx';
const s=fs.readFileSync(p,'utf8');
const marker='data-testid="consulta-mini-dashboard"';
if(!s.includes(marker)) throw new Error('Consulta Geral ainda não possui a mini dashboard');
const start=s.indexOf(marker), end=s.indexOf('Consulta Geral</h2>', start);
const block=s.slice(start,end);
for (const token of ['tableTotals.faturamento','tableTotals.frete','tableTotals.quantidade','tableTotals.valorProduto','tableTotals.valorFrete','tableTotals.percentual']) {
 if(!block.includes(token)) throw new Error(`Mini dashboard da Consulta não usa ${token}`);
}
console.log('OK: mini dashboard da Consulta Geral acompanha os filtros da tabela.');
