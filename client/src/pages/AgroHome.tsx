import { useEffect, useState } from "react";
import { ArrowLeftRight, Leaf, LogOut, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";
import { getModuleLicense, moduleStatusLabel } from "@/lib/module-access";

export default function AgroHome() {
  const { user, logout } = useAuth();
  const [, navigate] = useLocation();
  const [checking, setChecking] = useState(true);
  const [error, setError] = useState("");
  const license = getModuleLicense(user, "AGRO");

  useEffect(() => {
    let active = true;
    api.get("/agro/status")
      .catch((err) => { if (active) setError(err?.response?.data?.message || "Não foi possível validar a licença do Agro."); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  return (
    <main className="min-h-screen bg-background">
      <header className="border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Leaf className="h-5 w-5" /></div>
            <div><div className="font-bold">Radasa System</div><div className="text-xs text-muted-foreground">Ambiente Agro</div></div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/modulos")}><ArrowLeftRight className="mr-2 h-4 w-4" />Trocar módulo</Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/perfil")}><UserRound className="mr-2 h-4 w-4" />Perfil</Button>
            <Button variant="outline" size="sm" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
          </div>
        </div>
      </header>

      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><h1 className="text-2xl font-bold">Agro</h1><p className="mt-1 text-sm text-muted-foreground">O ambiente está separado do Transportes e protegido pela licença Agro.</p></div>
          <div className="rounded-lg border bg-card px-3 py-2 text-sm"><span className="text-muted-foreground">Licença: </span><strong>{moduleStatusLabel(license)}</strong></div>
        </div>

        <Card className="mt-6">
          <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Leaf className="h-5 w-5" />Ambiente Agro preparado</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            {checking && <p>Validando acesso ao módulo...</p>}
            {error && <p className="text-destructive">{error}</p>}
            {!checking && !error && <p>A licença foi validada pelo servidor. Nesta Etapa 2 ainda não foram criadas as telas funcionais de Estoque e Lavouras.</p>}
            <p>A estrutura visual e o menu próprio do Agro serão montados na próxima etapa, mantendo os dados agrícolas separados do TMS.</p>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
