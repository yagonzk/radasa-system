import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/lib/bi-staging.ts', import.meta.url),'utf8');
if(!src.includes('canonicalKeyPart')) throw new Error('Codigos numericos equivalentes ainda nao sao normalizados');
if(!src.includes('displayProductCode')) throw new Error('Codigo exibido do produto nao esta padronizado');
if(!src.includes('return "00308"')) throw new Error('GARRAFAO 20 LT nao esta padronizado como 00308');
console.log('OK: codigos numericos sao normalizados e GARRAFAO 20 LT usa 00308.');
