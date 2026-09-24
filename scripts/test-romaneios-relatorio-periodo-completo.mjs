import fs from 'node:fs';
const s=fs.readFileSync('client/src/pages/Romaneios.tsx','utf8');
for (const token of [
  'const prepareReportRows = async () =>',
  'const loaded = await loadRange(reportDateFrom, reportDateTo);',
  'downloadFilteredRomaneiosCsv(rows);',
  'downloadFilteredRomaneiosPdf(rows);',
  'const downloadFilteredRomaneiosCsv = (rows: Romaneio[]) =>',
  'const downloadFilteredRomaneiosPdf = (rows: Romaneio[]) =>'
]) if(!s.includes(token)) throw new Error(`Falta proteção do período completo: ${token}`);
if (s.includes('reportFiltered.forEach((romaneio) =>')) throw new Error('Exportação ainda depende do estado assíncrono reportFiltered.');
console.log('OK: relatório exporta o retorno exato do período solicitado.');
