import { useEffect, useMemo, useState } from "react";
import {
  CalendarDays,
  ChevronRight,
  Clock3,
  RefreshCw,
  Search,
  ShieldCheck,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";

type LicenseStatus = "ATIVA" | "VENCIDA" | "SUSPENSA" | "NAO_CONTRATADO" | "ILIMITADA";
type LicenseSummary = {
  module: "TRANSPORTES" | "AGRO";
  status: LicenseStatus;
  active: boolean;
  unlimited: boolean;
  expiresAt: string | null;
  remainingDays: number | null;
};

type AdminUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  telefone?: string;
  cpf?: string | null;
  role: string;
  active: boolean;
  motoristaId: string | null;
  permissoes: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  licenses: LicenseSummary[];
};

function licenseOf(user: AdminUser, module: "TRANSPORTES" | "AGRO") {
  return user.licenses?.find((license) => license.module === module) ?? {
    module,
    status: "NAO_CONTRATADO" as const,
    active: false,
    unlimited: false,
    expiresAt: null,
    remainingDays: null,
  };
}

function licenseLabel(license: LicenseSummary) {
  if (license.status === "ILIMITADA") return "Permanente";
  if (license.status === "NAO_CONTRATADO") return "Não contratado";
  if (license.status === "SUSPENSA") return "Suspensa";
  if (license.status === "VENCIDA") return "Vencida";
  return `${license.remainingDays ?? 0} dias`;
}

function licenseClass(status: LicenseStatus) {
  if (status === "ATIVA") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "ILIMITADA") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (status === "VENCIDA") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (status === "SUSPENSA") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

export default function Administracao() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [role, setRole] = useState("TODOS");
  const [accountStatus, setAccountStatus] = useState("TODOS");
  const [transportStatus, setTransportStatus] = useState("TODOS");
  const [agroStatus, setAgroStatus] = useState("TODOS");

  const load = async () => {
    setLoading(true);
    try {
      const { data } = await api.get<AdminUser[]>("/admin/usuarios");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []);

  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "admin", "usuarios")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void load(); }, 250);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(REALTIME_CHANGE_EVENT, handler);
    };
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return users.filter((user) => {
      if (q) {
        const haystack = normalize(`${user.name} ${user.username} ${user.email}`);
        if (!haystack.includes(q)) return false;
      }
      if (role !== "TODOS" && user.role !== role) return false;
      if (accountStatus === "ATIVOS" && !user.active) return false;
      if (accountStatus === "INATIVOS" && user.active) return false;
      if (transportStatus !== "TODOS" && licenseOf(user, "TRANSPORTES").status !== transportStatus) return false;
      if (agroStatus !== "TODOS" && licenseOf(user, "AGRO").status !== agroStatus) return false;
      return true;
    });
  }, [users, search, role, accountStatus, transportStatus, agroStatus]);

  const stats = useMemo(() => ({
    total: users.length,
    active: users.filter((user) => user.active).length,
    admins: users.filter((user) => user.role === "ADMIN").length,
    expired: users.filter((user) =>
      licenseOf(user, "TRANSPORTES").status === "VENCIDA" || licenseOf(user, "AGRO").status === "VENCIDA",
    ).length,
  }), [users]);

  const clearFilters = () => {
    setSearch("");
    setRole("TODOS");
    setAccountStatus("TODOS");
    setTransportStatus("TODOS");
    setAgroStatus("TODOS");
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Usuários e licenças</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              Pesquise contas, consulte as licenças e abra o usuário para administrar todos os dados da conta.
            </p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar
          </Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [Users, "Contas", stats.total],
            [ShieldCheck, "Contas ativas", stats.active],
            [ShieldCheck, "Administradores", stats.admins],
            [Clock3, "Com licença vencida", stats.expired],
          ].map(([Icon, label, value]: any) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>{label}</span><Icon className="h-4 w-4" />
                </div>
                <div className="mt-2 text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="pl-9"
                placeholder="Pesquisar por username, e-mail ou nome..."
                autoComplete="off"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={role} onChange={(event) => setRole(event.target.value)}>
                <option value="TODOS">Todos os perfis</option>
                {["ADMIN", "GERENTE", "BORRACHARIA", "MANUTENCAO", "VISUALIZACAO", "USER"].map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={accountStatus} onChange={(event) => setAccountStatus(event.target.value)}>
                <option value="TODOS">Todas as contas</option>
                <option value="ATIVOS">Somente ativas</option>
                <option value="INATIVOS">Somente inativas</option>
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={transportStatus} onChange={(event) => setTransportStatus(event.target.value)}>
                <option value="TODOS">Transportes: todos</option>
                <option value="ATIVA">Transportes: ativa</option>
                <option value="VENCIDA">Transportes: vencida</option>
                <option value="NAO_CONTRATADO">Transportes: não contratado</option>
                <option value="ILIMITADA">Transportes: permanente</option>
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={agroStatus} onChange={(event) => setAgroStatus(event.target.value)}>
                <option value="TODOS">Agro: todos</option>
                <option value="ATIVA">Agro: ativa</option>
                <option value="VENCIDA">Agro: vencida</option>
                <option value="NAO_CONTRATADO">Agro: não contratado</option>
                <option value="ILIMITADA">Agro: permanente</option>
              </select>
              <Button variant="ghost" onClick={clearFilters}>Limpar filtros</Button>
            </div>
            <div className="text-xs text-muted-foreground">
              Exibindo <span className="font-semibold text-foreground">{filtered.length}</span> de {users.length} conta{users.length === 1 ? "" : "s"}.
            </div>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Conta</th>
                  <th className="px-4 py-3">E-mail</th>
                  <th className="px-4 py-3">Perfil</th>
                  <th className="px-4 py-3">Situação</th>
                  <th className="px-4 py-3">Transportes</th>
                  <th className="px-4 py-3">Agro</th>
                  <th className="px-4 py-3">Última atividade</th>
                  <th className="w-16 px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Carregando usuários...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">Nenhuma conta encontrada com os filtros informados.</td></tr>
                ) : filtered.map((user) => {
                  const transport = licenseOf(user, "TRANSPORTES");
                  const agro = licenseOf(user, "AGRO");
                  return (
                    <tr key={user.id} className="border-t transition hover:bg-muted/25">
                      <td className="px-4 py-3">
                        <div className="font-semibold">{user.name}</div>
                        <div className="text-xs text-muted-foreground">@{user.username}</div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
                      <td className="px-4 py-3"><Badge variant="outline">{user.role}</Badge></td>
                      <td className="px-4 py-3">
                        <Badge variant="outline" className={user.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"}>
                          {user.active ? "Ativa" : "Inativa"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3"><Badge variant="outline" className={licenseClass(transport.status)}>{licenseLabel(transport)}</Badge></td>
                      <td className="px-4 py-3"><Badge variant="outline" className={licenseClass(agro.status)}>{licenseLabel(agro)}</Badge></td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(user.lastActivityAt)}</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link href={`/admin/usuarios/${user.id}`} className="inline-flex h-9 w-9 items-center justify-center rounded-md border bg-background hover:bg-accent" title="Abrir usuário" aria-label={`Abrir usuário ${user.username}`}>
                          <ChevronRight className="h-4 w-4" />
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
