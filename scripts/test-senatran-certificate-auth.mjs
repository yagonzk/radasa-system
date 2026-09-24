import assert from 'node:assert/strict';
import fs from 'node:fs';

const agent = fs.readFileSync('dnit-agent/index.ts', 'utf8');
const login = fs.readFileSync('dnit-agent/login.ts', 'utf8');

assert.match(agent, /loadCompanyCertificate/);
assert.match(agent, /certificadoArquivo/);
assert.match(agent, /certificadoSenha/);
assert.match(agent, /clientCertificates/);
assert.match(agent, /certificado\.sso\.acesso\.gov\.br/);
assert.match(agent, /Seu certificado digital/i);
assert.match(agent, /SENATRAN_LOGIN_VEHICLES/);
assert.doesNotMatch(agent, /openNormalLoginBrowser/);
assert.doesNotMatch(login, /press.*ENTER|pressione ENTER|createInterface/i);

console.log('senatran certificate auth regression: ok');
