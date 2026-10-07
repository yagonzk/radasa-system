import fs from "node:fs";

const checks = [];
const read = (file) => fs.readFileSync(file, "utf8");
const expect = (condition, label) => {
  checks.push([condition, label]);
  if (!condition) console.error(`FALHOU: ${label}`);
};

const list = read("client/src/pages/Administracao.tsx");
const detail = read("client/src/pages/AdminUsuarioDetalhe.tsx");
const logs = read("client/src/pages/Logs.tsx");
const app = read("client/src/App.tsx");
const service = read("server/services/admin.service.ts");
const routes = read("server/routes/admin.routes.ts");

expect(list.includes("Pesquisar por username, e-mail ou nome"), "busca de usuário por username/e-mail/nome");
expect(list.includes("transportStatus") && list.includes("agroStatus"), "filtros de licença por módulo");
expect(list.includes("/admin/usuarios/${user.id}"), "acesso à tela individual do usuário");
expect(detail.includes("Informações da conta"), "edição de informações da conta");
expect(detail.includes("Nova senha (mínimo 8 caracteres)"), "redefinição administrativa de senha");
expect(detail.includes("Permissões do Transportes"), "gestão de permissões");
expect(detail.includes("Licenças por módulo"), "gestão individual de licenças");
expect(detail.includes("Atividade recente"), "atividade e auditoria da conta");
expect(logs.includes("Username, e-mail, ação ou caminho"), "busca completa nos logs");
expect(logs.includes("/admin/usuarios/${log.user.id}"), "atalho do log para usuário");
expect(app.includes('path="/admin/usuarios/:id"'), "rota individual do usuário");
expect(app.includes('path="/admin/configuracoes"'), "rota administrativa de configurações");
expect(routes.includes('get("/usuarios/:id"'), "API de detalhe do usuário");
expect(routes.includes('put("/usuarios/:id/conta"'), "API de edição da conta");
expect(service.includes("ensureUniqueAccountFields"), "proteção contra username/e-mail/CPF duplicados");
expect(service.includes('entityId: id'), "auditoria relacionada à conta administrada");

const failed = checks.filter(([ok]) => !ok);
console.log(`${checks.length - failed.length}/${checks.length} verificações passaram.`);
if (failed.length) process.exit(1);
