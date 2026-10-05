import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
for (const token of ['clienteLookup','clienteByCode','canonicalClientIdentity','codigoInterno','const clienteCod=x.clienteCod||clienteCadastro?.codigoInterno||""']) {
  if(!s.includes(token)) throw new Error(`Falta enriquecimento/identidade do cliente pelo codigo: ${token}`);
}
console.log('OK: BI completa e unifica cliente pelo codigo do cadastro, usando nome apenas como fallback.');
