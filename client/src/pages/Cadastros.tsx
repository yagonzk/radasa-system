import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link, useLocation, useRoute } from "wouter";
import { useEffect } from "react";
import { getResourceCollection } from "@/lib/api";
import MotoristaTab from "@/components/cadastros/MotoristaTab";
import ChapaTab from "@/components/cadastros/ChapaTab";
import ClienteTab from "@/components/cadastros/ClienteTab";
import ProdutoTab from "@/components/cadastros/ProdutoTab";
import LocaisTab from "@/components/cadastros/LocaisTab";
import VeiculoTab from "@/components/cadastros/VeiculoTab";
import EmpresaTab from "@/components/cadastros/EmpresaTab";

export default function Cadastros() {
  const [match, params] = useRoute("/cadastros/:tab");
  const activeTab = match ? params.tab : "motoristas";
  const [, navigate] = useLocation();

  useEffect(() => {
    // A aba visível carrega normalmente. Logo depois, aquecemos em background os
    // demais cadastros para que trocar entre Clientes/Produtos/Veículos/etc. seja
    // praticamente instantâneo, sem bloquear a primeira pintura da página.
    const timer = window.setTimeout(() => {
      void Promise.allSettled(
        ["motoristas", "chapas", "clientes", "produtos", "locais", "veiculos", "empresa"].map(
          (resource) => getResourceCollection(resource, false),
        ),
      );
    }, 250);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <Layout>
      <div className="mx-auto w-full min-w-0 max-w-6xl">
        <div className="mb-6">
          <h1 className="font-display text-2xl font-bold text-foreground">
            Cadastros
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Cadastros organizados por área para encontrar cada informação com mais rapidez.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={(tab) => navigate(`/cadastros/${tab}`)} className="w-full">
          <TabsList className="grid h-auto w-full grid-cols-1 gap-3 bg-transparent p-0 md:grid-cols-2 xl:grid-cols-4">
            <div className="rounded-xl border bg-card p-3 shadow-sm">
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Frota</p>
              <div className="grid grid-cols-2 gap-1">
                <TabsTrigger value="veiculos">Veículos</TabsTrigger>
                <Link href="/pneus" className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground transition hover:bg-muted hover:text-foreground">Pneus</Link>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-3 shadow-sm">
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Pessoas</p>
              <div className="grid grid-cols-2 gap-1">
                <TabsTrigger value="motoristas">Motoristas</TabsTrigger>
                <TabsTrigger value="chapas">Chapas</TabsTrigger>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-3 shadow-sm">
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Comercial</p>
              <div className="grid grid-cols-3 gap-1">
                <TabsTrigger value="clientes">Clientes</TabsTrigger>
                <TabsTrigger value="produtos">Produtos</TabsTrigger>
                <TabsTrigger value="empresa">Empresa</TabsTrigger>
              </div>
            </div>
            <div className="rounded-xl border bg-card p-3 shadow-sm">
              <p className="mb-2 px-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">Localidades</p>
              <div className="grid grid-cols-1 gap-1">
                <TabsTrigger value="locais">Cidades / Locais</TabsTrigger>
              </div>
            </div>
          </TabsList>

          <TabsContent value="motoristas" className="mt-6">
            <MotoristaTab />
          </TabsContent>
          <TabsContent value="chapas" className="mt-6">
            <ChapaTab />
          </TabsContent>
          <TabsContent value="clientes" className="mt-6">
            <ClienteTab />
          </TabsContent>
          <TabsContent value="produtos" className="mt-6">
            <ProdutoTab />
          </TabsContent>
          <TabsContent value="locais" className="mt-6">
            <LocaisTab />
          </TabsContent>
          <TabsContent value="veiculos" className="mt-6">
            <VeiculoTab />
          </TabsContent>
          <TabsContent value="empresa" className="mt-6">
            <EmpresaTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
