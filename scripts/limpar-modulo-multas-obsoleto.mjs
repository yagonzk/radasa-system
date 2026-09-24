import fs from 'node:fs';
import path from 'node:path';

const obsoletePaths = [
  'client/src/pages/Multas.tsx',
  'server/routes/multas.routes.ts',
  'server/controllers/multas.controller.ts',
  'server/services/multas.service.ts',
  'server/services/dnit-jobs.service.ts',
  'dnit-agent',
  'Iniciar-DNIT-Agent.bat',
  'Iniciar-SENATRAN-Agent.bat',
];

let removed = 0;
for (const relativePath of obsoletePaths) {
  const absolutePath = path.resolve(process.cwd(), relativePath);
  if (!fs.existsSync(absolutePath)) continue;
  fs.rmSync(absolutePath, { recursive: true, force: true });
  removed += 1;
  console.log(`[limpeza] removido arquivo obsoleto: ${relativePath}`);
}

if (removed === 0) {
  console.log('[limpeza] nenhum arquivo obsoleto do módulo Multas encontrado.');
}
