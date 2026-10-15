import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Redirect, Route, Router as WouterRouter, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import AdaptiveTables from "./components/responsive/AdaptiveTables";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AppLoading from "./components/AppLoading";
import { hasModuleAccess } from "./lib/module-access";

const Dashboard = lazy(() => import("./pages/Dashboard"));
const Alertas = lazy(() => import("./pages/Alertas"));
const Demandas = lazy(() => import("./pages/Demandas"));
const Cadastros = lazy(() => import("./pages/Cadastros"));
const Pedagios = lazy(() => import("./pages/Pedagios"));
const Viagens = lazy(() => import("./pages/Viagens"));
const Fechamentos = lazy(() => import("./pages/Fechamentos"));
const Romaneios = lazy(() => import("./pages/Romaneios"));
const Perfil = lazy(() => import("./pages/Perfil"));
const Logs = lazy(() => import("./pages/Logs"));
const Abastecimentos = lazy(() => import("./pages/Abastecimentos"));
const Pneus = lazy(() => import("./pages/Pneus"));
const Estoque = lazy(() => import("./pages/Estoque"));
const AprovacaoContas = lazy(() => import("./pages/AprovacaoContas"));
const Fiscal = lazy(() => import("./pages/Fiscal"));
const Financeiro = lazy(() => import("./pages/Financeiro"));
const Manutencao = lazy(() => import("./pages/Manutencao"));
const BIGerencial = lazy(() => import("./pages/BIGerencial"));
const Administracao = lazy(() => import("./pages/Administracao"));
const AdminUsuarioDetalhe = lazy(() => import("./pages/AdminUsuarioDetalhe"));
const CiotGerar = lazy(() => import("./pages/CiotGerar"));
const CiotGerados = lazy(() => import("./pages/CiotGerados"));
const CiotConfiguracao = lazy(() => import("./pages/CiotConfiguracao"));
const ModuleSelector = lazy(() => import("./pages/ModuleSelector"));
const AgroHome = lazy(() => import("./pages/AgroHome"));
const AgroEstoque = lazy(() => import("./pages/AgroEstoque"));
const AgroMovimentacoes = lazy(() => import("./pages/AgroMovimentacoes"));
const AgroLavouras = lazy(() => import("./pages/AgroLavouras"));
const AgroCadastros = lazy(() => import("./pages/AgroCadastros"));
const AgroRelatorios = lazy(() => import("./pages/AgroRelatorios"));
const AgroInventario = lazy(() => import("./pages/AgroInventario"));
const AdminHome = lazy(() => import("./pages/AdminHome"));
const AdminCadastros = lazy(() => import("./pages/AdminCadastros"));
const AdminConfiguracoes = lazy(() => import("./pages/AdminConfiguracoes"));

// Trocas de abas carregam apenas o conteúdo: nunca recriar uma sidebar/página falsa.
const RouteFallback = () => (
  <div role="status" aria-label="Carregando página" className="flex min-h-[180px] w-full items-center justify-center gap-3 text-sm text-muted-foreground">
    <span className="size-5 animate-spin rounded-full border-2 border-primary/20 border-t-primary" aria-hidden="true" />
    Carregando página...
  </div>
);

/** Cada módulo possui seu próprio endereço, mas compartilha a autenticação. */
function TmsRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/demandas" component={Demandas} />
        <Route path="/alertas" component={Alertas} />
        <Route path="/cadastros" component={Cadastros} />
        <Route path="/cadastros/:tab" component={Cadastros} />
        <Route path="/pedagios" component={Pedagios} />
        <Route path="/viagens" component={Viagens} />
        <Route path="/romaneios" component={Romaneios} />
        <Route path="/fiscal" component={Fiscal} />
        <Route path="/financeiro" component={Financeiro} />
        <Route path="/manutencao" component={Manutencao} />
        <Route path="/bi" component={BIGerencial} />
        <Route path="/manifestos" component={Romaneios} />
        <Route path="/holerite" component={Fechamentos} />
        <Route path="/fechamentos" component={Fechamentos} />
        <Route path="/abastecimentos" component={Abastecimentos} />
        <Route path="/ciot/gerar" component={CiotGerar} />
        <Route path="/ciot/gerados" component={CiotGerados} />
        <Route path="/ciot/configuracao" component={CiotConfiguracao} />
        <Route path="/ciot" component={CiotGerar} />
        <Route path="/pneus" component={Pneus} />
        <Route path="/estoque" component={Estoque} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

