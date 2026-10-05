import fs from 'node:fs';

const staging = fs.readFileSync('client/src/lib/bi-staging.ts', 'utf8');
const bi = fs.readFileSync('client/src/pages/BIGerencial.tsx', 'utf8');
const pdf = fs.readFileSync('server/services/manifesto-pdf.service.ts', 'utf8');
const manifestos = fs.readFileSync('server/services/manifestos.service.ts', 'utf8');

function must(condition, message) {
  if (!condition) throw new Error(message);
}

must(staging.includes('canonicalClientIdentity'), 'BI nao possui identidade canonica de cliente.');
must(staging.includes('normalizedCode?`COD:${normalizedCode}`'), 'Cliente ainda nao prioriza codigo como identidade.');
must(staging.includes('canonicalProductIdentity=(code:unknown,description:unknown)=>canonicalKeyPart(code)||productFamily(description)||norm(description)'), 'Produto ainda nao prioriza codigo antes do nome/familia.');
must(staging.includes('canonicalClientIdentity(x.clienteCod,x.cliente,x.razaoSocial)'), 'Deduplicacao da staging ainda depende do nome do cliente.');
must(bi.includes('clienteByCode') && bi.includes('produtoByCode'), 'BI nao resolve cadastro mestre por codigo.');
must(bi.includes('clienteId:`bi-cliente:${canonicalClientIdentity(clienteCod,cliente,razaoSocial)}`'), 'Agrupamento do cliente ainda nao usa codigo canonico.');
must(bi.includes('produtoId:`bi-produto:${produtoKey}`'), 'Agrupamento do produto ainda nao usa codigo canonico.');
must(pdf.includes('canonicalCode(item.codigoInterno ?? "") === code'), 'Importacao PDF nao prioriza cadastro existente pelo codigo.');
must(manifestos.includes('const codeKey = (value: unknown)'), 'Importacao por planilha nao normaliza codigo.');
must(manifestos.includes('clients.has(code)') && manifestos.includes('products.has(code)'), 'Importacao por planilha nao reutiliza entidades pela chave de codigo.');

console.log('PASS: BI e importacoes reutilizam cliente/produto pelo codigo, independentemente do nome.');
