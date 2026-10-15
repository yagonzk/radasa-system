import assert from "node:assert/strict";
import fs from "node:fs";

const app = fs.readFileSync("client/src/App.tsx", "utf8");
const layout = fs.readFileSync("client/src/components/Layout.tsx", "utf8");
const modules = fs.readFileSync("client/src/pages/ModuleSelector.tsx", "utf8");
const loader = fs.readFileSync("client/src/components/AppLoading.tsx", "utf8");

assert.match(app, /<WouterRouter base="\/tms"><TmsRoutes\s*\/><\/WouterRouter>/);
assert.match(app, /location\.startsWith\("\/tms\/"\)/);
assert.match(app, /hasModuleAccess\(user, "TRANSPORTES"\)/);
assert.match(app, /hasModuleAccess\(user, "AGRO"\)/);
assert.match(app, /<Redirect to="\/login" replace\s*\/>/);
assert.match(app, /<Redirect to="\/modulos" replace\s*\/>/);
assert.match(app, /<Redirect to=\{legacy\} replace\s*\/>/);
for (const name of ["romaneios", "viagens", "abastecimentos", "bi", "financeiro", "manutencao", "cadastros", "pneus", "ciot", "alertas"]) {
  assert.match(app, new RegExp(`path="/${name}`), `Falta rota ${name} no TMS`);
}
assert.match(modules, /onEnter=\{\(\) => navigate\("\/tms"\)\}/);
for (const path of ["modulos", "perfil", "alterar-senha"]) {
  assert.match(layout, new RegExp(`href="~/${path}"`), `Link global ${path} não escapou da base TMS`);
}
assert.doesNotMatch(loader, /Radasa System|<aside|Array\.from|<Truck/);
assert.doesNotMatch(app, /RouteFallback\s*=\s*AppLoading/);
assert.match(app, /role="status" aria-label="Carregando página"/);
console.log("OK: TMS em /tms/*, links globais, rotas antigas e carregamento neutro.");
