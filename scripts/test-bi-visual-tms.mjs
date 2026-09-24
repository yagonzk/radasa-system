import fs from 'node:fs';
const s=fs.readFileSync(new URL('../client/src/pages/BIGerencial.tsx', import.meta.url),'utf8');
const must=[
 'itemStyle:{color:"#0F172A"}',
 'labelStyle:{color:"#0F172A",fontWeight:700}',
 'const compactLabel=',
 'tickFormatter={compactLabel}',
 'barSize={18}',
 'bg-[#0B3B63]',
 'text-white',
 'max-h-[190px]'
];
for(const x of must) if(!s.includes(x)) throw new Error(`BI visual ainda sem padrão esperado: ${x}`);
console.log('OK: BI com tooltip legível, gráficos compactos e filtros TMS padronizados.');
