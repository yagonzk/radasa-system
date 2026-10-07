import { CalendarRange, Map, MapPinned, Sprout, Tractor, Wheat } from "lucide-react";
import AgroLayout from "@/components/agro/AgroLayout";
import AgroSectionPlaceholder from "@/components/agro/AgroSectionPlaceholder";

export default function AgroLavouras() {
  return <AgroLayout><AgroSectionPlaceholder eyebrow="Agro / Lavouras" title="Gestão de lavouras" description="Organização agrícola por fazenda, talhão e safra, com histórico das operações realizadas em cada área." items={[
    { title: "Fazendas", description: "Estrutura principal das propriedades administradas no módulo Agro.", icon: <MapPinned className="h-5 w-5" /> },
    { title: "Talhões", description: "Divisão das áreas com identificação e tamanho em hectares.", icon: <Map className="h-5 w-5" /> },
    { title: "Safras", description: "Separação das informações por ciclo e período agrícola.", icon: <CalendarRange className="h-5 w-5" /> },
    { title: "Culturas", description: "Soja, milho e outras culturas vinculadas às áreas e safras.", icon: <Wheat className="h-5 w-5" /> },
    { title: "Operações", description: "Plantio, aplicação, adubação, pulverização, monitoramento e colheita.", icon: <Tractor className="h-5 w-5" /> },
    { title: "Consumo por área", description: "Preparado para vincular produtos utilizados às operações e talhões.", icon: <Sprout className="h-5 w-5" /> },
  ]} /></AgroLayout>;
}
