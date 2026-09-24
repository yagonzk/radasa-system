import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/lib/bi-staging.ts', import.meta.url),'utf8');
if(!src.includes('GARRAFAO20L')) throw new Error('BI ainda nao possui identidade semantica para GARRAFAO 20 LT');
if(!src.includes('return "00308"')) throw new Error('BI ainda nao padroniza GARRAFAO 20 LT no codigo correto 00308');
if(!src.includes('productIdentity(x.produtoCod,x.produto)')) throw new Error('Cruzamento NF/Romaneio ainda depende apenas do codigo e pode perder o frete');
if(!src.includes('productIdentity(n?.produto_cod,n?.produto_desc)===productIdentity(r.produto_cod,r.produto)')) throw new Error('Leitura da staging ainda cruza produto somente pelo codigo');
console.log('OK: GARRAFAO 20 LT usa codigo 00308 e cruza NF/frete pela identidade do produto.');
