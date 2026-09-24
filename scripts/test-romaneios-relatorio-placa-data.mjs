import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/Romaneios.tsx','utf8');
for (const token of [
  'const [reportPlate, setReportPlate]',
  'const [reportDateFrom, setReportDateFrom]',
  'const [reportDateTo, setReportDateTo]',
  'Placa do relatório',
  'Data inicial do relatório',
  'Data final do relatório',
  'reportFiltered',
]) if(!s.includes(token)) throw new Error(`Falta filtro de relatório: ${token}`);
console.log('OK: relatório de Romaneios possui filtros próprios de placa e período.');
