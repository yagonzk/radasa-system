import fs from 'node:fs';
const app=fs.readFileSync('client/src/App.tsx','utf8');
const layout=fs.readFileSync('client/src/components/Layout.tsx','utf8');
const page=fs.existsSync('client/src/pages/BIV2.tsx')?fs.readFileSync('client/src/pages/BIV2.tsx','utf8'):'';
const checks=[
 ['lazy BI v2', app.includes('BIV2')],
 ['rota /bi-v2', app.includes('path="/bi-v2"')],
 ['menu BI v2', layout.includes('label: "BI v2"') && layout.includes('href: "/bi-v2"')],
 ['preserva BI normal', layout.includes('label: "BI Gerencial"') && app.includes('path="/bi"')],
 ['usa staging existente', page.includes('readStagingBiFacts') && page.includes('mergeStagingBiFacts') && page.includes('/dados/romaneio_nf_staging.xlsx')],
 ['usa romaneios atuais', page.includes('useRomaneios') && page.includes('liveStagingFacts')],
 ['filtros data placa cliente produto', ['Data inicial','Data final','Placa','Cliente','Produto'].every(x=>page.includes(x))],
 ['KPIs principais', ['Faturamento','Frete total','Quantidade','Valor unitário produto','Valor unitário frete','Frete / faturamento'].every(x=>page.includes(x))],
 ['consulta detalhada e total', page.includes('Consulta Geral') && page.includes('TOTAL')],
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){console.error('FALHOU:',failed.map(([n])=>n).join(', '));process.exit(1)}
console.log('OK: BI v2 criado preservando BI normal e staging existente.');
