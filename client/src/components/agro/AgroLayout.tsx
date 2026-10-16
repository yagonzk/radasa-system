import { type ReactNode, useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import {
  ArrowLeftRight,
  BarChart3,
  Boxes,
  ClipboardList,
  ReceiptText,
  KeyRound,
  LayoutDashboard,
  Leaf,
  LogOut,
  Menu,
  Moon,
  NotebookTabs,
  Sprout,
  Sun,
  UserRound,
  Warehouse,
  X,
} from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { getModuleLicense, moduleStatusLabel } from "@/lib/module-access";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface AgroNavItem {
  label: string;
  href: string;
  icon: ReactNode;
}

const agroNav: AgroNavItem[] = [
  { label: "Dashboard", href: "/agro", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { label: "Estoque", href: "/agro/estoque", icon: <Warehouse className="h-[18px] w-[18px]" /> },
  { label: "Movimentações", href: "/agro/movimentacoes", icon: <ClipboardList className="h-[18px] w-[18px]" /> },
  { label: "Barracões", href: "/agro/inventario", icon: <Boxes className="h-[18px] w-[18px]" /> },
  { label: "Lavouras", href: "/agro/lavouras", icon: <Sprout className="h-[18px] w-[18px]" /> },
  { label: "Cadastros", href: "/agro/cadastros", icon: <NotebookTabs className="h-[18px] w-[18px]" /> },
  { label: "Relatórios", href: "/agro/relatorios", icon: <BarChart3 className="h-[18px] w-[18px]" /> },
  { label: "Fiscal · NF-e", href: "/agro/fiscal/nfe", icon: <ReceiptText className="h-[18px] w-[18px]" /> },
];

export default function AgroLayout({ children }: { children: ReactNode }) {
  const [location, navigate] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout, refreshUser } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDark = theme === "dark";
  const license = getModuleLicense(user, "AGRO");
  const initials = useMemo(
    () => user?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U",
    [user?.name],
  );

  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);

  useEffect(() => {
    let active = true;
    api.get("/agro/status").catch(async (error) => {
      if (!active) return;
      if (error?.response?.status === 401 || error?.response?.status === 403) {
        await refreshUser().catch(() => undefined);
        navigate("/modulos");
      }
    });
    return () => { active = false; };
  }, [navigate, refreshUser]);

  const isActive = (href: string) => href === "/agro" ? location === "/agro" : location.startsWith(href);

  const sidebar = (
    <>
      <div className="flex items-center gap-3 border-b border-sidebar-border/80 px-5 py-5">
        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-[#266b40] to-[#399458] shadow-sm ring-1 ring-amber-400/25">
          <Leaf className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <span className="block truncate font-display text-[15px] font-bold leading-tight text-sidebar-foreground">Radasa Agro</span>
          <span className="block truncate text-[10px] text-muted-foreground">Gestão agrícola</span>
        </div>
        <button
          type="button"
          className="ml-auto flex h-9 w-9 items-center justify-center rounded-xl text-muted-foreground hover:bg-sidebar-accent xl:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-3 py-4">
        <Link
          href="/modulos"
          onClick={() => setMobileMenuOpen(false)}
          className="mb-3 flex items-center gap-3 rounded-2xl border border-sidebar-border/80 bg-white/50 px-3 py-3 text-[12px] font-semibold text-sidebar-foreground shadow-sm transition hover:bg-sidebar-accent/60 dark:bg-white/5"
        >
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">Agro</span>
            <span className="block text-[10px] font-normal text-muted-foreground">Trocar módulo</span>
          </span>
        </Link>

        {agroNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              data-active={active ? "true" : undefined}
              className={cn(
                "radasa-nav-item flex items-center gap-3 rounded-2xl px-3 py-3 text-[13px] font-medium transition-all",
                active
                  ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground"
                  : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <span className={cn(active && "text-primary")}>{item.icon}</span>
              {item.label}
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-sidebar-border/80 bg-sidebar/60 px-4 py-4">
        <div className="mb-3 rounded-2xl border border-sidebar-border bg-sidebar-accent/30 px-3 py-2.5">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Licença Agro</div>
          <div className="mt-0.5 truncate text-[11px] font-semibold text-sidebar-foreground">{user?.role === "ADMIN" ? "Sem vencimento" : moduleStatusLabel(license)}</div>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br from-primary to-chart-2 text-xs font-bold text-primary-foreground shadow-sm transition hover:ring-4 hover:ring-primary/15"
                aria-label="Abrir opções do perfil"
              >
                {user?.fotoPerfil ? <img src={user.fotoPerfil} alt="Foto de perfil" className="h-full w-full object-cover" /> : initials}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-48">
              <DropdownMenuItem asChild><Link href="/modulos" className="flex cursor-pointer items-center gap-2"><ArrowLeftRight className="h-4 w-4" />Trocar módulo</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/perfil" className="flex cursor-pointer items-center gap-2"><UserRound className="h-4 w-4" />Meu perfil</Link></DropdownMenuItem>
              <DropdownMenuItem asChild><Link href="/alterar-senha" className="flex cursor-pointer items-center gap-2"><KeyRound className="h-4 w-4" />Alterar senha</Link></DropdownMenuItem>
              
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-sidebar-foreground">{user?.name}</p>
            <p className="truncate text-[11px] text-muted-foreground">@{user?.username}</p>
          </div>
          <button
            type="button"
            onClick={logout}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
            aria-label="Sair da conta"
            title="Sair da conta"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className={cn("module-agro flex min-h-screen min-w-0 bg-background", isDark && "dark")}>
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px] xl:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={cn(
        "surface-glass fixed left-3 top-3 z-40 flex h-[calc(100vh-1.5rem)] w-[236px] flex-col rounded-[2rem] border border-sidebar-border/90 bg-sidebar/95 shadow-[0_24px_60px_rgba(15,23,42,0.12)] transition-transform duration-200 xl:left-4 xl:top-4 xl:h-[calc(100vh-2rem)] xl:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-[120%]",
      )}>
        {sidebar}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col xl:ml-[268px]">
        <header className="surface-glass sticky top-0 z-20 mx-3 mt-3 flex h-14 items-center gap-3 rounded-2xl border border-border/70 bg-background/85 px-3 shadow-sm backdrop-blur sm:mx-4 sm:px-4 xl:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border bg-card text-foreground shadow-sm"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-chart-2">
              <Leaf className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <span className="block truncate font-display text-sm font-bold">Radasa Agro</span>
              <span className="block truncate text-[10px] text-muted-foreground">Gestão agrícola</span>
            </div>
          </div>
        </header>

        <main data-radasa-agro-main className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-7 xl:p-8">
          <div className="radasa-page-enter w-full min-w-0 max-w-full">{children}</div>
        </main>

        <footer className="mx-3 mb-3 mt-2 flex items-center justify-between gap-3 border-t border-border/40 px-3 py-3 sm:mx-4 sm:px-4 md:mx-6 md:px-6 xl:mx-8 xl:px-8">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <Boxes className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Ambiente Agro separado do Transportes</span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="surface-glass flex shrink-0 items-center gap-2 rounded-full border border-border/70 bg-card/85 px-3.5 py-2 text-xs font-medium text-muted-foreground shadow-sm transition-all hover:bg-accent hover:text-accent-foreground hover:border-primary/30 active:scale-95"
            aria-label="Alternar tema"
            title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            {isDark ? <><Sun className="h-3.5 w-3.5" /><span className="hidden sm:inline">Modo claro</span></> : <><Moon className="h-3.5 w-3.5" /><span className="hidden sm:inline">Modo escuro</span></>}
          </button>
        </footer>
      </div>
    </div>
  );
}
