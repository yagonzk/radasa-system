import fs from 'node:fs';

const source = fs.readFileSync(new URL('../client/src/pages/Estoque.tsx', import.meta.url), 'utf8');
const required = [
  'remove: removeSubcategoria',
  'const deleteSubcategoria = async',
  'Subcategorias do almoxarifado',
  'Nova subcategoria',
  'Subcategorias cadastradas',
  'onClick={() => void deleteSubcategoria(item)}',
  'aria-label={`Remover subcategoria ${item.nome}`}',
  'Nenhuma subcategoria cadastrada para esta categoria.',
];

const missing = required.filter((marker) => !source.includes(marker));
if (missing.length) {
  console.error('FAIL: gerenciamento de subcategorias ainda não espelha o de categorias.');
  for (const marker of missing) console.error(`- ausente: ${marker}`);
  process.exit(1);
}

console.log('PASS: gerenciamento de subcategorias permite adicionar e remover como categorias.');
