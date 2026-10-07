export type AgroProduct = {
  id: string;
  codigo: string;
  nome: string;
  categoria: string;
  fabricante: string;
  unidadeMedida: string;
  estoqueMinimo: number;
  localizacao: string;
  controlaLote: boolean;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AgroStockRow = {
  produto: AgroProduct;
  estoque: number;
  custoMedio: number;
  valorEstoque: number;
  abaixoMinimo: boolean;
  semEstoque: boolean;
  lotesAtivos: number;
  proximaValidade: string | null;
};

export type AgroStockLocation = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string;
  ativo: boolean;
  principal: boolean;
  createdAt: string;
  updatedAt: string;
};


export type AgroStoragePosition = {
  id: string;
  localId: string;
  codigo: string;
  nome: string;
  setor: string;
  tipo: string;
  linha: number;
  coluna: number;
  observacoes: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  local?: AgroStockLocation;
};

export type AgroPositionStockItem = {
  produto: AgroProduct;
  lote?: AgroLot | null;
  quantidade: number;
  custoMedio: number;
  valorEstoque: number;
};

export type AgroStorageMapPosition = AgroStoragePosition & { itens: AgroPositionStockItem[] };
export type AgroStorageMap = {
  local: AgroStockLocation;
  linhas: number;
  colunas: number;
  posicoes: AgroStorageMapPosition[];
  semPosicao: AgroPositionStockItem[];
};

export type AgroLot = {
  id: string;
  produtoId: string;
  codigo: string;
  validade: string | null;
  localizacao: string;
  observacoes: string;
  ativo: boolean;
  saldo?: number;
};

export type AgroMovementType = "ENTRADA" | "SAIDA" | "AJUSTE_ENTRADA" | "AJUSTE_SAIDA" | "TRANSFERENCIA_ENTRADA" | "TRANSFERENCIA_SAIDA" | "INVENTARIO_ENTRADA" | "INVENTARIO_SAIDA";

export type AgroMovement = {
  id: string;
  produtoId: string;
  loteId: string | null;
  tipo: AgroMovementType;
  quantidade: number;
  valorUnitario: number;
  data: string;
  responsavel: string;
  destino: string;
  documento: string;
  observacoes: string;
  createdAt: string;
  produto: AgroProduct;
  lote?: AgroLot | null;
  createdBy?: { id: string; name: string; username: string } | null;
  agroOperacaoId?: string | null;
  transferenciaId?: string | null;
  inventarioId?: string | null;
  localId: string;
  local?: AgroStockLocation | null;
  posicaoId?: string | null;
  posicao?: AgroStoragePosition | null;
};

export function formatAgroNumber(value: number, maximumFractionDigits = 3) {
  return Number(value || 0).toLocaleString("pt-BR", { maximumFractionDigits });
}

export function formatAgroDate(value?: string | null) {
  if (!value) return "—";
  const [year, month, day] = value.slice(0, 10).split("-");
  return year && month && day ? `${day}/${month}/${year}` : value;
}

export function movementLabel(type: AgroMovementType) {
  if (type === "ENTRADA") return "Entrada";
  if (type === "SAIDA") return "Saída";
  if (type === "AJUSTE_ENTRADA") return "Ajuste +";
  if (type === "AJUSTE_SAIDA") return "Ajuste -";
  if (type === "TRANSFERENCIA_ENTRADA") return "Transferência +";
  if (type === "TRANSFERENCIA_SAIDA") return "Transferência -";
  if (type === "INVENTARIO_ENTRADA") return "Inventário +";
  return "Inventário -";
}

export function movementIsExit(type: AgroMovementType) {
  return type === "SAIDA" || type === "AJUSTE_SAIDA" || type === "TRANSFERENCIA_SAIDA" || type === "INVENTARIO_SAIDA";
}

export type AgroTransfer = {
  id: string; produtoId: string; loteId: string | null; localOrigemId: string; localDestinoId: string; posicaoOrigemId?: string | null; posicaoDestinoId?: string | null; quantidade: number; valorUnitario: number; data: string; responsavel: string; documento: string; observacoes: string; createdAt: string;
  produto: AgroProduct; lote?: AgroLot | null; localOrigem: AgroStockLocation; localDestino: AgroStockLocation; posicaoOrigem?: AgroStoragePosition | null; posicaoDestino?: AgroStoragePosition | null;
};

