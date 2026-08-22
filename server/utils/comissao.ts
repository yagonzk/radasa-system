function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function valorComissaoPorDestino(input: {
  cidade: unknown;
  uf?: unknown;
  valorLegado?: unknown;
}) {
  const cidade = normalizeText(input.cidade)
    .replace(/\s*[/,\-]\s*[A-Z]{2}\s*$/, "")
    .trim();
  const uf = normalizeText(input.uf);
  const valorLegado = Number(input.valorLegado ?? 0);

  // Regra oficial do módulo de Comissões:
  // 1) Colniza: R$ 350,00
  // 2) Qualquer município do Pará: R$ 300,00
  // 3) Demais destinos: R$ 275,00
  if (cidade === "COLNIZA") return 350;
  if (uf === "PA") return 300;

  // Compatibilidade com locais antigos: antes desta versão não existia UF.
  // Como a nova regra reserva R$ 300,00 para o Pará, um local legado já
  // cadastrado com R$ 300,00 continua classificado como Pará até ser editado.
  if (!uf && Math.abs(valorLegado - 300) < 0.005) return 300;

  return 275;
}
