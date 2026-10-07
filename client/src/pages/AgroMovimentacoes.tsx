import { ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine, ClipboardList, History, SlidersHorizontal } from "lucide-react";
import AgroLayout from "@/components/agro/AgroLayout";
import AgroSectionPlaceholder from "@/components/agro/AgroSectionPlaceholder";

export default function AgroMovimentacoes() {
  return <AgroLayout><AgroSectionPlaceholder eyebrow="Agro / Movimentações" title="Movimentações de estoque" description="Área destinada aos lançamentos que alteram o estoque. O saldo será consequência das movimentações, nunca um número editado diretamente." items={[
    { title: "Entrada", description: "Recebimento e compra de produtos para o barracão.", icon: <ArrowDownToLine className="h-5 w-5" /> },
    { title: "Saída", description: "Retirada de produtos, com responsável e destino quando aplicável.", icon: <ArrowUpFromLine className="h-5 w-5" /> },
    { title: "Ajuste", description: "Correção por inventário, perda, quebra ou divergência física.", icon: <SlidersHorizontal className="h-5 w-5" /> },
    { title: "Transferência", description: "Estrutura preparada para movimentação futura entre locais de estoque.", icon: <ArrowLeftRight className="h-5 w-5" /> },
    { title: "Histórico", description: "Rastreabilidade cronológica de todas as alterações de saldo.", icon: <History className="h-5 w-5" /> },
    { title: "Responsável", description: "Registro informativo de quem retirou, entregou ou recebeu o material.", icon: <ClipboardList className="h-5 w-5" /> },
  ]} /></AgroLayout>;
}
