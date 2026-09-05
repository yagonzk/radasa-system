export const MANUTENCAO_CATEGORIAS = [
  { value: "MOTOR_COMBUSTAO", label: "Motor e Sistema de Combustão", examples: "Diagnóstico de falhas, filtros de ar/óleo/combustível, injeção eletrônica, turbina, intercooler e vazamentos." },
  { value: "TRANSMISSAO_EMBREAGEM", label: "Transmissão e Embreagem", examples: "Caixa de câmbio manual/automática, embreagem, cardan e diferencial." },
  { value: "FREIOS", label: "Sistema de Freios", examples: "Pastilhas, lonas, discos, tambores, ABS/EBS e sistema pneumático: válvulas, mangueiras e moduladores." },
  { value: "SUSPENSAO_DIRECAO", label: "Suspensão e Direção", examples: "Amortecedores, molas/feixes, barras, pivôs, alinhamento e geometria." },
  { value: "ELETRICO_ELETRONICO", label: "Sistema Elétrico e Eletrônico", examples: "Bateria, alternador, chicotes elétricos, sensores, módulos eletrônicos e iluminação." },
  { value: "ARREFECIMENTO", label: "Sistema de Arrefecimento", examples: "Radiador, bomba d’água, mangueiras e válvula termostática." },
  { value: "LUBRIFICACAO", label: "Sistema de Lubrificação", examples: "Troca de óleo, vazamentos e manutenção de bombas e linhas de lubrificação." },
  { value: "ESTRUTURA_CHASSI", label: "Estrutura e Chassi", examples: "Soldas, trincas, reparos estruturais, suportes e coxins." },
  { value: "IMPLEMENTOS_CARROCERIA", label: "Implementos e Carroceria", examples: "Baú, grade baixa, caçamba, basculante e sistemas hidráulicos dos implementos." },
  { value: "PNEUS_RODAS", label: "Pneus e Rodas", examples: "Troca de pneus, balanceamento, recapagem e inspeção de desgaste." },
  { value: "HIDRAULICA", label: "Hidráulica", examples: "Bombas, mangueiras, válvulas e sistemas hidráulicos de basculamento." },
  { value: "ESCAPE", label: "Sistema de Escape", examples: "Silencioso, catalisador, sonda lambda e componentes do sistema de escape." },
  { value: "LIMPEZA_HIGIENIZACAO", label: "Limpeza e Higienização Técnica", examples: "Limpeza de radiador, limpeza do sistema de ar e higienização interna." },
  { value: "PREVENTIVA_PROGRAMADA", label: "Manutenção Preventiva Programada", examples: "Revisão por quilometragem, checklists de rotina e inspeção geral programada." },
  { value: "CORRETIVA_EMERGENCIAL", label: "Manutenção Corretiva / Emergencial", examples: "Pane elétrica, pane mecânica, reparo corretivo e socorro na estrada." },
  { value: "DIAGNOSTICO_TESTES", label: "Diagnóstico e Testes", examples: "Scanner eletrônico, teste de rodagem, teste de compressão e diagnóstico técnico." },
  { value: "SEGURANCA_OBRIGATORIOS", label: "Segurança e Equipamentos Obrigatórios", examples: "Tacógrafo, extintor, cintos e demais itens de inspeção obrigatória." },
] as const;

export type MaintenanceCategory = typeof MANUTENCAO_CATEGORIAS[number]["value"];

export function isMaintenanceCategory(value: string): value is MaintenanceCategory {
  return MANUTENCAO_CATEGORIAS.some((category) => category.value === value);
}

export function maintenanceCategoryExamples(value?: string | null) {
  return MANUTENCAO_CATEGORIAS.find((category) => category.value === value)?.examples || "Selecione uma categoria para ver exemplos do que pertence a ela.";
}

export function maintenanceCategoryLabel(value?: string | null) {
  return MANUTENCAO_CATEGORIAS.find((category) => category.value === value)?.label || "Sem categoria";
}
