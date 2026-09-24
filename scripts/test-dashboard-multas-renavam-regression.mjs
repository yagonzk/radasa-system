import fs from 'node:fs';
const read=(p)=>fs.readFileSync(p,'utf8');
const dashboard=read('server/services/dashboard.service.ts');
const multas=read('server/services/multas.service.ts');
const routes=read('server/routes/veiculos.routes.ts');
const tab=read('client/src/components/cadastros/VeiculoTab.tsx');
const pkg=JSON.parse(read('package.json'));
const checks=[
  ['dashboard is resilient', dashboard.includes('runSettledWithConcurrency')],
  ['dashboard has safe fallback', dashboard.includes('safeResult')],
  ['multas self-heal table', multas.includes('ensureMultasTable')],
  ['renavam lookup route', routes.includes('/consultar-renavam')],
  ['renavam search icon', tab.includes('Search') && tab.includes('consultarRenavam')],
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){for(const [name] of failed) console.error('FAIL',name);process.exit(1)}
for(const [name] of checks) console.log('PASS',name);
