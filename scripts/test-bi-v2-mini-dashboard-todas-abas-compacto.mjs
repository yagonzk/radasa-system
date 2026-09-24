import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/pages/BIV2.tsx',import.meta.url),'utf8');
for (const id of ['produtos-mini-dashboard','clientes-mini-dashboard','placas-mini-dashboard','consulta-mini-dashboard']) {
  if (!src.includes(`data-testid="${id}"`)) throw new Error(`Mini dashboard ausente: ${id}`);
}
for (const token of ['productTabFacts','clientTabFacts','plateTabFacts','tabProdutos','tabClientes','tabPlacas']) {
  if (!src.includes(token)) throw new Error(`Filtro contextual ausente: ${token}`);
}
if (!src.includes('min-w-[1180px]')) throw new Error('Tabela da Consulta Geral não foi compactada');
if (src.includes('min-w-[1550px]')) throw new Error('Largura antiga da tabela ainda presente');
if (!src.includes('table-fixed border-collapse text-[11px]')) throw new Error('Layout compacto da tabela ausente');
console.log('OK: BI v2 com mini dashboards contextuais em todas as miniabas e Consulta Geral compacta.');
