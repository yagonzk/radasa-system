import fs from 'node:fs';
const s=fs.readFileSync(new URL('../client/src/pages/BIGerencial.tsx', import.meta.url),'utf8');
const req=[
 'x={1139.5} y={15.1} w={123.7}',
 'x={868.1} y={88.9} w={226.2}',
 'x={1159.9} y={89.8} w={103.2}',
 'x={1140.1} y={14.4} w={125.7}',
 'x={1154.5} y={87.1} w={101.4}',
 'className="flex items-center overflow-visible px-[4%]"'
];
for(const x of req) if(!s.includes(x)) throw new Error(`Layout do filtro não respeita slot original: ${x}`);
console.log('OK: filtros permanecem nos slots do template e encolhem internamente.');
