import { useCallback, useEffect, useState } from "react";
import Layout from "@/components/Layout";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { Check, Clock3, LoaderCircle, ShieldCheck, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";

type PendingUser = {
  id: string;
  name: string;
  username: string;
  email: string;
  role: "ADMIN" | "GERENTE" | "BORRACHARIA" | "MANUTENCAO" | "VISUALIZACAO" | "USER";
  active: boolean;
  createdAt: string;
};

function formatCreatedAt(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function AprovacaoContas() {
  const { user } = useAuth();
  const [pending, setPending] = useState<PendingUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadPending = useCallback(async () => {
    if (user?.role !== "ADMIN") {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.get<PendingUser[]>("/usuarios/pending");
      setPending(data);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível carregar as contas pendentes.");
    } finally {
      setLoading(false);
    }
  }, [user?.role]);

  useEffect(() => {
    void loadPending();
  }, [loadPending]);

  const approve = async (account: PendingUser) => {
    setProcessingId(account.id);
    try {
      await api.patch(`/usuarios/${account.id}/approve`);
      setPending((items) => items.filter((item) => item.id !== account.id));
      toast.success(`Conta de ${account.name} aprovada.`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível aprovar a conta.");
    } finally {
      setProcessingId(null);
    }
  };

  const reject = async (account: PendingUser) => {
    const confirmed = window.confirm(
      `Recusar a solicitação de ${account.name} (@${account.username})? A conta pendente será removida.`,
    );
    if (!confirmed) return;

    setProcessingId(account.id);
    try {
      await api.delete(`/usuarios/${account.id}/reject`);
      setPending((items) => items.filter((item) => item.id !== account.id));
      toast.success(`Solicitação de ${account.name} recusada.`);
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível recusar a conta.");
    } finally {
      setProcessingId(null);
    }
  };

  if (user?.role !== "ADMIN") {
    return (
      <Layout>
        <div className="mx-auto max-w-3xl rounded-xl border bg-card p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-muted-foreground" />
          <h1 className="mt-4 text-xl font-bold">Acesso restrito</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Somente administradores podem aprovar novas contas.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="mx-auto max-w-5xl space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-6 w-6 text-primary" />
              <h1 className="font-display text-2xl font-bold">Aprovação de contas</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Novos usuários só conseguem entrar no sistema depois da aprovação de um administrador.
            </p>
          </div>
          <Button variant="outline" onClick={() => void loadPending()} disabled={loading}>
            {loading ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Clock3 className="mr-2 h-4 w-4" />}
            Atualizar
          </Button>
        </div>

        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-5 py-4">
            <div>
              <p className="font-semibold">Aguardando aprovação</p>
              <p className="text-xs text-muted-foreground">{pending.length} conta(s) pendente(s)</p>
            </div>
          </div>

          {loading ? (
            <div className="flex min-h-48 items-center justify-center">
              <LoaderCircle className="h-7 w-7 animate-spin text-primary" />
            </div>
          ) : pending.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <Check className="mx-auto h-10 w-10 text-emerald-500" />
              <p className="mt-3 font-semibold">Nenhuma conta pendente</p>
              <p className="mt-1 text-sm text-muted-foreground">Todas as solicitações já foram analisadas.</p>
            </div>
          ) : (
            <div className="divide-y">
              {pending.map((account) => {
                const processing = processingId === account.id;
                return (
                  <div key={account.id} className="flex flex-col gap-4 px-5 py-4 md:flex-row md:items-center md:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                        <UserRound className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-semibold">{account.name}</p>
                        <p className="truncate text-sm text-muted-foreground">@{account.username} • {account.email}</p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          Solicitada em {formatCreatedAt(account.createdAt)} • Perfil inicial: Visualização
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 gap-2">
                      <Button variant="outline" disabled={processing} onClick={() => void reject(account)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        Recusar
                      </Button>
                      <Button disabled={processing} onClick={() => void approve(account)}>
                        {processing ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Check className="mr-2 h-4 w-4" />}
                        Aprovar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </Layout>
  );
}
