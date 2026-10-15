import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import vm from "node:vm";

const require = createRequire(import.meta.url);
const ts = require("typescript");

// Executa o núcleo puro de leitura, sem navegador, OCR ou documento real.
function loadPure(path) {
  const source = readFileSync(new URL(path, import.meta.url), "utf8");
  const transformed = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
    reportDiagnostics: true,
  });
  const errors = (transformed.diagnostics || []).filter(d => d.category === ts.DiagnosticCategory.Error);
  assert.equal(errors.length, 0, "Erro de transpilação na leitura CNH");
  const module = { exports: {} };
  vm.runInNewContext(transformed.outputText, { module, exports: module.exports }, { timeout: 1000 });
  return module.exports;
}

const { identificarPerfilCnh, PERFIL_CNH_VERDE, PERFIL_CNH_ATUAL } = loadPure("../client/src/lib/cnhLayouts.ts");
const { interpretarCamposCnh } = loadPure("../client/src/lib/cnhCampos.ts");

const canvasMock = (green) => ({
  width: 1000,
  height: 1400,
  getContext: () => ({
    getImageData: () => ({ data: green ? [220, 255, 201, 255] : [255, 255, 255, 255] }),
  }),
});
assert.equal(identificarPerfilCnh(canvasMock(true)).id, "cnh-e-verde");
assert.equal(identificarPerfilCnh(canvasMock(false)).id, "cnh-e-atual");
for (const perfil of [PERFIL_CNH_VERDE, PERFIL_CNH_ATUAL]) {
  assert.equal(Object.keys(perfil.regioes).length, 9);
  for (const coords of Object.values(perfil.regioes)) {
    assert.equal(coords.length, 4);
    assert.ok(coords[0] >= 0 && coords[0] < coords[2] && coords[2] <= 1);
    assert.ok(coords[1] >= 0 && coords[1] < coords[3] && coords[3] <= 1);
  }
}

const exemplo = interpretarCamposCnh({
  nome: "JOAO DA SILVA",
  cpf: "529.982.247-25",
  rg: "12345678 SSP MT",
  dataNascimento: "12/03/1985",
  cnhEmissao: "11/02/2022",
  cnhValidade: "11/02/2032",
  primeiraHabilitacao: "20/08/2003",
  cnhRegistro: "01234567890",
  cnhCategoria: "AE",
});
assert.equal(exemplo.dados.nome, "JOAO DA SILVA");
assert.equal(exemplo.dados.cpf, "52998224725");
assert.equal(exemplo.dados.cnhNumero, "01234567890");
assert.equal(exemplo.dados.cnhRegistro, "01234567890");
assert.equal(exemplo.dados.cnhCategoria, "AE");
assert.equal(exemplo.dados.cnhValidade, "2032-02-11");
assert.equal(exemplo.dados.cnhEmissao, "2022-02-11");
assert.equal(exemplo.dados.primeiraHabilitacao, "2003-08-20");
assert.equal(exemplo.dados.dataNascimento, "1985-03-12");
assert.equal(exemplo.dados.rg, "12345678");

// DATA EMISSÃO no verso inferior da CNH verde (não confundir com validade).
const emissaoVerde = PERFIL_CNH_VERDE.regioes.cnhEmissao;
assert.ok(emissaoVerde[0] > 0.30 && emissaoVerde[1] > 0.40 && emissaoVerde[2] < 0.45);
for (const texto of ["16/12/2021", "16 12 2021", "16122021", "DATA EMISSÃO\n16/12/2021"]) {
  assert.equal(interpretarCamposCnh({ cnhEmissao: texto }).dados.cnhEmissao, "2021-12-16");
}
assert.equal(interpretarCamposCnh({ cnhEmissao: "31 02 2021" }).dados.cnhEmissao, undefined);
assert.equal(interpretarCamposCnh({ cnhEmissao: "16242021" }).dados.cnhEmissao, undefined);

const incompleto = interpretarCamposCnh({ nome: "JOAO DA SILVA", cpf: "123.456.789-00", cnhValidade: "35/13/2026" });
assert.equal(incompleto.dados.cpf, undefined);
assert.equal(incompleto.dados.cnhValidade, undefined);
assert.ok(incompleto.avisos.length);
console.log("CNH: perfis, coordenadas, CPF, registro, categoria e datas OK.");
