import fs from "node:fs";

const read = (path) => fs.readFileSync(path, "utf8");
const app = read("client/src/App.tsx");
const selector = read("client/src/pages/ModuleSelector.tsx");
const transport = read("client/src/components/Layout.tsx");
const agro = read("client/src/components/agro/AgroLayout.tsx");
const adminLayout = read("client/src/components/admin/AdminLayout.tsx");
const adminRoutes = read("server/routes/admin.routes.ts");
const adminService = read("server/services/admin.service.ts");

const checks = [
  [selector.includes("AdminModuleCard"), "seletor possui card administrativo"],
  [selector.includes('user?.role === "ADMIN" && <AdminModuleCard'), "card administrativo aparece somente para ADMIN"],
  [app.includes('<Route path="/admin" component={AdminHome} />'), "rota principal administrativa existe"],
  [app.includes('<Route path="/admin/usuarios" component={Administracao} />'), "rota de usuários existe"],
  [app.includes('<Route path="/admin/aprovacoes" component={AprovacaoContas} />'), "rota de aprovações existe"],
  [app.includes('<Route path="/admin/cadastros" component={AdminCadastros} />'), "rota de cadastros existe"],
  [app.includes('<Route path="/admin/logs" component={Logs} />'), "rota de logs existe"],
  [app.includes('return user.role === "ADMIN" ? <Router /> : <ModuleSelector />'), "frontend bloqueia módulo admin para não administradores"],
  [!transport.includes('label: "Administração"'), "Transportes não exibe grupo Administração"],
  [!transport.includes('href="/logs"'), "Transportes não exibe atalho de logs"],
  [!agro.includes('href="/logs"'), "Agro não exibe atalho administrativo"],
  [adminLayout.includes('Radasa Admin'), "layout administrativo próprio existe"],
  [adminLayout.includes('/admin/usuarios') && adminLayout.includes('/admin/logs'), "layout administrativo possui navegação própria"],
  [adminRoutes.includes('requireRole(UserRole.ADMIN)'), "API administrativa exige papel ADMIN"],
  [adminRoutes.includes('adminRoutes.get("/resumo"'), "API de resumo administrativo existe"],
  [adminService.includes('prisma.auditLog.count'), "resumo usa contagem leve de auditoria"],
  [adminService.includes('prisma.manifesto.count()'), "resumo usa contagem leve de romaneios"],
  [adminService.includes('prisma.agroProduto.count()'), "resumo usa contagem leve do Agro"],
];

let failed = 0;
for (const [ok, label] of checks) {
  if (ok) console.log(`OK  ${label}`);
  else { console.error(`ERRO ${label}`); failed += 1; }
}

if (failed) process.exit(1);
console.log(`\n${checks.length}/${checks.length} verificações da Administração separada passaram.`);
