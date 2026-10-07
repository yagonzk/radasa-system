import fs from "node:fs";

const read = (file) => fs.readFileSync(file, "utf8");
const checks = [];
function check(name, condition) {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) throw new Error(`Falhou: ${name}`);
}

const app = read("client/src/App.tsx");
const layout = read("client/src/components/agro/AgroLayout.tsx");
const home = read("client/src/pages/AgroHome.tsx");
const estoque = read("client/src/pages/AgroEstoque.tsx");
const movimentacoes = read("client/src/pages/AgroMovimentacoes.tsx");
const lavouras = read("client/src/pages/AgroLavouras.tsx");
const cadastros = read("client/src/pages/AgroCadastros.tsx");
const relatorios = read("client/src/pages/AgroRelatorios.tsx");

check("rota Dashboard Agro existe", app.includes('path="/agro"'));
check("rota Estoque Agro existe", app.includes('path="/agro/estoque"'));
check("rota Movimentações Agro existe", app.includes('path="/agro/movimentacoes"'));
check("rota Lavouras Agro existe", app.includes('path="/agro/lavouras"'));
check("rota Cadastros Agro existe", app.includes('path="/agro/cadastros"'));
check("rota Relatórios Agro existe", app.includes('path="/agro/relatorios"'));
check("Agro possui layout próprio", layout.includes("Radasa Agro") && layout.includes("agroNav"));
check("menu possui Dashboard", layout.includes('label: "Dashboard"'));
check("menu possui Estoque", layout.includes('label: "Estoque"'));
check("menu possui Movimentações", layout.includes('label: "Movimentações"'));
check("menu possui Lavouras", layout.includes('label: "Lavouras"'));
check("menu possui Cadastros", layout.includes('label: "Cadastros"'));
check("menu possui Relatórios", layout.includes('label: "Relatórios"'));
check("layout permite trocar módulo", layout.includes('href="/modulos"'));
check("layout valida licença Agro no servidor", layout.includes('api.get("/agro/status")'));
check("dashboard não inventa números", (home.includes('Aguardando dados do módulo Agro') && home.includes('>—<')) || home.includes('api.get<DashboardData>("/agro/dashboard")'));
check("estoque está separado do TMS", estoque.includes("/agro/estoque") && !estoque.includes("/estoque/produtos"));
check("movimentações preservam saldo por lançamentos", movimentacoes.includes("Não existe edição manual da quantidade em estoque") || movimentacoes.includes("nunca um número editado diretamente"));
check("lavouras possuem fazendas/talhões/safras", lavouras.includes("Fazendas") && lavouras.includes("Talhões") && lavouras.includes("Safras"));
check("cadastros deixam responsáveis sem login", cadastros.includes("sem login"));
check("relatórios não misturam TMS", relatorios.includes("sem misturar dados operacionais do TMS"));

console.log(`Etapa 3: ${checks.length} verificações passaram.`);
