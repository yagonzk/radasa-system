import { documentDigits, formatCpfInput } from "@/lib/documentMasks";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  Activity,
  ArrowLeft,
  CalendarDays,
  Check,
  Clock3,
  Infinity as InfinityIcon,
  KeyRound,
  Pencil,
  RefreshCw,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { Link, useRoute } from "wouter";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import { useMotoristas } from "@/lib/store";

const permissionModules = [
  ["dashboard", "Visão Geral"],
  ["demandas", "Demandas"],
  ["romaneios", "Romaneios"],
  ["viagens", "Viagens"],
  ["abastecimentos", "Abastecimentos"],
  ["frota", "Frota"],
  ["financeiro", "Financeiro / DRE"],
  ["fiscal", "Fiscal"],
  ["comercial", "Comercial"],
  ["bi", "BI"],
  ["cadastros", "Cadastros"],
  ["portal_motorista", "Portal do motorista"],
] as const;

const licenseModules = ["TRANSPORTES", "AGRO"] as const;
type LicenseModule = (typeof licenseModules)[number];
type LicenseStatus = "ATIVA" | "VENCIDA" | "SUSPENSA" | "NAO_CONTRATADO" | "ILIMITADA";

type LicenseSummary = {
  module: LicenseModule;
  status: LicenseStatus;
  active: boolean;
  unlimited: boolean;
  expiresAt: string | null;
  remainingDays: number | null;
};

type AuditLog = {
  id: string;
  action: string;
  method: string;
  path: string;
  entityId: string | null;
  detalhes: unknown;
  createdAt: string;
  user: { id: string; name: string; username: string; email: string };
};

type AdminUserDetails = {
  id: string;
  name: string;
  username: string;
  email: string;
  telefone: string;
  cpf: string | null;
  fotoPerfil: string | null;
  role: string;
  active: boolean;
  motoristaId: string | null;
  permissoes: Record<string, boolean>;
  createdAt: string;
  updatedAt: string;
  lastActivityAt: string | null;
  auditCount: number;
  auditLogs: AuditLog[];
  licenses: LicenseSummary[];
};

type AccountDraft = {
  name: string;
  username: string;
  email: string;
  telefone: string;
  cpf: string;
  password: string;
};

function moduleLabel(module: LicenseModule) {
  return module === "TRANSPORTES" ? "Transportes" : "Agro";
}

function licenseStatusLabel(status: LicenseStatus) {
  if (status === "NAO_CONTRATADO") return "Não contratado";
  if (status === "ILIMITADA") return "Sem vencimento";
  if (status === "SUSPENSA") return "Suspensa";
  if (status === "VENCIDA") return "Vencida";
  return "Ativa";
}

function licenseBadgeClass(status: LicenseStatus) {
  if (status === "ATIVA") return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300";
  if (status === "ILIMITADA") return "border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300";
  if (status === "VENCIDA") return "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300";
  if (status === "SUSPENSA") return "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300";
  return "border-border bg-muted text-muted-foreground";
}

function formatDate(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short" });
}

