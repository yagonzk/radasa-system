import assert from 'node:assert/strict';
import { expandirViagensFechamento, formatFechamentoViagemLabel } from './fechamentoViagem.ts';

const locais = [{ id: 'local-lucas', cidade: 'Lucas do Rio Verde', valorComissao: 275 }] as any;
const fechamento = {
  motoristaId: 'mot-1',
  dataInicio: '2026-08-01',
  dataFim: '2026-08-31',
  viagens: [
    { localId: 'local-lucas', quantidade: 1, dataViagem: '2026-08-18' },
    { localId: 'local-lucas', quantidade: 1, dataViagem: '2026-08-21' },
  ],
} as any;

const exibicao = expandirViagensFechamento(fechamento, [], locais);
assert.equal(exibicao.length, 2);
assert.equal(exibicao[0].quantidade, 1);
assert.equal(exibicao[1].quantidade, 1);
assert.equal(formatFechamentoViagemLabel(exibicao[0].dataViagem, exibicao[0].cidade), '18/08/2026 - Lucas do Rio Verde');
assert.equal(formatFechamentoViagemLabel(exibicao[1].dataViagem, exibicao[1].cidade), '21/08/2026 - Lucas do Rio Verde');
console.log('fechamento individual trips regression: PASS');
