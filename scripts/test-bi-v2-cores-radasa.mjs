import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIV2.tsx','utf8');
for (const token of ['#0A508E','#159447','#F2C318','stroke="#0A508E"','stroke="#159447"','fill="#0A508E"','fill="#F2C318"']) {
  if (!s.includes(token)) throw new Error(`Cor RADASA ausente: ${token}`);
}
console.log('OK: BI v2 usa azul, verde e amarelo RADASA.');
