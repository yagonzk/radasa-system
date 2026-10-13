import { type ReactNode, useCallback, useEffect, useState } from "react";
import { ArrowRight, Boxes, Leaf, RefreshCw, Truck } from "lucide-react";
import { Link } from "wouter";
import AdminLayout from "@/components/admin/AdminLayout";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { api } from "@/lib/api";

type Summary = {
  cadastros: {
    transportes: { motoristas: number; clientes: number; fornecedores: number; produtos: number; veiculos: number; empresas: number };
    agro: { produtos: number; fazendas: number; talhoes: number; lavouras: number; barracoes: number };
  };
};

type DataItem = { label: string; value: number; href: string; description: string };

function DataSection({ title, badge, icon, items }: { title: string; badge: string; icon: ReactNode; items: DataItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-base">{icon}{title}</CardTitle>
          <Badge variant="outline">{badge}</Badge>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <Link key={item.label} href={item.href} className="group rounded-xl border bg-muted/10 p-4 transition hover:border-primary/30 hover:bg-accent/30">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="mt-1 text-xs leading-5 text-muted-foreground">{item.description}</div>
              </div>
              <div className="shrink-0 text-xl font-bold tabular-nums">{item.value.toLocaleString("pt-BR")}</div>
            </div>
            <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary">Abrir cadastro <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" /></div>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default function AdminCadastros() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Summary>("/admin/resumo");
      setSummary(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const t = summary?.cadastros.transportes;
  const a = summary?.cadastros.agro;

  return (
    <AdminLayout>
      <div className="space-y-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold text-primary"><Boxes className="h-4 w-4" /> Dados da plataforma</div>
            <h1 className="mt-1 text-2xl font-bold">Cadastros e dados</h1>
            <p className="mt-1 text-sm text-muted-foreground">Central administrativa para consultar volumes e acessar a origem correta de cada cadastro.</p>
          </div>
          <Button variant="outline" onClick={() => void load()} disabled={loading}><RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Atualizar</Button>
        </div>

        <div className="rounded-xl border bg-muted/20 p-4 text-sm text-muted-foreground">
          Os cadastros operacionais continuam sendo editados dentro do módulo responsável. Esta central evita duplicar regras: aqui você supervisiona os dados e abre diretamente a tela oficial de manutenção.
        </div>

        <DataSection
          title="Transportes"
          badge="TMS"
          icon={<Truck className="h-4 w-4 text-primary" />}
          items={[
            { label: "Veículos", value: t?.veiculos ?? 0, href: "/cadastros/veiculos", description: "Frota, documentos e dados dos veículos." },
            { label: "Motoristas", value: t?.motoristas ?? 0, href: "/cadastros/motoristas", description: "Motoristas e vínculos operacionais." },
            { label: "Clientes", value: t?.clientes ?? 0, href: "/cadastros/clientes", description: "Clientes utilizados em romaneios e BI." },
            { label: "Produtos", value: t?.produtos ?? 0, href: "/cadastros/produtos", description: "Produtos do domínio de Transportes." },
            { label: "Fornecedores", value: t?.fornecedores ?? 0, href: "/cadastros/fornecedores", description: "Fornecedores do TMS e financeiro." },
            { label: "Empresas", value: t?.empresas ?? 0, href: "/cadastros/empresa", description: "Empresas, filiais e configuração fiscal." },
          ]}
        />

        <DataSection
          title="Agro"
          badge="Gestão agrícola"
          icon={<Leaf className="h-4 w-4 text-primary" />}
          items={[
            { label: "Produtos Agro", value: a?.produtos ?? 0, href: "/agro/estoque", description: "Produtos, lotes, estoque mínimo e custos." },
            { label: "Fazendas", value: a?.fazendas ?? 0, href: "/agro/cadastros", description: "Propriedades utilizadas nas lavouras." },
            { label: "Talhões", value: a?.talhoes ?? 0, href: "/agro/cadastros", description: "Áreas produtivas vinculadas às fazendas." },
            { label: "Lavouras", value: a?.lavouras ?? 0, href: "/agro/lavouras", description: "Safras, culturas e operações agrícolas." },
            { label: "Barracões", value: a?.barracoes ?? 0, href: "/agro/inventario", description: "Locais físicos de estoque e inventários." },
          ]}
        />
      </div>
    </AdminLayout>
  );
}
