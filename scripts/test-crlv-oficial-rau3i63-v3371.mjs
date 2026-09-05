import assert from 'node:assert/strict';
import { interpretarTextoCrlv } from '../.tmp-crlv-test/crlv-text-parser.js';

// Ordem observada no texto extraído do CRLV-e oficial SENATRAN/DETRAN-MT da RAU3I63.
const officialSenatranText = `
REPÚBLICA FEDERATIVA DO BRASIL
MINISTÉRIO DOS TRANSPORTES
SECRETARIA NACIONAL DE TRÂNSITO - SENATRAN
CÓDIGO RENAVAM
DETRAN CERTIFICADO DE REGISTRO E LICENCIAMENTO DE VEÍCULO - DIGITAL
ANO FABRICAÇÃO
ASSINADO DIGITALMENTE PELO DETRAN
CATEGORIA CAPACIDADE
POTÊNCIA/CILINDRADA PESO BRUTO TOTAL
CMT EIXOS LOTAÇÃO
ANO MODELO
PLACA EXERCÍCIO
MOTOR
CARROCERIA
OBSERVAÇÕES DO VEÍCULO INFORMAÇÕES DO SEGURO DPVAT
NOME
LOCAL DATA
CPF / CNPJ
NÚMERO DO CRV
MARCA / MODELO / VERSÃO
PLACA ANTERIOR / UF CHASSI
COR PREDOMINANTE
ESPÉCIE / TIPO
COMBUSTÍVEL
CÓDIGO DE SEGURANÇA DO CLA CAT
QRCode
01264380841
RAU3I63 2025
2021 2022
213129829423
22890050355 ***
VW/30.280 CRM 8X2
CARGA CAMINHAO
RAU3I63/MT 953658242NR004835
BRANCA DIESEL
ALUGUEL
14.0
277CV/6871 29.0
2095954A175946 36.0 4 02P
FECHADA/CABINE ESTENDIDA
D. BARBIERO E CIA LTDA
15.209.274/0001-62
IPIRANGA DO NORTE MT 16/04/2025
ALF: BANCO VOLKSWAGEN S.A
`;

const parsed = interpretarTextoCrlv(officialSenatranText);
assert.equal(parsed.placa, 'RAU-3I63');
assert.equal(parsed.renavam, '01264380841');
assert.equal(parsed.chassi, '953658242NR004835');
assert.equal(parsed.anoFabricacao, 2021);
assert.equal(parsed.anoModelo, 2022);
assert.equal(parsed.exercicio, 2025);
assert.equal(parsed.marca, 'VW');
assert.equal(parsed.modelo, '30.280 CRM 8X2');
assert.equal(parsed.cor, 'BRANCA');
assert.equal(parsed.combustivel, 'DIESEL');
assert.equal(parsed.proprietario, 'D. BARBIERO E CIA LTDA');
assert.equal(parsed.subcategoria, 'CAMINHAO');
console.log('CRLV oficial RAU3I63 regression: OK');

// Mantém compatibilidade com CRLVs cuja camada de texto vem no formato tradicional, rótulo + valor.
const traditional = interpretarTextoCrlv(`
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
`);
assert.equal(traditional.placa, 'RAX-6E36');
assert.equal(traditional.renavam, '01234567890');
assert.equal(traditional.chassi, '9BWZZZ377VT004251');
assert.equal(traditional.marca, 'VW');
assert.equal(traditional.modelo, '30.330 CRC 8X2');
assert.equal(traditional.cor, 'BRANCA');
assert.equal(traditional.combustivel, 'DIESEL');
assert.equal(traditional.subcategoria, 'CAMINHAO');
console.log('CRLV tradicional regression: OK');
