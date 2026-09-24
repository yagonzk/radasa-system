import fs from 'node:fs';
const files = [
  ['client/src/components/Layout.tsx', 'label: "DRE Operacional"'],
  ['client/src/pages/Financeiro.tsx', '>DRE Operacional</h1>'],
  ['client/src/pages/Dashboard.tsx', 'Abrir DRE Operacional'],
  ['client/src/pages/Manutencao.tsx', 'enviados ao DRE Operacional'],
];
for (const [file, token] of files) {
  const s = fs.readFileSync(file, 'utf8');
  if (!s.includes(token)) throw new Error(`${file}: falta ${token}`);
}
console.log('OK: Financeiro renomeado visualmente para DRE Operacional.');
