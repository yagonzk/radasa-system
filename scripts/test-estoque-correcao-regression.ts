import { saldoAposCorrecao, podeAplicarCorrecao } from "../server/services/estoque-correction.js";

function expectEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: esperado ${String(expected)}, recebido ${String(actual)}`);
}

expectEqual(saldoAposCorrecao(8, "SAIDA", 8), 0, "entrada errada 8 corrigida para saida 8");
expectEqual(saldoAposCorrecao(8, "ENTRADA", 8), 16, "entrada adiciona ao saldo base");
expectEqual(podeAplicarCorrecao(8, "SAIDA", 9), false, "saida acima do saldo base e bloqueada");
expectEqual(podeAplicarCorrecao(8, "SAIDA", 8), true, "saida igual ao saldo base e permitida");

console.log("regressao estoque-correcao: ok");
