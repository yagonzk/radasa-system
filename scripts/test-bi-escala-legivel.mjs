import fs from 'node:fs';
import assert from 'node:assert/strict';

const page = fs.readFileSync('client/src/pages/BIGerencial.tsx', 'utf8');
const view = fs.readFileSync('client/src/components/bi/BiPresentation.tsx', 'utf8');
const styles = fs.readFileSync('client/src/pages/bi-gerencial.css', 'utf8');
assert.ok(page.includes('<BiConsultation'), 'Consulta deve utilizar a nova apresentação');
assert.ok(view.includes('columnWidths') && view.includes('tableWidth'), 'Tabela deve reservar larguras reais para as colunas');
assert.ok(view.includes('compactColumnKeys') && view.includes('fullColumns'), 'Colunas completas devem continuar acessíveis');
assert.ok(view.includes('BiColumnFilter'), 'Filtro por coluna deve permanecer');
assert.ok(view.includes('rows.slice('), 'Listagem deve ser paginada');
assert.ok(styles.includes('container: bi-dashboard / inline-size'), 'Responsividade precisa respeitar o espaço após a sidebar');
assert.ok(styles.includes('@container bi-dashboard (max-width: 920px)'), 'A consulta deve adaptar-se à largura disponível');
assert.ok(styles.includes('overflow: auto') && styles.includes('bi-v3__table-scroll'), 'Tabela deve rolar horizontalmente sem diminuir a fonte');
assert.ok(styles.includes('bi-v3__mobile-rows'), 'Registros devem ter alternativa em cartões');
console.log('OK: Consulta legível em diferentes larguras, com tabela detalhada, cartões e paginação.');
