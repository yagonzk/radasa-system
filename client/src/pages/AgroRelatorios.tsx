import { BarChart3, Boxes, CalendarRange, History, MapPinned, PackageSearch } from "lucide-react";
import AgroLayout from "@/components/agro/AgroLayout";
import AgroSectionPlaceholder from "@/components/agro/AgroSectionPlaceholder";

export default function AgroRelatorios() {
  return <AgroLayout><AgroSectionPlaceholder eyebrow="Agro / Relatórios" title="Relatórios Agro" description="Área gerencial para acompanhar estoque, consumo e lavouras sem misturar dados operacionais do TMS." items={[
    { title: "Estoque atual", description: "Posição consolidada por produto, lote, categoria e local.", icon: <Boxes className="h-5 w-5" /> },
    { title: "Movimentações", description: "Entradas, saídas e ajustes por período e responsável.", icon: <History className="h-5 w-5" /> },
    { title: "Consumo por produto", description: "Quantidade utilizada e evolução de consumo dos insumos.", icon: <PackageSearch className="h-5 w-5" /> },
    { title: "Consumo por fazenda", description: "Uso de produtos separado por propriedade e talhão.", icon: <MapPinned className="h-5 w-5" /> },
    { title: "Consumo por safra", description: "Análise das movimentações e operações por ciclo agrícola.", icon: <CalendarRange className="h-5 w-5" /> },
    { title: "Indicadores", description: "Base para custo por hectare e demais indicadores quando os custos forem alimentados.", icon: <BarChart3 className="h-5 w-5" /> },
  ]} /></AgroLayout>;
}
