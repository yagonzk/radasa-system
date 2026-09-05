import { describe, expect, it } from "vitest";
import { formatFechamentoViagemLabel } from "./fechamentoViagem";

describe("formatFechamentoViagemLabel", () => {
  it("exibe a data real da viagem antes do destino", () => {
    expect(formatFechamentoViagemLabel("2026-08-18", "Lucas do Rio Verde")).toBe("18/08/2026 - Lucas do Rio Verde");
  });

  it("mantem somente o destino em registros antigos sem data", () => {
    expect(formatFechamentoViagemLabel(undefined, "Lucas do Rio Verde")).toBe("Lucas do Rio Verde");
  });
});
