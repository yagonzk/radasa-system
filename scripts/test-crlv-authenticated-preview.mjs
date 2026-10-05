import assert from 'node:assert/strict';
import fs from 'node:fs';

const ui = fs.readFileSync('client/src/components/cadastros/VeiculoTab.tsx', 'utf8');

assert.match(
  ui,
  /api\.get<Blob>\(\s*`\/veiculos\/\$\{id\}\/crlv-pdf`\s*,\s*\{\s*responseType:\s*"blob"\s*\}\s*\)/,
  'visualizacao do CRLV deve buscar o PDF via api.get com responseType blob para enviar Authorization'
);
assert.doesNotMatch(
  ui,
  /window\.open\(`\/api\/veiculos\/\$\{editingId\}\/crlv-pdf`/,
  'visualizacao do CRLV nao deve abrir /api diretamente, pois a nova aba nao envia o token Bearer'
);

console.log('CRLV authenticated preview regression: OK');
