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
  abaixoMinimo: boolean;
  semEstoque: boolean;
  lotesAtivos: number;
  proximaValidade: string | null;
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

export type AgroMovementType = "ENTRADA" | "SAIDA" | "AJUSTE_ENTRADA" | "AJUSTE_SAIDA";

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
  return "Ajuste -";
}

export function movementIsExit(type: AgroMovementType) {
  return type === "SAIDA" || type === "AJUSTE_SAIDA";
}
