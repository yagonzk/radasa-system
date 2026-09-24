import assert from 'node:assert/strict';
import fs from 'node:fs';

const agent = fs.readFileSync(new URL('../dnit-agent/index.ts', import.meta.url), 'utf8');
const login = fs.readFileSync(new URL('../dnit-agent/login.ts', import.meta.url), 'utf8');
const pkg = JSON.parse(fs.readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

assert.equal(agent.includes('waitForVehicleFormAfterManualLogin'), false, 'agente não deve tentar login GOV.BR dentro do Playwright');
assert.match(agent, /Sessão GOV\.BR não autenticada|login GOV\.BR/i, 'agente deve orientar login antes da automação');
assert.match(login, /spawn\(/, 'login deve abrir navegador normal via processo do sistema');
assert.match(login, /--user-data-dir=/, 'login normal deve usar perfil persistente dedicado');
assert.equal(pkg.scripts['login:dnit-agent'], 'tsx dnit-agent/login.ts');
assert.match(login, /readline\/promises/, 'login deve aguardar confirmação explícita do usuário');
assert.match(login, /pressione ENTER/i, 'login deve pedir ENTER depois que o formulário estiver visível');
assert.match(login, /mantenha essa janela aberta|Não feche/i, 'navegador deve permanecer aberto para a conexão CDP');
assert.match(agent, /connectOverCDP/, 'agente deve anexar à mesma janela em vez de relançar o perfil');
assert.doesNotMatch(agent, /launchPersistentContext/, 'agente não deve disputar o perfil com um segundo processo do navegador');
console.log('dnit normal-browser login regression: ok');
