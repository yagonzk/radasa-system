import fs from 'node:fs';
const mustNotExist = [
  'client/src/pages/Multas.tsx',
  'server/routes/multas.routes.ts',
  'server/controllers/multas.controller.ts',
  'server/services/multas.service.ts',
  'server/services/dnit-jobs.service.ts',
  'dnit-agent/index.ts', 'dnit-agent/login.ts', 'dnit-agent/portal.js',
  'Iniciar-SENATRAN-Agent.bat'
];
for (const f of mustNotExist) if (fs.existsSync(f)) throw new Error(`arquivo ainda existe: ${f}`);
const checks = [
 ['client/src/App.tsx', /pages\/Multas|path="\/multas"/i],
 ['client/src/components/Layout.tsx', /label:\s*"Multas"|href:\s*"\/multas"/i],
 ['client/src/lib/store.ts', /function\s+useMultas|\/multas/i],
 ['server/routes/index.ts', /multas\.routes|use\("\/multas"/i],
 ['package.json', /senatran-agent|dnit-agent/i],
];
for (const [f,re] of checks) { const s=fs.readFileSync(f,'utf8'); if(re.test(s)) throw new Error(`${f} ainda referencia módulo Multas`); }
console.log('remoção módulo multas: ok');
