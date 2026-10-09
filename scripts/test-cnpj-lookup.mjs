import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";
const require = createRequire(import.meta.url);
const ts = require("typescript");
const sources = [
  "client/src/lib/cnpjLookup.ts",
  "client/src/components/cadastros/CnpjLookupButton.tsx",
  "client/src/components/cadastros/FornecedorTab.tsx",
  "client/src/components/cadastros/ClienteTab.tsx",
  "client/src/components/cadastros/EmpresaTab.tsx",
  "client/src/pages/Manutencao.tsx",
  "server/routes/cnpj.routes.ts",
  "server/middlewares/permissions.ts",
];
let verified = 0;
for (const path of sources) {
  const code = readFileSync(path, "utf8");
  const source = ts.createSourceFile(path, code, ts.ScriptTarget.Latest, true, path.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  assert.equal(source.parseDiagnostics.length, 0, `${path} com erro de sintaxe: ${source.parseDiagnostics.map(x=>x.messageText)}`);
  verified++;
}
const source = readFileSync("client/src/lib/cnpjLookup.ts", "utf8");
const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
const exports = {};
const fakeApi = { get: async () => ({ data: { cnpj: "11222333000181", razaoSocial: "Empresa Teste" } }) };
vm.runInNewContext(code, { exports, require: (name) => {
  if (name === "@/lib/api") return { api: fakeApi };
  if (name === "@/lib/documentMasks") return { documentDigits: (v) => String(v ?? "").replace(/\D/g, "") };
  throw Error(`Import inesperado ${name}`);
}});
assert.equal(exports.isValidCnpj("11.222.333/0001-81"), true);
assert.equal(exports.isValidCnpj("11.222.333/0001-82"), false);
assert.equal(exports.isValidCnpj("00.000.000/0000-00"), false);
assert.equal(exports.fillIfEmpty("Informado manualmente", "Externo"), "Informado manualmente");
assert.equal(exports.fillIfEmpty("", "Externo"), "Externo");
assert.equal(exports.formatCompanyAddress({logradouro: "Rua Alfa",numero: "10",bairro:"Centro",cidade:"Vilhena",uf:"RO",cep:"76980000"}), "Rua Alfa, 10 - Centro - Vilhena/RO - CEP 76980000");
verified += 6;
const result = await exports.lookupCnpj("11.222.333/0001-81");
assert.equal(result.razaoSocial, "Empresa Teste");
await assert.rejects(() => exports.lookupCnpj("11.222.333/0001-82"), /válido/);
verified += 2;
const frontend = sources.slice(1, 6).map(file=>readFileSync(file,"utf8"));
assert.equal(frontend[0].includes('type="button"'), true);
assert.equal(frontend[1].includes("<CnpjLookupButton"), true);
assert.equal(frontend[2].includes("<CnpjLookupButton"), true);
assert.equal(frontend[4].includes("<CnpjLookupButton"), true);
verified += 4;
console.log(`Consulta CNPJ: ${verified} verificações passaram.`);
