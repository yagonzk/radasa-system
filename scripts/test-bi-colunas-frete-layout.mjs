import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
const header="['NF/Série','Razão Social','Cliente','Cód. Cliente','Cód. Produto','Produto','Qtde','Valor Unitário do Produto','Frete Total','V. Unit. Frete','Faturamento','% Frete/Faturamento','Placa','Data','Município/Endereço']";
if(!s.includes(header)) throw new Error('Ordem esperada das colunas não encontrada ou Romaneio ainda presente');
console.log('OK: Romaneio removido e V. Unit. Frete entre Frete Total e Faturamento.');
