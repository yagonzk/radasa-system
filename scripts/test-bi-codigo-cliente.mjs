import fs from 'node:fs';
const staging=fs.readFileSync('client/src/lib/bi-staging.ts','utf8');
const bi=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
for(const token of ['clienteCod:string','clienteLoja:string','clienteCod:doc(r.cliente_cod)','clienteLoja:doc(r.cliente_loja)']) if(!staging.includes(token)) throw new Error(`staging sem ${token}`);
if(!bi.includes("'Cód. Cliente'")) throw new Error('Consulta Geral sem coluna Cód. Cliente');
if(!bi.includes('x.clienteCod')) throw new Error('BI não exibe código do cliente');
if(!bi.includes('clienteCod:c?.codigoInterno||""')) throw new Error('Romaneios atuais não alimentam código do cliente');
console.log('OK: código do cliente percorre staging, Romaneios atuais e Consulta Geral.');
