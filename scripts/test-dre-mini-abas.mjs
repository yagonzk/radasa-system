import fs from 'node:fs';

const file = 'client/src/components/financeiro/DreOperacionalDashboard.tsx';
const source = fs.readFileSync(file, 'utf8');

const required = [
  '["RESUMO", "Resumo"]',
  '["DRE", "DRE"]',
  '["RENTABILIDADE", "Rentabilidade"]',
  '["ANALISES", "Análises"]',
  'Mais filtros',
  'Receita Líquida',
  'Resultado Operacional',
  'Rentabilidade por veículo',
  'Evolução mensal',
];

for (const token of required) {
  if (!source.includes(token)) throw new Error(`Estrutura esperada ausente: ${token}`);
}

for (const noisy of ['Grupo de clientes', 'Gestor responsável', 'Sem campo no cadastro atual']) {
  if (source.includes(noisy)) throw new Error(`Campo indisponível não deve ocupar a tela principal: ${noisy}`);
}

if (!source.includes('miniTab === "RESUMO"') || !source.includes('miniTab === "DRE"') || !source.includes('miniTab === "RENTABILIDADE"') || !source.includes('miniTab === "ANALISES"')) {
  throw new Error('Conteúdo das mini-abas precisa ser renderizado sob demanda.');
}

console.log('DRE mini-abas: OK');
