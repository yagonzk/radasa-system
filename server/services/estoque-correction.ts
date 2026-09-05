export type MovimentoEstoqueTipo = "ENTRADA" | "SAIDA";

export function saldoAposCorrecao(saldoSemMovimento: number, tipo: MovimentoEstoqueTipo, quantidade: number) {
  return saldoSemMovimento + (tipo === "ENTRADA" ? quantidade : -quantidade);
}

export function podeAplicarCorrecao(saldoSemMovimento: number, tipo: MovimentoEstoqueTipo, quantidade: number) {
  return saldoAposCorrecao(saldoSemMovimento, tipo, quantidade) >= -1e-9;
}
