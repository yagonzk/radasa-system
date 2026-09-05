import { motoristaDaViagemParaPlaca } from "../server/services/multas-match.js";

function expectEqual(actual: unknown, expected: unknown, label: string) {
  if (actual !== expected) throw new Error(`${label}: esperado ${String(expected)}, recebido ${String(actual)}`);
}

const viagens = [
  { placa: "RAT-8F79", motoristaId: "m1" },
  { placa: "RAQ5F96", motoristaId: "m2" },
];
expectEqual(motoristaDaViagemParaPlaca(viagens, "RAT8F79"), "m1", "placa deve ignorar hifen");
expectEqual(motoristaDaViagemParaPlaca(viagens, "raq-5f96"), "m2", "placa deve ignorar caixa");
expectEqual(motoristaDaViagemParaPlaca(viagens, "ABC1D23"), null, "sem viagem deve retornar null");
console.log("regressao multas-motorista: ok");
