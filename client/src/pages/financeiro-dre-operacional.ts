export type DreAnaliseRow = {
  id: string;
  nome: string;
  receita: number;
  despesa: number;
  resultado: number;
  margem: number;
  viagens: number;
  distanciaKm: number;
  custoKm: number;
  lucroKm: number;
};

export type DreAnalise = {
  resumo: { receita: number; despesa: number; resultado: number; margem: number; viagens: number };
  porVeiculo: DreAnaliseRow[];
  porCliente: DreAnaliseRow[];
  porViagem: unknown[];
  custosPorVeiculo?: {
    id: string;
    placa: string;
    total: number;
    categorias: { categoria: string; valor: number }[];
  }[];
};

export type DreOperacionalLinha = {
  id: string;
  label: string;
  tipo: "moeda" | "numero" | "percentual";
  valores: Map<string, number>;
  total: number;
  destaque?: "positivo" | "resultado" | "custo";
};

export type DreOperacional = {
  placas: DreAnaliseRow[];
  linhas: DreOperacionalLinha[];
  categorias: string[];
  totais: {
    receita: number;
    despesa: number;
    resultado: number;
    margem: number;
    viagens: number;
    distanciaKm: number;
    custoKm: number;
    lucroKm: number;
  };
  insights: {
    melhorResultado: DreAnaliseRow | null;
    piorResultado: DreAnaliseRow | null;
    maiorMargem: DreAnaliseRow | null;
    maiorCustoKm: DreAnaliseRow | null;
  };
};

const number = (value: unknown) => Number(value || 0);

const normalizeKey = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase();

