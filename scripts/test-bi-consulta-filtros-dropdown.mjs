import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
if(!s.includes('function ColumnMultiFilter')) throw new Error('Consulta Geral ainda não possui filtro dropdown por coluna');
if(s.includes('placeholder="Filtrar" value={consultaColumnFilters[field]')) throw new Error('Consulta Geral ainda usa campos de texto por coluna');
if(!s.includes('Pesquisar opções...')) throw new Error('Filtro por coluna precisa permitir pesquisar opções existentes');
if(!s.includes('consultaColumnFilters[field]?.includes')) throw new Error('Filtro por coluna precisa selecionar valores existentes');
console.log('OK: Consulta Geral usa dropdown pesquisável/multisseleção por coluna.');
