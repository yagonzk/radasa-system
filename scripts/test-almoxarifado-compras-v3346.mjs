import fs from 'node:fs';
const root = new URL('../', import.meta.url);
const read = p => fs.readFileSync(new URL(p, root), 'utf8');
const schema=read('prisma/schema.prisma'), svc=read('server/services/estoque.service.ts'), fin=read('server/services/financeiro.service.ts'), ui=read('client/src/pages/Estoque.tsx'), store=read('client/src/lib/store.ts');
const checks=[
 [schema.includes('model EstoqueSubcategoria'), 'modelo EstoqueSubcategoria'],
 [schema.includes('subcategoria'), 'produto possui subcategoria'],
 [schema.includes('xmlUrl'), 'movimentação armazena XML'],
 [svc.includes('createSubcategoria'), 'API cria subcategoria'],
 [svc.includes('data.quantidade') && svc.includes('valorUnitario'), 'cadastro cria compra/entrada inicial'],
 [fin.includes('produto:{select:{categoria:true}}') || fin.includes('produto: { select: { categoria: true'), 'DRE carrega categoria do produto'],
 [fin.includes('x.produto.categoria'), 'DRE usa categoria escolhida'],
 [ui.includes('Data de compra'), 'campo Data de compra'],
 [ui.includes('Valor unitário'), 'campo Valor unitário'],
 [ui.includes('Subcategoria'), 'campo Subcategoria'],
 [ui.includes('Observação'), 'campo Observação'],
 [ui.includes('XML da NF-e'), 'anexo XML'],
 [ui.includes('PDF'), 'anexo PDF'],
 [ui.includes('DOMParser'), 'leitura automática XML'],
 [store.includes('useEstoqueSubcategorias'), 'store de subcategorias'],
];
const fail=checks.filter(([ok])=>!ok); if(fail.length){console.error('FAIL:',fail.map(x=>x[1]).join(', '));process.exit(1)} console.log('PASS: fluxo de compras do Almoxarifado V33.46 implementado.');