function formatExpiration(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function LicenseDaysEditor({
  user,
  license,
  onSaved,
}: {
  user: AdminUserDetails;
  license: LicenseSummary;
  onSaved: (license: LicenseSummary) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const cancelledRef = useRef(false);

  const startEditing = () => {
    setDraft(license.remainingDays == null ? "" : String(license.remainingDays));
    setEditing(true);
  };

  const save = async () => {
    if (cancelledRef.current) {
      cancelledRef.current = false;
      setEditing(false);
      return;
    }
    if (saving) return;
    const normalized = draft.trim();
    if (!normalized) {
      setEditing(false);
      return;
    }
    const days = Number(normalized);
    if (!Number.isInteger(days) || days < 0 || days > 365000) {
      toast.error("Informe uma quantidade inteira de dias entre 0 e 365000.");
      return;
    }
    if (!license.unlimited && license.remainingDays === days) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      const { data } = await api.put<LicenseSummary>(
        `/admin/usuarios/${user.id}/licencas/${license.module}/dias`,
        { remainingDays: days },
      );
      onSaved(data);
      setEditing(false);
      toast.success(`Licença de ${moduleLabel(license.module)} atualizada.`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível atualizar a licença.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-xl border bg-muted/15 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{moduleLabel(license.module)}</span>
            <Badge variant="outline" className={licenseBadgeClass(license.status)}>{licenseStatusLabel(license.status)}</Badge>
          </div>
          <div className="mt-3 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Dias restantes:</span>
            {editing ? (
              <Input
                autoFocus
                type="number"
                min={0}
                max={365000}
                step={1}
                inputMode="numeric"
                className="h-9 w-32"
                value={draft}
                disabled={saving}
                onChange={(event) => setDraft(event.target.value)}
                onBlur={() => void save()}
                onKeyDown={(event) => {
                  if (event.key === "Enter") event.currentTarget.blur();
                  if (event.key === "Escape") {
                    cancelledRef.current = true;
                    event.currentTarget.blur();
                  }
                }}
              />
            ) : user.role === "ADMIN" ? (
              <span className="inline-flex items-center gap-1.5 font-semibold"><InfinityIcon className="h-4 w-4" /> Permanente</span>
            ) : (
              <button type="button" className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold hover:bg-accent" onClick={startEditing} title="Alterar dias restantes">
                {license.unlimited ? <><InfinityIcon className="h-4 w-4" /> Sem limite</> : license.remainingDays == null ? "Não contratado" : `${license.remainingDays} dias`}
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {user.role === "ADMIN" ? "Administradores possuem acesso permanente." : license.unlimited ? "Sem data de vencimento." : license.expiresAt ? `Vencimento: ${formatExpiration(license.expiresAt)}` : "Informe os dias para liberar o módulo."}
          </div>
        </div>
        {saving ? <Clock3 className="h-4 w-4 animate-pulse text-muted-foreground" /> : <Check className="h-4 w-4 text-muted-foreground/40" />}
      </div>
    </div>
  );
}

export default function AdminUsuarioDetalhe() {
  const [, params] = useRoute("/admin/usuarios/:id");
  const userId = params?.id ?? "";
  const { items: motoristas } = useMotoristas();
  const [user, setUser] = useState<AdminUserDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [savingAccount, setSavingAccount] = useState(false);
  const [savingAccess, setSavingAccess] = useState(false);
  const [tab, setTab] = useState<"CONTA" | "ACESSO" | "LICENCAS" | "ATIVIDADE">("CONTA");
  const [account, setAccount] = useState<AccountDraft>({ name: "", username: "", email: "", telefone: "", cpf: "", password: "" });
  const [access, setAccess] = useState({ role: "VISUALIZACAO", active: true, motoristaId: "", permissoes: {} as Record<string, boolean> });

  const load = async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data } = await api.get<AdminUserDetails>(`/admin/usuarios/${userId}`);
      setUser(data);
      setAccount({
        name: data.name || "",
        username: data.username || "",
        email: data.email || "",
        telefone: data.telefone || "",
        cpf: data.cpf || "",
        password: "",
      });
      setAccess({
        role: data.role,
        active: data.active,
        motoristaId: data.motoristaId || "",
        permissoes: data.permissoes || {},
      });
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível carregar o usuário.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [userId]);

  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "admin", "usuarios")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void load(); }, 300);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(REALTIME_CHANGE_EVENT, handler);
    };
  }, [userId]);

  const saveAccount = async () => {
    if (!user) return;
    setSavingAccount(true);
    try {
      await api.put(`/admin/usuarios/${user.id}/conta`, account);
      toast.success(account.password ? "Dados e senha da conta atualizados." : "Dados da conta atualizados.");
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível atualizar os dados da conta.");
    } finally {
      setSavingAccount(false);
    }
  };

  const saveAccess = async () => {
    if (!user) return;
    setSavingAccess(true);
    try {
      await api.put(`/admin/usuarios/${user.id}/acesso`, {
        role: access.role,
        active: access.active,
        motoristaId: access.motoristaId || null,
        permissoes: access.permissoes,
      });
      toast.success("Acesso e permissões atualizados.");
      await load();
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível atualizar o acesso.");
    } finally {
      setSavingAccess(false);
    }
  };

  const updateLicense = (license: LicenseSummary) => {
    setUser((current) => current ? {
      ...current,
      licenses: current.licenses.map((item) => item.module === license.module ? license : item),
    } : current);
  };

  const initials = useMemo(() => user?.name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "U", [user?.name]);

  if (loading) {
    return <AdminLayout><div className="flex min-h-[45vh] items-center justify-center text-sm text-muted-foreground">Carregando usuário...</div></AdminLayout>;
  }

  if (!user) {
    return (
      <AdminLayout>
        <div className="mx-auto max-w-2xl rounded-xl border bg-card p-8 text-center">
          <UserRound className="mx-auto h-9 w-9 text-muted-foreground" />
          <h1 className="mt-3 text-xl font-bold">Usuário não encontrado</h1>
          <Link href="/admin/usuarios" className="mt-4 inline-flex items-center gap-2 text-sm text-primary hover:underline"><ArrowLeft className="h-4 w-4" />Voltar para usuários</Link>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-[1450px] space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <Link href="/admin/usuarios" className="mb-2 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Usuários e licenças</Link>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {user.fotoPerfil ? <img src={user.fotoPerfil} alt="Foto de perfil" className="h-full w-full object-cover" /> : initials}
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold">{user.name}</h1>
                  <Badge variant="outline">{user.role}</Badge>
                  <Badge variant="outline" className={user.active ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300" : "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"}>{user.active ? "Ativa" : "Inativa"}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">@{user.username} • {user.email}</p>
              </div>
            </div>
          </div>
          <Button variant="outline" onClick={() => void load()}><RefreshCw className="mr-2 h-4 w-4" />Atualizar</Button>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Criada em</div><div className="mt-2 text-sm font-semibold">{formatDate(user.createdAt)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Última alteração</div><div className="mt-2 text-sm font-semibold">{formatDate(user.updatedAt)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Última atividade</div><div className="mt-2 text-sm font-semibold">{formatDate(user.lastActivityAt)}</div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="text-xs text-muted-foreground">Eventos auditados</div><div className="mt-2 text-2xl font-bold">{user.auditCount}</div></CardContent></Card>
        </div>

        <div className="flex gap-2 overflow-x-auto border-b pb-1">
          {[
            ["CONTA", "Dados da conta", UserRound],
            ["ACESSO", "Acesso e permissões", ShieldCheck],
            ["LICENCAS", "Licenças", Clock3],
            ["ATIVIDADE", "Atividade", Activity],
          ].map(([key, label, Icon]: any) => (
            <Button key={key} variant={tab === key ? "default" : "ghost"} onClick={() => setTab(key)} className="shrink-0">
              <Icon className="mr-2 h-4 w-4" />{label}
            </Button>
          ))}
        </div>

        {tab === "CONTA" && (
          <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader><CardTitle className="text-base">Informações da conta</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <label className="text-sm">Nome completo<Input className="mt-1" value={account.name} onChange={(event) => setAccount({ ...account, name: event.target.value })} /></label>
                <label className="text-sm">Username<Input className="mt-1" value={account.username} autoCapitalize="none" onChange={(event) => setAccount({ ...account, username: event.target.value })} /></label>
                <label className="text-sm">E-mail<Input className="mt-1" type="email" value={account.email} autoCapitalize="none" onChange={(event) => setAccount({ ...account, email: event.target.value })} /></label>
                <label className="text-sm">Telefone<Input className="mt-1" value={account.telefone} onChange={(event) => setAccount({ ...account, telefone: event.target.value })} /></label>
                <label className="text-sm">CPF<Input className="mt-1" inputMode="numeric" maxLength={14} value={formatCpfInput(account.cpf)} onChange={(event) => setAccount({ ...account, cpf: documentDigits(event.target.value).slice(0, 11) })} placeholder="000.000.000-00" /></label>
                <label className="text-sm">ID interno<Input className="mt-1" value={user.id} readOnly disabled /></label>
                <div className="md:col-span-2 flex justify-end"><Button onClick={() => void saveAccount()} disabled={savingAccount}><Save className="mr-2 h-4 w-4" />{savingAccount ? "Salvando..." : "Salvar dados"}</Button></div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 text-base"><KeyRound className="h-4 w-4" />Definir nova senha</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">Use apenas quando precisar redefinir a senha do usuário. A senha atual não é exibida.</p>
                <Input type="password" autoComplete="new-password" placeholder="Nova senha (mínimo 8 caracteres)" value={account.password} onChange={(event) => setAccount({ ...account, password: event.target.value })} />
                <Button className="w-full" variant="outline" disabled={!account.password || savingAccount} onClick={() => void saveAccount()}><KeyRound className="mr-2 h-4 w-4" />Alterar senha</Button>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "ACESSO" && (
          <div className="space-y-4">
            <Card>
              <CardHeader><CardTitle className="text-base">Situação e perfil</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-3">
                <label className="text-sm">Perfil
                  <select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={access.role} onChange={(event) => setAccess({ ...access, role: event.target.value })}>
                    {["ADMIN", "GERENTE", "BORRACHARIA", "MANUTENCAO", "VISUALIZACAO", "USER"].map((role) => <option key={role} value={role}>{role}</option>)}
                  </select>
                </label>
                <label className="text-sm">Motorista vinculado
                  <select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={access.motoristaId} onChange={(event) => setAccess({ ...access, motoristaId: event.target.value })}>
                    <option value="">Nenhum</option>
                    {motoristas.map((motorista) => <option key={motorista.id} value={motorista.id}>{motorista.nome}</option>)}
                  </select>
                </label>
                <label className="mt-6 flex h-10 items-center gap-2 rounded-md border px-3 text-sm">
                  <Checkbox checked={access.active} onCheckedChange={(value) => setAccess({ ...access, active: !!value })} />Conta ativa
                </label>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Permissões do Transportes</CardTitle></CardHeader>
              <CardContent>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {permissionModules.map(([module, label]) => (
                    <label key={module} className="flex min-h-11 items-center gap-2 rounded-lg border px-3 py-2 text-sm">
                      <Checkbox
                        checked={access.role === "ADMIN" || !!access.permissoes?.[module]}
                        disabled={access.role === "ADMIN"}
                        onCheckedChange={(value) => setAccess({ ...access, permissoes: { ...access.permissoes, [module]: !!value } })}
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-4 flex justify-end"><Button onClick={() => void saveAccess()} disabled={savingAccess}><Save className="mr-2 h-4 w-4" />{savingAccess ? "Salvando..." : "Salvar acesso"}</Button></div>
              </CardContent>
            </Card>
          </div>
        )}

        {tab === "LICENCAS" && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Licenças por módulo</CardTitle>
              <p className="text-sm text-muted-foreground">Clique no lápis, informe diretamente os dias restantes e pressione Enter ou saia do campo.</p>
            </CardHeader>
            <CardContent className="grid gap-3 lg:grid-cols-2">
              {licenseModules.map((module) => {
                const license = user.licenses.find((item) => item.module === module) ?? { module, status: "NAO_CONTRATADO" as const, active: false, unlimited: false, expiresAt: null, remainingDays: null };
                return <LicenseDaysEditor key={module} user={user} license={license} onSaved={updateLicense} />;
              })}
            </CardContent>
          </Card>
        )}

        {tab === "ATIVIDADE" && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base"><Activity className="h-4 w-4" />Atividade recente</CardTitle>
              <p className="text-sm text-muted-foreground">Últimos 100 eventos da conta e alterações administrativas feitas sobre ela. Total histórico relacionado: {user.auditCount}.</p>
            </CardHeader>
            <CardContent className="overflow-x-auto p-0">
              <table className="w-full min-w-[900px] text-left text-sm">
                <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Executado por</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Método</th><th className="px-4 py-3">Caminho</th></tr></thead>
                <tbody>
                  {user.auditLogs.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">Nenhuma atividade registrada para esta conta.</td></tr>
                  ) : user.auditLogs.map((log) => (
                    <tr key={log.id} className="border-t"><td className="whitespace-nowrap px-4 py-3 text-muted-foreground"><span className="inline-flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5" />{formatDate(log.createdAt)}</span></td><td className="px-4 py-3"><div className="font-medium">@{log.user.username}</div><div className="text-xs text-muted-foreground">{log.user.name}</div></td><td className="px-4 py-3 font-medium">{log.action}</td><td className="px-4 py-3"><Badge variant="outline">{log.method}</Badge></td><td className="max-w-[480px] truncate px-4 py-3 text-muted-foreground">{log.path}</td></tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </AdminLayout>
  );
}
