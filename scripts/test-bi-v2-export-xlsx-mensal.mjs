import fs from 'node:fs';
const src=fs.readFileSync(new URL('../client/src/pages/BIV2.tsx',import.meta.url),'utf8');
const checks=[
 ['xlsx import',/from ["']xlsx["']/],
 ['export button',/Exportar XLSX/],
 ['general sheet',/book_append_sheet\([^\n]*["']GERAL["']/],
 ['monthly sheets',/monthSheetName|monthName|monthNames/],
 ['uses filtered consulta rows',/export[\s\S]{0,5000}(consultaFiltered|rows)/i],
 ['total row',/TOTAL/],
 ['xlsx filename',/\.xlsx/]
];
let failed=0; for(const [name,re] of checks){if(!re.test(src)){console.error('FAIL',name);failed++}else console.log('PASS',name)}
if(failed) process.exit(1);
