import fs from 'node:fs';
import assert from 'node:assert/strict';

const page = fs.readFileSync(new URL('../client/src/pages/Fechamentos.tsx', import.meta.url), 'utf8');
const form = fs.readFileSync(new URL('../client/src/components/fechamentos/FechamentoForm.tsx', import.meta.url), 'utf8');

assert.match(page, /items:\s*viagensCadastradas[^}]*loadRange:\s*loadViagensRange/s, 'Fechamentos deve expor loadRange das viagens');
assert.match(page, /loadViagensRange=\{loadViagensRange\}/, 'Fechamentos deve passar o carregador de período ao formulário');
assert.match(form, /loadViagensRange:\s*\(from:\s*string,\s*to:\s*string\)\s*=>\s*Promise/, 'Form deve receber carregador de viagens por período');
assert.match(form, /await\s+loadViagensRange\(dataInicio,\s*dataFim\)/, 'Form deve carregar as viagens do período escolhido antes do vínculo automático');

console.log('OK: fechamento carrega viagens do período selecionado para preencher cidades automaticamente.');

const resetEffectMatch = form.match(/useEffect\(\(\) => \{\s*if \(editingFechamento\)[\s\S]*?\n  \}, \[([^\]]+)\]\);/);
assert.ok(resetEffectMatch, 'Form deve possuir efeito de inicialização/reset');
assert.doesNotMatch(resetEffectMatch[1], /viagensCadastradas/, 'Atualizar viagens do período não pode resetar motorista/datas selecionados');
