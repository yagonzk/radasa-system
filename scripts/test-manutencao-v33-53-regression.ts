import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";

const page = readFileSync("client/src/pages/Manutencao.tsx", "utf8");
const service = readFileSync("server/services/manutencao.service.ts", "utf8");

assert(!page.includes('Informe o problema relatado ou motivo da manutenção.'), "frontend ainda exige problema/motivo");
assert(!service.includes('Informe o problema ou motivo da manutenção.'), "backend ainda exige problema/motivo");
assert(page.includes('<Label>Problema relatado / motivo</Label>'), "label de problema/motivo deve ficar sem asterisco");
assert(page.includes('<Label>Valor unit.</Label>'), "serviço deve usar o rótulo Valor unit.");
assert(!page.includes('<Label>Unit.</Label>'), "rótulo Unit. antigo ainda existe na OS");
assert(!page.includes('<Label>Peças adicionais</Label>'), "campo Peças adicionais ainda está visível");
assert(!page.includes('<Label>Mão de obra adicional</Label>'), "campo Mão de obra adicional ainda está visível");
assert(!page.includes('<Label>Outros custos</Label>'), "campo Outros custos ainda está visível");
assert(page.includes('CommandInput placeholder="Pesquisar fornecedor ou oficina..."'), "fornecedor/oficina ainda não tem busca digitável");
assert(page.includes('role="combobox"'), "fornecedor/oficina deve usar seletor pesquisável tipo combobox");
assert(page.includes('Total da OS'), "Total da OS deve permanecer visível");
assert(page.includes('<Label>Desconto</Label>'), "Desconto deve permanecer visível");

console.log("OK: regressões da Manutenção V33.53 validadas.");
