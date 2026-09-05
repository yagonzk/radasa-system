import assert from "node:assert/strict";
import { parseEstoqueNfeXml } from "../../shared/estoque-nfe.js";

const xml = `<?xml version="1.0" encoding="UTF-8"?>
<nfeProc xmlns="http://www.portalfiscal.inf.br/nfe">
  <NFe><infNFe Id="NFe51260912345678000199550010000001231000001234">
    <ide><nNF>123</nNF><serie>1</serie><dhEmi>2026-09-05T10:00:00-04:00</dhEmi></ide>
    <emit><CNPJ>12345678000199</CNPJ><xNome>Fornecedor Teste LTDA</xNome><xFant>Fornecedor Teste</xFant><IE>123456789</IE><enderEmit><xLgr>Rua A</xLgr><nro>100</nro><xBairro>Centro</xBairro><xMun>Sorriso</xMun><UF>MT</UF><CEP>78890000</CEP><fone>66999999999</fone></enderEmit></emit>
    <det nItem="1"><prod><cProd>ABC-01</cProd><xProd>Filtro de oleo</xProd><NCM>84212300</NCM><uCom>UN</uCom><qCom>2</qCom><vUnCom>35.50</vUnCom><vProd>71.00</vProd></prod></det>
    <det nItem="2"><prod><cProd>XYZ-02</cProd><xProd>Correia</xProd><NCM>40103900</NCM><uCom>UN</uCom><qCom>3</qCom><vUnCom>42</vUnCom><vProd>126</vProd></prod></det>
  </infNFe></NFe>
</nfeProc>`;

const parsed = parseEstoqueNfeXml(xml);
assert.equal(parsed.chave, "51260912345678000199550010000001231000001234");
assert.equal(parsed.numero, "123");
assert.equal(parsed.fornecedor.documento, "12345678000199");
assert.equal(parsed.fornecedor.razaoSocial, "Fornecedor Teste LTDA");
assert.equal(parsed.fornecedor.cidade, "Sorriso");
assert.equal(parsed.itens.length, 2);
assert.deepEqual(parsed.itens[0], {
  nItem: "1", codigoFornecedor: "ABC-01", nome: "Filtro de oleo", ncm: "84212300", unidade: "UN", quantidade: 2, valorUnitario: 35.5, valorTotal: 71,
});
assert.equal(parsed.itens[1].codigoFornecedor, "XYZ-02");
console.log("estoque NF-e parser regression: PASS");
