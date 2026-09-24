import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/pages/BIGerencial.tsx',import.meta.url),'utf8');
if(src.includes('/fiscal/precos-produtos')) throw new Error('BI ainda busca tabela de preços para inventar faturamento sem NF na staging');
if(src.includes('pickPrice(')) throw new Error('BI ainda calcula faturamento de Romaneio atual por preço cadastrado');
if(!src.includes('faturamento:0')) throw new Error('Romaneio atual sem NF staging deve entrar com faturamento zero');
console.log('OK: faturamento só nasce da NF existente na staging; Romaneio atual sozinho não gera faturamento.');
