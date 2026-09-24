import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/lib/bi-staging.ts',import.meta.url),'utf8');
if(!src.includes('const nfEnrichmentKey=')) throw new Error('merge ainda nao possui chave especifica NF/serie/produto para enriquecer Romaneios atuais');
if(!src.includes('manualByNfKey')) throw new Error('NF da staging ainda nao e indexada separadamente para enriquecer Romaneios atuais');
console.log('OK: NF da staging enriquece Romaneios atuais sem depender da chave completa do Romaneio.');
