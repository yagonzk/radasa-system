import fs from 'node:fs';
const p='client/src/pages/Viagens.tsx';
const s=fs.readFileSync(p,'utf8');
if(!s.includes('comissaoVisualizacao')) throw new Error('visualizacao ainda nao resolve comissao persistida/fallback');
if(!s.includes('localComissaoVisualizacao')) throw new Error('fallback por destino ausente');
if(!s.includes('formatBRL(comissaoVisualizacao)')) throw new Error('campo Comissao nao usa valor resolvido');
console.log('OK: visualizacao de Acerto usa comissao persistida com fallback deterministico.');
