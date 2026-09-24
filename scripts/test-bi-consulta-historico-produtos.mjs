import fs from 'node:fs';
const bi=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
const st=fs.readFileSync('client/src/lib/bi-staging.ts','utf8');
const req=[
 ['filtro por coluna',bi.includes('consultaColumnFilters')&&bi.includes('Filtrar')],
 ['texto escuro explicito',bi.includes('text-slate-800')],
 ['produto canonico no facts',bi.includes('canonicalProductIdentity')],
 ['historico inclui copias',st.includes('romaneioSheetNames')&&st.includes('Cópia de stg_romaneio_itens')],
 ['familia galao',st.includes('GALAO20L')||st.includes('GARRAFAO20L')&&st.includes('GALAO')]
];
const bad=req.filter(([,ok])=>!ok);if(bad.length){console.error(bad.map(x=>x[0]).join(', '));process.exit(1)}
console.log('OK: consulta por coluna, tema escuro, produtos canonicos e historico staging.');
