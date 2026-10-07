import { useEffect, useRef, useState } from "react";
import {
  Check,
  Clock3,
  Infinity as InfinityIcon,
  Pencil,
  Save,
  Settings2,
  ShieldCheck,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "@/components/Layout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";
import { useMotoristas } from "@/lib/store";

const permissionModules = [
  "dashboard",
  "demandas",
  "romaneios",
  "viagens",
  "abastecimentos",
  "frota",
  "financeiro",
  "fiscal",
  "comercial",
  "bi",
  "cadastros",
  "portal_motorista",
];

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

type AdminUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: string;
  active: boolean;
  motoristaId: string | null;
  permissoes: Record<string, boolean>;
  createdAt: string;
  licenses: LicenseSummary[];
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

function formatExpiration(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("pt-BR");
}

function auditDetails(log: any) {
  const details = log?.detalhes;
  if (!details || typeof details !== "object" || !details.modulo || !details.depois) return "";
  const before = details.antes?.status === "ILIMITADA"
    ? "sem vencimento"
    : details.antes?.remainingDays == null
      ? "não contratado"
      : `${details.antes.remainingDays} dias`;
  const after = details.depois?.remainingDays == null
    ? details.depois?.status === "ILIMITADA" ? "sem vencimento" : "—"
    : `${details.depois.remainingDays} dias`;
  return `${moduleLabel(details.modulo)}: ${before} → ${after}`;
}

function LicenseDaysEditor({
  user,
  license,
  onSaved,
}: {
  user: AdminUser;
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
      toast.success(`Licença de ${moduleLabel(license.module)} atualizada para ${days} dia${days === 1 ? "" : "s"}.`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível atualizar a licença.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="rounded-lg border bg-muted/20 p-3">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="font-semibold">{moduleLabel(license.module)}</span>
            <Badge variant="outline" className={licenseBadgeClass(license.status)}>
              {licenseStatusLabel(license.status)}
            </Badge>
          </div>
          <div className="mt-2 flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Dias restantes:</span>
            {editing ? (
              <Input
                autoFocus
                type="number"
                min={0}
                max={365000}
                step={1}
                inputMode="numeric"
                className="h-8 w-28"
                value={draft}
                disabled={saving}
                placeholder="dias"
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
              <span className="inline-flex items-center gap-1.5 font-semibold">
                <InfinityIcon className="h-4 w-4" /> Permanente (ADMIN)
              </span>
            ) : (
              <button
                type="button"
                className="inline-flex items-center gap-1.5 rounded-md px-1.5 py-0.5 font-semibold hover:bg-accent"
                onClick={startEditing}
                title="Alterar dias restantes"
              >
                {license.unlimited ? (
                  <><InfinityIcon className="h-4 w-4" /> Sem limite</>
                ) : license.remainingDays == null ? (
                  "Não contratado"
                ) : (
                  `${license.remainingDays} dia${license.remainingDays === 1 ? "" : "s"}`
                )}
                <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            )}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {user.role === "ADMIN"
              ? "Contas administrativas não expiram."
              : license.unlimited
                ? "Sem data de vencimento definida."
                : license.expiresAt
                ? `Vencimento: ${formatExpiration(license.expiresAt)}`
                : "Defina os dias para contratar este módulo."}
          </div>
        </div>
        {saving && <Clock3 className="h-4 w-4 animate-pulse text-muted-foreground" />}
      </div>
    </div>
  );
}

export default function Administracao() {
  const { items: motoristas } = useMotoristas();
  const [tab, setTab] = useState<"USUARIOS" | "CONFIG" | "AUDITORIA">("USUARIOS");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [config, setConfig] = useState<any>({ alertaDias: 30, nomeSistema: "Radasa System", bloquearExclusao: false });

  const load = async () => {
    const [usersResponse, logsResponse, configResponse] = await Promise.all([
      api.get<AdminUser[]>("/admin/usuarios"),
      api.get("/admin/logs"),
      api.get("/admin/configuracoes"),
    ]);
    setUsers(usersResponse.data);
    setLogs(logsResponse.data);
    const nextConfig: any = { alertaDias: 30, nomeSistema: "Radasa System", bloquearExclusao: false };
    for (const item of configResponse.data) nextConfig[item.chave] = item.valor;
    setConfig(nextConfig);
  };

  useEffect(() => {
    void load();
  }, []);

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

  const updateUser = (index: number, patch: Partial<AdminUser>) => {
    setUsers((current) => current.map((user, currentIndex) => currentIndex === index ? { ...user, ...patch } : user));
  };

  const updateLicense = (userId: string, license: LicenseSummary) => {
    setUsers((current) => current.map((user) => user.id === userId
      ? { ...user, licenses: user.licenses.map((item) => item.module === license.module ? license : item) }
      : user));
  };

  const saveUser = async (user: AdminUser) => {
    try {
      await api.put(`/admin/usuarios/${user.id}/acesso`, {
        role: user.role,
        active: user.active,
        motoristaId: user.motoristaId || null,
        permissoes: user.permissoes || {},
      });
      toast.success("Acesso atualizado.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível atualizar o acesso.");
    }
  };

  const saveConfig = async () => {
    try {
      for (const [key, value] of Object.entries(config)) {
        await api.put("/admin/configuracoes", { chave: key, valor: value });
      }
      toast.success("Configurações salvas.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível salvar as configurações.");
    }
  };

  return (
    <Layout>
      <div className="space-y-5">
        <div>
          <h1 className="text-2xl font-bold">Administração e Segurança</h1>
          <p className="text-sm text-muted-foreground">
            Usuários, acessos e licenças independentes de Transportes e Agro.
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          {[
            [Users, "Usuários", users.length],
            [ShieldCheck, "Ativos", users.filter((user) => user.active).length],
            [Settings2, "Eventos de auditoria", logs.length],
          ].map(([Icon, label, value]: any) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{label}</span>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="mt-2 text-2xl font-bold">{value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto border-b">
          {[
            ["USUARIOS", "Usuários e licenças"],
            ["CONFIG", "Configurações"],
            ["AUDITORIA", "Auditoria"],
          ].map(([key, label]) => (
            <Button key={key} variant={tab === key ? "default" : "ghost"} onClick={() => setTab(key as typeof tab)}>
              {label}
            </Button>
          ))}
        </div>

        {tab === "USUARIOS" && (
          <div className="space-y-3">
            {users.map((user, index) => (
              <Card key={user.id}>
                <CardContent className="space-y-5 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold">
                        {user.name} <span className="text-xs font-normal text-muted-foreground">@{user.username}</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </div>
                    <Button size="sm" onClick={() => void saveUser(user)}>
                      <Save className="mr-1 h-4 w-4" /> Salvar acesso
                    </Button>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <label className="text-sm">
                      Perfil
                      <select
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                        value={user.role}
                        onChange={(event) => updateUser(index, { role: event.target.value })}
                      >
                        {["ADMIN", "GERENTE", "BORRACHARIA", "MANUTENCAO", "VISUALIZACAO", "USER"].map((role) => (
                          <option key={role}>{role}</option>
                        ))}
                      </select>
                    </label>

                    <label className="text-sm">
                      Motorista vinculado
                      <select
                        className="mt-1 h-10 w-full rounded-md border bg-background px-3"
                        value={user.motoristaId || ""}
                        onChange={(event) => updateUser(index, { motoristaId: event.target.value || null })}
                      >
                        <option value="">Nenhum</option>
                        {motoristas.map((motorista) => (
                          <option key={motorista.id} value={motorista.id}>{motorista.nome}</option>
                        ))}
                      </select>
                    </label>

                    <label className="mt-6 flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={user.active}
                        onCheckedChange={(value) => updateUser(index, { active: !!value })}
                      />
                      Usuário ativo
                    </label>
                  </div>

                  <div>
                    <div className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase text-muted-foreground">
                      <Clock3 className="h-3.5 w-3.5" /> Licenças por módulo
                    </div>
                    <div className="grid gap-3 lg:grid-cols-2">
                      {licenseModules.map((module) => {
                        const license = user.licenses?.find((item) => item.module === module) ?? {
                          module,
                          status: "NAO_CONTRATADO" as const,
                          active: false,
                          unlimited: false,
                          expiresAt: null,
                          remainingDays: null,
                        };
                        return (
                          <LicenseDaysEditor
                            key={module}
                            user={user}
                            license={license}
                            onSaved={(updated) => updateLicense(user.id, updated)}
                          />
                        );
                      })}
                    </div>
                    <p className="mt-2 text-xs text-muted-foreground">
                      Clique no lápis e informe diretamente os dias restantes. Enter ou sair do campo salva automaticamente.
                    </p>
                  </div>

                  <div>
                    <div className="mb-2 text-xs font-semibold uppercase text-muted-foreground">Permissões do Transportes</div>
                    <div className="flex flex-wrap gap-2">
                      {permissionModules.map((module) => (
                        <label key={module} className="flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
                          <Checkbox
                            checked={user.role === "ADMIN" || !!user.permissoes?.[module]}
                            disabled={user.role === "ADMIN"}
                            onCheckedChange={(value) => updateUser(index, {
                              permissoes: { ...(user.permissoes || {}), [module]: !!value },
                            })}
                          />
                          {module}
                        </label>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {tab === "CONFIG" && (
          <Card>
            <CardHeader><CardTitle className="text-base">Configurações gerais</CardTitle></CardHeader>
            <CardContent className="grid gap-4 md:grid-cols-2">
              <label className="text-sm">
                Nome do sistema
                <Input className="mt-1" value={config.nomeSistema || ""} onChange={(event) => setConfig({ ...config, nomeSistema: event.target.value })} />
              </label>
              <label className="text-sm">
                Alertar vencimentos com antecedência (dias)
                <Input className="mt-1" type="number" value={config.alertaDias || 30} onChange={(event) => setConfig({ ...config, alertaDias: Number(event.target.value) })} />
              </label>
              <div className="md:col-span-2">
                <Button onClick={() => void saveConfig()}><Save className="mr-2 h-4 w-4" />Salvar configurações</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {tab === "AUDITORIA" && (
          <Card>
            <CardContent className="overflow-x-auto p-4">
              <table className="w-full min-w-[960px] text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2">Data</th>
                    <th>Usuário</th>
                    <th>Ação</th>
                    <th>Detalhes</th>
                    <th>Método</th>
                    <th>Caminho</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="py-2">{new Date(log.createdAt).toLocaleString("pt-BR")}</td>
                      <td>{log.user?.name || log.user?.username}</td>
                      <td>{log.action}</td>
                      <td className="max-w-[280px] truncate">{auditDetails(log) || "—"}</td>
                      <td>{log.method}</td>
                      <td className="max-w-[360px] truncate">{log.path}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}
