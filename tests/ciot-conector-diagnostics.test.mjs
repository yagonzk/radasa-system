import test from 'node:test';
import assert from 'node:assert/strict';
import { safeConnectorRejection } from '../server/services/ciot-connector-diagnostics.ts';

test('identifica divergencia de ambiente sem mostrar dados arbitrarios', () => {
  const result = safeConnectorRejection(400, JSON.stringify({ error: 'ENVIRONMENT_MISMATCH' }));
  assert.equal(result.connectorCode, 'ENVIRONMENT_MISMATCH');
  assert.match(result.recommendedNextStep, /ambientes diferentes/);
});
test('identifica divergencia de empresa', () => {
  const result = safeConnectorRejection(400, JSON.stringify({ error: 'COMPANY_MISMATCH' }));
  assert.equal(result.connectorCode, 'COMPANY_MISMATCH');
  assert.match(result.recommendedNextStep, /CNPJ/);
});
test('resposta arbitraria nao e refletida na tela', () => {
  const leak = '<html>token-secreto user information</html>';
  const result = safeConnectorRejection(400, leak);
  assert.equal(result.connectorCode, undefined);
  assert.doesNotMatch(result.recommendedNextStep, /token-secreto/);
});
test('nao repassa codigos desconhecidos nem objetos inesperados', () => {
  const x = safeConnectorRejection(400, JSON.stringify({ error: 'MY_SECRET', password: 'test' }));
  assert.equal(x.connectorCode, undefined);
  assert.doesNotMatch(x.recommendedNextStep, /MY_SECRET|password/);
  assert.equal(safeConnectorRejection(400, 'x'.repeat(5000)).connectorCode, undefined);
});
test('diferencia negativa de autenticacao', () => {
  const x = safeConnectorRejection(401, JSON.stringify({ error: 'UNAUTHORIZED' }));
  assert.match(x.recommendedNextStep, /acesso ao conector foi negado/i);
});
test('worker propaga apenas codigos permitidos e nunca corpo bruto', async () => {
  const fs = await import('node:fs/promises');
  const code = await fs.readFile(new URL('../server/services/antt-ciot.service.ts', import.meta.url), 'utf8');
  assert.match(code, /safeConnectorRejection\(response.status, rejectionBody\)/);
  assert.match(code, /connectorCode: rejection.connectorCode/);
  assert.match(code, /reader.cancel\(\)/);
});
