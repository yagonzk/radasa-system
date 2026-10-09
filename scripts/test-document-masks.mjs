import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { documentDigits, formatCpfInput, formatCnpjInput, formatCpfCnpjInput } from '../client/src/lib/documentMasks.ts';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const testCases = [
  [formatCpfInput('1'), '1'],
  [formatCpfInput('1234'), '123.4'],
  [formatCpfInput('12345678901'), '123.456.789-01'],
  [formatCpfInput('123.456.789-01'), '123.456.789-01'],
  [formatCpfInput('12345678901999'), '123.456.789-01'],
  [formatCnpjInput('405'), '40.5'],
  [formatCnpjInput('4051563000190'), '40.515.630/0019-0'],
  [formatCnpjInput('40515630001902'), '40.515.630/0019-02'],
  [formatCnpjInput('40.515.630/0019-02'), '40.515.630/0019-02'],
  [formatCpfCnpjInput('12345678901'), '123.456.789-01'],
  [formatCpfCnpjInput('123456789012'), '12.345.678/9012'],
  [formatCpfCnpjInput('40515630001902'), '40.515.630/0019-02'],
  [formatCpfCnpjInput(''), ''],
  [documentDigits('40.515.630/0019-02'), '40515630001902'],
  [documentDigits('123.456.789-01'), '12345678901'],
];
for (const [actual, expected] of testCases) assert.equal(actual, expected);

const forms = {
  'client/src/pages/Manutencao.tsx': ['formatCpfCnpjInput(quickSupplierForm.documento)', 'digitsOnly(e.target.value).slice(0, 14)'],
  'client/src/components/cadastros/FornecedorTab.tsx': ['formatCpfCnpjInput(form.documento)', 'digits(e.target.value).slice(0, 14)'],
  'client/src/components/cadastros/MotoristaTab.tsx': ['formatCpfInput(form.cpf)', 'documentDigits(e.target.value).slice(0,11)'],
  'client/src/components/cadastros/ChapaTab.tsx': ['formatCpfInput(form.cpf)', 'documentDigits(e.target.value).slice(0,11)'],
  'client/src/pages/AdminUsuarioDetalhe.tsx': ['formatCpfInput(account.cpf)', 'documentDigits(event.target.value).slice(0, 11)'],
  'client/src/pages/CiotGerar.tsx': ['formatCpfCnpjInput(anttFields.cpfCnpjCreditado)', 'digits(e.target.value).slice(0, 14)'],
  'client/src/components/cadastros/EmpresaTab.tsx': ['formatCnpj(form.cnpj)'],
  'client/src/components/cadastros/ClienteTab.tsx': ['formatCnpj(form.cnpj)'],
  'client/src/pages/Perfil.tsx': ['formatCpf(e.target.value)'],
};
for (const [file, patterns] of Object.entries(forms)) {
  const source = readFileSync(resolve(root, file), 'utf8');
  for (const pattern of patterns) assert.ok(source.includes(pattern), `${file}: faltando ${pattern}`);
}
console.log(`${testCases.length} testes de máscara e ${Object.keys(forms).length} formulários verificados.`);
