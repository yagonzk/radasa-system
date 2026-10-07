import { AlertTriangle, Boxes, MapPin, PackageSearch, Tags, Warehouse } from "lucide-react";
import AgroLayout from "@/components/agro/AgroLayout";
import AgroSectionPlaceholder from "@/components/agro/AgroSectionPlaceholder";

export default function AgroEstoque() {
  return <AgroLayout><AgroSectionPlaceholder eyebrow="Agro / Estoque" title="Estoque do barracão" description="Visão de produtos e saldos agrícolas. A implementação funcional será feita na próxima etapa com banco próprio do Agro." items={[
    { title: "Saldo por produto", description: "Quantidade disponível por produto e unidade de medida.", icon: <Boxes className="h-5 w-5" /> },
    { title: "Lotes e validade", description: "Controle de lote, vencimento e rastreabilidade dos insumos.", icon: <Tags className="h-5 w-5" /> },
    { title: "Localização", description: "Barracão, setor, prateleira ou posição física do produto.", icon: <MapPin className="h-5 w-5" /> },
    { title: "Estoque mínimo", description: "Alertas para produtos abaixo do nível mínimo definido.", icon: <AlertTriangle className="h-5 w-5" /> },
    { title: "Consulta rápida", description: "Pesquisa por produto, categoria, lote e localização.", icon: <PackageSearch className="h-5 w-5" /> },
    { title: "Inventário", description: "Base preparada para conferência física e ajustes rastreáveis.", icon: <Warehouse className="h-5 w-5" /> },
  ]} /></AgroLayout>;
}
