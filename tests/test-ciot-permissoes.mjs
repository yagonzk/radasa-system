import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
const read = (file) => fs.readFileSync(new URL(file, import.meta.url), "utf8");

test("reparo corrige ACLs antes de tentar atualizar arquivos protegidos", () => {
  const src = read("../Reparar-Conector-CIOT.ps1");
  const acl = src.indexOf("Set-CiotRestrictedPermissions -RuntimeDir $runtime");
  const copy = src.indexOf("Copy-Item -LiteralPath (Join-Path $project");
  assert.ok(acl > 0 && copy > acl);
  assert.match(src, /Set-CiotRestrictedPermissions -RuntimeDir \$runtime\s*\nStart-ScheduledTask/);
});

test("instalacao nunca executa icacls /inheritance:r recursivamente", () => {
  const src = read("../Instalar-Conector-CIOT.ps1");
  assert.doesNotMatch(src, /icacls\.exe[^\n]*\/T/);
  assert.match(src, /Set-CiotRestrictedPermissions -RuntimeDir \$runtimeDir/);
});

test("reparo de ACL define SYSTEM e Administradores explicitamente por arquivo", () => {
  const src = read("../ciot-conector/Restaurar-Permissoes-CIOT.ps1");
  assert.match(src, /takeown\.exe \/F \$item\.FullName \/A/);
  assert.match(src, /\*S-1-5-18:F/);
  assert.match(src, /\*S-1-5-32-544:F/);
  assert.doesNotMatch(src, /icacls\.exe[^\n]*\/T/);
});

test("reparo nao concede direitos amplos nem aceita caminho fora do runtime", () => {
  const src = read("../ciot-conector/Restaurar-Permissoes-CIOT.ps1");
  assert.match(src, /PASTA_CIOT_INESPERADA/);
  assert.match(src, /ReparsePoint/);
  assert.doesNotMatch(src, /\*S-1-1-0|\*S-1-5-32-545|Authenticated Users/);
});

test("reparo preserva PFX, senha e configuracao protegida", () => {
  const src = read("../Reparar-Conector-CIOT.ps1");
  assert.match(src, /config-protegida\.bin/);
  assert.doesNotMatch(src, /Remove-Item|config-protegida\.bin.*-Force|certificado\.pfx.*-Force/);
  assert.match(read("../Diagnosticar-Conector-CIOT.ps1"), /ACL \$name restrita SYSTEM\/Admins/);
});

test("instalador evita sobrescrever credenciais de uma instalacao existente", () => {
  const src = read("../Instalar-Conector-CIOT.ps1");
  assert.match(src, /config-protegida\.bin/);
  assert.match(src, /Conector CIOT ja instalado/);
});
