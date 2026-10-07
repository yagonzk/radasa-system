import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) throw new Error(`Falhou: ${name}`);
}

const app = read("client/src/App.tsx");
const auth = read("client/src/pages/Auth.tsx");
const selector = read("client/src/pages/ModuleSelector.tsx");
const agro = read("client/src/pages/AgroHome.tsx");
const context = read("client/src/contexts/AuthContext.tsx");
const routes = read("server/routes/index.ts");
const middleware = read("server/middlewares/module-license.ts");
const service = read("server/services/module-license.service.ts");

check("login direciona para seletor", auth.includes('navigate("/modulos")'));
check("rota de módulos existe", app.includes('path="/modulos"'));
check("rota Agro existe", app.includes('path="/agro"'));
check("guard do Transportes existe", app.includes('hasModuleAccess(user, "TRANSPORTES")'));
check("guard do Agro existe", app.includes('hasModuleAccess(user, "AGRO")'));
check("seletor mostra Transportes", selector.includes('module="TRANSPORTES"'));
check("seletor mostra Agro", selector.includes('module="AGRO"'));
check("seletor permite trocar de módulo", selector.includes('Escolha onde deseja entrar'));
check("Agro tem ambiente separado", agro.includes('Ambiente Agro'));
check("Agro valida licença no backend", agro.includes('api.get("/agro/status")'));
check("backend protege Agro", routes.includes('requireModuleLicense("AGRO")'));
check("backend protege Transportes", routes.includes('requireModuleLicense("TRANSPORTES")'));
check("admin fica antes do gate do Transportes", routes.indexOf('apiRoutes.use("/admin"') < routes.indexOf('apiRoutes.use(requireModuleLicense("TRANSPORTES"))'));
check("middleware consulta licença", middleware.includes("assertUserModuleAccess"));
check("erro estruturado de licença", service.includes('code: "MODULE_LICENSE_BLOCKED"'));
check("mudança de licença atualiza usuário", context.includes('includes("/licencas/")'));

console.log(`Etapa 2: ${checks.length} verificações passaram.`);
