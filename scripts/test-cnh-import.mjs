import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import ts from 'typescript';

// Testa apenas parser puro: não carrega documentos nem bibliotecas de OCR/PDF.
const code = ts.transpileModule(fs.readFileSync('client/src/lib/cnhImport.ts', 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const context = { exports: {}, require(id) { if (id === 'pdfjs-dist') return { GlobalWorkerOptions: {}, getDocument: () => {} }; return {}; } };
vm.runInNewContext(code, context);
const parse = context.exports.interpretarCamposCnh;
const { dados, avisos } = parse({
  nome: '2 E 1 NOME E SOBRENOME\nMARIO SILVA PEREIRA',
  cpf: '4d CPF\n529.982.247-25',
  rg: '12345678 SSP MT',
  dataNascimento: '05/06/1997, MUNICIPIO, PR',
  primeiraHabilitacao: '30/01/2019',
  cnhEmissao: '03/06/2024',
  cnhValidade: '17/04/2034',
  cnhRegistro: '50 07204829912',
  cnhCategoria: 'CAT HAB\nAA AD',
});
assert.equal(dados.nome, 'MARIO SILVA PEREIRA');
assert.equal(dados.cpf, '52998224725');
assert.equal(dados.rg, '12345678');
assert.equal(dados.dataNascimento, '1997-06-05');
assert.equal(dados.primeiraHabilitacao, '2019-01-30');
assert.equal(dados.cnhEmissao, '2024-06-03');
assert.equal(dados.cnhValidade, '2034-04-17');
assert.equal(dados.cnhRegistro, '07204829912');
assert.equal(dados.cnhNumero, dados.cnhRegistro);
assert.equal(dados.cnhCategoria, 'AD');
assert.equal(avisos.length, 0);
assert.equal(parse({cpf:'529.982.247-26',cnhEmissao:'31/02/2024',nome:'CNH DIGITAL'}).dados.cpf,undefined);
assert.equal(parse({cpf:'529.982.247-26',cnhEmissao:'31/02/2024',nome:'CNH DIGITAL'}).dados.cnhEmissao,undefined);
// Casos de regressão: leitura de um campo numérico com espaços e categoria em duas letras.
const separated = parse({
  cpf: '4d CPF\n5 2 9 . 9 8 2 . 2 4 7 - 2 5',
  cnhCategoria: '9 CAT HAB\nA D',
});
assert.equal(separated.dados.cpf, '52998224725');
assert.equal(separated.dados.cnhCategoria, 'AD');
const invalid = parse({ cpf: '4d CPF\n529.982.247-26', cnhCategoria: 'CAT HAB\nAD' });
assert.equal(invalid.dados.cpf, undefined);
assert.ok(invalid.avisos.some(aviso => aviso.includes('4d')));
console.log('CNH parser: 16 verificações passaram.');
