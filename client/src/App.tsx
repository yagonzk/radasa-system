import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch, useLocation } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import Dashboard from "./pages/Dashboard";
import Demandas from "./pages/Demandas";
import Cadastros from "./pages/Cadastros";
import Pedagios from "./pages/Pedagios";
import Viagens from "./pages/Viagens";
import Fechamentos from "./pages/Fechamentos";
import Romaneios from "./pages/Romaneios";
import Auth from "./pages/Auth";
import ChangePassword from "./pages/ChangePassword";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Perfil from "./pages/Perfil";
import Logs from "./pages/Logs";
import Abastecimentos from "./pages/Abastecimentos";
import Pneus from "./pages/Pneus";
import Estoque from "./pages/Estoque";
import AprovacaoContas from "./pages/AprovacaoContas";
import Fiscal from "./pages/Fiscal";
import Financeiro from "./pages/Financeiro";
import Manutencao from "./pages/Manutencao";
import BIGerencial from "./pages/BIGerencial";
import Administracao from "./pages/Administracao";
import ComercialCRM from "./pages/ComercialCRM";
import CiotGerar from "./pages/CiotGerar";
import CiotGerados from "./pages/CiotGerados";
import CiotConfiguracao from "./pages/CiotConfiguracao";
import { LoaderCircle } from "lucide-react";

function Router() {
  return (
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
      <Route path="/administracao" component={Administracao} />
      <Route path="/comercial" component={ComercialCRM} />
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
