import assert from 'node:assert/strict';
import { interpretarTextoCrlv } from '../server/services/crlv-text-parser.ts';

const sample = `
CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEÍCULO DIGITAL
CÓDIGO RENAVAM
01234567890
PLACA
RAX6E36
EXERCÍCIO
2026
ANO FABRICAÇÃO
2022
ANO MODELO
2023
MARCA / MODELO / VERSÃO
VW/30.330 CRC 8X2
CHASSI
9BWZZZ377VT004251
COR PREDOMINANTE
BRANCA
COMBUSTÍVEL
DIESEL
NOME
D BARBIERO E CIA LTDA
CATEGORIA
ALUGUEL
ESPÉCIE / TIPO
CARGA/CAMINHAO
`;

const parsed = interpretarTextoCrlv(sample);
assert.equal(parsed.placa, 'RAX-6E36');
assert.equal(parsed.renavam, '01234567890');
assert.equal(parsed.chassi, '9BWZZZ377VT004251');
assert.equal(parsed.anoFabricacao, 2022);
assert.equal(parsed.anoModelo, 2023);
assert.equal(parsed.marca, 'VW');
assert.equal(parsed.modelo, '30.330 CRC 8X2');
assert.equal(parsed.cor, 'BRANCA');
assert.equal(parsed.combustivel, 'DIESEL');
assert.equal(parsed.proprietario, 'D BARBIERO E CIA LTDA');
assert.equal(parsed.subcategoria, 'CAMINHAO');
assert.equal(parsed.exercicio, 2026);

const inline = interpretarTextoCrlv(`PLACA: RAQ5F96 RENAVAM: 00987654321 CHASSI: 93XHNK7408C123456 ANO FABRICAÇÃO/MODELO: 2019/2020 MARCA/MODELO: IVECO/TECTOR 310E30 COR: BRANCO COMBUSTÍVEL: DIESEL`);
assert.equal(inline.placa, 'RAQ-5F96');
assert.equal(inline.renavam, '00987654321');
assert.equal(inline.anoFabricacao, 2019);
assert.equal(inline.anoModelo, 2020);

console.log('CRLV parser regression: OK');
