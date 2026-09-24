import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import { LoaderCircle } from "lucide-react";

const Dashboard = lazy(() => import("./pages/Dashboard"));
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
const BIV2 = lazy(() => import("./pages/BIV2"));
const Administracao = lazy(() => import("./pages/Administracao"));
const CiotGerar = lazy(() => import("./pages/CiotGerar"));
const CiotGerados = lazy(() => import("./pages/CiotGerados"));
const CiotConfiguracao = lazy(() => import("./pages/CiotConfiguracao"));

const RouteFallback = () => (
  <div className="flex min-h-[40vh] items-center justify-center bg-background">
    <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
  </div>
);

function Router() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/demandas" component={Demandas} />
      <Route path="/cadastros" component={Cadastros} />
      <Route path="/cadastros/:tab" component={Cadastros} />
      <Route path="/pedagios" component={Pedagios} />
      <Route path="/viagens" component={Viagens} />
      <Route path="/romaneios" component={Romaneios} />
      <Route path="/fiscal" component={Fiscal} />
      <Route path="/financeiro" component={Financeiro} />
      <Route path="/manutencao" component={Manutencao} />
      <Route path="/bi" component={BIGerencial} />
      <Route path="/bi-v2" component={BIV2} />
      <Route path="/administracao" component={Administracao} />
      <Route path="/manifestos" component={Romaneios} />
      <Route path="/fechamentos" component={Fechamentos} />
      <Route path="/abastecimentos" component={Abastecimentos} />
      <Route path="/ciot/gerar" component={CiotGerar} />
      <Route path="/ciot/gerados" component={CiotGerados} />
      <Route path="/ciot/configuracao" component={CiotConfiguracao} />
      <Route path="/ciot" component={CiotGerar} />
      <Route path="/pneus" component={Pneus} />
      <Route path="/estoque" component={Estoque} />
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

function PublicAuthRouter() {
  return (
    <Switch>
      <Route path="/esqueci-senha" component={ForgotPassword} />
      <Route path="/redefinir-senha" component={ResetPassword} />
      <Route component={Auth} />
    </Switch>
  );
}

function SessionGate() {
  const { user, loading } = useAuth();
  const [location] = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoaderCircle className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (location === "/esqueci-senha" || location === "/redefinir-senha") {
    return <PublicAuthRouter />;
  }

  return user ? <Router /> : <PublicAuthRouter />;
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light" switchable>
        <TooltipProvider>
          <AuthProvider>
            <SessionGate />
            <Toaster />
          </AuthProvider>
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
