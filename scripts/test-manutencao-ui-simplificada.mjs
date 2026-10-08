import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const src = readFileSync(new URL('../client/src/pages/Manutencao.tsx', import.meta.url), 'utf8');
const checks = [
  ['nova manutenção abre formulário existente', /Nova manutenção[\s\S]*?Novo plano preventivo[\s\S]*?Novo documento/],
  ['cartões de OS usam paginação', /pageOrdens\.map\(\(os\) =>/],
  ['filtros rápidos por status', /"TODAS" \| "PENDENTES" \| "CONCLUIDAS"/],
  ['filtro de pesquisa mantido', /filterMaintenanceOrders\(ordens, placa, query, columnFilters\)/],
  ['tabela detalhada permanece disponível', /orderView === "DETALHADA"/],
  ['cadastro pede veículo', /if \(!osForm\.veiculoId\)/],
  ['cadastro possui serviços rápidos', /addFrequentService\(descricao, categoria\)/],
  ['cadastro mantém categorias dos itens', /newItemWithoutCategory/],
  ['dados complementares recolhíveis', /<details className="rounded-xl border p-4" key=\{`extra-/],
  ['notas e anexos recolhíveis', /<details className="space-y-3 rounded-xl border p-4" key=\{`docs-/],
  ['notas fiscais continuam sendo enviadas', /for \(const nota of pendingNotas\) await uploadNota/],
  ['anexos continuam sendo enviados', /for \(const anexo of pendingAnexos\) await uploadAnexo/],
  ['conclusão de OS permanece disponível', /manutencao\/ordens\/\$\{detail\.id\}\/concluir/],
  ['conclusão em lote permanece disponível', /\/manutencao\/ordens\/concluir-lote/],
  ['peças do almoxarifado permanecem vinculadas', /Peça externa \/ Consumo direto/],
  ['alertas mantém título e detalhe reais', /a\.titulo[\s\S]*?a\.detalhe/],
  ['lista completa usa paginação', /pageOrdens\.length \? pageOrdens\.map/],
  ['edição continua usando endpoint individual', /\/manutencao\/ordens\/\$\{id\}/],
];
for (const [description, pattern] of checks) {
  assert.match(src, pattern, `Falha: ${description}`);
}
console.log(`OK: ${checks.length} verificações de manutenção simplificada passaram.`);
