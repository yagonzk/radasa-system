import assert from 'node:assert/strict';
import { maintenanceDreValue, isGeneratedMaintenanceEntry } from '../financeiro-dre.ts';

assert.equal(maintenanceDreValue({ valorPecas: 1250, valorMaoObra: 100, valorOutros: 20, desconto: 10 }), 110);
assert.equal(maintenanceDreValue({ valorPecas: 500, valorMaoObra: 0, valorOutros: 0, desconto: 0 }), 0);
assert.equal(maintenanceDreValue({ valorPecas: 0, valorMaoObra: 80, valorOutros: 20, desconto: 150 }), 0);

const osNumbers = new Set(['OS-00001']);
assert.equal(isGeneratedMaintenanceEntry({ categoria: 'Manutenção', numeroDocumento: 'OS-00001' }, osNumbers), true);
assert.equal(isGeneratedMaintenanceEntry({ categoria: 'Manutenção', numeroDocumento: 'MANUAL-1' }, osNumbers), false);
assert.equal(isGeneratedMaintenanceEntry({ categoria: 'Peças', numeroDocumento: 'OS-00001' }, osNumbers), false);

console.log('financeiro-dre tests passed');
