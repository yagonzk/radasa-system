import fs from 'node:fs';

const source = fs.readFileSync(new URL('../client/src/pages/Estoque.tsx', import.meta.url), 'utf8');
const required = [
  'sm:max-w-[1040px]',
  'grid-cols-1 gap-5 md:grid-cols-2',
  'Nome do produto',
  'Valor unitário (R$)',
  'Categoria',
  'Subcategoria',
  'min-h-[150px]',
  'Arraste e solte o arquivo XML da NF-e aqui',
  'Arraste e solte o arquivo PDF aqui',
  'onDragOver',
  'onDrop',
  'Selecionar arquivo',
  'XML da NF-e',
  'PDF da NF-e (ou comprovante)',
];

const missing = required.filter((marker) => !source.includes(marker));
if (missing.length) {
  console.error('FAIL: modal do Almoxarifado ainda não segue o layout aprovado.');
  for (const marker of missing) console.error(`- ausente: ${marker}`);
  process.exit(1);
}

console.log('PASS: modal do Almoxarifado segue o layout aprovado com drag-and-drop.');
