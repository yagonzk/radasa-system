import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  normalizePlate,
  detectSenatranState,
  extractSenatranRowsFromText,
} from '../dnit-agent/portal.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

assert.equal(normalizePlate('rau-3i63'), 'RAU3I63');
assert.equal(detectSenatranState('Nenhuma infração encontrada para este veículo.'), 'SEM_MULTAS');
assert.equal(detectSenatranState('Auto de Infração A123456 Órgão Autuador PRF'), 'COM_MULTAS');

const rows = extractSenatranRowsFromText(`
Auto de Infração: A123456789
Órgão Autuador: POLÍCIA RODOVIÁRIA FEDERAL
Código da Infração: 7455
Data da Infração: 06/09/2026
Hora: 13:45
Local: BR-163 KM 100
Descrição: Excesso de velocidade
Valor da Multa: R$ 195,23
Data de Vencimento: 30/09/2026
Situação: Em aberto
`);
assert.equal(rows.length, 1);
assert.equal(rows[0].autoInfracao, 'A123456789');
assert.equal(rows[0].orgaoAutuador, 'POLÍCIA RODOVIÁRIA FEDERAL');
assert.equal(rows[0].dataInfracao, '2026-09-06');
assert.equal(rows[0].valorAtual, 195.23);

const login = read('dnit-agent/login.ts');
assert.match(login, /portalservicos\.senatran\.serpro\.gov\.br/);
assert.match(login, /SENATRAN_HOME = 'https:\/\/portalservicos\.senatran\.serpro\.gov\.br\/#\/home'/);
assert.ok(login.includes("SENATRAN_LOGIN_VEHICLES = 'https://portalservicos.senatran.serpro.gov.br/#/login?nextRoute=%2Fveiculos%2Fmeus-veiculos'"));
assert.match(login, /createInterface/);
assert.match(login, /pressione ENTER/i);

const agent = read('dnit-agent/index.ts');
assert.match(agent, /SENATRAN/);
assert.match(agent, /Consultar Minhas Infrações|consultar minhas infrações/i);
assert.match(agent, /Por ve[ií]culo|por ve[ií]culo/i);
assert.match(agent, /SENATRAN_HOME/);
assert.match(agent, /SENATRAN_LOGIN_VEHICLES/);
assert.match(agent, /connectOverCDP/);
assert.match(agent, /openNormalLoginBrowser/);
assert.match(agent, /extractSenatranRowsFromText/);
assert.match(agent, /ver detalhes|detalhar|detalhes/i);
assert.doesNotMatch(agent, /orgaoAutuador:\s*'DNIT'/);

const jobs = read('server/services/dnit-jobs.service.ts');
assert.match(jobs, /Aguardando agente SENATRAN/);
assert.doesNotMatch(jobs, /Cadastre o RENAVAM do veículo antes da consulta/);

const page = read('client/src/pages/Multas.tsx');
assert.match(page, /SENATRAN Agent/);
assert.match(page, /Consultar Minhas Infrações/);
assert.match(page, /Aguardando agente SENATRAN/);
assert.doesNotMatch(page, /consulta pública ao DNIT/);
assert.doesNotMatch(page, /RENAVAM não cadastrado para este veículo/);

const packageJson = JSON.parse(read('package.json'));
assert.ok(packageJson.scripts['build:senatran-agent']);
assert.ok(packageJson.scripts['start:senatran-agent']);
assert.ok(fs.existsSync(path.join(root, 'Iniciar-SENATRAN-Agent.bat')));

console.log('senatran agent regression: ok');
