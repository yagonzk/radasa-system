import fs from 'node:fs';
const client=fs.readFileSync('client/src/pages/Viagens.tsx','utf8');
const server=fs.readFileSync('server/services/viagens.service.ts','utf8');
const expected=/replace\(\/\\s\*\[\\\/,-\]\?\\s\*\(MT\|PA\)\$\/i, ""\)/;
if(!expected.test(client)) throw new Error('Cliente ainda nao normaliza cidade com separador antes da UF');
if(!expected.test(server)) throw new Error('Servidor ainda nao normaliza cidade com separador antes da UF');
console.log('OK: cidade/UF normalizada de forma consistente no Acerto de Viagem.');
