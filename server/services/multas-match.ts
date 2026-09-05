const normalizePlate = (value: unknown) => String(value ?? "").replace(/[^A-Z0-9]/gi, "").toUpperCase();

export function motoristaDaViagemParaPlaca(viagens: Array<{ placa: string; motoristaId: string }>, placa: string) {
  return viagens.find((viagem) => normalizePlate(viagem.placa) === normalizePlate(placa))?.motoristaId ?? null;
}