export type AgroInventoryStatus = "ABERTO" | "FINALIZADO" | "CANCELADO";
export type AgroInventoryItem = { id: string; inventarioId: string; produtoId: string; loteId: string | null; posicaoId?: string | null; saldoSistema: number; contagemFisica: number; diferenca: number; custoUnitario: number; produto: AgroProduct; lote?: AgroLot | null; posicao?: AgroStoragePosition | null; };
export type AgroInventory = { id: string; localId: string; data: string; status: AgroInventoryStatus; descricao: string; observacoes: string; finalizadoEm: string | null; createdAt: string; updatedAt: string; local: AgroStockLocation; itens?: AgroInventoryItem[]; _count?: { itens: number }; };

export type AgroReportGroup = { id: string; label: string; custo: number; quantidade: number; areaHa: number; custoPorHa: number; };
export type AgroReport = {
  periodo: { from: string; to: string };
  resumo: { valorEstoqueAtual: number; entradasValor: number; consumoValor: number; ajustesValor: number; custoPorHa: number; areaHa: number; movimentacoes: number; operacoes: number };
  estoque: Array<{ produto: AgroProduct; estoque: number; custoMedio: number; valorEstoque: number; abaixoMinimo: boolean; proximaValidade: string | null }>;
  consumoPorProduto: AgroReportGroup[]; consumoPorFazenda: AgroReportGroup[]; consumoPorTalhao: AgroReportGroup[]; consumoPorSafra: AgroReportGroup[]; consumoPorCultura: AgroReportGroup[]; consumoPorOperacao: AgroReportGroup[];
  mensal: Array<{ mes: string; entradas: number; consumo: number; ajustes: number }>;
  consumos: Array<any>;
};

export function formatAgroCurrency(value: number) { return Number(value || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }); }

export type AgroFarm = {
  id: string;
  nome: string;
  cidade: string;
  uf: string;
  areaTotalHa: number;
  observacoes: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { talhoes: number };
};

export type AgroPlot = {
  id: string;
  fazendaId: string;
  nome: string;
  areaHa: number;
  observacoes: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  fazenda?: AgroFarm;
  _count?: { lavouras: number };
};

export type AgroSeason = {
  id: string;
  nome: string;
  dataInicio: string | null;
  dataFim: string | null;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { lavouras: number };
};

export type AgroCrop = {
  id: string;
  nome: string;
  ativo: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { lavouras: number };
};

export type AgroCropCycleStatus = "PLANEJADA" | "EM_ANDAMENTO" | "CONCLUIDA";

export type AgroCropCycle = {
  id: string;
  talhaoId: string;
  safraId: string;
  culturaId: string;
  areaHa: number;
  status: AgroCropCycleStatus;
  dataPlantio: string | null;
  dataPrevisaoColheita: string | null;
  observacoes: string;
  createdAt: string;
  updatedAt: string;
  talhao: AgroPlot;
  safra: AgroSeason;
  cultura: AgroCrop;
  _count?: { operacoes: number };
};

export type AgroOperationType = "PLANTIO" | "ADUBACAO" | "PULVERIZACAO" | "APLICACAO" | "MONITORAMENTO" | "COLHEITA" | "OUTROS";

export type AgroOperation = {
  id: string;
  lavouraId: string;
  tipo: AgroOperationType;
  data: string;
  areaHa: number;
  responsavel: string;
  documento: string;
  observacoes: string;
  createdAt: string;
  lavoura: AgroCropCycle;
  movimentacoes: AgroMovement[];
  createdBy?: { id: string; name: string; username: string } | null;
};

export function agroCropCycleStatusLabel(status: AgroCropCycleStatus) {
  if (status === "PLANEJADA") return "Planejada";
  if (status === "EM_ANDAMENTO") return "Em andamento";
  return "Concluída";
}

export function agroOperationLabel(type: AgroOperationType) {
  if (type === "PLANTIO") return "Plantio";
  if (type === "ADUBACAO") return "Adubação";
  if (type === "PULVERIZACAO") return "Pulverização";
  if (type === "APLICACAO") return "Aplicação";
  if (type === "MONITORAMENTO") return "Monitoramento";
  if (type === "COLHEITA") return "Colheita";
  return "Outros";
}
