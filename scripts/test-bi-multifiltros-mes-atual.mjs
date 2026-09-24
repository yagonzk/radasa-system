import fs from 'node:fs';
const src=fs.readFileSync('client/src/pages/BIGerencial.tsx','utf8');
const checks=[
 ['filtro multisselecao', /function MultiSearchableSlicer\(/],
 ['estado produto array', /produtoIds,setProdutoIds\]=useState<string\[\]>/],
 ['estado cliente array', /clienteIds,setClienteIds\]=useState<string\[\]>/],
 ['estado placa array', /placas,setPlacas\]=useState<string\[\]>/],
 ['estado NF array', /nfs,setNfs\]=useState<string\[\]>/],
 ['estado romaneio array', /romaneiosFiltro,setRomaneiosFiltro\]=useState<string\[\]>/],
 ['mes atual padrao', /currentMonthRange\(\)/],
 ['produto usa includes', /produtoIds\.length===0\|\|produtoIds\.includes\(x\.produtoId\)/],
 ['cliente usa includes', /clienteIds\.length===0\|\|clienteIds\.includes\(x\.clienteId\)/],
 ['placa usa includes', /placas\.length===0\|\|placas\.includes\(x\.placa\)/],
 ['selecionar todos', /Selecionar todos/],
 ['limpar selecao', /Limpar/],
];
const missing=checks.filter(([,re])=>!re.test(src)).map(([name])=>name);
if(missing.length){console.error('FAIL:',missing.join(', '));process.exit(1)}
console.log('PASS: BI com multisselecao e mes atual por padrao');
