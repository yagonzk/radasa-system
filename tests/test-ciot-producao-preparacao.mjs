import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { validateBridgeRequest } from '../ciot-conector/servidor.mjs';
const root = new URL('../', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, root), 'utf8');
test('ambiente de produção depende de confirmação explícita do operador local', () => {
  const script = read('Alternar-Ambiente-Conector-CIOT.ps1');
  assert.match(script, /Read-Host.*ATIVAR CIOT PRODUCAO/);
  assert.match(script, /Confirmacao nao recebida/);
  assert.match(script, /allowProduction/);
  assert.match(script, /ProtectedData\]::Protect/);
  assert.match(script, /previousBytes/);
});
test('inicializador habilita produção apenas quando segredo protegido permite', () => {
  const launcher = read('Iniciar-Conector-CIOT.ps1');
  assert.match(launcher, /CIOT_BRIDGE_ALLOW_PRODUCTION/);
  assert.match(launcher, /\$cfg\.allowProduction -eq "SIM"/);
  const server = read('ciot-conector/servidor.mjs');
  assert.match(server, /CIOT_BRIDGE_ALLOW_PRODUCTION !== "SIM"/);
});
test('Worker de produção exige conector local e não faz fallback mTLS', () => {
  const service = read('server/services/antt-ciot.service.ts');
  assert.match(service, /ANTT_PRODUCTION_CONNECTOR_REQUIRED/);
  assert.match(service, /env\.ANTT_CIOT_ENVIRONMENT === "producao" && !connectorEnabled/);
});
test('ambiente de emissão é validado contra o conector local', () => {
  const base = { companyCnpj:'15209274000162',environment:'producao',method:'POST',generator:false,path:'ConsultarSituacaoTransportador',headers:{},payload:{} };
  assert.equal(validateBridgeRequest(base,'15209274000162','producao').path,base.path);
  assert.throws(()=>validateBridgeRequest(base,'15209274000162','homologacao'),/ENVIRONMENT_MISMATCH/);
});
test('publicação de produção exige confirmação independente', () => {
  const script = read('scripts/configurar-ciot-cloudflare.mjs');
  assert.match(script, /--confirmar-producao/);
  assert.match(script, /environment === "producao" && !productionConfirmed/);
  const wrangler = read('wrangler.jsonc');
  assert.match(wrangler, /"ANTT_CIOT_ENVIRONMENT": "homologacao"/);
});
