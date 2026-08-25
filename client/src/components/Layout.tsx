import { useTheme } from "@/contexts/ThemeContext";
import { cn } from "@/lib/utils";
import { Truck, Users, LayoutDashboard, Moon, Sun, ClipboardList, HandCoins, LogOut, KeyRound, ScrollText, Fuel, Boxes, FileBadge2, ChevronDown, ChevronRight, UserRound, Settings2, BadgeDollarSign, ShieldCheck, Menu, X, BriefcaseBusiness, WalletCards, ListTodo, BarChart3, ContactRound } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Link, useLocation } from "wouter";
import { type ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

interface NavItem {
  label: string;
  href: string;
  icon: ReactNode;
  matchPaths: string[];
  adminOnly?: boolean;
}

const navGroups = [
  {
    label: "Operação",
    icon: <BriefcaseBusiness className="h-[18px] w-[18px]" />,
    items: [
      { label: "Romaneios", href: "/romaneios", icon: <ClipboardList className="h-4 w-4" />, matchPaths: ["/romaneios", "/manifestos"] },
      { label: "Viagens", href: "/viagens", icon: <Truck className="h-4 w-4" />, matchPaths: ["/viagens"] },
      { label: "Abastecimentos", href: "/abastecimentos", icon: <Fuel className="h-4 w-4" />, matchPaths: ["/abastecimentos"] },
      { label: "Rotas", href: "/pedagios", icon: <BadgeDollarSign className="h-4 w-4" />, matchPaths: ["/pedagios"] },
    ],
  },
  {
    label: "Frota",
    icon: <Truck className="h-[18px] w-[18px]" />,
    items: [
      { label: "Manutenção", href: "/manutencao", icon: <Truck className="h-4 w-4" />, matchPaths: ["/manutencao"] },
      { label: "Pneus", href: "/pneus", icon: <Truck className="h-4 w-4" />, matchPaths: ["/pneus"] },
    ],
  },
  {
    label: "Financeiro",
    icon: <WalletCards className="h-[18px] w-[18px]" />,
    items: [
      { label: "Visão Geral", href: "/financeiro", icon: <WalletCards className="h-4 w-4" />, matchPaths: ["/financeiro"] },
      { label: "Comissões", href: "/fechamentos", icon: <HandCoins className="h-4 w-4" />, matchPaths: ["/fechamentos"] },
      { label: "Rentabilidade", href: "/fiscal", icon: <FileBadge2 className="h-4 w-4" />, matchPaths: ["/fiscal"] },
    ],
  },
  {
    label: "Comercial",
    icon: <ContactRound className="h-[18px] w-[18px]" />,
    items: [
      { label: "CRM e Propostas", href: "/comercial", icon: <BriefcaseBusiness className="h-4 w-4" />, matchPaths: ["/comercial"] },
    ],
  },
  {
    label: "Fiscal",
    icon: <FileBadge2 className="h-[18px] w-[18px]" />,
    items: [
      { label: "CIOT", href: "/ciot/gerar", icon: <FileBadge2 className="h-4 w-4" />, matchPaths: ["/ciot"] },
    ],
  },
  {
    label: "Almoxarifado",
    icon: <Boxes className="h-[18px] w-[18px]" />,
    items: [
      { label: "Estoque e movimentações", href: "/estoque", icon: <Boxes className="h-4 w-4" />, matchPaths: ["/estoque"] },
    ],
  },
  {
    label: "Cadastros",
    icon: <Users className="h-[18px] w-[18px]" />,
    items: [
      { label: "Veículos", href: "/cadastros/veiculos", icon: <Truck className="h-4 w-4" />, matchPaths: ["/cadastros/veiculos", "/pneus"] },
      { label: "Pessoas", href: "/cadastros/motoristas", icon: <Users className="h-4 w-4" />, matchPaths: ["/cadastros/motoristas", "/cadastros/chapas"] },
      { label: "Comercial", href: "/cadastros/clientes", icon: <HandCoins className="h-4 w-4" />, matchPaths: ["/cadastros/clientes", "/cadastros/produtos", "/cadastros/empresa"] },
      { label: "Localidades", href: "/cadastros/locais", icon: <BadgeDollarSign className="h-4 w-4" />, matchPaths: ["/cadastros/locais"] },
    ],
  },
  {
    label: "Relatórios",
    icon: <BarChart3 className="h-[18px] w-[18px]" />,
    items: [
      { label: "BI Gerencial", href: "/bi", icon: <BarChart3 className="h-4 w-4" />, matchPaths: ["/bi"] },
    ],
  },
  {
    label: "Administração",
    icon: <Settings2 className="h-[18px] w-[18px]" />,
    adminOnly: true,
    items: [
      { label: "Central administrativa", href: "/administracao", icon: <Settings2 className="h-4 w-4" />, matchPaths: ["/administracao"] },
      { label: "Aprovação de contas", href: "/aprovacao-contas", icon: <ShieldCheck className="h-4 w-4" />, matchPaths: ["/aprovacao-contas"] },
      { label: "Logs do sistema", href: "/logs", icon: <ScrollText className="h-4 w-4" />, matchPaths: ["/logs"] },
    ],
  },
] satisfies Array<{ label: string; icon: ReactNode; adminOnly?: boolean; items: NavItem[] }>;


export default function Layout({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  const { theme, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>(() => Object.fromEntries(navGroups.map(group => [group.label, group.items.some(item => item.matchPaths.some(path => location.startsWith(path)))])));
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isDark = theme === "dark";
  const configuredPermissions = user?.permissoes && Object.keys(user.permissoes).length > 0;
  const permissionFor = (href: string) => href.startsWith("/romaneios") ? "romaneios" : href.startsWith("/viagens") || href.startsWith("/pedagios") ? "viagens" : href.startsWith("/abastecimentos") ? "abastecimentos" : href.startsWith("/manutencao") || href.startsWith("/pneus") ? "frota" : href.startsWith("/financeiro") || href.startsWith("/fechamentos") ? "financeiro" : href.startsWith("/ciot") || href.startsWith("/fiscal") ? "fiscal" : href.startsWith("/comercial") ? "comercial" : href.startsWith("/bi") ? "bi" : href.startsWith("/cadastros") || href.startsWith("/estoque") ? "cadastros" : href.startsWith("/portal-motorista") ? "portal_motorista" : href.startsWith("/alertas") ? "dashboard" : "dashboard";
  const canAccessItem = (item: NavItem) => user?.role === "ADMIN" || !configuredPermissions || user?.permissoes?.[permissionFor(item.href)] === true;
  const canAccessStandalone = (permission: string) => user?.role === "ADMIN" || !configuredPermissions || user?.permissoes?.[permission] === true;


  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location]);
  const initials = user?.name?.trim().split(/\s+/).slice(0, 2).map(part => part[0]).join("").toUpperCase() || "U";

  const isActive = (item: NavItem) =>
    item.matchPaths.some((p) =>
      p === "/" ? location === "/" : location.startsWith(p)
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

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed left-0 top-0 z-40 flex h-screen w-[220px] flex-col border-r border-sidebar-border bg-sidebar shadow-sm transition-transform duration-200 lg:translate-x-0",
          mobileMenuOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
            <Truck className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="font-display text-[14px] font-bold leading-tight text-sidebar-foreground">
            Radasa System
          </span>
          <button
            type="button"
            className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-sidebar-accent lg:hidden"
            aria-label="Fechar menu"
            onClick={() => setMobileMenuOpen(false)}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {canAccessStandalone("demandas") && <Link
            href="/demandas"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all",
              location === "/demandas" ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <ListTodo className={cn("h-[18px] w-[18px]", location === "/demandas" && "text-primary")} />
            Demandas
            {location === "/demandas" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </Link>}

          {canAccessStandalone("dashboard") && <Link
            href="/"
            onClick={() => setMobileMenuOpen(false)}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all",
              location === "/" ? "bg-sidebar-accent font-semibold text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
            )}
          >
            <LayoutDashboard className={cn("h-[18px] w-[18px]", location === "/" && "text-primary")} />
            Dashboard
            {location === "/" && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </Link>}

          {navGroups.map(group => ({ ...group, items: group.items.filter(canAccessItem) })).filter(group => group.items.length > 0 && (!group.adminOnly || user?.role === "ADMIN")).map(group => {
            const groupActive = group.items.some(isActive);
            const open = openGroups[group.label] ?? false;
            return (
              <div key={group.label} className="space-y-1">
                <button
                  type="button"
                  onClick={() => setOpenGroups(current => ({ ...current, [group.label]: !open }))}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-all",
                    groupActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-semibold" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                  )}
                >
                  <span className={cn(groupActive && "text-primary")}>{group.icon}</span>
                  {group.label}
                  {open ? <ChevronDown className="ml-auto h-4 w-4" /> : <ChevronRight className="ml-auto h-4 w-4" />}
                </button>
                {open && (
                  <div className="ml-4 space-y-1 border-l border-sidebar-border pl-3">
                    {group.items.map(item => {
                      const active = isActive(item);
                      return (
                        <Link key={item.href} href={item.href} onClick={() => setMobileMenuOpen(false)} className={cn(
                          "flex items-center gap-2 rounded-lg px-3 py-2 text-[12px] font-medium transition-colors",
                          active ? "bg-sidebar-accent text-sidebar-accent-foreground" : "text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
                        )}>
                          {item.icon}{item.label}
                        </Link>
                      );
                    })}
                    {group.label === "Fiscal" && location.startsWith("/ciot") && (
                      <div className="ml-3 space-y-1 border-l border-sidebar-border pl-2">
                        <Link href="/ciot/gerar" className="block rounded px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-sidebar-accent">Gerar CIOTs</Link>
                        <Link href="/ciot/gerados" className="block rounded px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-sidebar-accent">CIOTs gerados</Link>
                        <Link href="/ciot/configuracao" className="block rounded px-2 py-1.5 text-[11px] text-muted-foreground hover:bg-sidebar-accent">Configuração ANTT</Link>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* User profile */}
        <div className="border-t border-sidebar-border px-4 py-4 bg-sidebar">
          <div className="flex items-center gap-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary text-xs font-bold text-primary-foreground transition hover:ring-2 hover:ring-primary/30" aria-label="Abrir opções do perfil">{user?.fotoPerfil ? <img src={user.fotoPerfil} alt="Foto de perfil" className="h-full w-full object-cover" /> : initials}</button>
              </DropdownMenuTrigger>
              <DropdownMenuContent side="top" align="start" className="w-48">
                <DropdownMenuItem asChild><Link href="/perfil" className="flex cursor-pointer items-center gap-2"><UserRound className="h-4 w-4"/>Meu perfil</Link></DropdownMenuItem>
                <DropdownMenuItem asChild><Link href="/alterar-senha" className="flex cursor-pointer items-center gap-2"><KeyRound className="h-4 w-4"/>Alterar senha</Link></DropdownMenuItem>
                {user?.role === "ADMIN" && <DropdownMenuItem asChild><Link href="/logs" className="flex cursor-pointer items-center gap-2"><ScrollText className="h-4 w-4"/>Ver logs</Link></DropdownMenuItem>}
              </DropdownMenuContent>
            </DropdownMenu>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-sidebar-foreground">
                {user?.name}
              </p>
              <p className="truncate text-[11px] text-muted-foreground">
                @{user?.username}
              </p>
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
      </aside>

      {/* Main content */}
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
              <Truck className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="truncate font-display text-sm font-bold">Radasa System</span>
          </div>
        </header>

        <main data-radasa-main className="min-h-0 min-w-0 flex-1 overflow-x-hidden p-3 sm:p-4 md:p-6 lg:p-6 xl:p-8">
          <div className="w-full min-w-0 max-w-full">{children}</div>
        </main>

        {/* Footer with theme toggle */}
        <footer className="flex items-center justify-end border-t border-border/50 px-3 py-3 sm:px-4 md:px-6 xl:px-8">
          <button
            onClick={toggleTheme}
            className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-all duration-200 hover:bg-accent hover:text-accent-foreground hover:border-primary/30 active:scale-95"
            aria-label="Alternar tema"
            title={isDark ? "Mudar para modo claro" : "Mudar para modo escuro"}
          >
            {isDark ? (
              <>
                <Sun className="h-3.5 w-3.5 text-amber-500" />
                <span>Modo claro</span>
              </>
            ) : (
              <>
                <Moon className="h-3.5 w-3.5 text-slate-500" />
                <span>Modo escuro</span>
              </>
            )}
          </button>
        </footer>
      </div>
    </div>
  );
}
