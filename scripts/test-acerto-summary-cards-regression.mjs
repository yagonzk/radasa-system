import fs from 'node:fs';

const file = new URL('../client/src/pages/Viagens.tsx', import.meta.url);
const source = fs.readFileSync(file, 'utf8');
const start = source.indexOf('{/* Summary cards */}');
const end = source.indexOf('</div>', source.indexOf('Lucro Bruto', start));
const block = source.slice(start, end + 6);

if (block.includes('Acertos Exibidos')) {
  throw new Error('Card "Acertos Exibidos" ainda existe na mini dash do Acerto de Viagem.');
}
if (!block.includes('lg:grid-cols-3')) {
  throw new Error('Mini dash não foi reorganizada para 3 cards em telas grandes.');
}
for (const label of ['Total de Custos', 'Custo Médio por KM', 'Lucro Bruto']) {
  if (!block.includes(label)) throw new Error(`Card obrigatório ausente: ${label}`);
}
console.log('Acerto summary cards regression: OK');
