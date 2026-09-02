import fs from 'node:fs';

const file = fs.readFileSync('client/src/pages/Estoque.tsx', 'utf8');
const required = [
  'const [produtoFiltro, setProdutoFiltro] = useState("TODOS")',
  'const [subcategoriaFiltro, setSubcategoriaFiltro] = useState("TODAS")',
  '>Produto</Label>',
  '>Subcategoria</Label>',
  'onViewProduct={setViewingProduct}',
  'Visualizar produto',
  'Detalhes do produto em estoque',
  'Histórico de movimentações',
  'Visualizar PDF',
  'Baixar XML',
  'Categoria',
  'Subcategoria',
];
const missing = required.filter((marker) => !file.includes(marker));
if (missing.length) {
  console.error('FAIL: estoque ainda não possui filtros e visualização completa do produto.');
  for (const item of missing) console.error(`- ausente: ${item}`);
  process.exit(1);
}
console.log('PASS: estoque possui filtros de produto/subcategoria e visualização completa com documentos.');
