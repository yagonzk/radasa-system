import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/lib/bi-staging.ts', import.meta.url),'utf8');
if(!src.includes('productMatches=nfMatches.filter')) throw new Error('NF ainda nao filtra o item correspondente antes de associar ao frete');
if(!src.includes('productIdentity(n?.produto_cod,n?.produto_desc)===productIdentity(r.produto_cod,r.produto)')) throw new Error('NF ainda pode multiplicar o frete porque o produto nao e cruzado semanticamente');
if(!src.includes('const matches=productMatches.length?productMatches:[null]')) throw new Error('Leitura da staging nao preserva uma unica linha de frete quando nao ha item NF correspondente');
console.log('OK: NF cruza o produto semanticamente sem multiplicar o frete do romaneio.');
