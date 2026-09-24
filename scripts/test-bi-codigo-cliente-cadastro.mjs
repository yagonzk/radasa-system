import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
for (const token of ['clienteLookup','codigoInterno','clienteCod:x.clienteCod||clienteCadastro?.codigoInterno||""']) {
  if(!s.includes(token)) throw new Error(`Falta enriquecimento do código do cliente pelo cadastro: ${token}`);
}
console.log('OK: BI completa código do cliente usando cadastro quando staging não possui código.');
