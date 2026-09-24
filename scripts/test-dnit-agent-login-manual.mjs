import assert from 'node:assert/strict';
import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

const portalPath = new URL('../dnit-agent/portal.js', import.meta.url);
const portal = await import(pathToFileURL(portalPath.pathname).href);

assert.equal(typeof portal.detectAccessStage, 'function', 'detectAccessStage precisa existir');
assert.equal(portal.detectAccessStage({ url: 'https://sso.acesso.gov.br/login', text: 'Entrar com gov.br', vehicleFormVisible: false }), 'LOGIN');
assert.equal(portal.detectAccessStage({ url: 'https://servicos.dnit.gov.br/multas/consulta-multas/veiculo', text: 'Consulta de veículo', vehicleFormVisible: true }), 'VEHICLE_FORM');
assert.equal(portal.detectAccessStage({ url: 'https://servicos.dnit.gov.br/multas/consulta-multas/veiculo', text: 'Captcha', vehicleFormVisible: false }), 'LOGIN');

const agent = fs.readFileSync(new URL('../dnit-agent/index.ts', import.meta.url), 'utf8');
const service = fs.readFileSync(new URL('../server/services/dnit-jobs.service.ts', import.meta.url), 'utf8');
const ui = fs.readFileSync(new URL('../client/src/pages/Multas.tsx', import.meta.url), 'utf8');

assert.doesNotMatch(agent, /waitForVehicleFormAfterManualLogin/);
assert.match(agent, /openNormalLoginBrowser/);
assert.match(agent, /AGUARDANDO_LOGIN/);
assert.match(agent, /navegador normal/i);
assert.match(service, /AGUARDANDO_LOGIN/);
assert.match(ui, /AGUARDANDO_LOGIN/);
assert.match(ui, /Faça o login manualmente/i);

console.log('dnit manual login regression: ok');
