import assert from 'node:assert/strict';
import fs from 'node:fs';

const agent = fs.readFileSync('dnit-agent/index.ts', 'utf8');
const login = fs.readFileSync('dnit-agent/login.ts', 'utf8');
const jobs = fs.readFileSync('server/services/dnit-jobs.service.ts', 'utf8');
const page = fs.readFileSync('client/src/pages/Multas.tsx', 'utf8');

assert.match(login, /createInterface/);
assert.match(login, /pressione ENTER/i);
assert.match(login, /SENATRAN_LOGIN_VEHICLES/);
assert.match(login, /remote-debugging-port/);
assert.match(agent, /connectOverCDP/);
assert.match(agent, /async function isLoginRequired/);
assert.match(agent, /openNormalLoginBrowser/);
assert.match(agent, /aguardando.*login/i);
assert.doesNotMatch(agent, /clientCertificates/);
assert.doesNotMatch(agent, /loadCompanyCertificate/);
assert.doesNotMatch(agent, /CERTIFICADO_ERRO/);
assert.doesNotMatch(jobs, /Cadastre o certificado digital A1/);
assert.doesNotMatch(page, /usa automaticamente o certificado A1/);
assert.match(page, /faça o login.*pressione ENTER/i);

console.log('senatran manual login regression: ok');
