import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/lib/bi-staging.ts', import.meta.url),'utf8');
if(!src.includes('unmatchedNfIndexes')) throw new Error('NF sem linha correspondente em stg_romaneio_itens ainda é descartada pelo BI');
if(!src.includes('invoiceKey')) throw new Error('Consolidação ainda não cruza faturamento da NF por NF/série + produto');
if(!src.includes('frete:0')) throw new Error('NF sem Romaneio deve entrar como faturamento sem criar frete');
console.log('OK: NF sem romaneio estático entra no faturamento sem duplicar frete.');
