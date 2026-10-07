import { Link } from "wouter";
import { ArrowRight, BarChart3, Boxes, ClipboardList, Leaf, Sprout, Warehouse } from "lucide-react";
import AgroLayout from "@/components/agro/AgroLayout";
import { Card, CardContent } from "@/components/ui/card";

const quickLinks = [
  { title: "Estoque", description: "Produtos, lotes, saldos e alertas do barracão.", href: "/agro/estoque", icon: Warehouse },
  { title: "Movimentações", description: "Entradas, saídas, ajustes e histórico de estoque.", href: "/agro/movimentacoes", icon: ClipboardList },
  { title: "Lavouras", description: "Fazendas, talhões, safras e operações agrícolas.", href: "/agro/lavouras", icon: Sprout },
  { title: "Relatórios", description: "Consumo, estoque, lavouras e indicadores gerenciais.", href: "/agro/relatorios", icon: BarChart3 },
];

export default function AgroHome() {
  return (
    <AgroLayout>
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary"><Leaf className="h-4 w-4" />Radasa Agro</div>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Dashboard Agro</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">Ponto central do ambiente agrícola. Nesta etapa a navegação está pronta; os indicadores serão alimentados quando estoque e lavouras forem implementados.</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {["Estoque atual", "Estoque baixo", "Saídas do mês", "Lavouras em andamento"].map((label) => (
            <Card key={label} className="border-border/70">
              <CardContent className="p-5">
                <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
                <div className="mt-3 text-2xl font-bold text-muted-foreground/50">—</div>
                <div className="mt-1 text-xs text-muted-foreground">Aguardando dados do módulo Agro</div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div>
          <h2 className="text-base font-semibold">Acesso rápido</h2>
          <div className="mt-3 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {quickLinks.map(({ title, description, href, icon: Icon }) => (
              <Link key={href} href={href} className="group rounded-xl border bg-card p-5 transition hover:border-primary/30 hover:bg-accent/20">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></div>
                  <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-primary" />
                </div>
                <div className="mt-4 font-semibold">{title}</div>
                <p className="mt-1 text-sm leading-5 text-muted-foreground">{description}</p>
              </Link>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-dashed bg-muted/20 p-4">
          <div className="flex items-start gap-3">
            <Boxes className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-semibold">Etapa 3: estrutura do ambiente</div>
              <p className="mt-1 text-sm leading-6 text-muted-foreground">Nenhum saldo, produto ou movimentação do Transportes é reutilizado aqui. O banco funcional do Agro será criado na etapa de Estoque.</p>
            </div>
          </div>
        </div>
      </div>
    </AgroLayout>
  );
}
