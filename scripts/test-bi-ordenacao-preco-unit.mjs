import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
for (const token of ['value="freteUnit-desc">Maior preço unitário','value="freteUnit-asc">Menor preço unitário']) {
  if(!s.includes(token)) throw new Error(`Falta ordenação: ${token}`);
}
console.log('OK: ordenação por maior/menor preço unitário disponível no BI.');