export function buildDreOperacional(analise: DreAnalise | null | undefined): DreOperacional {
  const placas = [...(analise?.porVeiculo ?? [])]
    .map((row) => ({
      ...row,
      receita: number(row.receita),
      despesa: number(row.despesa),
      resultado: number(row.resultado),
      margem: number(row.margem),
      viagens: number(row.viagens),
      distanciaKm: number(row.distanciaKm),
      custoKm: number(row.custoKm),
      lucroKm: number(row.lucroKm),
    }))
    .filter((row) => [row.receita, row.despesa, row.resultado].some((value) => number(value) !== 0))
    .sort((a, b) => b.resultado - a.resultado || String(a.nome).localeCompare(String(b.nome), "pt-BR", { numeric: true }));

  const custosPorPlaca = new Map<string, Map<string, number>>();

  for (const item of analise?.custosPorVeiculo ?? []) {
    const keys = new Set([item.id, item.placa, normalizeKey(item.placa)].filter(Boolean).map(String));
    const categorias = new Map<string, number>();

    for (const categoria of item.categorias ?? []) {
      const valor = number(categoria.valor);
      categorias.set(categoria.categoria, valor);
    }

    for (const key of keys) {
      custosPorPlaca.set(key, categorias);
    }
  }

  const valoresPorPlaca = (pick: (placa: DreAnaliseRow) => number) =>
    new Map(placas.map((placa) => [placa.id, pick(placa)]));

  const total = (pick: (placa: DreAnaliseRow) => number) => placas.reduce((sum, placa) => sum + pick(placa), 0);
  const receita = total((placa) => placa.receita);
  const despesa = total((placa) => placa.despesa);
  const resultado = receita - despesa;
  const distanciaKm = total((placa) => placa.distanciaKm);
  const viagens = total((placa) => placa.viagens);

  const categoriaValor = (placa: DreAnaliseRow, aliases: string[]) => {
    const custo = custosPorPlaca.get(placa.id) ?? custosPorPlaca.get(placa.nome) ?? custosPorPlaca.get(normalizeKey(placa.nome));
    const aliasSet = new Set(aliases);
    let sum = 0;

    for (const [categoria, valor] of custo ?? []) {
      if (aliasSet.has(normalizeKey(categoria))) sum += number(valor);
    }

    return sum;
  };

  const linhaMoeda = (
    id: string,
    label: string,
    pick: (placa: DreAnaliseRow) => number,
    destaque?: DreOperacionalLinha["destaque"],
  ): DreOperacionalLinha => {
    const valores = valoresPorPlaca(pick);
    return {
      id,
      label,
      tipo: "moeda",
      valores,
      total: Array.from(valores.values()).reduce((sum, valor) => sum + valor, 0),
      destaque,
    };
  };

  const custoConhecido = (placa: DreAnaliseRow) => {
    const diaria = categoriaValor(placa, ["DIARIA", "DIARIAS"]);
    const chapa = categoriaValor(placa, ["CHAPA", "CHAPAS"]);
    const comissao = categoriaValor(placa, ["COMISSAO", "COMISSOES"]);
    const diesel = categoriaValor(placa, ["DIESEL", "ARLA", "ABASTECIMENTO", "COMBUSTIVEL"]);
    const pedagio = categoriaValor(placa, ["PEDAGIO", "PEDAGIOS"]);
    const manutencao = categoriaValor(placa, ["MANUTENCAO", "MANUTENCOES"]);
    const pneus = categoriaValor(placa, ["PNEU", "PNEUS", "RECAPAGEM", "CONSERTODEPNEUS"]);
    const documentacao = categoriaValor(placa, ["IPVA", "LICENCIAMENTO", "SEGURO"]);
    const multas = categoriaValor(placa, ["MULTA", "MULTAS"]);
    return { diaria, chapa, comissao, diesel, pedagio, manutencao, pneus, documentacao, multas };
  };

  const linhas: DreOperacionalLinha[] = [
    linhaMoeda("receita", "Receita", (placa) => placa.receita, "positivo"),
    linhaMoeda("diaria", "Diária", (placa) => custoConhecido(placa).diaria, "custo"),
    linhaMoeda("chapa", "Chapa", (placa) => custoConhecido(placa).chapa, "custo"),
    linhaMoeda("comissao", "Comissão", (placa) => custoConhecido(placa).comissao, "custo"),
    linhaMoeda("diesel", "Diesel + ARLA", (placa) => custoConhecido(placa).diesel, "custo"),
    linhaMoeda("pedagio", "Pedágio", (placa) => custoConhecido(placa).pedagio, "custo"),
    linhaMoeda("manutencao", "Manutenção", (placa) => custoConhecido(placa).manutencao, "custo"),
    linhaMoeda("pneus", "Pneus", (placa) => custoConhecido(placa).pneus, "custo"),
    linhaMoeda("documentacao", "Documentação", (placa) => custoConhecido(placa).documentacao, "custo"),
    linhaMoeda("multas", "Multas", (placa) => custoConhecido(placa).multas, "custo"),
    linhaMoeda("outros", "Outros", (placa) => {
      const custos = custoConhecido(placa);
      const classificados = Object.values(custos).reduce((sum, valor) => sum + valor, 0);
      return Math.max(0, placa.despesa - classificados);
    }, "custo"),
    linhaMoeda("custo-total", "Custo total", (placa) => placa.despesa, "custo"),
  ];

  const byMax = (pick: (placa: DreAnaliseRow) => number) =>
    placas.reduce<DreAnaliseRow | null>((best, placa) => (!best || pick(placa) > pick(best) ? placa : best), null);
  const byMin = (pick: (placa: DreAnaliseRow) => number) =>
    placas.reduce<DreAnaliseRow | null>((worst, placa) => (!worst || pick(placa) < pick(worst) ? placa : worst), null);

  return {
    placas,
    linhas,
    categorias: ["Diária", "Chapa", "Comissão", "Diesel + ARLA", "Pedágio", "Manutenção", "Pneus", "Documentação", "Multas", "Outros"],
    totais: {
      receita,
      despesa,
      resultado,
      margem: receita > 0 ? (resultado / receita) * 100 : 0,
      viagens,
      distanciaKm,
      custoKm: distanciaKm > 0 ? despesa / distanciaKm : 0,
      lucroKm: distanciaKm > 0 ? resultado / distanciaKm : 0,
    },
    insights: {
      melhorResultado: byMax((placa) => placa.resultado),
      piorResultado: byMin((placa) => placa.resultado),
      maiorMargem: byMax((placa) => placa.margem),
      maiorCustoKm: byMax((placa) => placa.custoKm),
    },
  };
}
