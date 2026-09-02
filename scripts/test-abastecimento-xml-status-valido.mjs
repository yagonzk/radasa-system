import fs from 'node:fs';

const route = fs.readFileSync('server/routes/abastecimentos-xml.routes.ts', 'utf8');
const service = fs.readFileSync('server/services/abastecimento-xml.service.ts', 'utf8');

const checks = [
  ['falha de sugestão não marca XML como inválido', /catch \(error\) \{[\s\S]*?status:\s*"PENDENTE"[\s\S]*?documento:\s*document[\s\S]*?xmlUrl:/m.test(route)],
  ['falha de sugestão preserva pendência de vínculos', /pendencias:\s*\[["']vínculos["']\]/i.test(route)],
  ['conferência não cria posto automaticamente', !/if \(!cliente && \(document\.emitente[\s\S]*?resolveOrCreatePostoFromEmitente/m.test(service)],
];

const failed = checks.filter(([, ok]) => !ok);
if (failed.length) {
  console.error('FAIL:', failed.map(([name]) => name).join(', '));
  process.exit(1);
}
console.log('PASS: XML válido não vira inválido por falha de vínculo/cadastro.');
