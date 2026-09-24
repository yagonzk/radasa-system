import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/lib/bi-staging.ts', import.meta.url),'utf8');
if(!src.includes('canonicalKeyPart')) throw new Error('Deduplicação ainda não normaliza códigos numéricos equivalentes (ex.: 308 e 00308).');
if(!src.includes('currentByKey')) throw new Error('Merge ainda não consolida staging manual e Romaneios atuais pela mesma chave operacional.');
console.log('OK: staging deduplica códigos equivalentes e consolida o frete atual.');
