import type { Fechamento, Local, Viagem, ViagemFechamento } from "./store";

function normalizeCidade(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s*[/,\-]\s*[A-Z]{2}\s*$/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatDateOnly(data: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(data);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : data;
}

export function formatFechamentoViagemLabel(data: string | undefined | null, cidade: string) {
  return data ? `${formatDateOnly(data)} - ${cidade}` : cidade;
}

export interface ViagemFechamentoExibicao extends ViagemFechamento {
  dataViagem?: string;
  cidade: string;
}

export function expandirViagensFechamento(
  fechamento: Pick<Fechamento, "motoristaId" | "dataInicio" | "dataFim" | "viagens">,
  viagensCadastradas: Viagem[],
  locais: Local[]
): ViagemFechamentoExibicao[] {
  const candidatas = viagensCadastradas
    .filter((v) =>
      v.motoristaId === fechamento.motoristaId &&
      v.dataManifesto >= fechamento.dataInicio &&
      v.dataManifesto <= fechamento.dataFim
    )
    .sort((a, b) => a.dataManifesto.localeCompare(b.dataManifesto) || String(a.createdAt ?? "").localeCompare(String(b.createdAt ?? "")));

  const usadas = new Set<string>();
  const resultado: ViagemFechamentoExibicao[] = [];

  for (const item of fechamento.viagens) {
    const local = locais.find((l) => l.id === item.localId);
    const cidade = local?.cidade || "—";

    // Fechamentos novos persistem a data real em cada viagem. Nesse caso não
    // precisamos reconstruir nada a partir do Acerto de Viagem.
    if (item.dataViagem) {
      resultado.push({ localId: item.localId, quantidade: 1, dataViagem: item.dataViagem, cidade });
      continue;
    }

    let restantes = Math.max(1, item.quantidade || 1);
    for (const viagem of candidatas) {
      if (restantes <= 0) break;
      if (usadas.has(viagem.id)) continue;
      if (normalizeCidade(viagem.cidadeEntrega) !== normalizeCidade(cidade)) continue;
      usadas.add(viagem.id);
      resultado.push({ localId: item.localId, quantidade: 1, dataViagem: viagem.dataManifesto, cidade });
      restantes -= 1;
    }

    // Compatibilidade com fechamentos antigos: mesmo quando não for possível
    // recuperar a data, cada viagem continua em uma linha individual.
    while (restantes > 0) {
      resultado.push({ localId: item.localId, quantidade: 1, cidade });
      restantes -= 1;
    }
  }

  return resultado;
}
