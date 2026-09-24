import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIV2.tsx','utf8');
const required=['Visão Geral','Produtos','Clientes','Veículos/Placas','Consulta Geral','Pesquisar ${label.toLowerCase()}','aria-label={`Filtrar ${label}`}','Ordenar por','Maior faturamento','Menor faturamento','Maior frete','Menor frete','Selecionar todos','Limpar'];
const missing=required.filter(x=>!s.includes(x));
if(missing.length){console.error('FALTANDO:',missing.join(', '));process.exit(1)}
const headerFilterUses=(s.match(/<HeaderFilter /g)||[]).length;
if(headerFilterUses<1){console.error('FALTANDO: filtros nas colunas');process.exit(1)}
console.log('OK: BI v2 com abas, pesquisa digitável, filtros por coluna e ordenação.');
