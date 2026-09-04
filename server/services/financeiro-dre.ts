const normalize = (value: unknown) => String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
const toNumber = (value: unknown) => {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
};

export function maintenanceDreValue(os: { valorPecas?: unknown; valorMaoObra?: unknown; valorOutros?: unknown; desconto?: unknown }) {
  return Math.max(0, toNumber(os.valorMaoObra) + toNumber(os.valorOutros) - toNumber(os.desconto));
}

export function isGeneratedMaintenanceEntry(
  entry: { categoria?: unknown; numeroDocumento?: unknown },
  osNumbers: Set<string>,
) {
  return normalize(entry.categoria) === "MANUTENCAO" && osNumbers.has(String(entry.numeroDocumento || ""));
}
