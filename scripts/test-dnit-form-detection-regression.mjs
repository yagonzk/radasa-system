import assert from 'node:assert/strict';
import fs from 'node:fs';

const agent = fs.readFileSync(new URL('../dnit-agent/index.ts', import.meta.url), 'utf8');

assert.match(agent, /managedContext\.pages\(\)/, 'startup deve examinar todas as abas abertas do navegador');
assert.match(agent, /page\.frames\(\)/, 'detecção do formulário deve examinar frames/iframes');
assert.match(agent, /Digite a placa|placeholder\*=.*placa/i, 'detecção deve reconhecer o placeholder real do campo Placa');
assert.match(agent, /Digite o renavam|placeholder\*=.*renavam/i, 'detecção deve reconhecer o placeholder real do campo RENAVAM');
assert.doesNotMatch(agent, /const page = managedContext\.pages\(\)\[0\][\s\S]{0,200}page\.goto\(PORTAL/, 'startup não deve navegar cegamente a primeira aba e ignorar a aba DNIT já autenticada');
assert.match(agent, /waitForVehicleForm/i, 'startup deve aguardar renderização do formulário em vez de checar apenas uma vez');

console.log('dnit form detection regression: ok');
