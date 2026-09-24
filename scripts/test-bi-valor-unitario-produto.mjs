import fs from 'node:fs';
const bi=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
const st=fs.readFileSync('client/src/lib/bi-staging.ts','utf8');
for(const x of ['valorUnitProduto:number','Valor Unitário do Produto','x.valorUnitProduto','TOTAL']) if(!bi.includes(x)) throw new Error(`BI sem ${x}`);
for(const x of ['valorUnitProduto:number','v_unit']) if(!st.includes(x)) throw new Error(`staging sem ${x}`);
console.log('OK: valor unitário do produto e totais presentes.');
