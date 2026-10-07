import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
let passed = 0;
function check(condition, message) {
  if (!condition) { console.error(`FAIL: ${message}`); process.exitCode = 1; return; }
  passed += 1; console.log(`OK: ${message}`);
}

const schema = read('prisma/schema.prisma');
const migration = read('prisma/migrations/20261007170000_agro_mapa_barracao_stage8/migration.sql');
const service = read('server/services/agro-estoque.service.ts');
const farmService = read('server/services/agro-lavouras.service.ts');
const routes = read('server/routes/agro.routes.ts');
const types = read('client/src/lib/agro.ts');
const stock = read('client/src/pages/AgroEstoque.tsx');
const movements = read('client/src/pages/AgroMovimentacoes.tsx');
const inventory = read('client/src/pages/AgroInventario.tsx');
const crops = read('client/src/pages/AgroLavouras.tsx');

check(schema.includes('model AgroEstoquePosicao'), 'schema possui posições físicas do barracão');
check(schema.includes('@@unique([localId, linha, coluna])'), 'cada coordenada do mapa é única por barracão');
check(schema.includes('posicaoId String?'), 'movimentações/inventário podem carregar posição');
check(schema.includes('posicaoOrigemId String?') && schema.includes('posicaoDestinoId String?'), 'transferências possuem posição de origem e destino');
check(migration.includes('CREATE TABLE "agro_estoque_posicoes"'), 'migração cria tabela de posições');
check(migration.includes('ALTER TABLE "agro_movimentacoes" ADD COLUMN "posicaoId"'), 'migração vincula movimentações às posições');
check(routes.includes('get("/mapa-barracao"') && routes.includes('post("/posicoes"'), 'API publica mapa e cadastro de posições');
check(service.includes('async mapaBarracao') && service.includes('semPosicao'), 'backend monta mapa e preserva estoque sem posição');
check(service.includes('by: ["posicaoId", "produtoId", "loteId", "tipo"]'), 'saldo do mapa é calculado por posição/produto/lote');
check(service.includes('(posicaoOrigem?.id || null) === (posicaoDestino?.id || null)'), 'transferência interna aceita Sem posição e bloqueia origem/destino idênticos');
check(service.includes('currentAgroBalance(tx, produtoId, loteId, origemId, posicaoOrigem ? posicaoOrigem.id : null)'), 'transferência valida saldo exato da posição de origem');
check(types.includes('export type AgroStorageMapPosition') && types.includes('semPosicao: AgroPositionStockItem[]'), 'frontend possui tipos do mapa físico');
check(stock.includes('Mapa do barracão') && stock.includes('gridColumnStart: position.coluna'), 'Estoque renderiza o mapa por linha/coluna');
check(stock.includes('position.itens.slice(0, 2)') && stock.includes('selectedPosition.itens.map'), 'um quadrado suporta e detalha vários produtos/lotes');
check(stock.includes('Estoque sem posição definida'), 'mapa sinaliza estoque legado sem localização inventada');
check(movements.includes('Posição física') && movements.includes('posicaoId: form.posicaoId || null'), 'movimentação manual seleciona e grava posição');
check(inventory.includes('Posição de origem') && inventory.includes('Posição de destino'), 'transferência permite mover estoque entre posições');
check(inventory.includes('item.posicao?.codigo || "Sem posição"'), 'inventário é conferido por posição física');
check(farmService.includes('requiredByStorage') && farmService.includes('posicaoId: item.posicaoId'), 'operações agrícolas validam e baixam a posição correta');
check(crops.includes('selectPosition') && crops.includes('Posição'), 'tela de lavoura escolhe posição para cada consumo');
check(crops.includes('m.posicao?.codigo'), 'histórico agrícola mostra a posição consumida');
check(!Array.from(fs.readdirSync(path.join(root, 'scripts'))).some((name) => name.endsWith('.md')), 'nenhum arquivo .md foi criado em scripts');

if (!process.exitCode) console.log(`\nEtapa 8 validada: ${passed} verificações.`);
