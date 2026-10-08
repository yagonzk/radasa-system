import fs from 'node:fs';

const file = 'client/src/pages/AgroEstoque.tsx';
const source = fs.readFileSync(file, 'utf8');
const checks = [
  ['usa mapa físico', source.includes('Mapa físico ·')],
  ['orienta hover', source.includes('Passe o mouse sobre um pallet')],
  ['clique edita pallet', source.includes('onClick={() => onEdit(position)}')],
  ['tooltip mostra produto', source.includes('item.produto.nome') && source.includes('TooltipContent')],
  ['tooltip mostra lote', source.includes('Lote ${item.lote.codigo}')],
  ['tooltip mostra validade', source.includes('Validade:')],
  ['tooltip mostra quantidade', source.includes('formatAgroNumber(item.quantidade)')],
  ['pallet suporta múltiplos itens', source.includes('position.itens.map')],
  ['editor mostra conteúdo atual', source.includes('Conteúdo atual do pallet')],
  ['planta tem moldura de barracão', source.includes('border-4 border-muted-foreground/65')],
];
let failed = 0;
for (const [name, ok] of checks) {
  console.log(`${ok ? '✓' : '✗'} ${name}`);
  if (!ok) failed++;
}
if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} verificações passaram.`);
