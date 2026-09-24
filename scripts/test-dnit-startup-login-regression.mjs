import assert from 'node:assert/strict';
import fs from 'node:fs';

const agent = fs.readFileSync(new URL('../dnit-agent/index.ts', import.meta.url), 'utf8');

assert.match(agent, /async function startAgent\(/, 'agente deve ter uma inicialização assíncrona explícita');
assert.match(agent, /startAgent[\s\S]*openNormalLoginBrowser\(\)[\s\S]*connectToManagedBrowser[\s\S]*Verificação da fila/, 'login normal e conexão CDP devem acontecer antes do início da fila');
assert.match(agent, /login GOV\.BR será feito ANTES|login GOV\.BR antes/i, 'terminal deve explicar que o login vem antes das consultas');
assert.doesNotMatch(agent, /^console\.log\(`\[dnit-agent\] iniciado/m, 'não deve iniciar polling antes do login de startup');

console.log('dnit startup login regression: ok');
