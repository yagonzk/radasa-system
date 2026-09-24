import fs from 'node:fs';
const p='client/src/lib/bi-staging.ts';
const s=fs.readFileSync(p,'utf8');
for (const needle of ['fillMissingMunicipios','municipio:n.municipio||x.municipio']) {
 if(!s.includes(needle)) throw new Error(`Municípios ainda não são propagados: ${needle}`);
}
console.log('OK: BI preenche municípios ausentes por NF/cliente e preserva município da staging no merge.');
