import { type ReactNode, useEffect, useMemo, useState } from "react";
import {
  ArrowLeftRight,
  Boxes,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ScrollText,
  ShieldCheck,
  Sun,
  UserRound,
  Users,
  X,
} from "lucide-react";
import { Link, useLocation } from "wouter";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";

const adminNav = [
  { label: "Visão administrativa", href: "/admin", icon: <LayoutDashboard className="h-[18px] w-[18px]" /> },
  { label: "Usuários e licenças", href: "/admin/usuarios", icon: <Users className="h-[18px] w-[18px]" /> },
  { label: "Aprovação de contas", href: "/admin/aprovacoes", icon: <ShieldCheck className="h-[18px] w-[18px]" /> },
  { label: "Cadastros e dados", href: "/admin/cadastros", icon: <Boxes className="h-[18px] w-[18px]" /> },
  { label: "Logs e auditoria", href: "/admin/logs", icon: <ScrollText className="h-[18px] w-[18px]" /> },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDark = theme === "dark";
  const initials = useMemo(
    () => user?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "A",
    [user?.name],
  );

  useEffect(() => setMobileMenuOpen(false), [location]);

  const isActive = (href: string) => href === "/admin" ? location === "/admin" : location.startsWith(href);

  const sidebar = (
    <>
      <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <ShieldCheck className="h-5 w-5 text-primary-foreground" />
        </div>
        <div className="min-w-0">
          <span className="block truncate font-display text-[14px] font-bold leading-tight text-sidebar-foreground">Radasa Admin</span>
          <span className="block truncate text-[10px] text-muted-foreground">Gestão da plataforma</span>
        </div>
        <button
          type="button"
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
        <Link
          href="/modulos"
          onClick={() => setMobileMenuOpen(false)}
          className="mb-3 flex items-center gap-3 rounded-lg border border-sidebar-border px-3 py-2.5 text-[12px] font-semibold text-sidebar-foreground transition hover:bg-sidebar-accent/60"
        >
          <ArrowLeftRight className="h-4 w-4 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block truncate">Administração</span>
            <span className="block text-[10px] font-normal text-muted-foreground">Trocar módulo</span>
          </span>
        </Link>

        {adminNav.map((item) => {
          const active = isActive(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileMenuOpen(false)}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all",
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

      <div className="border-t border-sidebar-border bg-sidebar px-4 py-4">
        <div className="mb-3 rounded-lg border border-sidebar-border bg-sidebar-accent/30 px-3 py-2">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">Acesso administrativo</div>
          <div className="mt-0.5 truncate text-[11px] font-semibold text-sidebar-foreground">Administrador • acesso permanente</div>
        </div>
        <div className="flex items-center gap-3">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground transition hover:ring-2 hover:ring-primary/30"
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
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
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
    <div className={cn("flex min-h-screen min-w-0 bg-background", isDark && "dark")}>
      {mobileMenuOpen && (
        <button
          type="button"
          className="fixed inset-0 z-30 bg-black/45 backdrop-blur-[1px] lg:hidden"
          aria-label="Fechar menu"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-sidebar-border bg-sidebar shadow-sm transition-transform duration-200 lg:translate-x-0",
        mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
      )}>
        {sidebar}
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col lg:ml-[220px]">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/70 bg-background/95 px-3 backdrop-blur sm:px-4 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileMenuOpen(true)}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border bg-card text-foreground shadow-sm"
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex min-w-0 items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary">
              <ShieldCheck className="h-4 w-4 text-primary-foreground" />
            </div>
            <div className="min-w-0">
              <span className="block truncate font-display text-sm font-bold">Radasa Admin</span>
              <span className="block truncate text-[10px] text-muted-foreground">Gestão da plataforma</span>
            </div>
          </div>
        </header>

        <main data-radasa-admin-main className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-6 xl:p-8">
          <div className="w-full min-w-0 max-w-full">{children}</div>
        </main>

        <footer className="flex items-center justify-between gap-3 border-t border-border/50 px-3 py-3 sm:px-4 md:px-6 xl:px-8">
          <div className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">Ambiente restrito a administradores</span>
          </div>
          <button
            type="button"
            onClick={toggleTheme}
            className="flex shrink-0 items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all hover:bg-accent hover:text-accent-foreground hover:border-primary/30 active:scale-95"
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
