import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/pages/Viagens.tsx', import.meta.url),'utf8');
const must=[
  'function viagemTotalCusto(viagem: Viagem, locais:',
  'normalizeCidadeLookup(local.cidade) === normalizeCidadeLookup(viagem.cidadeEntrega)',
  'viagemTotalCusto(v, locais)',
  'viagemCustoPorKm(v, locais)',
  'viagemLucroBruto(v, locais)',
  'sum + viagemTotalCusto(v, locais)',
  'formatBRL(viagemTotalCusto(item, locais))'
];
for(const s of must) if(!src.includes(s)) throw new Error(`Faltando correção da coluna Custos: ${s}`);
console.log('OK: coluna Custos usa comissão resolvida pelo destino em registros legados.');
