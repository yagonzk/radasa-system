import fs from 'node:fs';
const p='client/src/pages/BIGerencial.tsx';
const s=fs.readFileSync(p,'utf8');
if (/Detalhamento por Produto[\s\S]*?rows=\{byProduct\.slice\(0,8\)/.test(s)) throw new Error('Detalhamento por Produto ainda limita a lista aos 8 primeiros produtos');
if (!s.includes('rows={byProduct.map(r=>[r.name,money(r.a),money(r.b),pct(r.percent)])}')) throw new Error('Detalhamento por Produto precisa fornecer todos os produtos ao scroll');
if (!s.includes('sticky top-0')) throw new Error('Cabeçalho da tabela precisa permanecer fixo durante o scroll');
console.log('OK: detalhamento por produto lista todos os itens com scroll e cabeçalho fixo.');
