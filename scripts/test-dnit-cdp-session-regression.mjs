import assert from 'node:assert/strict';
import fs from 'node:fs';

const agent = fs.readFileSync(new URL('../dnit-agent/index.ts', import.meta.url), 'utf8');
const login = fs.readFileSync(new URL('../dnit-agent/login.ts', import.meta.url), 'utf8');

assert.match(agent, /connectOverCDP\(/, 'agente deve se conectar ao navegador já aberto via CDP');
assert.doesNotMatch(agent, /launchPersistentContext\(/, 'agente não deve relançar o perfil persistente com Playwright');
assert.match(login, /--remote-debugging-port=/, 'Brave normal deve iniciar com porta CDP local');
assert.match(login, /127\.0\.0\.1/, 'CDP deve ficar limitado ao localhost');
assert.match(login, /\.dnit-agent-cdp-profile/, 'novo fluxo deve usar perfil dedicado para evitar conflito com perfil antigo');
assert.match(login, /mantenha essa janela aberta|não feche/i, 'login deve instruir a manter o navegador aberto');
assert.match(agent, /navegador permanece aberto/i, 'agente deve informar que reutiliza a mesma sessão');

console.log('dnit cdp session regression: ok');
