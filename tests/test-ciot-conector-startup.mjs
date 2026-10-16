import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (path) => fs.readFileSync(new URL(path, import.meta.url), "utf8");
test("instalador espera health antes de declarar conector online", () => {
  const src = read("../Instalar-Conector-CIOT.ps1");
  assert.match(src, /Invoke-RestMethod.*8789\/health/);
  assert.match(src, /Aguardando o conector responder/);
  assert.match(src, /Diagnosticar-Conector-CIOT.ps1/);
});
test("reparo preserva configuracao e token existentes", () => {
  const src = read("../Reparar-Conector-CIOT.ps1");
  assert.match(src, /config-protegida\.bin/);
  assert.doesNotMatch(src, /secret put|sharedToken\s*=|Read-Host.*[Ss]enha/);
});
test("log registra apenas eventos e identificadores seguros", () => {
  const src = read("../Iniciar-Conector-CIOT.ps1");
  assert.match(src, /Write-CiotEvent/);
  assert.match(src, /CIOT_STARTUP_FAILED/);
  assert.doesNotMatch(src, /Write-(Host|Output).*pfxPassword|Add-Content.*pfxPassword/);
});
test("script de diagnostico nao desencripta segredo", () => {
  const src = read("../Diagnosticar-Conector-CIOT.ps1");
  assert.doesNotMatch(src, /Unprotect|pfxPassword|sharedToken/);
  assert.match(src, /LastTaskResult/);
  assert.match(src, /diagnostico-inicializacao\.log/);
});
