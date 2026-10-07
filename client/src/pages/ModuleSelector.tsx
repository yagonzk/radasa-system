import { useEffect } from "react";
import { ArrowRight, Leaf, LogOut, RefreshCw, Settings2, ShieldCheck, Truck, UserRound } from "lucide-react";
import { useLocation } from "wouter";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getModuleLicense, hasModuleAccess, moduleStatusLabel, remainingModuleDays, type RadasaModule } from "@/lib/module-access";

function ModuleCard({ module, onEnter }: { module: RadasaModule; onEnter: () => void }) {
  const { user } = useAuth();
  const license = getModuleLicense(user, module);
  const enabled = hasModuleAccess(user, module);
  const days = remainingModuleDays(license);
  const transport = module === "TRANSPORTES";
  const Icon = transport ? Truck : Leaf;
  const title = transport ? "Transportes" : "Agro";
  const description = transport
    ? "TMS, frota, romaneios, viagens, financeiro e BI."
    : "Gestão agrícola, estoque, movimentações e lavouras.";

  return (
    <Card className={cn("overflow-hidden border-2 transition", enabled ? "hover:border-primary/40 hover:shadow-md" : "opacity-75")}> 
      <CardContent className="p-0">
        <div className="flex min-h-[260px] flex-col p-6">
          <div className="flex items-start justify-between gap-3">
            <div className={cn("flex h-12 w-12 items-center justify-center rounded-2xl", enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}> 
              <Icon className="h-6 w-6" />
            </div>
            <Badge variant="outline" className={cn(enabled ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-muted-foreground/20 bg-muted text-muted-foreground")}> 
              {enabled ? "Disponível" : "Bloqueado"}
            </Badge>
          </div>

          <div className="mt-5">
            <h2 className="text-xl font-bold">{title}</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>

          <div className="mt-5 rounded-xl border bg-muted/25 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Licença</div>
            <div className={cn("mt-1 text-sm font-semibold", enabled ? "text-foreground" : "text-destructive")}>{moduleStatusLabel(license)}</div>
            {enabled && days !== null && days <= 7 && <div className="mt-1 text-xs text-amber-600 dark:text-amber-400">Vencimento próximo.</div>}
          </div>

          <div className="mt-auto pt-5">
            <Button className="w-full" disabled={!enabled} onClick={onEnter}>
              {enabled ? <>Entrar em {title}<ArrowRight className="ml-2 h-4 w-4" /></> : title === "Agro" ? "Agro indisponível" : "Transportes indisponível"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AdminModuleCard({ onEnter }: { onEnter: () => void }) {
  return (
    <Card className="overflow-hidden border-2 transition hover:border-primary/40 hover:shadow-md">
      <CardContent className="p-0">
        <div className="flex min-h-[260px] flex-col p-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Settings2 className="h-6 w-6" />
            </div>
            <Badge variant="outline" className="border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300">Somente ADMIN</Badge>
          </div>
          <div className="mt-5">
            <h2 className="text-xl font-bold">Administração</h2>
            <p className="mt-1.5 text-sm leading-6 text-muted-foreground">Usuários, licenças, logs, cadastros e informações gerais da plataforma.</p>
          </div>
          <div className="mt-5 rounded-xl border bg-muted/25 p-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Acesso</div>
            <div className="mt-1 text-sm font-semibold">Administrativo permanente</div>
          </div>
          <div className="mt-auto pt-5">
            <Button className="w-full" onClick={onEnter}>Entrar em Administração<ArrowRight className="ml-2 h-4 w-4" /></Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ModuleSelector() {
  const { user, logout, refreshUser } = useAuth();
  const [, navigate] = useLocation();

  useEffect(() => {
    void refreshUser();
    const onFocus = () => void refreshUser();
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refreshUser]);

  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto w-full max-w-5xl">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-5">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary"><ShieldCheck className="h-4 w-4" /> Radasa System</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Escolha onde deseja entrar</h1>
            <p className="mt-1 text-sm text-muted-foreground">Transportes e Agro possuem licenças independentes. A Administração é exclusiva para administradores.</p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => void refreshUser()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
            <Button variant="outline" size="sm" onClick={() => navigate("/perfil")}><UserRound className="mr-2 h-4 w-4" />Perfil</Button>
            <Button variant="outline" size="sm" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Sair</Button>
          </div>
        </div>

        <div className="mt-6 rounded-xl border bg-card px-4 py-3 text-sm">
          <span className="text-muted-foreground">Conta:</span> <strong>{user?.name}</strong> <span className="text-muted-foreground">@{user?.username}</span>
          {user?.role === "ADMIN" && <Badge className="ml-2" variant="secondary">Administrador</Badge>}
        </div>

        <div className={cn("mt-6 grid gap-4 md:grid-cols-2", user?.role === "ADMIN" && "lg:grid-cols-3")}>
          <ModuleCard module="TRANSPORTES" onEnter={() => navigate("/")} />
          <ModuleCard module="AGRO" onEnter={() => navigate("/agro")} />
          {user?.role === "ADMIN" && <AdminModuleCard onEnter={() => navigate("/admin")} />}
        </div>

        {!hasModuleAccess(user, "TRANSPORTES") && !hasModuleAccess(user, "AGRO") && (
          <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-300">
            Nenhum módulo está disponível no momento. Um administrador precisa liberar ou renovar uma das licenças.
          </div>
        )}
      </div>
    </main>
  );
}