function CoreRoutes() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
        <Route path="/modulos" component={ModuleSelector} />
        <Route path="/agro/estoque" component={AgroEstoque} />
        <Route path="/agro/movimentacoes" component={AgroMovimentacoes} />
        <Route path="/agro/lavouras" component={AgroLavouras} />
        <Route path="/agro/cadastros" component={AgroCadastros} />
        <Route path="/agro/relatorios" component={AgroRelatorios} />
        <Route path="/agro/inventario" component={AgroInventario} />
        <Route path="/agro" component={AgroHome} />
        <Route path="/admin/usuarios/:id" component={AdminUsuarioDetalhe} />
        <Route path="/admin/usuarios" component={Administracao} />
        <Route path="/admin/aprovacoes" component={AprovacaoContas} />
        <Route path="/admin/cadastros" component={AdminCadastros} />
        <Route path="/admin/configuracoes" component={AdminConfiguracoes} />
        <Route path="/admin/logs" component={Logs} />
        <Route path="/admin" component={AdminHome} />
        <Route path="/administracao" component={Administracao} />
        <Route path="/aprovacao-contas" component={AprovacaoContas} />
        <Route path="/perfil" component={Perfil} />
        <Route path="/alterar-senha" component={ChangePassword} />
        <Route path="/logs" component={Logs} />
        <Route path="/404" component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </Suspense>
  );
}

// Compatibilidade com links antigos, favoritos e notificações já enviados.
const LEGACY_TMS_SECTIONS = new Set([
  "demandas", "alertas", "cadastros", "pedagios", "viagens", "romaneios", "manifestos",
  "fiscal", "financeiro", "manutencao", "bi", "holerite", "fechamentos",
  "abastecimentos", "ciot", "pneus", "estoque",
]);

function legacyTmsPath(location: string) {
  const section = location.split("/")[1];
  return LEGACY_TMS_SECTIONS.has(section) ? `/tms${location}` : null;
}

function PublicAuthRouter() {
  return (
    <Switch>
      <Route path="/esqueci-senha" component={ForgotPassword} />
      <Route path="/redefinir-senha" component={ResetPassword} />
      <Route path="/login" component={Auth} />
      <Route component={Auth} />
    </Switch>
  );
}

function SessionGate() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  // O único carregamento de sessão ocorre ao abrir/atualizar o aplicativo.
  if (loading) return <AppLoading />;

  if (location === "/esqueci-senha" || location === "/redefinir-senha") {
    return <PublicAuthRouter />;
  }
  if (!user) {
    return location === "/login" ? <PublicAuthRouter /> : <Redirect to="/login" replace />;
  }

  if (location === "/" || location === "/login") {
    return <Redirect to="/modulos" replace />;
  }

  // URLs antigas passam a apontar para o TMS sem perder o caminho da seção.
  const legacy = legacyTmsPath(location);
  if (legacy) return <Redirect to={legacy} replace />;

  const adminRoute = location === "/admin" || location.startsWith("/admin/") ||
    location.startsWith("/administracao") || location.startsWith("/aprovacao-contas") ||
    location === "/logs";
  if (adminRoute && user.role !== "ADMIN") return <Redirect to="/modulos" replace />;

  if (location === "/tms" || location === "/tms/" || location.startsWith("/tms/")) {
    if (!hasModuleAccess(user, "TRANSPORTES")) return <Redirect to="/modulos" replace />;
    return <WouterRouter base="/tms"><TmsRoutes /></WouterRouter>;
  }

  if (location === "/agro" || location.startsWith("/agro/")) {
    if (!hasModuleAccess(user, "AGRO")) return <Redirect to="/modulos" replace />;
  }

  return <CoreRoutes />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <AuthProvider>
            <AdaptiveTables />
            <SessionGate />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
