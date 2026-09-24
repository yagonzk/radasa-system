import assert from 'node:assert/strict';
import fs from 'node:fs';

const servicePath='server/services/dnit-public.service.ts';
assert.equal(fs.existsSync(servicePath), true, 'serviço público do DNIT deve existir');
const service=fs.readFileSync(servicePath,'utf8');
assert.match(service,/buildDnitQueryFromForm/);
assert.match(service,/parseDnitInfractionsHtml/);
assert.match(service,/placa/);
assert.match(service,/renavam/);
assert.match(service,/servicos\.dnit\.gov\.br\/multas/);

const multas=fs.readFileSync('server/services/multas.service.ts','utf8');
assert.match(multas,/consultarDnitPublico/);
assert.match(multas,/autoInfracao/);
assert.match(multas,/DNIT/);

const ui=fs.readFileSync('client/src/pages/Multas.tsx','utf8');
assert.match(ui,/Buscar multas no DNIT/);
assert.match(ui,/consultandoDnit/);

console.log('DNIT public multas regression: OK');
