import { useEffect, useState } from "react";
import { Save, Settings2 } from "lucide-react";
import { toast } from "sonner";
import AdminLayout from "@/components/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { api } from "@/lib/api";

type Config = {
  nomeSistema: string;
  alertaDias: number;
};

export default function AdminConfiguracoes() {
  const [config, setConfig] = useState<Config>({ nomeSistema: "Radasa System", alertaDias: 30 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    api.get<Array<{ chave: string; valor: unknown }>>("/admin/configuracoes")
      .then(({ data }) => {
        if (!active) return;
        const next: Config = { nomeSistema: "Radasa System", alertaDias: 30 };
        for (const item of data) {
          if (item.chave === "nomeSistema") next.nomeSistema = String(item.valor ?? "Radasa System");
          if (item.chave === "alertaDias") next.alertaDias = Number(item.valor ?? 30);
        }
        setConfig(next);
      })
      .catch((error: any) => toast.error(error?.response?.data?.message || "Não foi possível carregar as configurações."))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const save = async () => {
    if (!config.nomeSistema.trim()) {
      toast.error("Informe o nome do sistema.");
      return;
    }
    if (!Number.isFinite(config.alertaDias) || config.alertaDias < 0 || config.alertaDias > 3650) {
      toast.error("Informe uma antecedência entre 0 e 3650 dias.");
      return;
    }
    setSaving(true);
    try {
      await Promise.all([
        api.put("/admin/configuracoes", { chave: "nomeSistema", valor: config.nomeSistema.trim() }),
        api.put("/admin/configuracoes", { chave: "alertaDias", valor: Math.floor(config.alertaDias) }),
      ]);
      toast.success("Configurações atualizadas.");
    } catch (error: any) {
      toast.error(error?.response?.data?.message || "Não foi possível salvar as configurações.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdminLayout>
      <div className="mx-auto w-full max-w-5xl space-y-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary"><Settings2 className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold">Configurações do sistema</h1>
            <p className="mt-1 text-sm text-muted-foreground">Parâmetros gerais administrados fora dos módulos operacionais.</p>
          </div>
        </div>

        <Card>
          <CardHeader><CardTitle className="text-base">Configurações gerais</CardTitle></CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <label className="text-sm">
              Nome do sistema
              <Input className="mt-1" disabled={loading} value={config.nomeSistema} onChange={(event) => setConfig({ ...config, nomeSistema: event.target.value })} />
            </label>
            <label className="text-sm">
              Alertar vencimentos com antecedência (dias)
              <Input className="mt-1" type="number" min={0} max={3650} disabled={loading} value={config.alertaDias} onChange={(event) => setConfig({ ...config, alertaDias: Number(event.target.value) })} />
            </label>
            <div className="md:col-span-2 flex justify-end">
              <Button onClick={() => void save()} disabled={loading || saving}><Save className="mr-2 h-4 w-4" />{saving ? "Salvando..." : "Salvar configurações"}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
}
