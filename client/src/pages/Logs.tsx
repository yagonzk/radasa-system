import { useEffect, useState } from "react";
import { ArrowLeft, ScrollText, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import Layout from "@/components/Layout";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";

type Log = {
  id: string;
  action: string;
  createdAt: string;
  user: { username: string; email: string };
};

export default function Logs() {
  const { user } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(user?.role === "ADMIN");

  useEffect(() => {
    if (user?.role !== "ADMIN") {
      setLoading(false);
      return;
    }

    let active = true;
    api.get<Log[]>("/logs")
      .then((response) => {
        if (active) setLogs(response.data);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [user?.role]);

  if (user?.role !== "ADMIN") {
    return (
      <Layout>
        <div className="mx-auto w-full max-w-3xl rounded-xl border bg-card p-5 text-center sm:p-8">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Somente administradores podem visualizar os logs do sistema.
          </p>
          <Link href="/" className="mt-5 inline-flex items-center gap-2 text-sm text-primary hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Voltar para a visão geral
          </Link>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto w-full min-w-0 max-w-7xl">
        <Link href="/" className="mb-5 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        <div className="mb-6 flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <ScrollText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">Logs do sistema</h1>
            <p className="text-sm text-muted-foreground">Histórico das alterações realizadas pelos usuários.</p>
          </div>
        </div>

        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 sm:px-5">Usuário</th>
                  <th className="px-4 py-3 sm:px-5">E-mail</th>
                  <th className="px-4 py-3 sm:px-5">Alteração</th>
                  <th className="px-4 py-3 sm:px-5">Data e hora</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">Carregando...</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={4} className="px-5 py-10 text-center text-muted-foreground">Nenhuma alteração registrada.</td></tr>
                ) : (
                  logs.map((log) => (
                    <tr key={log.id} className="border-t border-border">
                      <td className="px-4 py-3 font-medium sm:px-5">@{log.user.username}</td>
                      <td className="px-4 py-3 text-muted-foreground sm:px-5">{log.user.email}</td>
                      <td className="px-4 py-3 sm:px-5">{log.action}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted-foreground sm:px-5">
                        {new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(new Date(log.createdAt))}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </Layout>
  );
}
