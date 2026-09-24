import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
const required=[
 'x={1122} y={15.1} w={118}',
 'x={850} y={88.9} w={238}',
 'x={1110} y={89.8} w={130}',
 'x={1122} y={14.4} w={118}',
 'x={1110} y={87.1} w={130}'
];
for(const x of required) if(!s.includes(x)) throw new Error(`Filtro ainda fora da safe-area: ${x}`);
if(!s.includes('maxWidth:"100%"')) throw new Error('Slicer sem limite de largura interna');
console.log('OK: filtros do BI respeitam safe-area e largura interna.');
