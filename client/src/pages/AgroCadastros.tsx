import { Building2, MapPinned, Package, Tags, UserRound, Wheat } from "lucide-react";
import AgroLayout from "@/components/agro/AgroLayout";
import AgroSectionPlaceholder from "@/components/agro/AgroSectionPlaceholder";

export default function AgroCadastros() {
  return <AgroLayout><AgroSectionPlaceholder eyebrow="Agro / Cadastros" title="Cadastros do Agro" description="Cadastros próprios do ambiente agrícola. Eles serão independentes dos clientes, produtos e fornecedores do Transportes." items={[
    { title: "Produtos", description: "Insumos agrícolas com unidade, fabricante e estoque mínimo.", icon: <Package className="h-5 w-5" /> },
    { title: "Categorias", description: "Sementes, defensivos, fertilizantes, adjuvantes, peças e outras classes.", icon: <Tags className="h-5 w-5" /> },
    { title: "Fornecedores", description: "Fornecedores utilizados especificamente nas compras do Agro.", icon: <Building2 className="h-5 w-5" /> },
    { title: "Fazendas e talhões", description: "Propriedades e áreas de produção vinculadas às lavouras.", icon: <MapPinned className="h-5 w-5" /> },
    { title: "Culturas e safras", description: "Cadastros necessários para organizar os ciclos produtivos.", icon: <Wheat className="h-5 w-5" /> },
    { title: "Responsáveis", description: "Pessoas como Elton e Tâmioso, apenas para identificação das movimentações, sem login.", icon: <UserRound className="h-5 w-5" /> },
  ]} /></AgroLayout>;
}
