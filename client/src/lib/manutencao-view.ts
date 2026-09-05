export type MaintenanceColumnFilters = {
  os?: string;
  dataInicio?: string;
  dataFim?: string;
  veiculo?: string;
  fornecedor?: string;
  tipo?: string;
  problema?: string;
  documentos?: string;
  status?: string;
  custo?: string;
};

export type MaintenanceOrderLike = {
  id: string;
  numero: string;
  numeroFornecedor?: string | null;
  veiculoId: string;
  tipo: string;
  status: string;
  descricao: string;
  responsavel?: string | null;
  fornecedor?: string | null;
  dataAbertura: string;
  valorTotal?: number | null;
  itensCount?: number | null;
  notasCount?: number | null;
  anexosCount?: number | null;
  fornecedorId?: string | null;
  servicoRealizado?: string | null;
  kmAbertura?: number | null;
  desconto?: number | null;
  observacoes?: string | null;
  itens?: Array<{
    id?: string;
    produtoId?: string | null;
    categoria?: string | null;
    tipo: "SERVICO" | "PECA" | "OUTRO";
    descricao: string;
    quantidade: number;
    valorUnitario: number;
  }>;
};

const normalize = (value: unknown) => String(value ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

export function maintenanceTypeLabel(tipo: string) {
  return ({ PREVENTIVA: "Preventiva", CORRETIVA: "Corretiva", EMERGENCIAL: "Emergencial", OUTRA: "Outra" } as Record<string, string>)[tipo] || tipo;
}

export function maintenanceStatusLabel(status: string) {
  return ({ ABERTA: "Aberta", EM_ANDAMENTO: "Em andamento", AGUARDANDO_PECA: "Aguardando peça", CONCLUIDA: "Concluída", CANCELADA: "Cancelada" } as Record<string, string>)[status] || status;
}

function documentsLabel(item: MaintenanceOrderLike) {
  return `${item.itensCount || item.itens?.length || 0} item(ns) · ${item.notasCount || 0} NF · ${item.anexosCount || 0} anexo(s)`;
}

export function filterMaintenanceOrders<T extends MaintenanceOrderLike>(
  rows: T[],
  plate: (id: string) => string,
  query: string,
  filters: MaintenanceColumnFilters,
): T[] {
  const q = normalize(query).trim();
  return rows.filter((item) => {
    const values = {
      os: `${item.numero}${item.numeroFornecedor ? ` · OS forn. ${item.numeroFornecedor}` : ""}`,
      veiculo: plate(item.veiculoId),
      fornecedor: item.fornecedor || "—",
      tipo: maintenanceTypeLabel(item.tipo),
      problema: `${item.descricao || ""}${item.responsavel ? ` · Resp.: ${item.responsavel}` : ""}`,
      documentos: documentsLabel(item),
      status: maintenanceStatusLabel(item.status),
      custo: Number(item.valorTotal || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" }),
    };

    if (q && !normalize(Object.values(values).join(" ")).includes(q)) return false;
    if (filters.dataInicio && item.dataAbertura < filters.dataInicio) return false;
    if (filters.dataFim && item.dataAbertura > filters.dataFim) return false;

    for (const key of ["os", "veiculo", "fornecedor", "tipo", "problema", "documentos", "status", "custo"] as const) {
      const selected = filters[key];
      if (selected && normalize(values[key]) !== normalize(selected)) return false;
    }
    return true;
  });
}

export function maintenanceOrderToForm(item: MaintenanceOrderLike) {
  return {
    veiculoId: item.veiculoId || "",
    tipo: item.tipo || "CORRETIVA",
    status: item.status || "ABERTA",
    dataAbertura: item.dataAbertura || "",
    numeroFornecedor: item.numeroFornecedor || "",
    fornecedorId: item.fornecedorId || "",
    responsavel: item.responsavel || "",
    kmAbertura: item.kmAbertura == null ? "" : String(item.kmAbertura),
    descricao: item.descricao || "",
    servicoRealizado: item.servicoRealizado || "",
    desconto: item.desconto == null ? "" : String(item.desconto),
    observacoes: item.observacoes || "",
    itens: (item.itens || []).map((row) => ({ ...row })),
  };
}
