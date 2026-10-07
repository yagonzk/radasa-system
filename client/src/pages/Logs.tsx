import { useEffect, useMemo, useState } from "react";
import { RefreshCw, ScrollText, Search, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { REALTIME_CHANGE_EVENT, realtimeChangeTouches } from "@/lib/realtime";

type Log = {
  id: string;
  action: string;
  method: string;
  path: string;
  entityId?: string | null;
  detalhes?: unknown;
  createdAt: string;
  user: { id: string; name: string; username: string; email: string };
};

function normalize(value: string) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

export default function Logs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(user?.role === "ADMIN");
  const [search, setSearch] = useState("");
  const [method, setMethod] = useState("TODOS");

  const load = async () => {
    if (user?.role !== "ADMIN") return;
    setLoading(true);
    try {
      const response = await api.get<Log[]>("/admin/logs");
      setLogs(response.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, [user?.role]);

  useEffect(() => {
    let timer: number | undefined;
    const handler = (event: Event) => {
      if (!realtimeChangeTouches(event, "admin", "usuarios", "agro", "financeiro", "manifestos", "viagens")) return;
      if (timer) window.clearTimeout(timer);
      timer = window.setTimeout(() => { void load(); }, 350);
    };
    window.addEventListener(REALTIME_CHANGE_EVENT, handler);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener(REALTIME_CHANGE_EVENT, handler);
    };
  }, [user?.role]);

  const filtered = useMemo(() => {
    const q = normalize(search);
    return logs.filter((log) => {
      if (method !== "TODOS" && log.method !== method) return false;
      if (!q) return true;
      return normalize(`${log.user?.name || ""} ${log.user?.username || ""} ${log.user?.email || ""} ${log.action} ${log.path}`).includes(q);
    });
  }, [logs, search, method]);

  if (user?.role !== "ADMIN") {
    return (
      <AdminLayout>
        <div className="mx-auto w-full max-w-3xl rounded-xl border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">Somente administradores podem visualizar os logs do sistema.</p>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="mx-auto w-full min-w-0 max-w-[1500px] space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><ScrollText className="h-5 w-5" /></div>
            <div>
              <h1 className="text-2xl font-bold">Logs e auditoria</h1>
              <p className="text-sm text-muted-foreground">Pesquise alterações por usuário, e-mail, ação ou caminho da API.</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />Atualizar</Button>
        </div>

        <Card>
          <CardContent className="grid gap-3 p-4 lg:grid-cols-[1fr_190px_auto]">
            <div className="relative"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Username, e-mail, ação ou caminho..." /></div>
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={method} onChange={(event) => setMethod(event.target.value)}>
              <option value="TODOS">Todos os métodos</option>
              {["POST", "PUT", "PATCH", "DELETE", "GET"].map((item) => <option key={item} value={item}>{item}</option>)}
            </select>
            <Button variant="ghost" onClick={() => { setSearch(""); setMethod("TODOS"); }}>Limpar</Button>
            <div className="text-xs text-muted-foreground lg:col-span-3">Exibindo {filtered.length} de {logs.length} eventos carregados.</div>
          </CardContent>
        </Card>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1050px] text-left text-sm">
              <thead className="bg-muted/40 text-xs text-muted-foreground"><tr><th className="px-4 py-3">Data</th><th className="px-4 py-3">Usuário</th><th className="px-4 py-3">E-mail</th><th className="px-4 py-3">Ação</th><th className="px-4 py-3">Método</th><th className="px-4 py-3">Caminho</th></tr></thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Carregando...</td></tr>
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={6} className="px-5 py-10 text-center text-muted-foreground">Nenhum evento encontrado.</td></tr>
                ) : filtered.map((log) => (
                  <tr key={log.id} className="border-t border-border">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">{new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(log.createdAt))}</td>
                    <td className="px-4 py-3"><Link href={`/admin/usuarios/${log.user.id}`} className="font-medium text-primary hover:underline">@{log.user.username}</Link><div className="text-xs text-muted-foreground">{log.user.name}</div></td>
                    <td className="px-4 py-3 text-muted-foreground">{log.user.email}</td>
                    <td className="px-4 py-3 font-medium">{log.action}</td>
                    <td className="px-4 py-3"><Badge variant="outline">{log.method}</Badge></td>
                    <td className="max-w-[420px] truncate px-4 py-3 text-xs text-muted-foreground" title={log.path}>{log.path}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </AdminLayout>
  );
}
