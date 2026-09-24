import fs from 'node:fs';
const staging=fs.readFileSync(new URL('../client/src/lib/bi-staging.ts', import.meta.url),'utf8');
const bi=fs.readFileSync(new URL('../client/src/pages/BIGerencial.tsx', import.meta.url),'utf8');
if(!staging.includes('formatPlate')) throw new Error('staging ainda nao normaliza/formata placas');
if(!bi.includes('formatPlate(r.placaVeiculo')) throw new Error('Romaneios atuais ainda entram com placa sem normalizacao');
console.log('OK: placas sao normalizadas antes de filtros e agrupamentos do BI.');
