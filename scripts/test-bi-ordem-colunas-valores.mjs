import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
const fields='["nfSerie","razaoSocial","cliente","clienteCod","produtoCod","produto","quantidade","valorUnitProduto","faturamento","freteUnit","frete","percentual","placa","data","municipio"]';
const headers="'Qtde','Valor Unitário do Produto','Faturamento','V. Unit. Frete','Frete Total','% Frete/Faturamento'";
if(!s.includes(fields)) throw new Error('Ordem dos campos da Consulta Geral incorreta');
if(!s.includes(headers)) throw new Error('Ordem visual das colunas incorreta');
console.log('OK: ordem Quantidade > Valor Unitário Produto > Faturamento > Valor Unitário Frete > Frete Total.');
