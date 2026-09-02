import fs from 'node:fs';
const src=fs.readFileSync(new URL('../server/services/abastecimento-xml.service.ts', import.meta.url),'utf8');
const checks=[
 ['função de consolidação', src.includes('function consolidarProdutosXml')],
 ['parser consolida os itens', /const produtos = consolidarProdutosXml\(/.test(src)],
 ['agrupa por assinatura', src.includes('xmlProductGroupingKey')],
 ['soma quantidade', src.includes('atual.quantidade += produto.quantidade')],
 ['soma valor total', src.includes('atual.valorTotal += produto.valorTotal')],
];
const failed=checks.filter(([,ok])=>!ok);
if(failed.length){console.error('FAIL:',failed.map(([n])=>n).join(', '));process.exit(1)}
console.log('PASS: XML com combustível repetido é consolidado antes da importação.');
